import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function inspectSnapshot(sql) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('La copia de la base no supera la verificacion de integridad.');
    }
    // Require the portal schema rather than accepting an empty or unrelated SQL dump.
    for (const table of ['users', 'sessions', 'reservations', 'settings', 'files']) {
      db.prepare(`SELECT count(*) FROM ${table}`).get();
    }
    return db.prepare('SELECT id,object_key,size FROM files ORDER BY id').all();
  } finally { db.close(); }
}

export async function createBackup(directory, { exportDatabase, downloadObject }) {
  // A new directory prevents overwriting an existing backup or mixing snapshots.
  mkdirSync(directory, { recursive: false, mode: 0o700 });
  const databasePath = join(directory, 'database.sql');
  await exportDatabase(databasePath);
  const sql = readFileSync(databasePath);
  const files = inspectSnapshot(sql.toString('utf8'));
  mkdirSync(join(directory, 'objects'), { mode: 0o700 });
  const objects = [];
  for (const [index, file] of files.entries()) {
    if (typeof file.object_key !== 'string' || !/^attachments\/[a-zA-Z0-9_-]+$/.test(file.object_key)) {
      throw new Error('Clave de archivo inesperada; copia incompleta.');
    }
    const path = `objects/${index}.bin`;
    await downloadObject(file.object_key, join(directory, path));
    const bytes = readFileSync(join(directory, path));
    if (bytes.length !== file.size) throw new Error('Tamano de adjunto incorrecto; copia incompleta.');
    objects.push({ id: file.id, key: file.object_key, path, size: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = { version: 1, createdAt: new Date().toISOString(), database: { path: 'database.sql', sha256: sha256(sql) }, objects };
  // Written last: missing manifest means the backup never completed.
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  return verifyBackup(directory);
}

export function verifyBackup(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.database?.path !== 'database.sql' || !Array.isArray(manifest.objects)) throw new Error('Manifiesto invalido.');
  const sql = readFileSync(join(directory, 'database.sql'));
  if (sha256(sql) !== manifest.database.sha256) throw new Error('La base fue modificada despues del respaldo.');
  const files = inspectSnapshot(sql.toString('utf8'));
  if (files.length !== manifest.objects.length) throw new Error('Cantidad de adjuntos incorrecta.');
  for (const [index, file] of files.entries()) {
    const object = manifest.objects[index];
    if (object.id !== file.id || object.key !== file.object_key || object.path !== `objects/${index}.bin` || object.size !== file.size) throw new Error('Metadatos de adjunto inconsistentes.');
    const bytes = readFileSync(join(directory, object.path));
    if (bytes.length !== object.size || sha256(bytes) !== object.sha256) throw new Error('Adjunto faltante o alterado.');
  }
  return { verified: true, files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === '--verify' && process.argv.length === 4) {
      console.log(verifyBackup(resolve(process.argv[3])));
    } else if (process.argv[2] === '--remote' && process.argv.length === 3) {
      const base = join(root, '.wrangler', 'backups');
      mkdirSync(base, { recursive: true, mode: 0o700 });
      const directory = join(base, `portal-${new Date().toISOString().replaceAll(':', '-')}`);
      const run = args => {
        // Suppress CLI output that can include signed export URLs and private metadata.
        try { execFileSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), ...args], { cwd: root, stdio: 'pipe', windowsHide: true }); }
        catch { throw new Error('Cloudflare no pudo completar la lectura. La copia no debe usarse.'); }
      };
      const result = await createBackup(directory, {
        exportDatabase: output => run(['d1', 'export', 'portal-edificio-produccion', '--remote', '--output', output]),
        downloadObject: (key, output) => run(['r2', 'object', 'get', `portal-edificio-archivos/${key}`, '--remote', '--file', output]),
      });
      console.log(JSON.stringify({ ...result, directory }));
    } else {
      throw new Error('Uso: node scripts/backup-portal.mjs --remote | --verify DIRECTORIO. Contiene datos privados: no compartir ni subir a Git.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
