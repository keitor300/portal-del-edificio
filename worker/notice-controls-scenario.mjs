import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export async function runNoticeControls({ admin, owner, neighbor, visitor, base, pdf }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const title = 'SIMULACRO - Aviso con controles completos';
  const text = 'Información ficticia de captación de propuestas para el salón.';
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  const find = async () => (await state(owner)).notices.find(row => row.title === title);
  await admin.goto(`${base}/admin/comunicaciones`);
  await admin.getByRole('button', { name: 'Nuevo aviso', exact: true }).click();
  let editor = admin.getByRole('dialog');
  await editor.getByLabel('Título', { exact: true }).fill('SIMULACRO descartado');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.ok(!(await state(owner)).notices.some(row => row.title === 'SIMULACRO descartado'));
  await admin.getByRole('button', { name: 'Nuevo aviso', exact: true }).click();
  editor = admin.getByRole('dialog');
  await editor.getByLabel('Título', { exact: true }).fill('   ');
  await editor.getByLabel('Mensaje', { exact: true }).fill(text);
  await editor.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Completá el título y el mensaje');
  await editor.getByLabel('Título', { exact: true }).fill(title);
  const date = editor.getByLabel('Fecha de publicación', { exact: true });
  const today = await date.inputValue();
  await date.fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  assert.equal(await date.evaluate(input => input.validity.rangeOverflow), true);
  await editor.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
  assert.equal(await find(), undefined);
  await date.fill(today);
  await editor.getByLabel(/^Adjuntar archivo/).setInputFiles({ name: 'aviso-ficticio.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(editor.getByText('aviso-ficticio.pdf', { exact: true })).toBeVisible();
  await editor.getByRole('checkbox', { name: /Fijar al principio/ }).check();
  await editor.getByRole('checkbox', { name: /Destacar como urgente/ }).check();
  await editor.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const notice = await find();
  assert.ok(notice && notice.pinned && notice.urgent && !notice.public);
  const assetUrl = new URL(notice.attachment.url, base).href;
  assert.equal((await visitor.request.get(assetUrl)).status(), 401);
  assert.equal((await neighbor.request.get(assetUrl)).status(), 200);
  const item = admin.locator('.notice-item').filter({ has: admin.getByRole('heading', { name: title, exact: true }) });
  await expect(admin.locator('.notice-item').first()).toContainText(title);
  await expect(item.locator('.notice-card-urgent')).toBeVisible();
  await item.getByRole('button', { name: 'Desfijar', exact: true }).click();
  await expect(item.getByRole('button', { name: 'Fijar', exact: true })).toBeVisible();
  assert.equal((await find()).pinned, false);
  await item.getByRole('button', { name: 'Fijar', exact: true }).click();
  await expect(item.getByRole('button', { name: 'Desfijar', exact: true })).toBeVisible();
  await expect(admin.locator('.notice-item').first()).toContainText(title);

  for (const category of ['Urgente', 'Información', 'Mantenimiento', 'Reunión', 'Comunidad']) {
    await item.getByRole('button', { name: `Editar ${title}`, exact: true }).click();
    await admin.getByRole('dialog').getByLabel('Categoría', { exact: true }).selectOption(category);
    await admin.getByRole('dialog').getByRole('button', { name: 'Publicar aviso', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    assert.equal((await find()).category, category);
    await owner.goto(`${base}/demo/propietario/novedades`);
    await owner.getByLabel('Categoría', { exact: true }).selectOption(category);
    await owner.getByLabel('Buscar novedades').fill('CAPTACIÓN');
    await expect(owner.locator('.notice-item')).toHaveCount(1);
    await expect(owner.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await owner.getByLabel('Buscar novedades').fill('SIMULACRO SIN COINCIDENCIAS');
    await expect(owner.locator('.notice-item')).toHaveCount(0);
    await expect(owner.locator('.empty')).toBeVisible();
    await owner.getByLabel('Buscar novedades').fill('');
    await owner.getByRole('link').filter({ has: owner.getByRole('heading', { name: title, exact: true }) }).click();
    await expect(owner.getByRole('heading', { name: title, exact: true })).toBeVisible();
    if (category === 'Mantenimiento') {
      await owner.getByRole('link', { name: 'Ver obras y avances', exact: true }).click();
      await expect(owner).toHaveURL(/\/edificio\/obras$/);
    }
    if (category === 'Reunión') {
      await owner.getByRole('link', { name: 'Ver reuniones', exact: true }).click();
      await expect(owner).toHaveURL(/\/edificio\/reuniones$/);
    }
  }

  await owner.getByRole('button', { name: 'Ver adjunto', exact: true }).click();
  await expect(owner.getByRole('dialog', { name: 'aviso-ficticio.pdf', exact: true })).toBeVisible();
  await owner.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await owner.route(`**/api/notices/${notice.id}/read`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULACRO: lectura no guardada' }) }), { times: 1 });
  await owner.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await expect(owner.getByRole('alert')).toContainText('lectura no guardada');
  assert.equal((await find()).views, 0);
  await owner.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await expect(owner.getByRole('button', { name: 'Marcado como leído', exact: true })).toBeDisabled();
  await owner.reload();
  await expect(owner.getByRole('button', { name: 'Marcado como leído', exact: true })).toBeDisabled();
  await neighbor.goto(`${base}/demo/propietario/novedades/${notice.id}`);
  await neighbor.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await expect(neighbor.getByRole('button', { name: 'Marcado como leído', exact: true })).toBeDisabled();
  assert.equal((await find()).views, 2);
  await admin.reload();
  await expect(item).toContainText('2 de 52 unidades confirmaron lectura');

  const setPublic = async value => {
    await item.getByRole('button', { name: `Editar ${title}`, exact: true }).click();
    await admin.getByRole('checkbox', { name: 'Mostrar también en la página pública (sin iniciar sesión)', exact: true }).setChecked(value);
    await admin.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
  };
  await setPublic(true);
  await visitor.goto(`${base}/novedades/${notice.id}`);
  await expect(visitor.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(visitor.getByRole('button', { name: 'Marcar como leído', exact: true })).toHaveCount(0);
  await expect(visitor.getByRole('button', { name: 'Ver adjunto', exact: true })).toHaveCount(0);
  assert.equal((await visitor.request.get(assetUrl)).status(), 401);
  await setPublic(false);
  await visitor.reload();
  await expect(visitor.getByRole('heading', { name: 'Aviso no disponible', exact: true })).toBeVisible();
  assert.equal((await visitor.request.get(assetUrl)).status(), 401);
  assert.equal((await find()).views, 2);

  await item.getByRole('button', { name: `Editar ${title}`, exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Quitar archivo', exact: true }).click();
  await admin.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  await owner.reload();
  await expect(owner.getByRole('button', { name: 'Ver adjunto', exact: true })).toHaveCount(0);
  await item.getByRole('button', { name: `Eliminar ${title}`, exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
  assert.ok(await find());
  await item.getByRole('button', { name: `Eliminar ${title}`, exact: true }).click();
  await admin.route(`**/api/entities/notices/${notice.id}`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULACRO: eliminación no disponible' }) }), { times: 1 });
  await admin.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(admin.getByRole('dialog').getByRole('alert')).toContainText('eliminación no disponible');
  assert.ok(await find());
  await admin.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  assert.equal(await find(), undefined);
  await owner.reload();
  await expect(owner.getByRole('heading', { name: 'Aviso no disponible', exact: true })).toBeVisible();
  console.log('Simulation verified: notice categories, search, pin, attachment privacy, read receipts and deletion retry');
}
