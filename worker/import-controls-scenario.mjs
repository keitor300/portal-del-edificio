import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function runImportControls({ admin, owner, base }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const state = async () => (await (await owner.request.get(`${base}/api/state`)).json()).data;
  const original = (await state()).movements;
  await admin.goto(`${base}/admin/finanzas?tab=importar`);
  const input = () => admin.getByLabel('Seleccionar o arrastrar archivo', { exact: true });
  const file = async (name, buffer) => {
    await input().setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await expect(input()).toBeEnabled();
  };
  const mapping = admin.getByRole('group', { name: 'Asignación de columnas', exact: true });
  for (const [name, buffer, message] of [
    ['no-es-planilla.txt', Buffer.from('prueba'), 'XLSX, XLS o CSV'],
    ['vacia.csv', Buffer.alloc(0), 'tener contenido'],
    ['excede-limite.csv', Buffer.alloc(5 * 1024 * 1024 + 1, 32), 'hasta 5 MB'],
  ]) {
    await file(name, buffer);
    await expect(admin.getByRole('alert')).toContainText(message);
    await expect(admin.getByRole('button', { name: /^Importar \d+ movimientos/ })).toHaveCount(0);
    assert.deepEqual((await state()).movements, original);
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), 'Vacia');
  const rows = [
    ['SIMULACRO - Caja ficticia'], [],
    ['Dia contable', 'Resumen', 'Sentido', 'Grupo', 'Total pesos'],
    ['26/11/2026', 'SIMULACRO XLSX aporte', 'Ingreso', 'Aportes', '1.250,50'],
    ['26/11/2026', 'SIMULACRO XLSX aporte', 'Ingreso', 'Aportes', '1.250,50'],
    ['31/02/2026', 'SIMULACRO fecha invalida', 'Ingreso', 'Aportes', '100'],
    ['26/11/2026', 'SIMULACRO importe invalido', 'Egreso', 'Servicios', '-50'],
    [],
    ['26/11/2026', 'SIMULACRO XLSX gasto', 'Egreso', 'Servicios', '250,25'],
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Caja');
  const workbook = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  await file('simulacro-hojas.xlsx', workbook);
  await expect(admin.getByRole('alert')).toContainText('La hoja está vacía');
  await admin.getByLabel('Hoja', { exact: true }).selectOption('Caja');
  await admin.getByLabel('Fila de encabezados', { exact: true }).selectOption('3');
  for (const [index, label] of ['Fecha', 'Concepto', 'Tipo', 'Categoría', 'Importe'].entries()) {
    await mapping.getByLabel(label, { exact: true }).selectOption(String(index));
  }
  await expect(admin.getByRole('status').filter({ hasText: '2 filas válidas' })).toContainText('2 con errores · 1 duplicadas');
  await mapping.getByLabel('Importe', { exact: true }).selectOption('0');
  await expect(admin.getByText('Asigná una columna diferente a cada campo.', { exact: true })).toBeVisible();
  await expect(admin.getByRole('button', { name: /^Importar \d+ movimientos/ })).toHaveCount(0);
  await mapping.getByLabel('Importe', { exact: true }).selectOption('4');
  await admin.getByRole('button', { name: 'Importar 2 movimientos válidos', exact: true }).click();
  await expect(admin.getByRole('dialog')).toContainText('hoja “Caja”');
  await admin.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  assert.deepEqual((await state()).movements, original);
  await admin.getByRole('button', { name: 'Importar 2 movimientos válidos', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: '2 movimientos guardados en el consorcio' })).toBeVisible();
  const added = (await state()).movements.filter(row => row.title.startsWith('SIMULACRO XLSX'));
  assert.equal(added.length, 2);
  assert.equal(added.find(row => row.type === 'Ingreso').amount, 1250.5);
  assert.equal(added.find(row => row.type === 'Egreso').amount, 250.25);
  assert.ok(added.every(row => row.date === '2026-11-26'));
  assert.equal((await state()).movements.length, original.length + 2);
  await admin.getByRole('button', { name: 'Quitar archivo', exact: true }).click();
  await expect(admin.getByLabel('Hoja', { exact: true })).toHaveCount(0);

  await file('simulacro-hojas.xlsx', workbook);
  await admin.getByLabel('Hoja', { exact: true }).selectOption('Caja');
  await admin.getByLabel('Fila de encabezados', { exact: true }).selectOption('3');
  for (const [index, label] of ['Fecha', 'Concepto', 'Tipo', 'Categoría', 'Importe'].entries()) {
    await mapping.getByLabel(label, { exact: true }).selectOption(String(index));
  }
  await expect(admin.getByRole('status').filter({ hasText: '0 filas válidas' })).toContainText('3 duplicadas');
  await expect(admin.getByRole('button', { name: 'Importar 0 movimientos válidos', exact: true })).toBeDisabled();

  const header = ['Fecha', 'Concepto', 'Tipo', 'Categoria', 'Importe'];
  const large = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(large, XLSX.utils.aoa_to_sheet([header, ...Array.from({ length: 501 }, (_, index) => ['2026-11-26', `SIMULACRO exceso ${index}`, 'Ingreso', 'Otros', 1])]), 'Exceso');
  await file('exceso.xlsx', XLSX.write(large, { type: 'buffer', bookType: 'xlsx' }));
  await expect(admin.getByRole('alert')).toContainText('supera los 500 movimientos');
  await expect(admin.getByRole('button', { name: /^Importar \d+ movimientos/ })).toBeDisabled();
  assert.equal((await state()).movements.length, original.length + 2);

  const legacy = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(legacy, XLSX.utils.aoa_to_sheet([header, [46352, 'SIMULACRO XLS fecha Excel', 'Egreso', 'Servicios', 175.75]]), 'Caja');
  await file('legado.xls', XLSX.write(legacy, { type: 'buffer', bookType: 'biff8' }));
  await expect(admin.getByRole('status').filter({ hasText: '1 filas válidas' })).toBeVisible();
  await admin.getByRole('button', { name: 'Importar 1 movimientos válidos', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: '1 movimientos guardados en el consorcio' })).toBeVisible();
  const serialDate = XLSX.SSF.parse_date_code(46352);
  const expectedDate = `${serialDate.y}-${String(serialDate.m).padStart(2, '0')}-${String(serialDate.d).padStart(2, '0')}`;
  assert.equal((await state()).movements.find(row => row.title === 'SIMULACRO XLS fecha Excel').date, expectedDate);

  const csv = 'Fecha;Concepto;Tipo;Categoría;Importe\n26/11/2026;SIMULACRO reparación cañería;Egreso;Mantenimiento;75,50\n';
  await file('acentos.csv', Buffer.from(csv, 'latin1'));
  await expect(admin.getByRole('status').filter({ hasText: '1 filas válidas' })).toBeVisible();
  await expect(admin.getByRole('region', { name: 'Vista previa del archivo', exact: true })).toContainText('reparación cañería');
  await admin.getByRole('button', { name: 'Importar 1 movimientos válidos', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: '1 movimientos guardados en el consorcio' })).toBeVisible();
  const final = (await state()).movements;
  assert.equal(final.length, original.length + 4);
  assert.equal(final.find(row => row.title === 'SIMULACRO reparación cañería').amount, 75.5);
  for (const width of [320, 390, 1440]) {
    await admin.setViewportSize({ width, height: 844 });
    assert.equal(await admin.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
    for (const tableName of ['Vista previa del archivo', 'Validación de movimientos']) {
      const region = admin.getByRole('region', { name: tableName, exact: true });
      const headerLines = await region.locator('thead th').evaluateAll(cells => cells.map(cell => {
        const range = globalThis.document.createRange();
        range.selectNodeContents(cell);
        return range.getClientRects().length;
      }));
      assert.ok(headerLines.every(count => count === 1), `Wrapped column labels: ${width}px ${tableName}`);
      await region.locator('tbody tr').last().locator('td').last().scrollIntoViewIfNeeded();
      const lastColumnFits = await region.evaluate(element => {
        const last = element.querySelector('tbody tr:last-child td:last-child').getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return last.right <= box.right + 1 && last.left >= box.left - 1;
      });
      assert.ok(lastColumnFits, `Last column unreachable: ${width}px ${tableName}`);
      await region.evaluate(element => { element.scrollLeft = 0; });
    }
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.screenshot({ path: join(tmpdir(), 'portal-simulacro-import-controls.png'), fullPage: true });
  console.log('Simulation verified: XLSX sheets, header mapping, validation, duplicates, limits, XLS and CSV encoding');
}
