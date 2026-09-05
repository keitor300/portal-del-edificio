import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Mount the app-owned service and notice routes through a real Vite source module.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const routes = [
  '/servicios', '/servicios/sum', '/servicios/reclamos', '/servicios/chat', '/servicios/contactos', '/servicios/urgencias', '/admin/servicios',
  '/demo/propietario/novedades', '/demo/propietario/novedades/aviso-1', '/demo/administracion/comunicaciones', '/demo/administracion/comunicaciones/aviso-1',
];
const html = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Portal QA</title></head><body><main id="root"></main><script type="module" src="/src/features/services/browser-harness.tsx"></script></body></html>';
let server;
let browser;
let context;
let page;
let baseURL;
const errors = [];

before(async () => {
  server = await createServer({ root, appType: 'custom', server: { host: '127.0.0.1', port: 5184, strictPort: false }, plugins: [{
    name: 'services-test-harness', configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (!request.headers.accept?.includes('text/html')) return next();
        vite.transformIndexHtml(request.url, html).then(result => { response.setHeader('Content-Type', 'text/html'); response.end(result); }).catch(next);
      });
    },
  }] });
  await server.listen();
  baseURL = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});

after(async () => { await browser?.close(); await server?.close(); });

async function goto(path) {
  await page.goto(`${baseURL}${path}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
}

test('booking acceptance, reload, cross-role collision, cancellation, blocking and rule editing', async () => {
  await goto('/servicios/sum');
  await page.getByLabel('Fecha de reserva').fill('2099-09-06');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await expect(page.getByRole('alert')).toContainText('Aceptá el reglamento');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await page.reload();
  await page.getByLabel('Fecha de reserva').fill('2099-09-06');
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await expect(page.getByRole('radio')).toHaveCount(10);
  await expect(page.getByText('15:00 a 17:00', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Disponibilidad de todas las unidades' })).toBeVisible();
  await expect(page.getByText(/Unidad 3A/).first()).toBeVisible();
  await goto('/admin/servicios?tab=sum');
  await page.getByLabel('Fecha de reserva').fill('2099-09-06');
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await page.getByLabel('Unidad', { exact: true }).fill('2C');
  await page.getByRole('radio', { name: '17:00 a 18:00' }).check();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await page.getByLabel('Fecha a bloquear').fill('2099-09-06');
  await page.getByRole('button', { name: 'Bloquear día' }).click();
  await expect(page.getByRole('alert')).toContainText('tiene reservas');
  await page.getByRole('button', { name: /Cancelar reserva del .*2099.*10:00/ }).count().then(count => assert.equal(count, 0));
  await page.getByRole('button', { name: /Cancelar reserva del 6 de septiembre a las 10:00, unidad 7B/ }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('radio').first()).toBeEnabled();
  await page.getByRole('button', { name: /Cancelar reserva del 6 de septiembre a las 17:00, unidad 2C/ }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByRole('button', { name: 'Bloquear día' }).click();
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Desbloquear 6 de septiembre', exact: true }).click();
  await expect(page.getByRole('radio').first()).toBeEnabled();
  await page.getByRole('button', { name: 'Editar reglamento' }).click();
  await page.getByLabel('Reglamento', { exact: true }).fill('Reglamento actualizado para la prueba.');
  await page.getByRole('button', { name: 'Guardar reglamento' }).click();
  await goto('/servicios/sum');
  await expect(page.getByRole('region', { name: 'Reglamento del SUM' })).toHaveText('Reglamento actualizado para la prueba.');
});

test('administration notices persist, keep their role context and update the owner view', async () => {
  const title = 'Aviso QA de comunicaciones';
  const editedTitle = 'Aviso QA actualizado';
  await goto('/demo/administracion/comunicaciones');
  await page.getByRole('button', { name: 'Nuevo aviso' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Nuevo aviso' });
  await createDialog.getByLabel('Título').fill(title);
  await createDialog.getByLabel('Mensaje').fill('Contenido de prueba para verificar la publicación.');
  await createDialog.getByRole('button', { name: 'Publicar aviso' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  const adminLink = page.getByRole('link', { name: new RegExp(title) }).first();
  const adminHref = await adminLink.getAttribute('href');
  assert.match(adminHref ?? '', /^\/demo\/administracion\/comunicaciones\//);
  await adminLink.click();
  await expect(page).toHaveURL(/\/demo\/administracion\/comunicaciones\/[^/]+$/);
  await page.getByRole('button', { name: 'Marcar como leído' }).click();
  await expect(page.getByRole('button', { name: 'Marcado como leído' })).toBeDisabled();

  await goto('/demo/propietario/novedades');
  const ownerLink = page.getByRole('link', { name: new RegExp(title) }).first();
  const ownerHref = await ownerLink.getAttribute('href');
  assert.match(ownerHref ?? '', /^\/demo\/propietario\/novedades\//);
  await expect(ownerLink).toBeVisible();

  await goto('/demo/administracion/comunicaciones');
  const noticeRow = page.locator('.list > div').filter({ hasText: title });
  await noticeRow.getByRole('button', { name: `Editar ${title}` }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar aviso' });
  await editDialog.getByLabel('Título').fill(editedTitle);
  await editDialog.getByRole('button', { name: 'Publicar aviso' }).click();
  await expect(page.getByText(editedTitle, { exact: true })).toBeVisible();

  const editedRow = page.locator('.list > div').filter({ hasText: editedTitle });
  await editedRow.getByRole('button', { name: 'Fijar' }).click();
  await expect(editedRow.getByRole('button', { name: 'Desfijar' })).toBeVisible();
  await editedRow.getByRole('button', { name: `Eliminar ${editedTitle}` }).click();
  await page.getByRole('dialog', { name: 'Confirmar eliminación' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);
});

test('issue photo and dedicated conversation persist; admin filters, replies, resolves and reopens', async () => {
  await goto('/servicios/reclamos');
  await page.getByRole('button', { name: 'Nuevo reclamo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Categoría', { exact: true }).selectOption('Agua');
  await dialog.getByLabel('¿Qué ocurrió?').fill('Prueba: humedad en el hall');
  await dialog.getByLabel('Foto (opcional)').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  await expect(dialog.getByAltText('Foto que se adjuntará al reclamo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar reclamo demo' }).click();
  await expect(dialog.getByRole('button', { name: 'Ver foto adjunta' })).toBeVisible();
  await dialog.getByLabel('Mensaje', { exact: true }).fill('Detalle adicional del propietario');
  await dialog.getByRole('button', { name: 'Guardar mensaje demo' }).click();
  await expect(dialog.getByRole('log')).toContainText('Detalle adicional del propietario');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ver reclamo: Prueba: humedad en el hall' }).click();
  await expect(dialog.getByRole('log')).toContainText('Detalle adicional del propietario');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await goto('/admin/servicios?tab=reclamos');
  await page.getByLabel('Buscar reclamo o unidad').fill('Prueba: humedad');
  await expect(page.locator('.list-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver reclamo: Prueba: humedad en el hall' }).click();
  await dialog.getByLabel('Estado del reclamo').selectOption('En curso');
  await dialog.getByLabel('Mensaje', { exact: true }).fill('Respuesta local de administración');
  await dialog.getByRole('button', { name: 'Guardar mensaje demo' }).click();
  await dialog.getByRole('button', { name: 'Resolver reclamo', exact: true }).click();
  await page.getByRole('dialog', { name: 'Resolver reclamo', exact: true }).getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(dialog.getByText('Reclamo resuelto. La conversación queda disponible para consulta.')).toBeVisible();
  await dialog.getByLabel('Estado del reclamo').selectOption('En curso');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await goto('/servicios/reclamos');
  await page.getByRole('button', { name: 'Ver reclamo: Prueba: humedad en el hall' }).click();
  await expect(dialog.getByRole('log')).toContainText('Respuesta local de administración');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
});

test('central conversation stays separate and attachments survive reload and role switching', async () => {
  await goto('/servicios/chat');
  await expect(page.getByRole('log')).not.toContainText('Detalle adicional del propietario');
  await page.getByRole('button', { name: 'Guardar mensaje demo' }).click();
  await expect(page.getByRole('alert')).toContainText('Escribí un mensaje');
  await page.getByLabel('Mensaje', { exact: true }).fill('Consulta central del propietario');
  await page.getByLabel('Adjuntar archivo').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('Archivo demo de prueba') });
  await expect(page.getByText('nota.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar mensaje demo' }).click();
  await page.reload();
  await expect(page.getByRole('log')).toContainText('Consulta central del propietario');
  await expect(page.getByRole('button', { name: 'Ver nota.txt' })).toBeVisible();
  await goto('/admin/servicios?tab=chat');
  await expect(page.getByRole('log')).toContainText('Consulta central del propietario');
  await page.getByLabel('Mensaje', { exact: true }).fill('Respuesta central demo');
  await page.getByRole('button', { name: 'Guardar mensaje demo' }).click();
  await goto('/servicios/chat');
  await expect(page.getByRole('log')).toContainText('Respuesta central demo');
});

test('every service route renders at mobile, tablet and desktop sizes without overflow or broken images', async () => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await goto(path);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: overflow at ${width}px`);
      assert.equal(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).length), 0, `${path}: broken image`);
    }
  }
  await goto('/servicios/urgencias');
  for (const category of ['Agua', 'Ascensor', 'Gas', 'Electricidad', 'Otro']) {
    await page.getByLabel('Tipo de urgencia').selectOption(category);
    await expect(page.getByRole('heading', { name: `Contactos de ${category.toLocaleLowerCase('es')}`, exact: true })).toBeVisible();
  }
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await goto('/servicios/contactos');
  await page.getByLabel('Categoría de contacto').selectOption('Agua');
  await expect(page.locator('.list-row')).toHaveCount(1);
});

test('accessibility basics, modal focus, reduced motion and console health', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/servicios/sum', '/servicios/reclamos', '/servicios/chat', '/servicios/contactos', '/servicios/urgencias', '/admin/servicios?tab=sum']) {
    await goto(path);
    const result = await new AxeBuilder({ page }).include('.services-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).disableRules(['color-contrast']).analyze();
    assert.deepEqual(result.violations.map(item => item.id), [], `${path}: accessibility violations`);
  }
  await goto('/servicios/reclamos');
  await page.getByRole('button', { name: 'Nuevo reclamo' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nuevo reclamo' })).toBeFocused();
  assert.equal(await page.locator('.services-page button').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
  assert.deepEqual(errors, []);
});
