import { requireUser, rateLimit, audit, verifyPassword } from './auth.mjs';
import { authProvider, firebaseAuthenticate, firebaseInviteIdentity, firebaseSendPasswordEmail } from './firebase.mjs';
import { body, text, json, HttpError } from './http.mjs';

export async function administratorsRoute(request, env, path) {
  if (!path.startsWith('/api/admin/administrators')) return null;
  const admin = await requireUser(request, env, 'admin');
  if (path === '/api/admin/administrators' && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT u.id,u.name,u.email,u.username,u.status,i.expires_at,i.email_sent_at FROM users u LEFT JOIN admin_invitations i ON i.user_id=u.id WHERE u.role='admin' ORDER BY u.created_at").all();
    return json({ users: results });
  }
  const data = await body(request);
  await rateLimit(env, `admin-management:${admin.id}`, 10);
  try {
    if (authProvider(env) === 'firebase') await firebaseAuthenticate(env, admin, data.password);
    else if (!await verifyPassword(data.password, admin.password_hash)) throw new HttpError(401, 'Contraseña incorrecta.');
  } catch (error) { if (error.status === 401) throw new HttpError(403, 'Revisá tu contraseña de administración.'); throw error; }

  if (path === '/api/admin/administrators' && request.method === 'POST') {
    const name = text(data.name, 80), email = text(data.email, 120).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Ingresá un email válido.');
    if (await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) throw new HttpError(409, 'Ese correo ya tiene una cuenta.');
    const account = await firebaseInviteIdentity(env, email);
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,name,email,role,status,password_hash,firebase_uid) VALUES (?,?,?,'admin','pending','firebase',?)").bind(id, name, email, account.uid),
      env.DB.prepare('INSERT INTO admin_invitations(user_id,invited_by,initial_version,expires_at) VALUES (?,?,?,?)').bind(id, admin.id, account.version, Date.now() + 604800000),
    ]);
    await audit(env, admin, 'administrator.invite', id);
    try {
      await firebaseSendPasswordEmail(env, email);
      await env.DB.prepare('UPDATE admin_invitations SET email_sent_at=? WHERE user_id=?').bind(Date.now(), id).run();
    } catch { return json({ message: 'Invitación creada, pero no pudimos enviar el correo. Usá Reenviar invitación.', emailSent: false }, 201); }
    return json({ message: 'Correo enviado para elegir contraseña. Luego ingresará con su email en /admin. La invitación vence en 7 días.', emailSent: true }, 201);
  }
  const match = /^\/api\/admin\/administrators\/([^/]+)(\/resend)?$/.exec(path);
  const target = match && await env.DB.prepare("SELECT * FROM users WHERE id=? AND role='admin'").bind(match[1]).first();
  if (!target) throw new HttpError(404, 'No se encontró la cuenta.');
  if (match[2] && request.method === 'POST') {
    if (target.status !== 'pending') throw new HttpError(409, 'La invitación ya no está pendiente.');
    await firebaseSendPasswordEmail(env, target.email);
    await env.DB.prepare('UPDATE admin_invitations SET expires_at=?,email_sent_at=? WHERE user_id=? AND accepted_at IS NULL').bind(Date.now() + 604800000, Date.now(), target.id).run();
    await audit(env, admin, 'administrator.resend', target.id);
    return json({ message: 'Correo reenviado. Revisá también la carpeta de spam.' });
  }
  if (request.method === 'PATCH') {
    if (target.id === admin.id) throw new HttpError(400, 'No podés suspender tu propia cuenta.');
    if (!['approved','suspended'].includes(data.status) || target.status === 'pending') throw new HttpError(400, 'Primero debe aceptar la invitación por correo.');
    await env.DB.prepare('UPDATE users SET status=? WHERE id=?').bind(data.status, target.id).run();
    await audit(env, admin, 'administrator.status', target.id, { status: data.status });
    return json({ message: 'Acceso actualizado.' });
  }
  throw new HttpError(405, 'Operación no disponible.');
}
