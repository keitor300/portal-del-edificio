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

test('owner registration requires approval, preserves SUM destination and revokes suspended sessions', async () => {
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const landing = await ownerContext.newPage();
  try {
    await landing.goto(baseURL);
    const popup = ownerContext.waitForEvent('page');
    await landing.getByRole('link', {name:'Reservar el SUM',exact:true}).first().click();
    const owner = await popup;
    await owner.waitForURL(/\/login/);
    await expect(owner.getByText('¿Primera vez en el portal?')).toBeVisible();
    await expect(owner.getByText('Antes de ingresar, tenés que solicitar el acceso de tu unidad.')).toBeVisible();
    await owner.getByRole('button',{name:'Solicitar acceso',exact:true}).click();
    await owner.getByLabel('Nombre y apellido').fill('Persona Demo');
    await owner.getByLabel('DNI',{exact:true}).fill('12345678');
    await owner.getByLabel('Email',{exact:true}).fill('persona.demo@example.com');
    await owner.getByLabel('Unidad',{exact:true}).selectOption('5C');
    await owner.getByLabel('Contraseña',{exact:true}).fill('Demo123456');
    await owner.getByLabel('Repetir contraseña').fill('Demo123456');
    await owner.getByRole('button',{name:'Enviar solicitud'}).click();
    await expect(owner.getByRole('status')).toContainText('Solicitud enviada');
    const recoveryCode = await owner.locator('.access-recovery code').innerText();
    await owner.getByLabel('Contraseña',{exact:true}).fill('Demo123456');
    await owner.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(owner.getByRole('status')).toContainText('pendiente');
    const admin = await ownerContext.newPage();
    await admin.goto(baseURL+'/demo/administracion/accesos');
    admin.on('dialog',dialog=>dialog.accept());
    await admin.getByRole('button',{name:'Aprobar acceso'}).click();
    await expect(admin.locator('.access-request .status')).toHaveText('Aprobado');
    await expect(admin.locator('.access-request')).toContainText('persona.demo@example.com');
    await owner.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(owner).toHaveURL(/\/demo\/propietario\/servicios\/sum$/);
    await expect(owner.getByLabel('Unidad que reserva')).toHaveValue('5C');
    await expect(owner.getByLabel('Unidad que reserva')).toBeDisabled();
    assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    await admin.getByRole('button',{name:'Suspender acceso'}).click();
    await expect(owner).toHaveURL(/\/login/);
    await owner.getByRole('button',{name:'Olvidé mi contraseña'}).click();
    await owner.getByLabel('Unidad',{exact:true}).selectOption('5C');
    await owner.getByLabel('Clave de recuperación').fill(recoveryCode);
    await owner.getByLabel('Nueva contraseña',{exact:true}).fill('NuevaDemo123');
    await owner.getByLabel('Repetir contraseña').fill('NuevaDemo123');
    await owner.getByRole('button',{name:'Guardar contraseña'}).click();
    await expect(owner.getByRole('status')).toContainText('Contraseña actualizada');
    await owner.getByLabel('Contraseña',{exact:true}).fill('NuevaDemo123');
    await owner.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(owner.getByRole('status')).toContainText('no está habilitado');
    await owner.screenshot({path:'C:/Temp/portal-owner-login.png',fullPage:true});
    await admin.screenshot({path:'C:/Temp/portal-owner-approvals.png',fullPage:true});
  } finally { await ownerContext.close(); }
});

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
  await expect(page.getByRole('heading', { name: 'Atención y servicios' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comunicaciones' }).first()).toHaveAttribute('href', '/admin/comunicaciones');

  await page.getByRole('link', { name: 'Más herramientas' }).first().click();
  await expect(page).toHaveURL(/\/admin\/menu$/);
  await page.getByRole('link', { name: /Reservas del SUM/ }).click();
  await expect(page).toHaveURL(/\/admin\/servicios\?tab=sum$/);
  await expect(page.getByRole('heading', { name: 'Atención y servicios' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Ingresar a administración' })).toBeVisible();
  assert.deepEqual(errors, []);
});
