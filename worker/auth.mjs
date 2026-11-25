import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { HttpError, body, json, text } from './http.mjs';

const COOKIE = '__Host-portal_session';
const hashOptions = { N: 16384, r: 8, p: 5, dkLen: 32 };
const hex = bytes => bytesToHex(new Uint8Array(bytes));
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Usá una contraseña de 12 a 128 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `scrypt-v1:${hex(salt)}:${hex(await scryptAsync(password, salt, hashOptions))}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [version, salt, expected] = stored.split(':');
  if (version !== 'scrypt-v1') return false;
  const actual = await scryptAsync(password, hexToBytes(salt), hashOptions);
  const target = hexToBytes(expected);
  let diff = actual.length ^ target.length;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ (target[i] ?? 0);
  return diff === 0;
}
export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, unit: user.unit, role: user.role, status: user.status };
}
function cookieToken(request) {
  return request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}
export async function userFor(request, env) {
  const token = cookieToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.status='approved'`).bind(await digest(token), Date.now()).first();
}
export async function requireUser(request, env, role) {
  const user = await userFor(request, env);
  if (!user) throw new HttpError(401, 'Ingresá a tu cuenta para continuar.');
  if (role && user.role !== role) throw new HttpError(403, 'No tenés permiso para realizar esta acción.');
  return user;
}
export async function rateLimit(env, key, limit = 10, windowMs = 900000) {
  const now = Date.now();
  const row = await env.DB.prepare(`INSERT INTO rate_limits(key,attempts,reset_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,
    reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts`).bind(key, now + windowMs, now, now).first();
  if (row.attempts > limit) throw new HttpError(429, 'Hubo demasiados intentos. Esperá unos minutos y volvé a intentar.');
}
export async function audit(env, user, action, entityId, detail = {}) {
  await env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id,detail) VALUES (?,?,?,?)')
    .bind(user.id, action, entityId, JSON.stringify(detail)).run();
}

export async function authRoute(request, env, path) {
  if (path === '/api/auth/session' && request.method === 'GET') {
    const user = await userFor(request, env);
    return json({ user: user ? publicUser(user) : null });
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = cookieToken(request);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }
  if (path === '/api/auth/register' && request.method === 'POST') {
    await rateLimit(env, `register:${request.headers.get('cf-connecting-ip') || 'local'}`, 5);
    const data = await body(request);
    const name = text(data.name, 80);
    const email = text(data.email, 120).toLowerCase();
    const unit = text(data.unit, 8).toUpperCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Ingresá un email válido.');
    if (!await env.DB.prepare('SELECT id FROM units WHERE id=? AND active=1').bind(unit).first()) throw new HttpError(400, 'Elegí una unidad del edificio.');
    const password = await hashPassword(data.password);
    try {
      await env.DB.prepare("INSERT INTO users(id,name,email,unit,role,password_hash) VALUES (?,?,?,?,'owner',?)")
        .bind(crypto.randomUUID(), name, email, unit, password).run();
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new HttpError(409, 'Ya existe una solicitud para esos datos. Consultá con Administración.');
      throw error;
    }
    return json({ message: 'Solicitud enviada. Administración debe aprobar tu acceso.' }, 201);
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    await rateLimit(env, `login-ip:${request.headers.get('cf-connecting-ip') || 'local'}`, 30);
    const data = await body(request);
    const identity = text(data.identity, 120).toLowerCase();
    await rateLimit(env, `login-id:${await digest(identity)}`, 10);
    const user = await env.DB.prepare(`SELECT * FROM users WHERE status<>'rejected' AND
      ((role='owner' AND lower(unit)=?) OR (role='admin' AND email=?))`).bind(identity, identity).first();
    // Run the same expensive hash for unknown identities to avoid a fast account-existence signal.
    const dummyHash = 'scrypt-v1:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
    const valid = await verifyPassword(data.password, user?.password_hash ?? dummyHash);
    if (!user || !valid) throw new HttpError(401, 'La unidad, email o contraseña no son correctos.');
    if (user.status !== 'approved') throw new HttpError(403, user.status === 'pending' ? 'Tu solicitud está pendiente de aprobación.' : 'Tu acceso está suspendido. Consultá con Administración.');
    const token = randomToken();
    const maxAge = user.role === 'admin' ? 43200 : 604800;
    await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
      .bind(await digest(token), user.id, Date.now() + maxAge * 1000, Date.now()).run();
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}` });
  }
  if (path === '/api/admin/access' && request.method === 'GET') {
    await requireUser(request, env, 'admin');
    const { results } = await env.DB.prepare("SELECT u.id,u.name,u.email,u.unit,u.status,u.created_at,r.requested_at AS recovery_requested_at FROM users u LEFT JOIN recovery_requests r ON r.user_id=u.id AND r.resolved_at IS NULL WHERE u.role='owner' ORDER BY r.requested_at DESC,u.created_at DESC").all();
    return json({ users: results });
  }
  if (path.startsWith('/api/admin/access/') && request.method === 'PATCH') {
    const admin = await requireUser(request, env, 'admin');
    const id = path.slice('/api/admin/access/'.length);
    const data = await body(request);
    if (!['approved','rejected','suspended'].includes(data.status)) throw new HttpError(400, 'Estado inválido.');
    const target = await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='owner'").bind(id).first();
    if (!target) throw new HttpError(404, 'No se encontró la solicitud.');
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(data.status, id),
      env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id,detail) VALUES (?,?,?,?)').bind(admin.id, 'access.status', id, JSON.stringify({ status: data.status })),
    ]);
    return json({ ok: true });
  }
  return null;
}
