import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';

export async function verifyPublicationInquiry({ owner, admin, neighbor, base, item }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  const before = (await state(admin)).messages.length;
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
