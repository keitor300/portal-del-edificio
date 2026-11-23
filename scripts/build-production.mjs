import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = { ...process.env, VITE_PORTAL_MODE: 'production' };

// Wrangler always rebuilds the assets in shared-data mode before publishing.
// The ordinary Vite build remains available for the separate local demo.
for (const [entry, ...args] of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, [resolve(root, entry), ...args], {
    cwd: root, env, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Production assets built with server authentication and shared data.');
