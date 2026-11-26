import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from './index.mjs';
import { firebaseRegister, firebaseAccount, assertAuthEnvironment } from './firebase.mjs';

const project = 'demo-portal-edificio';
const host = '127.0.0.1:9099';
const password = 'Local-test-password-2026';
const nextPassword = 'Local-new-password-2026';
const base = `http://${host}/identitytoolkit.googleapis.com/v1`;

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(name, dir), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: sqlite.prepare(sql).run(...args) }),
  });
  const env = { AUTH_PROVIDER: 'firebase', RUNTIME_ENV: 'test', FIREBASE_PROJECT_ID: project,
    FIREBASE_API_KEY: 'local-test-key', FIREBASE_AUTH_EMULATOR_HOST: host,
    DB: { prepare: statement, batch: async statements => {
      sqlite.exec('BEGIN');
      try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    } },
  };
  const request = (path, method = 'GET', data, cookie) => worker.fetch(new Request(`https://localhost${path}`, {
    method, headers: { Origin: 'https://localhost', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  }), env);
  const login = (identity, value = password) => request('/api/auth/login', 'POST', { identity, password: value });
  return { sqlite, env, request, login };
}

test('test-only authentication cannot be enabled on a public hostname', () => {
  for (const env of [{ AUTH_PROVIDER: 'local', RUNTIME_ENV: 'test' }, { FIREBASE_AUTH_EMULATOR_HOST: host }, { RUNTIME_ENV: 'test' }]) {
    assert.throws(() => assertAuthEnvironment(new Request('https://portal.example/api/auth/login'), env), /verificar/);
  }
  assert.throws(() => assertAuthEnvironment(new Request('https://localhost/api/auth/login'), { AUTH_PROVIDER: 'local' }), /verificar/);
});

