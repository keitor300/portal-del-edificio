import { importPKCS8, SignJWT } from 'jose';
import { HttpError } from './http.mjs';

const unavailable = () => new HttpError(503, 'No pudimos verificar el acceso. Volvé a intentar en unos minutos.');
const credentialsMessage = 'La unidad, email o contraseña no son correctos.';
const oauthCache = new Map();

export function authProvider(env) {
  if (env.AUTH_PROVIDER === 'local' && env.RUNTIME_ENV === 'test') return 'local';
  if (env.AUTH_PROVIDER && env.AUTH_PROVIDER !== 'firebase') throw unavailable();
  return 'firebase';
}

export function assertAuthEnvironment(request, env) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
  if ((env.AUTH_PROVIDER === 'local' || env.FIREBASE_AUTH_EMULATOR_HOST || env.RUNTIME_ENV === 'test') && !local) throw unavailable();
  authProvider(env);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Usá una contraseña de 12 a 128 caracteres.');
}

function config(env) {
  const project = env.FIREBASE_PROJECT_ID;
  const key = env.FIREBASE_API_KEY;
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project || '') || !key) throw unavailable();
  if (env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (env.RUNTIME_ENV !== 'test' || !project.startsWith('demo-') || !/^127\.0\.0\.1:\d{2,5}$/.test(env.FIREBASE_AUTH_EMULATOR_HOST)) throw unavailable();
    return { project, key, base: `http://${env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`, emulator: true };
  }
  return { project, key, base: 'https://identitytoolkit.googleapis.com/v1', emulator: false };
}

class FirebaseError extends HttpError {
  constructor(code, status, message) { super(status, message); this.code = code; }
}

