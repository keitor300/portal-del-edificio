import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, verifyBackup } from './backup-portal.mjs';

const sql = `CREATE TABLE users(id TEXT PRIMARY KEY);
CREATE TABLE sessions(id TEXT);
CREATE TABLE reservations(id TEXT);
CREATE TABLE settings(id INTEGER);
CREATE TABLE files(id TEXT PRIMARY KEY,object_key TEXT,size INTEGER,owner_id TEXT REFERENCES users(id));
INSERT INTO users VALUES('owner');
INSERT INTO files VALUES('first','attachments/first',5,'owner');`;

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), 'portal-backup-test-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  return join(temp, 'snapshot');
}
const sources = {
  exportDatabase: path => writeFileSync(path, sql),
  downloadObject: (key, path) => { assert.equal(key, 'attachments/first'); writeFileSync(path, 'hello'); },
};

test('backup restores SQL locally and verifies every attachment, without overwriting a snapshot', async t => {
  const directory = fixture(t);
  assert.deepEqual(await createBackup(directory, sources), { verified: true, files: 1 });
  assert.deepEqual(verifyBackup(directory), { verified: true, files: 1 });
  await assert.rejects(createBackup(directory, sources), /EEXIST/);
  writeFileSync(join(directory, 'objects/0.bin'), 'other');
  assert.throws(() => verifyBackup(directory), /alterado/);
});

test('partial downloads, invalid schema and broken foreign keys never produce a completed manifest', async t => {
  for (const variant of [
    { ...sources, downloadObject: () => { throw new Error('offline'); } },
    { ...sources, downloadObject: (_key, path) => writeFileSync(path, 'shorter') },
    { ...sources, exportDatabase: path => writeFileSync(path, 'CREATE TABLE unrelated(id);') },
    { ...sources, exportDatabase: path => writeFileSync(path, sql.replace("5,'owner'", "5,'missing'")) },
  ]) {
    const directory = fixture(t);
    await assert.rejects(createBackup(directory, variant));
    assert.equal(existsSync(join(directory, 'manifest.json')), false);
  }
});

test('verifier rejects changed SQL, path traversal and omitted attachments', async t => {
  const directory = fixture(t);
  await createBackup(directory, sources);
  const manifestPath = join(directory, 'manifest.json');
  const original = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(original);
  manifest.objects[0].path = '../outside';
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifyBackup(directory), /inconsistentes/);
  manifest.objects = [];
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifyBackup(directory), /Cantidad/);
  writeFileSync(manifestPath, original);
  writeFileSync(join(directory, 'database.sql'), sql + '\n-- modified');
  assert.throws(() => verifyBackup(directory), /modificada/);
});