test('administrator invitation requires email password setup and supports suspension', {timeout:60000}, async()=>{
  const {sqlite,env,request,login}=fixture();
  const suffix=crypto.randomUUID().slice(0,8);
  try{
    const email=`inviter-${suffix}@example.invalid`, invited=`invited-${suffix}@example.invalid`;
    const uid=await firebaseRegister(env,email,password);
    sqlite.prepare("INSERT INTO users(id,name,email,username,role,status,password_hash,firebase_uid) VALUES ('inviter','Admin',?,'13y34.2026','admin','approved','firebase',?)").run(email,uid);
    const cookie=(await login('13y34.2026')).headers.get('set-cookie');
    const path='/api/admin/administrators';
    assert.equal((await request(path,'POST',{name:'Invitado',email:invited,password:'wrong'},cookie)).status,403);
    const response=await request(path,'POST',{name:'Invitado',email:invited,password},cookie);
    assert.equal(response.status,201,await response.clone().text());
    assert.equal((await response.json()).emailSent,true);
    const target=sqlite.prepare('SELECT * FROM users WHERE email=?').get(invited);
    assert.equal(target.status,'pending');
    const codes=await(await fetch(`http://${host}/emulator/v1/projects/${project}/oobCodes`)).json();
    const code=codes.oobCodes.filter(item=>item.email===invited).at(-1).oobCode;
    const reset=await fetch(`${base}/accounts:resetPassword?key=local-test-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code,newPassword:nextPassword})});
    assert.equal(reset.status,200);
    const accepted=await login(invited,nextPassword);assert.equal(accepted.status,200,await accepted.clone().text());
    assert.equal(sqlite.prepare('SELECT status FROM users WHERE id=?').get(target.id).status,'approved');
    const secondCookie=accepted.headers.get('set-cookie');
    assert.equal((await request(`${path}/${target.id}`,'PATCH',{status:'suspended',password},cookie)).status,200);
    assert.equal((await request(path,'GET',null,secondCookie)).status,401);
    assert.equal((await request(`${path}/${target.id}/resend`,'POST',{password},cookie)).status,409);
  }finally{sqlite.close();}
});

test('Firebase emulator: approval, UID binding, session revocation and one-use recovery', { timeout: 60000 }, async () => {
  // Only the named demo project in the local emulator is cleared.
  const cleared = await fetch(`http://${host}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });
  assert.equal(cleared.status, 200, 'Start the local Firebase Auth emulator first');
  const { sqlite, env, request, login } = fixture();
  const seedAdmin = async () => {
    const email = 'admin@example.invalid';
    const uid = await firebaseRegister(env, email, password);
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash,firebase_uid) VALUES ('admin','Admin',?,'admin','approved','firebase',?)").run(email, uid);
    return uid;
  };
  const provider = async (operation, data) => {
    const response = await fetch(`${base}/projects/${project}/accounts:${operation}`, {
      method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  try {
    await seedAdmin();
    const registration = { name: 'Test resident', unit: '7B', email: 'resident@example.invalid', password };
    assert.equal((await request('/api/auth/register', 'POST', registration)).status, 201);
    const user = sqlite.prepare("SELECT * FROM users WHERE unit='7B'").get();
    assert.ok(user.firebase_uid);
    assert.equal(user.password_hash, 'firebase');
    assert.equal(user.dni, null);
    assert.equal((await login('7B')).status, 403);
    assert.equal((await login('7B', 'incorrect-password')).status, 401);
    assert.equal((await login('99Z')).status, 401);
    assert.equal((await request('/api/auth/register', 'POST', registration)).status, 409);
    const adminResponse = await login('admin@example.invalid');
    assert.equal(adminResponse.status, 200, await adminResponse.clone().text());
    const adminCookie = adminResponse.headers.get('set-cookie');
    assert.equal((await request(`/api/admin/access/${user.id}`, 'PATCH', { status: 'approved' }, adminCookie)).status, 200);
    let ownerResponse = await login('7B');
    assert.equal(ownerResponse.status, 200);
    let cookie = ownerResponse.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
    assert.equal((await (await request('/api/auth/session', 'GET', null, cookie)).json()).user.unit, '7B');
    assert.equal((await request('/api/admin/access', 'GET', null, cookie)).status, 403);
    assert.equal((await request(`/api/admin/access/${user.id}`, 'PATCH', { status: 'suspended' }, adminCookie)).status, 200);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401);
    await request(`/api/admin/access/${user.id}`, 'PATCH', { status: 'approved' }, adminCookie);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401, 'Reapproval never restores an old session');
    ownerResponse = await login('7B'); cookie = ownerResponse.headers.get('set-cookie');
    await provider('update', { localId: user.firebase_uid, disableUser: true });
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401);
    await provider('update', { localId: user.firebase_uid, disableUser: false });
    cookie = (await login('7B')).headers.get('set-cookie');
    const recoveryPath = `/api/admin/access/${user.id}/recovery`;
    assert.equal((await request(recoveryPath, 'POST', { verified: true, password }, cookie)).status, 403);
    assert.equal((await request(recoveryPath, 'POST', { verified: false, password }, adminCookie)).status, 400);
    assert.equal((await request(recoveryPath, 'POST', { verified: true, password: 'incorrect-password' }, adminCookie)).status, 403);
    assert.equal((await (await request('/api/auth/session', 'GET', null, adminCookie)).json()).user.role, 'admin');
    const recovery = await request(recoveryPath, 'POST', { verified: true, password }, adminCookie);
    assert.equal(recovery.status, 200, await recovery.clone().text());
    const token = (await recovery.json()).path.split('#reset=')[1];
    const results = await Promise.all([1, 2].map(() => request('/api/auth/recovery/reset', 'POST', { token, password: nextPassword })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401);
    sqlite.exec('DELETE FROM rate_limits');
    assert.equal((await login('7B')).status, 401);
    cookie = (await login('7B', nextPassword)).headers.get('set-cookie');
    assert.ok(cookie);
    const before = await firebaseAccount(env, user.firebase_uid);
    await provider('update', { localId: user.firebase_uid, password: 'External-reset-password-2026' });
    assert.notEqual((await firebaseAccount(env, user.firebase_uid)).version, before.version);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401, 'Provider password changes invalidate portal sessions too');

    // Retry an interrupted provider registration without duplicating its identity.
    const orphan = await firebaseRegister(env, 'orphan@example.invalid', password);
    assert.equal((await request('/api/auth/register', 'POST', { ...registration, unit: '8A', email: 'orphan@example.invalid' })).status, 201);
    assert.equal(sqlite.prepare("SELECT firebase_uid FROM users WHERE unit='8A'").get().firebase_uid, orphan);
    assert.equal((await request('/api/auth/register', 'POST', { ...registration, unit: '8B', email: 'admin@example.invalid' })).status, 409);
  } finally { sqlite.close(); }
});