async function post(url, data, headers = {}) {
  let response, result;
  try {
    const form = data instanceof URLSearchParams;
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', ...headers }, body: form ? data.toString() : JSON.stringify(data), signal: AbortSignal.timeout(10000), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) throw unavailable();
    result = await response.json();
  } catch { throw unavailable(); }
  if (!response.ok) {
    const code = String(result?.error?.message || '').split(' : ')[0];
    if (['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'USER_DISABLED', 'USER_NOT_FOUND'].includes(code)) throw new FirebaseError(code, 401, credentialsMessage);
    if (code === 'EMAIL_EXISTS') throw new FirebaseError(code, 409, 'Ya existe una solicitud para esos datos. Consultá con Administración.');
    if (['INVALID_OOB_CODE', 'EXPIRED_OOB_CODE'].includes(code)) throw new FirebaseError(code, 409, 'El enlace venció o ya se utilizó. Solicitá uno nuevo.');
    if (code.startsWith('WEAK_PASSWORD') || code === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS') throw new FirebaseError(code, 400, 'La contraseña no cumple los requisitos. Elegí una más larga.');
    if (response.status === 429 || code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new FirebaseError(code, 429, 'Hubo demasiados intentos. Esperá unos minutos y volvé a intentar.');
    throw unavailable();
  }
  if (!result || typeof result !== 'object') throw unavailable();
  return result;
}

async function adminToken(env) {
  if (config(env).emulator) return 'owner';
  let account;
  try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || ''); } catch { throw unavailable(); }
  if (account.project_id !== env.FIREBASE_PROJECT_ID || !account.client_email?.endsWith('.iam.gserviceaccount.com') || !account.private_key) throw unavailable();
  const cacheKey = `${account.client_email}:${account.private_key_id}`;
  const cached = oauthCache.get(cacheKey);
  if (cached?.expires > Date.now()) return cached.token;
  try {
    const key = await importPKCS8(account.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/identitytoolkit' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
    const result = await post('https://oauth2.googleapis.com/token', new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }));
    if (!result.access_token || !Number.isFinite(Number(result.expires_in))) throw unavailable();
    oauthCache.clear();
    oauthCache.set(cacheKey, { token: result.access_token, expires: Date.now() + Math.min(Number(result.expires_in) - 60, 3300) * 1000 });
    return result.access_token;
  } catch { throw unavailable(); }
}

async function client(env, operation, data) {
  const { base, key } = config(env);
  return post(`${base}/accounts:${operation}?key=${encodeURIComponent(key)}`, data);
}

export async function firebaseAccount(env, uid) {
  const { base, project } = config(env);
  const result = await post(`${base}/projects/${project}/accounts:lookup`, { localId: [uid] }, { Authorization: `Bearer ${await adminToken(env)}` });
  const account = result.users?.find(user => user.localId === uid);
  if (!account) return null;
  return { uid: account.localId, email: account.email?.toLowerCase(), disabled: !!account.disabled, version: `${account.validSince || '0'}:${account.passwordUpdatedAt || '0'}` };
}

export async function firebaseRegister(env, email, password) {
  validatePassword(password);
  let result;
  try { result = await client(env, 'signUp', { email, password, returnSecureToken: true }); }
  catch (error) {
    if (error.code !== 'EMAIL_EXISTS') throw error;
    // Recover a provider account created before an interrupted D1 save, only
    // after proving its password. Portal role/approval still come from D1.
    try { result = await client(env, 'signInWithPassword', { email, password, returnSecureToken: true }); }
    catch (cause) { if (cause.status === 401) throw error; throw cause; }
  }
  if (typeof result.localId !== 'string' || !result.localId || result.email?.toLowerCase() !== email) throw unavailable();
  return result.localId;
}

export async function firebaseInviteIdentity(env, email) {
  // A random, undisclosed password forces the invited person to use their email.
  const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  const result = await client(env, 'signUp', { email, password, returnSecureToken: true });
  if (!result.localId || result.email?.toLowerCase() !== email) throw unavailable();
  return firebaseAccount(env, result.localId);
}

export async function firebaseSendPasswordEmail(env, email) {
  const { base, key } = config(env);
  await post(`${base}/accounts:sendOobCode?key=${encodeURIComponent(key)}`, { requestType: 'PASSWORD_RESET', email, ...(env.PORTAL_ORIGIN ? { continueUrl: `${env.PORTAL_ORIGIN}/admin` } : {}) }, { 'X-Firebase-Locale': 'es' });
}

export async function firebaseAuthenticate(env, user, password) {
  if (typeof password !== 'string' || !password || password.length > 128) throw new HttpError(401, credentialsMessage);
  // Make a provider call even for unknown portal identities; never return a
  // session for a Firebase identity without its explicit D1 account mapping.
  const before = user?.firebase_uid ? await firebaseAccount(env, user.firebase_uid) : null;
  const result = await client(env, 'signInWithPassword', { email: user?.email || 'unknown-portal-account@example.invalid', password, returnSecureToken: true });
  if (!user?.firebase_uid || result.localId !== user.firebase_uid || result.email?.toLowerCase() !== user.email.toLowerCase() || before?.disabled || before?.email !== user.email.toLowerCase()) throw new HttpError(401, credentialsMessage);
  const after = await firebaseAccount(env, user.firebase_uid);
  if (!after || after.disabled || after.email !== before.email || after.version !== before.version) throw new HttpError(409, 'El acceso cambió durante el ingreso. Volvé a ingresar.');
  return after.version;
}

export async function firebaseRecoveryCode(env, user) {
  const account = await firebaseAccount(env, user.firebase_uid);
  if (!account || account.disabled || account.email !== user.email.toLowerCase()) throw new HttpError(409, 'La cuenta no está habilitada para recuperar el acceso.');
  const { base, project } = config(env);
  const result = await post(`${base}/accounts:sendOobCode`, { requestType: 'PASSWORD_RESET', email: user.email, targetProjectId: project, returnOobLink: true }, { Authorization: `Bearer ${await adminToken(env)}` });
  let code;
  try { code = new URL(result.oobLink).searchParams.get('oobCode'); } catch { throw unavailable(); }
  if (!code || !/^[A-Za-z0-9_-]{16,1024}$/.test(code)) throw unavailable();
  return `f1.${code}`;
}

export async function firebaseReset(env, user, token, password) {
  validatePassword(password);
  if (!/^f1\.[A-Za-z0-9_-]{16,1024}$/.test(token || '')) throw new HttpError(409, 'El enlace no es válido. Solicitá uno nuevo.');
  const account = await firebaseAccount(env, user.firebase_uid);
  const code = token.slice(3);
  const verified = await client(env, 'resetPassword', { oobCode: code });
  if (!account || account.disabled || account.email !== user.email.toLowerCase() || verified.email?.toLowerCase() !== account.email || verified.requestType !== 'PASSWORD_RESET') throw new HttpError(409, 'El enlace no corresponde a una cuenta habilitada.');
  await client(env, 'resetPassword', { oobCode: code, newPassword: password });
}
