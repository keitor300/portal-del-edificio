import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firebaseAccount, firebaseAuthenticate, firebaseRecoveryCode, firebaseRegister, firebaseReset } from '../worker/firebase.mjs';

if (!process.argv.includes('--confirm-test-account')) throw new Error('Pass --confirm-test-account to create and remove one temporary Firebase account.');
const config = JSON.parse(readFileSync(new URL('../.secrets/firebase-config.json', import.meta.url), 'utf8'));
const env = { FIREBASE_PROJECT_ID: config.projectId, FIREBASE_API_KEY: config.apiKey,
  FIREBASE_SERVICE_ACCOUNT: readFileSync(new URL('../.secrets/firebase-service-account.json', import.meta.url), 'utf8') };
const email = `portal-check-${crypto.randomUUID()}@example.invalid`;
let password = `Test-${crypto.randomUUID()}`;
let uid;
const client = async (operation, data) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Firebase ${operation} failed (${response.status}); no credentials logged`);
  return response.json();
};
try {
  assert.equal(await firebaseAccount(env, `not-created-${crypto.randomUUID()}`), null);
  console.log('Service credential and account lookup verified.');
  uid = await firebaseRegister(env, email, password);
  const user = { firebase_uid: uid, email };
  const version = await firebaseAuthenticate(env, user, password);
  assert.ok(version);
  const token = await firebaseRecoveryCode(env, user);
  const nextPassword = `Reset-${crypto.randomUUID()}`;
  await firebaseReset(env, user, token, nextPassword);
  password = nextPassword;
  assert.notEqual(await firebaseAuthenticate(env, user, password), version);
  await assert.rejects(firebaseAuthenticate(env, user, 'incorrect-password'), error => error.status === 401);
  console.log('Real Firebase registration, login, recovery and password invalidation verified.');
} finally {
  if (uid) {
    const login = await client('signInWithPassword', { email, password, returnSecureToken: true });
    assert.equal(login.localId, uid);
    await client('delete', { idToken: login.idToken });
    assert.equal(await firebaseAccount(env, uid), null);
    console.log('Temporary verification account removed. No resident accounts created.');
  }
}
