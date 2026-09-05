import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('./repository.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'node' });
const { normalizeDemoData } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('normalization repairs partial storage without allowing invalid dates or duplicate blocked days', () => {
  const data = normalizeDemoData({
    notices: [{ id: 'custom', title: 'Aviso guardado', description: 'Texto', date: '2026-09-05' }, { id: 'bad', title: 'No debe romper', description: 'Texto', date: '2026-02-30' }],
    reservations: [{ id: 'bad-booking', title: 'Reserva', description: '', date: '2026-09-05', time: '25:00' }],
    settings: { rules: 'Reglas actualizadas', blockedDates: ['2026-09-06', '2026-09-06', '2026-02-30'], openingBalance: 'no', seedDate: '2026-09-05' },
  });

  assert.equal(data.notices.length, 2);
  assert.ok(data.notices.every(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date)));
  assert.equal(data.reservations.length, 1);
  assert.deepEqual(data.settings.blockedDates, ['2026-09-06']);
  assert.equal(data.settings.rules, 'Reglas actualizadas');
  assert.equal(typeof data.settings.openingBalance, 'number');
  assert.ok(data.documents.length > 0);
  assert.ok(Array.isArray(data.messages));
});
