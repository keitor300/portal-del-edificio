import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';

const ownerRoot = '/demo/propietario';
const ownerHeadings = {
  '/edificio': 'Mi edificio', '/servicios': 'Servicios', '/mas': 'Más del edificio',
  '/edificio/cuentas': 'Cuentas del edificio', '/edificio/expensas': 'Expensas',
  '/edificio/documentos': 'Documentos', '/edificio/obras': 'Obras y avances',
  '/edificio/reuniones': 'Reuniones y participación', '/edificio/encuestas': 'Encuestas y votaciones',
  '/servicios/sum': 'Reservar el SUM', '/servicios/reclamos': 'Reclamos',
  '/servicios/chat': 'Chat con administración', '/servicios/contactos': 'Contactos y ayuda',
  '/servicios/urgencias': 'Urgencias', '/mas/estado': 'Estado del edificio',
  '/mas/calendario': 'Calendario del edificio', '/mas/disponibilidades': 'Disponibilidades',
  '/mas/preguntas': 'Preguntas frecuentes', '/mas/objetos': 'Objetos perdidos',
};
const adminHeadings = {
  '/admin': 'El edificio, al día.', '/admin/accesos': 'Accesos de propietarios',
  '/admin/administradores': 'Administradores', '/admin/servicios': 'Atención y servicios',
  '/admin/comunidad': 'Comunidad', '/admin/contenido': 'Contenido',
  '/admin/comunicaciones': 'Comunicaciones', '/admin/finanzas': 'Cuentas del consorcio',
  '/admin/menu': 'Más herramientas',
};
const tabs = { sum: 'SUM', reclamos: 'Reclamos', chat: 'Chat', reuniones: 'Reuniones', encuestas: 'Encuestas', votaciones: 'Votaciones', documents: 'Documentos', works: 'Obras', statuses: 'Estado del edificio' };

export async function runNavigationReview({ owner, admin, base }) {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  let clicks = 0;
  const stateBefore = (await (await admin.request.get(`${base}/api/state`)).json()).data;
  async function destination(page, href, isAdmin = false) {
    await expect(page).toHaveURL(base + href);
    const url = new URL(href, base);
    const heading = isAdmin ? adminHeadings[url.pathname] : ownerHeadings[url.pathname.slice(ownerRoot.length)];
    assert.ok(heading, `Unmapped navigation target: ${href}`);
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
    if (isAdmin && url.searchParams.has('tab')) {
      await expect(page.locator('.tabs').first().getByRole('button', { name: tabs[url.searchParams.get('tab')], exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
  }

  // A return link must keep the owner inside the authenticated workspace.
  for (const [from, to] of [
    ['/edificio/documentos', '/edificio'], ['/edificio/reuniones', '/edificio'], ['/edificio/encuestas', '/edificio'],
    ['/edificio/obras', '/edificio/documentos'], ['/servicios/sum', '/servicios'],
    ['/servicios/reclamos', '/servicios'], ['/servicios/chat', '/servicios'], ['/servicios/contactos', '/servicios'], ['/servicios/urgencias', '/servicios'],
    ['/mas/calendario', '/mas'], ['/mas/estado', '/mas'], ['/mas/objetos', '/mas'], ['/mas/preguntas', '/mas'], ['/mas/disponibilidades', '/mas'],
  ]) {
    await owner.goto(base + ownerRoot + from);
    await owner.getByRole('link', { name: 'Volver', exact: true }).click();
    await destination(owner, ownerRoot + to);
    clicks++;
  }

  for (const width of [390, 1440]) {
    for (const [page, menu, count, isAdmin] of [[owner, ownerRoot + '/mas', 18, false], [admin, '/admin/menu', 17, true]]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + menu);
      const entries = page.locator('main .admin-tool-quick, main .admin-tool-card');
      await expect(entries).toHaveCount(count);
      const links = await entries.evaluateAll(elements => elements.map(element => ({ label: element.querySelector('strong').textContent, href: element.getAttribute('href') })));
      for (const link of links) {
        await entries.filter({ has: page.getByText(link.label, { exact: true }) }).click();
        await destination(page, link.href, isAdmin);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
        await page.goBack();
        await destination(page, menu, isAdmin);
        clicks++;
      }
    }
    for (const [label, suffix] of [['Inicio', ''], ['Mi edificio', '/edificio'], ['Servicios', '/servicios'], ['Más', '/mas']]) {
      await owner.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: label, exact: true }).click();
      await expect(owner).toHaveURL(base + ownerRoot + suffix);
      if (suffix) await destination(owner, ownerRoot + suffix);
      else await expect(owner.getByRole('heading', { name: /^Hola, Unidad/ })).toBeVisible();
      clicks++;
    }
    for (const [label, suffix] of [['Inicio', ''], ['Comunicaciones', '/comunicaciones'], ['Cuentas', '/finanzas'], ['Propietarios', '/accesos'], ['Administradores', '/administradores'], ['Más herramientas', '/menu']]) {
      if (width === 390) await admin.getByRole('button', { name: 'Menú', exact: true }).click();
      await admin.locator(width === 390 ? '.drawer-nav' : '.admin-sidebar').getByRole('link', { name: label, exact: true }).click();
      await destination(admin, '/admin' + suffix, true);
      if (width === 390) {
        await expect(admin.locator('.drawer-nav')).toHaveCount(0);
        await expect(admin.getByRole('button', { name: 'Menú', exact: true })).toHaveAttribute('aria-expanded', 'false');
      }
      clicks++;
    }
    for (const [label, title, secondary] of [
      ['Publicar un aviso', 'Nuevo aviso', false], ['Nuevo aviso', 'Nuevo aviso', false],
      ['Crear reunión', 'Crear reunión', false], ['Registrar movimiento', 'Anotar movimiento de caja', false],
      ['Cargar expensas', 'Nueva liquidación', false], ['Publicar reparación', 'Agregar · Obras', true],
      ['Agregar documento', 'Agregar · Documentos', true], ['Crear encuesta', 'Crear encuesta', true],
    ]) {
      await admin.goto(base + '/admin');
      if (secondary) await admin.locator('.admin-secondary-actions summary').click();
      await admin.locator('main a').filter({ hasText: label }).click();
      const dialog = admin.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(admin.getByRole('dialog')).toHaveCount(0);
      assert.notEqual(new URL(admin.url()).searchParams.get('new'), '1');
      clicks++;
    }
  }

  for (const from of ['/edificio', '/servicios']) {
    await owner.goto(base + ownerRoot + from);
    const gateways = owner.locator('main a.gateway');
    await expect(gateways).toHaveCount(4);
    const hrefs = await gateways.evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    for (const href of hrefs) {
      assert.ok(href.startsWith(ownerRoot + '/'), `Owner gateway escaped its workspace: ${href}`);
      await owner.locator(`main a.gateway[href="${href}"]`).click();
      await destination(owner, href);
      await owner.goBack();
      await destination(owner, ownerRoot + from);
      clicks++;
    }
  }
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.goto(base + ownerRoot + '/edificio/documentos');
  await owner.getByRole('link', { name: 'Volver', exact: true }).click();
  await destination(owner, ownerRoot + '/edificio');
  await owner.screenshot({ path: join(tmpdir(), 'portal-navigation-owner-mobile.png'), fullPage: true });
  const stateAfter = (await (await admin.request.get(`${base}/api/state`)).json()).data;
  assert.deepEqual(stateAfter, stateBefore, 'Browsing tools and closing empty forms must not change data');
  console.log(`Simulation verified: ${clicks} owner/admin return, directory, navigation and creation links clicked without saving data`);
}
