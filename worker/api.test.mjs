import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from './index.mjs';
import { hashPassword } from './auth.mjs';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_production.sql', import.meta.url), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: sqlite.prepare(sql).run(...args) }),
  });
  const env = { DB: { prepare: statement, batch: async statements => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } };
  const request = async (path, method = 'GET', data, cookie, origin = 'https://portal.example') => {
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' };
    if (cookie) headers.Cookie = cookie;
    return worker.fetch(new Request(`https://portal.example${path}`, { method, headers, ...(data ? { body: JSON.stringify(data) } : {}) }), env);
  };
  return { sqlite, request };
}
const password = 'Test-only-passphrase-2026';
const registration = unit => ({ unit, name: `Resident ${unit}`, email: `${unit.toLowerCase()}@example.invalid`, dni: '12345678', password });

test('registration, approval, private session, suspension and origin enforcement', async () => {
  const { sqlite, request } = fixture();
  try {
    const adminHash = await hashPassword(password);
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(adminHash);
    assert.equal((await request('/api/auth/register', 'POST', registration('7B'), null, 'https://attacker.example')).status, 403);
    assert.equal((await request('/api/admin/access')).status, 401);
    assert.equal((await request('/api/auth/register', 'POST', registration('7B'))).status, 201);
    assert.equal((await request('/api/auth/login', 'POST', { identity: '7B', password })).status, 403);
    const adminLogin = await request('/api/auth/login', 'POST', { identity: 'admin@example.invalid', password });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get('set-cookie');
    assert.match(adminCookie, /HttpOnly; Secure; SameSite=Lax/);
    const adminBody = await adminLogin.json();
    assert.equal(adminBody.user.password_hash, undefined);
    const requests = await (await request('/api/admin/access', 'GET', null, adminCookie)).json();
    assert.equal(requests.users.length, 1);
    const id = requests.users[0].id;
    assert.equal((await request(`/api/admin/access/${id}`, 'PATCH', { status: 'approved' }, adminCookie)).status, 200);
    const ownerLogin = await request('/api/auth/login', 'POST', { identity: '7b', password });
    assert.equal(ownerLogin.status, 200);
    const ownerCookie = ownerLogin.headers.get('set-cookie');
    const session = await (await request('/api/auth/session', 'GET', null, ownerCookie)).json();
    assert.equal(session.user.unit, '7B');
    assert.equal((await request('/api/admin/access', 'GET', null, ownerCookie)).status, 403);
    assert.equal((await request(`/api/admin/access/${id}`, 'PATCH', { status: 'suspended' }, adminCookie)).status, 200);
    assert.equal((await request('/api/reservations', 'GET', null, ownerCookie)).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', { identity: '7b', password })).status, 403);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM audit_log').get().n, 2);
  } finally { sqlite.close(); }
});

test('SUM API binds owner identity, enforces current rules, prevents overlaps and protects cancellation', async () => {
  const { sqlite, request } = fixture();
  try {
    for (const unit of ['7B', '8A']) {
      assert.equal((await request('/api/auth/register', 'POST', registration(unit))).status, 201);
    }
    sqlite.exec("UPDATE users SET status='approved'; UPDATE settings SET rules='Reglas vigentes' WHERE id=1");
    const login = async unit => (await request('/api/auth/login', 'POST', { identity: unit, password })).headers.get('set-cookie');
    const first = await login('7B');
    const second = await login('8A');
    const booking = { date: '2030-11-22', time: '21:00', endTime: '03:00', acceptedRules: 'Reglas vigentes', unit: '8A' };
    assert.equal((await request('/api/reservations', 'POST', { ...booking, acceptedRules: 'old' }, first)).status, 409);
    const created = await request('/api/reservations', 'POST', booking, first);
    assert.equal(created.status, 201);
    const record = await created.json();
    assert.equal(record.unit, '7B');
    assert.equal((await request('/api/reservations', 'POST', booking, second)).status, 409);
    assert.equal((await request(`/api/reservations/${record.id}`, 'DELETE', null, second)).status, 403);
    const shared = await (await request('/api/reservations', 'GET', null, second)).json();
    assert.equal(shared.reservations[0].unit, '7B');
    assert.equal(shared.reservations[0].created_by, undefined);
    assert.equal((await request(`/api/reservations/${record.id}`, 'DELETE', null, first)).status, 200);
    assert.equal((await request('/api/reservations', 'POST', booking, second)).status, 201);
  } finally { sqlite.close(); }
});

test('logout removes server session and forged browser sessions cannot authenticate', async () => {
  const { sqlite, request } = fixture();
  try {
    assert.equal((await request('/api/auth/register', 'POST', registration('7B'))).status, 201);
    sqlite.exec("UPDATE users SET status='approved'");
    const login = await request('/api/auth/login', 'POST', { identity: '7B', password });
    const cookie = login.headers.get('set-cookie');
    assert.equal((await request('/api/auth/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401);
    assert.equal((await request('/api/reservations', 'GET', null, '__Host-portal_session=owner-demo-7b')).status, 401);
  } finally { sqlite.close(); }
});

test('private data stays within its unit, public visitors see no resident data, and edits detect stale versions', async () => {
  const { sqlite, request } = fixture();
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    for (const unit of ['7B','8A']) assert.equal((await request('/api/auth/register', 'POST', registration(unit))).status, 201);
    sqlite.exec("UPDATE users SET status='approved'");
    const login = async identity => (await request('/api/auth/login', 'POST', { identity, password })).headers.get('set-cookie');
    const admin = await login('admin@example.invalid');
    const owner = await login('7B');
    const neighbor = await login('8A');
    const notice = await (await request('/api/entities/notices', 'POST', { title: 'Aviso', description: 'Información del edificio', date: '2026-11-23' }, admin)).json();
    const issue = await request('/api/entities/issues', 'POST', { title: 'Problema privado', description: 'Detalle privado', unit: '8A' }, owner);
    assert.equal(issue.status, 201);
    assert.equal((await request('/api/entities/movements', 'POST', { title: 'Fake', amount: 500, type: 'Ingreso' }, owner)).status, 403);
    assert.equal((await request('/api/messages', 'POST', { text: 'Consulta privada', unit: '8A' }, owner)).status, 201);
    const ownState = await (await request('/api/state', 'GET', null, owner)).json();
    assert.equal(ownState.data.issues.length, 1);
    assert.equal(ownState.data.issues[0].unit, '7B');
    assert.equal(ownState.data.messages.length, 1);
    const otherState = await (await request('/api/state', 'GET', null, neighbor)).json();
    assert.equal(otherState.data.issues.length, 0);
    assert.equal(otherState.data.messages.length, 0);
    const publicState = await (await request('/api/state')).json();
    assert.equal(publicState.data.notices.length, 1);
    assert.equal(publicState.data.issues.length, 0);
    assert.equal(publicState.data.messages.length, 0);
    assert.equal((await request(`/api/entities/notices/${notice.id}`, 'PATCH', { title: 'Actualizado', version: 1 }, admin)).status, 200);
    assert.equal((await request(`/api/entities/notices/${notice.id}`, 'PATCH', { title: 'Cambio obsoleto', version: 1 }, admin)).status, 409);
    assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM entities WHERE id=?').get(notice.id).data).title, 'Actualizado');
  } finally { sqlite.close(); }
});
