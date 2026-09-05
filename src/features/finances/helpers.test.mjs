import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(path, replacements = {}) {
  let code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(replacements)) code = code.replaceAll(`'${from}'`, `'${to}'`);
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const utils = await moduleUrl('../../lib/utils.ts');
const helperUrl = await moduleUrl('./helpers.ts', { '../../lib/utils': utils });
const { parseAmount, parseDate, parseType, suggestMapping, validateRows, signedTotal, formatAmount } = await import(helperUrl);
const { financeSeed } = await import(await moduleUrl('./seed.ts', { '../../lib/utils': utils, './helpers': helperUrl }));

test('Argentine currency accepts grouping and cents without accepting malformed or signed amounts', () => {
  for (const [input, expected] of [['$ 1.234.567,89', 1234567.89], ['ARS 125.000', 125000], ['1000,50', 1000.5], ['1234.56', 1234.56], [1.25, 1.25], ['1.234', 1234]]) assert.equal(parseAmount(input), expected);
  for (const input of ['', '0', '-100', '(100)', '1.23.456', '1,234.56', '12,345', '1e3', Infinity, NaN, -1, 0, 1.111, 'texto']) assert.equal(parseAmount(input), null, String(input));
  assert.match(formatAmount(1000.5), /1\.000,50/);
});
test('dates reject rollover and support leap days and both Excel epochs', () => {
  assert.equal(parseDate('29/02/2024'), '2024-02-29');
  assert.equal(parseDate('5-9-2026'), '2026-09-05');
  assert.equal(parseDate('2026-09-05'), '2026-09-05');
  assert.equal(parseDate(1), '1900-01-01');
  assert.equal(parseDate(61), '1900-03-01');
  assert.equal(parseDate(0, true), '1904-01-01');
  for (const value of ['31/02/2026', '29/02/2025', '2026-13-01', '2026-00-01', '05/09/26', '', 60, 3.5]) assert.equal(parseDate(value), null, String(value));
});
test('mapping and validation exclude invalid dates, blank rows, existing and within-file duplicates', () => {
  const mapping = suggestMapping(['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Monto']);
  assert.deepEqual(mapping, { date: 0, title: 1, type: 2, category: 3, amount: 4 });
  assert.equal(parseType('CRÉDITO'), 'Ingreso');
  assert.equal(parseType('débito'), 'Egreso');
  assert.equal(parseType('transferencia'), null);
  const existing = [{ id: 'old', date: '2026-09-05', title: 'Reparación bomba', type: 'Egreso', amount: 1000 }];
  const rows = validateRows([
    ['05/09/2026', ' reparación  bomba ', 'egreso', 'Otros', '1.000'],
    ['05/09/2026', 'Electricidad', 'Egreso', 'Servicios', '4.500,25'],
    ['2026-09-05', 'electricidad', 'Egreso', 'Otra categoría', 4500.25],
    ['31/09/2026', 'Inválido', 'Ingreso', 'Otros', 3],
    ['', '', '', '', ''],
    ['05/09/2026', 'Importe inválido', 'Ingreso', 'Otros', -15],
  ], mapping, existing);
  assert.equal(rows.length, 5);
  assert.equal(rows.filter(row => row.duplicate).length, 2);
  assert.equal(rows.filter(row => !row.errors.length).length, 1);
  assert.equal(rows.at(-1).row, 7);
  const saved = rows.filter(row => !row.errors.length).map(row => ({ ...row.item, id: 'new' }));
  assert.equal(validateRows([['05/09/2026', 'Electricidad', 'Egreso', 'Servicios', '4.500,25']], mapping, saved)[0].duplicate, true);
});
test('seed has current plus six earlier statements, positive movements, and consistent balances', () => {
  const seed = financeSeed();
  assert.equal(seed.expenses.length, 7);
  assert.equal(new Set(seed.expenses.map(item => item.period)).size, 7);
  assert.ok(seed.expenses.every(item => item.status === 'Publicado' && item.attachment?.type === 'application/pdf'));
  assert.ok(seed.movements.every(item => item.amount > 0 && ['Ingreso', 'Egreso'].includes(item.type)));
  assert.equal(new Set(seed.movements.map(item => item.id)).size, seed.movements.length);
  assert.equal(1850000 + signedTotal(seed.movements), 3747000);
  assert.equal(signedTotal([{ amount: 0.1, type: 'Ingreso' }, { amount: 0.2, type: 'Ingreso' }, { amount: 0.3, type: 'Egreso' }]), 0);
});
