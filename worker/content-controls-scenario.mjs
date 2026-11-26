import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { expect } from '@playwright/test';

export async function verifyPublicationInquiry({ owner, admin, neighbor, base, item }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  const before = (await state(admin)).messages.length;
  if (item.collection === 'listings') {
    await owner.getByRole('button', { name: 'Cocheras', exact: true }).click();
    await expect(owner.getByRole('heading', { name: item.title, exact: true })).toBeVisible();
    await owner.getByRole('button', { name: 'Departamentos', exact: true }).click();
    await expect(owner.getByRole('heading', { name: item.title, exact: true })).toHaveCount(0);
    await owner.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(owner.getByRole('heading', { name: item.title, exact: true })).toBeVisible();
  }
  const row = owner.locator(item.collection === 'listings' ? '.list-row' : '.lost-row').filter({ has: owner.getByRole('heading', { name: item.title, exact: true }) });
  await row.getByRole('link', { name: item.collection === 'listings' ? 'Consultar' : 'Es mío', exact: true }).click();
  await expect(owner).toHaveURL(base + '/demo/propietario/servicios/chat?consulta=' + encodeURIComponent(item.title));
  const draft = `Quisiera consultar por: ${item.title}`;
  await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue(draft);
  await owner.locator('.services-composer').screenshot({ path: join(tmpdir(), 'portal-inquiry-draft-mobile.png') });
  assert.equal((await state(admin)).messages.length, before, 'Opening a publication inquiry must not send automatically');
  const edited = `${draft}. Mensaje editado para el simulacro.`;
  await owner.getByLabel('Mensaje', { exact: true }).fill(edited);
  await owner.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
  await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue(edited);
  await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue('');
  const messages = (await state(admin)).messages.filter(message => message.text === edited);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].unit, '7B');
  assert.equal((await state(neighbor)).messages.some(message => message.text === edited), false);
  await owner.reload();
  await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue(draft);
  assert.equal((await state(admin)).messages.filter(message => message.text === edited).length, 1, 'Reloading the consultation link must not resend a message');
  await owner.goto(base + '/demo/propietario/servicios/chat');
  await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue('');
}

export async function verifyImageAttachments({ owner, admin, neighbor, base }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  await owner.goto(base + '/demo/propietario/servicios/chat');
  const input = owner.getByLabel(/^Adjuntar archivo/);
  const before = (await state(admin)).messages.length;
  await input.setInputFiles({ name: 'rechazado.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(owner.getByRole('alert')).toContainText('Elegí una imagen JPG, PNG, WebP');
  await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(1048577) });
  await expect(owner.getByRole('alert')).toContainText('menos de 1 MB');
  await input.setInputFiles({ name: 'firma-invalida.png', mimeType: 'image/png', buffer: Buffer.from('No es una imagen') });
  await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(owner.getByRole('alert')).toContainText('Revisá el formato');
  assert.equal((await state(admin)).messages.length, before);
  await owner.getByRole('button', { name: 'Quitar archivo', exact: true }).click();
  await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(owner.getByRole('alert')).toContainText('Escribí un mensaje o adjuntá un archivo');
  for (const format of ['jpeg', 'png', 'webp']) {
    const name = `simulacro-imagen.${format === 'jpeg' ? 'jpg' : format}`;
    const mimeType = `image/${format}`;
    const buffer = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#486b5a' } }).toFormat(format).toBuffer();
    await input.setInputFiles({ name, mimeType, buffer });
    await expect(owner.getByText(name, { exact: true })).toBeVisible();
    await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect(owner.getByRole('button', { name: 'Quitar archivo', exact: true })).toHaveCount(0);
    const messages = (await state(admin)).messages.filter(message => message.attachment?.name === name);
    assert.equal(messages.length, 1);
    const attachment = messages[0].attachment;
    assert.equal(attachment.type, mimeType);
    assert.equal((await neighbor.request.get(base + attachment.url)).status(), 404);
    await owner.getByRole('button', { name: `Ver ${name}`, exact: true }).click();
    const dialog = owner.getByRole('dialog', { name, exact: true });
    await expect.poll(() => dialog.locator('img').evaluate(image => image.complete && image.naturalWidth === 24)).toBe(true);
    const downloading = owner.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
    const download = await downloading;
    assert.equal(await download.failure(), null);
    assert.equal(download.suggestedFilename(), name);
    assert.deepEqual(readFileSync(await download.path()), buffer);
    await owner.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    const invalid = await owner.request.post(base + '/api/files', { headers: { Origin: base }, data: { name, type: mimeType, url: `data:${mimeType};base64,${Buffer.from('Firma incorrecta').toString('base64')}` } });
    assert.equal(invalid.status(), 400);
  }
  assert.equal((await state(admin)).messages.length, before + 3);
  console.log('Simulation verified: JPG, PNG and WebP upload, render, exact download, privacy and invalid-file rejection');
}

export async function verifyBuildingGallery({ owner, base }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  for (const width of [390, 1440]) {
    await owner.setViewportSize({ width, height: 844 });
    await owner.goto(base + '/demo/propietario/mas/estado');
    const tiles = owner.locator('.gallery-item');
    await expect(tiles).toHaveCount(4);
    for (let index = 0; index < 4; index++) {
      const tile = tiles.nth(index);
      const title = await tile.locator('span').innerText();
      const source = await tile.locator('img').getAttribute('src');
      await tile.click();
      const dialog = owner.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('img')).toHaveAttribute('src', source);
      await expect.poll(() => dialog.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      assert.equal(await owner.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
      if (index % 2) await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
      else await owner.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(tile).toBeFocused();
    }
  }
  await owner.setViewportSize({ width: 390, height: 844 });
  console.log('Simulation verified: all four building photos open, render and return focus on mobile and desktop');
}
