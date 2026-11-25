import assert from 'node:assert/strict';
import { test } from 'node:test';

// Run against an isolated local Wrangler database, never a live resident database.
const base = process.env.PORTAL_TEST_URL;
test('Cloudflare runtime executes health, registration, password hashing and access protection', { skip: !base }, async () => {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Runtime smoke is local-only');
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, 'production');
  assert.equal((await fetch(`${base}/api/admin/access`)).status, 401);
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.deepEqual(state.data.messages, []);
  assert.deepEqual(state.data.expenses, []);
  const password = crypto.randomUUID();
  const headers = { 'Content-Type': 'application/json', Origin: base };
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers, body: JSON.stringify({ unit: '9C', name: 'Prueba local', email: `${crypto.randomUUID()}@example.invalid`, password }) });
  assert.equal(response.status, 201, await response.text());
  const pending = await fetch(`${base}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ identity: '9C', password }) });
  assert.equal(pending.status, 403);
  assert.match((await pending.json()).error, /pendiente/);
});
