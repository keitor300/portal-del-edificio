import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs only against the disposable local database created by the browser suite.
export async function runExtendedScenario({ admin, owner, neighbor, base }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  await runMessagingScenario({ admin, owner, neighbor, base });
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  const save = async () => {
    await admin.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
  };
  const cases = [
    { collection: 'works', title: 'SIMULACRO - Reparacion del hall', route: '/edificio/obras',
      fields: { Proveedor: 'Proveedor ficticio', 'Presupuesto ($)': '25000.50', 'Avance (%)': '0' },
      states: ['Planificada', 'En ejecución', 'Pausada', 'Finalizada'] },
    { collection: 'statuses', title: 'SIMULACRO - Ascensor', route: '/mas/estado',
      states: ['Operativo', 'Habilitado', 'En mantenimiento', 'Corte programado', 'Fuera de servicio'] },
    { collection: 'lost', title: 'SIMULACRO - Llaves', route: '/mas/objetos',
      fields: { Lugar: 'Hall' }, states: ['En custodia', 'Devuelto'] },
    { collection: 'listings', title: 'SIMULACRO - Cochera', route: '/mas/disponibilidades',
      selects: { 'Tipo de espacio': 'Cochera', Operación: 'Alquiler' } },
    { collection: 'faqs', title: 'SIMULACRO - Consulta frecuente', route: '/mas/preguntas',
      titleLabel: 'Pregunta', fields: { Respuesta: 'Respuesta ficticia para la prueba.' } },
  ];
  for (const item of cases) {
    await admin.goto(`${base}/admin/contenido?tab=${item.collection}&new=1`);
    await admin.getByLabel(item.titleLabel ?? 'Título', { exact: true }).fill(item.title);
    for (const [label, value] of Object.entries(item.fields ?? {})) {
      await admin.getByLabel(label, { exact: true }).fill(value);
    }
    for (const [label, value] of Object.entries(item.selects ?? {})) {
      await admin.getByLabel(label, { exact: true }).selectOption(value);
    }
    await save();
    assert.ok((await state(neighbor))[item.collection].some(row => row.title === item.title));
    for (const status of item.states ?? []) {
      await admin.getByRole('button', { name: `Editar ${item.title}`, exact: true }).click();
      await admin.getByLabel('Estado', { exact: true }).selectOption(status);
      if (item.collection === 'works') await admin.getByLabel('Avance (%)', { exact: true }).fill(status === 'Finalizada' ? '100' : '25');
      await save();
      assert.equal((await state(owner))[item.collection].find(row => row.title === item.title).status, status);
    }
    await owner.goto(`${base}/demo/propietario${item.route}`);
    if (item.collection === 'faqs') {
      await expect(owner.locator('summary').filter({ hasText: item.title })).toBeVisible();
      await owner.locator('summary').filter({ hasText: item.title }).click();
      await expect(owner.getByText(item.fields.Respuesta, { exact: true })).toBeVisible();
    } else await expect(owner.getByText(item.title, { exact: true }).first()).toBeVisible();
    await admin.getByLabel('Buscar contenido').fill('NO-EXISTE-SIMULACRO');
    await expect(admin.getByRole('heading', { name: item.title, exact: true })).toHaveCount(0);
    await admin.getByLabel('Buscar contenido').fill('');
    await admin.getByRole('button', { name: `Eliminar ${item.title}`, exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Volver', exact: true }).click();
    assert.ok((await state(owner))[item.collection].some(row => row.title === item.title));
    await admin.getByRole('button', { name: `Eliminar ${item.title}`, exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    assert.equal((await state(owner))[item.collection].some(row => row.title === item.title), false);
    console.log(`Simulation verified: ${item.collection} CRUD and states`);
  }

  await admin.goto(`${base}/admin/comunidad?tab=reuniones`);
  for (const status of ['Cancelada', 'Programada', 'Realizada']) {
    await admin.getByRole('button', { name: 'Editar Reunión de prueba', exact: true }).click();
    await admin.getByLabel(/^Estado/).selectOption(status);
    await admin.getByRole('button', { name: 'Guardar reunión', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    assert.equal((await state(owner)).meetings[0].status, status);
  }
  await admin.goto(`${base}/admin/comunidad?tab=encuestas`);
  await admin.getByRole('button', { name: 'Cerrar Consulta de prueba', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Reabrir Consulta de prueba', exact: true })).toBeVisible();
  assert.equal((await state(neighbor)).polls[0].closed, true);
  await admin.getByRole('button', { name: 'Reabrir Consulta de prueba', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Cerrar Consulta de prueba', exact: true })).toBeVisible();
  assert.deepEqual((await state(owner)).polls[0].votes, [1, 0]);
  await admin.getByRole('button', { name: 'Editar Consulta de prueba', exact: true }).click();
  await expect(admin.getByLabel(/^Opciones/)).toHaveAttribute('readonly', '');
  await admin.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await admin.getByRole('button', { name: 'Resultados de Consulta de prueba', exact: true }).click();
  await expect(admin.getByRole('dialog')).toContainText('Por la mañana');
  await admin.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();

  for (const tab of ['encuestas', 'votaciones']) {
    await admin.goto(`${base}/admin/comunidad?tab=${tab}&new=1`);
    await admin.getByLabel('Título', { exact: true }).fill(`SIMULACRO - ${tab}`);
    await admin.getByLabel(/^Opciones/).fill('Opcion A\nOpcion B');
    await admin.route('**/api/entities/polls', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULACRO: guardado interrumpido' }) }), { times: 1 });
    const submit = admin.getByRole('button', { name: tab === 'encuestas' ? 'Guardar encuesta' : 'Guardar votación', exact: true });
    await submit.click();
    await expect(admin.getByRole('alert')).toContainText('SIMULACRO: guardado interrumpido');
    await expect(admin.getByLabel('Título', { exact: true })).toHaveValue(`SIMULACRO - ${tab}`);
    await submit.click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    assert.equal((await state(owner)).polls.filter(row => row.title === `SIMULACRO - ${tab}`).length, 1);
  }

  await admin.goto(`${base}/admin/comunidad?tab=temas`);
  for (const status of ['En agenda', 'No incluido', 'Resuelto', 'Pendiente']) {
    await admin.getByRole('button', { name: 'Revisar Propuesta de prueba', exact: true }).click();
    await admin.getByLabel(/^Estado de revisión/).selectOption(status);
    await admin.getByLabel(/^Respuesta de administración/).fill(`SIMULACRO: ${status}`);
    await admin.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
    assert.equal((await state(owner)).topics[0].status, status);
  }
  await owner.goto(`${base}/demo/propietario/edificio/reuniones?tab=temas`);
  await owner.getByRole('button', { name: 'Me interesa (0)', exact: true }).click();
  await expect(owner.getByRole('button', { name: 'Te interesa (1)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await owner.getByRole('button', { name: 'Te interesa (1)', exact: true }).click();
  await expect(owner.getByRole('button', { name: 'Me interesa (0)', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await owner.goto(`${base}/demo/propietario`);
  await owner.getByRole('link', { name: /Notificaciones:|Ver notificaciones/ }).click();
  await expect(owner).toHaveURL(/\/notificaciones$/);
  await owner.getByRole('button', { name: 'Marcar todas como leídas', exact: true }).click();
  await expect(owner.getByText('Estás al día', { exact: true })).toBeVisible();
  await owner.reload();
  await expect(owner.getByText('Estás al día', { exact: true })).toBeVisible();
  const inbox = await (await owner.request.get(`${base}/api/notifications`)).json();
  assert.ok(inbox.items.length > 0);
  assert.ok(inbox.items.every(row => row.read));

  const ownerRoutes = ['', '/novedades', '/edificio', '/edificio/expensas', '/edificio/reuniones', '/edificio/encuestas', '/edificio/documentos', '/edificio/cuentas', '/edificio/obras', '/servicios', '/servicios/sum', '/servicios/reclamos', '/servicios/chat', '/servicios/contactos', '/servicios/urgencias', '/mas', '/mas/disponibilidades', '/mas/objetos', '/mas/preguntas', '/mas/calendario', '/mas/estado'];
  const adminRoutes = ['', '/administradores', '/notificaciones', '/accesos', '/comunicaciones', '/finanzas', '/menu', '/comunidad', '/servicios', '/contenido'];
  for (const width of [320, 390, 1440]) {
    for (const [page, prefix, routes] of [[owner, '/demo/propietario', ownerRoutes], [admin, '/admin', adminRoutes]]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(`${base}${prefix}${route}`);
        await expect(page.locator('main h1').first()).toBeVisible();
        await expect(page.locator('vite-error-overlay')).toHaveCount(0);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false, `Overflow: ${width}px ${prefix}${route}`);
      }
    }
    console.log(`Simulation verified: 31 routes at ${width}px`);
  }
  for (const page of [owner, admin]) await page.setViewportSize({ width: 390, height: 844 });
  await owner.goto(`${base}/demo/propietario/servicios/sum`);
  await expect(owner.getByRole('heading', { name: 'Reservar el SUM', exact: true })).toBeVisible();
  await owner.screenshot({ path: join(tmpdir(), 'portal-simulacro-sum-mobile.png'), fullPage: true });
  await admin.goto(`${base}/admin/comunidad?tab=encuestas`);
  await expect(admin.getByRole('heading', { name: 'Comunidad', exact: true })).toBeVisible();
  await admin.screenshot({ path: join(tmpdir(), 'portal-simulacro-community-mobile.png'), fullPage: true });
}

async function runMessagingScenario({ admin, owner, neighbor, base }) {
  const state = async page => (await (await page.request.get(`${base}/api/state`)).json()).data;
  await owner.goto(`${base}/demo/propietario/servicios/chat`);
  for (const withFile of [false, true]) {
    const text = `SIMULACRO - Mensaje con respuesta perdida ${withFile ? 'y adjunto' : 'sin adjunto'}`;
    await owner.getByLabel('Mensaje', { exact: true }).fill(text);
    await expect(owner.getByRole('textbox', { name: 'Mensaje', exact: true })).toHaveAccessibleName('Mensaje');
    if (withFile) {
      await owner.getByLabel(/^Adjuntar archivo/).setInputFiles({ name: 'simulacro.txt', mimeType: 'text/plain', buffer: Buffer.from('Archivo ficticio privado de la unidad 7B.') });
      await expect(owner.getByText('simulacro.txt', { exact: true })).toBeVisible();
    }
    let uploads = 0;
    const onRequest = request => { if (request.method() === 'POST' && request.url() === `${base}/api/files`) uploads++; };
    owner.on('request', onRequest);
    await owner.route('**/api/messages', async route => {
      const saved = await route.fetch();
      assert.equal(saved.status(), 201);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SIMULACRO: respuesta perdida al enviar' }) });
    }, { times: 1 });
    await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect(owner.getByRole('alert')).toContainText('respuesta perdida');
    await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue(text);
    assert.equal((await state(admin)).messages.filter(row => row.text === text).length, 1);
    await owner.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect(owner.getByLabel('Mensaje', { exact: true })).toHaveValue('');
    const messages = (await state(admin)).messages.filter(row => row.text === text);
    assert.equal(messages.length, 1);
    assert.equal((await state(neighbor)).messages.some(row => row.text === text), false);
    assert.equal(uploads, withFile ? 1 : 0);
    owner.off('request', onRequest);
    if (withFile) {
      assert.equal((await neighbor.request.get(`${base}${messages[0].attachment.url}`)).status(), 404);
      await owner.getByRole('button', { name: 'Ver simulacro.txt', exact: true }).click();
      await expect(owner.getByRole('dialog')).toBeVisible();
      const downloaded = owner.waitForEvent('download');
      await owner.getByRole('dialog').getByRole('button', { name: 'Descargar archivo', exact: true }).click();
      const file = await downloaded;
      assert.equal(file.suggestedFilename(), 'simulacro.txt');
      assert.equal(await file.failure(), null);
      await owner.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    }
  }
  await neighbor.goto(`${base}/demo/propietario/servicios/chat`);
  await neighbor.getByLabel('Mensaje', { exact: true }).fill('SIMULACRO - Consulta independiente de 8A');
  await neighbor.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(neighbor.getByLabel('Mensaje', { exact: true })).toHaveValue('');
  await admin.goto(`${base}/admin/servicios?tab=chat`);
  const threads = admin.getByRole('navigation', { name: 'Consultas por unidad' });
  await threads.getByRole('button', { name: /^Unidad 7B/ }).click();
  await admin.getByLabel('Mensaje', { exact: true }).fill('Borrador exclusivo de 7B');
  await threads.getByRole('button', { name: /^Unidad 8A/ }).click();
  await expect(admin.getByLabel('Mensaje', { exact: true })).toHaveValue('');
  await admin.getByLabel('Mensaje', { exact: true }).fill('Respuesta privada para 8A');
  await admin.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(admin.getByLabel('Mensaje', { exact: true })).toHaveValue('');
  assert.ok((await state(neighbor)).messages.some(row => row.text === 'Respuesta privada para 8A'));
  assert.equal((await state(owner)).messages.some(row => row.text === 'Respuesta privada para 8A'), false);
  console.log('Simulation verified: lost message responses, private attachment download and independent admin drafts');
}
