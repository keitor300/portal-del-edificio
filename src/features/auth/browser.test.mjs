import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
let server;
let browser;
let context;
let page;
let baseURL;
const errors = [];

before(async () => {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 5185, strictPort: false } });
  await server.listen();
  baseURL = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});

after(async () => { await browser?.close(); await server?.close(); });

test('admin route requires the demo credentials, keeps internal links protected and supports logout', async () => {
  await page.goto(`${baseURL}/admin/servicios?tab=sum`);
  await expect(page.getByRole('heading', { name: 'Ingresar a administración' })).toBeVisible();
  await page.getByLabel('Usuario').fill('wrong');
  await page.getByLabel('Contraseña').fill('wrong');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toHaveText('El usuario o la contraseña no son correctos.');

  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('admin');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/admin\/servicios\?tab=sum$/);
  await expect(page.getByRole('heading', { name: 'Servicios del edificio' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comunicaciones' }).first()).toHaveAttribute('href', '/admin/comunicaciones');

  await page.getByRole('link', { name: 'Menú' }).first().click();
  await expect(page).toHaveURL(/\/admin\/menu$/);
  await page.getByRole('link', { name: /Reservas del SUM/ }).click();
  await expect(page).toHaveURL(/\/admin\/servicios\?tab=sum$/);
  await expect(page.getByRole('heading', { name: 'Servicios del edificio' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Ingresar a administración' })).toBeVisible();
  assert.deepEqual(errors, []);
});
