import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import https from 'node:https';
import { chromium, expect } from '@playwright/test';
import { hashPassword } from './auth.mjs';
import { firebaseRegister } from './firebase.mjs';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'portal-browser-'));
const cli = join(root, 'node_modules/wrangler/bin/wrangler.js');
const base = 'https://127.0.0.1:8791';
const password = `Test-${crypto.randomUUID()}`;
const firebase = process.env.PORTAL_TEST_FIREBASE === '1';
const authEnv = firebase ? { AUTH_PROVIDER:'firebase', RUNTIME_ENV:'test', FIREBASE_PROJECT_ID:'demo-portal-edificio', FIREBASE_API_KEY:'local-test-key', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099' } : { AUTH_PROVIDER:'local', RUNTIME_ENV:'test' };
let server;
let browser;
let logs = '';
const errors = [];
const run = args => execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });

before(async () => {
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, env: { ...process.env, VITE_PORTAL_MODE: 'production' }, stdio: 'pipe' });
  run(['d1','migrations','apply','portal-edificio-produccion','--local','--persist-to',temp]);
  const fixture = join(temp, 'fixture.sql');
  if(firebase){
    const cleared=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-portal-edificio/accounts',{method:'DELETE'});
    assert.equal(cleared.status,200);
  }
  const uid = firebase ? await firebaseRegister(authEnv,'admin@example.invalid',password) : null;
  const hash = firebase ? 'firebase' : await hashPassword(password);
  const sqlValue = value => value === null ? 'NULL' : `'${value.replaceAll("'","''")}'`;
  writeFileSync(fixture, `INSERT INTO users(id,name,email,role,status,password_hash,firebase_uid) VALUES ('test-admin','Admin de prueba','admin@example.invalid','admin','approved',${sqlValue(hash)},${sqlValue(uid)}); UPDATE settings SET rules='Reglamento exclusivo para pruebas locales',version=version+1 WHERE id=1;`);
  run(['d1','execute','portal-edificio-produccion','--local','--persist-to',temp,'--file',fixture]);
  server = spawn(process.execPath, [cli,'dev','--ip','127.0.0.1','--port','8791','--local-protocol','https','--persist-to',temp,...Object.entries(authEnv).flatMap(([key,value])=>['--var',`${key}:${value}`])], { cwd: root, stdio: 'pipe' });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  let ready = false;
  for (let i=0;i<60;i++) {
    try {
      const status = await new Promise((resolve,reject)=>{
        https.get(`${base}/api/health`,{rejectUnauthorized:false},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);
      });
      if(status===200){ready=true;break;}
    } catch { /* Worker startup. */ }
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Local Worker did not start: ${logs}`);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
});
after(async () => {
  await browser?.close();
  if(server && server.exitCode===null){
    if(process.platform==='win32')execFileSync('taskkill',['/pid',String(server.pid),'/t','/f'],{stdio:'pipe'});
    else server.kill();
    if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));
  }
  assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + '\\') || resolve(temp).startsWith(resolve(tmpdir()) + '/'));
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});
async function pageFor() {
  const context = await browser.newContext({ viewport: { width:390,height:844 }, locale:'es-AR', ignoreHTTPSErrors:true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      console.error(`CSP violation: ${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', message => {
    if(message.text().startsWith('CSP violation:'))errors.push(message.text());
  });
  return page;
}

test('resident registers from QR entry, administrator approves from another browser, SUM is shared, chat is private', async () => {
  const owner = await pageFor();
  await owner.goto(base);
  await expect(owner.getByText('Recorrido demo',{exact:true})).toHaveCount(0);
  await expect(owner.getByRole('link',{name:'Ver demo Administración'})).toHaveCount(0);
  await expect(owner.getByRole('link',{name:'Administración',exact:true}).first()).toHaveAttribute('href','/admin');
  await expect(owner.getByText('No hay avisos públicos publicados.',{exact:true})).toBeVisible();
  await owner.goto(`${base}/contacto`);
  await expect(owner.getByRole('link',{name:'Hablar con Administración'})).toBeVisible();
  await owner.goto(`${base}/demo`);
  await expect(owner).toHaveURL(/\/login$/);
  const entry = await owner.goto(`${base}/login?mode=register`);
  const securityHeaders = await entry.allHeaders();
  assert.equal(securityHeaders['x-frame-options'],'DENY');
  assert.equal(securityHeaders['x-content-type-options'],'nosniff');
  assert.match(securityHeaders['content-security-policy'],/frame-ancestors 'none'/);
  assert.match(securityHeaders['content-security-policy'],/script-src 'self';/);
  assert.equal(securityHeaders['referrer-policy'],'strict-origin-when-cross-origin');
  await owner.getByLabel('Nombre y apellido').fill('Propietario de prueba');
  await expect(owner.getByLabel('DNI',{exact:true})).toHaveCount(0);
  await owner.getByLabel('Email',{exact:true}).fill('owner@example.invalid');
  await owner.getByLabel('Unidad',{exact:true}).selectOption('7B');
  await owner.getByLabel('Contraseña',{exact:true}).fill(password);
  await owner.getByLabel('Repetir contraseña').fill(password);
  const registrationResponse=owner.waitForResponse(response=>response.url()===`${base}/api/auth/register`&&response.request().method()==='POST');
  await owner.getByRole('button',{name:'Enviar solicitud'}).click();
  const registered=await registrationResponse;
  assert.equal(registered.status(),201,await registered.text());
  await expect(owner.getByRole('status')).toContainText('Solicitud enviada');
  await expect(owner.getByRole('button',{name:'Entrar como Unidad 7B'})).toHaveCount(0);

  const admin = await pageFor();
  await admin.goto(`${base}/admin`);
  await admin.getByLabel('Usuario o email',{exact:true}).fill('admin@example.invalid');
  await admin.getByLabel('Contraseña',{exact:true}).fill(password);
  await admin.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(admin.getByRole('heading',{name:'Ingresar a administración'})).toHaveCount(0);
  await expect.poll(async()=> (await (await admin.request.get(`${base}/api/auth/session`)).json()).user?.role).toBe('admin');
  await admin.goto(`${base}/admin/accesos`);
  admin.on('dialog',dialog=>dialog.accept());
  await admin.getByRole('button',{name:'Aprobar acceso'}).click();
  await admin.getByLabel('Ver solicitudes').selectOption('approved');
  await expect(admin.getByRole('heading',{name:'Propietario de prueba'})).toBeVisible();

  await owner.getByLabel('Contraseña',{exact:true}).fill(password);
  await owner.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(owner).toHaveURL(/\/demo\/propietario$/);
  await owner.goto(`${base}/demo/propietario/servicios/sum`);
  const date = new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  await owner.getByLabel('Fecha de reserva').fill(date);
  await owner.getByLabel('Hora de inicio',{exact:true}).selectOption('15:00');
  await owner.getByLabel('Hora de finalización',{exact:true}).selectOption('18:30');
  await owner.getByRole('checkbox').check();
  await owner.getByRole('button',{name:'Continuar con la reserva'}).click();
  await owner.route('**/api/reservations',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fallo de conexión de prueba. Volvé a intentar.'})}),{times:1});
  await owner.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
  await expect(owner.getByRole('alert')).toContainText('Fallo de conexión de prueba');
  await expect(owner.getByLabel('Hora de inicio',{exact:true})).toHaveValue('15:00');
  await expect(owner.getByLabel('Hora de finalización',{exact:true})).toHaveValue('18:30');
  await expect(owner.getByRole('status').filter({hasText:'Reserva confirmada'})).toHaveCount(0);
  await owner.getByRole('button',{name:'Continuar con la reserva'}).click();
  await owner.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
  await expect(owner.getByRole('status').filter({hasText:'Reserva confirmada'})).toBeVisible();
  await admin.goto(`${base}/admin/servicios?tab=sum`);
  await expect(admin.getByText('15:00 a 18:30',{exact:false}).first()).toBeVisible();

  await owner.goto(`${base}/demo/propietario/servicios/chat`);
  await owner.getByLabel('Mensaje',{exact:true}).fill('Consulta privada desde otro celular');
  await owner.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect(owner.getByText('Consulta privada desde otro celular',{exact:true})).toBeVisible();
  await admin.goto(`${base}/admin/servicios?tab=chat`);
  await expect(admin.getByText('Consulta privada desde otro celular',{exact:true}).first()).toBeVisible();

  const neighbor = await pageFor();
  const headers = { Origin:base };
  const registration = await neighbor.request.post(`${base}/api/auth/register`,{headers,data:{name:'Otra unidad',email:'neighbor@example.invalid',unit:'8A',password}});
  assert.equal(registration.status(),201);
  const access = await (await admin.request.get(`${base}/api/admin/access`)).json();
  const neighborId = access.users.find(user=>user.unit==='8A').id;
  const approval = await admin.request.patch(`${base}/api/admin/access/${neighborId}`,{headers,data:{status:'approved'}});
  assert.equal(approval.status(),200);
  await neighbor.goto(`${base}/login`);
  await neighbor.getByLabel('Unidad',{exact:true}).selectOption('8A');
  await neighbor.getByLabel('Contraseña',{exact:true}).fill(password);
  await neighbor.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(neighbor).toHaveURL(/\/demo\/propietario$/);
  await neighbor.goto(`${base}/demo/propietario/servicios/sum`);
  await expect(neighbor.getByText('15:00 a 18:30',{exact:true})).toBeVisible();
  const neighborState = await (await neighbor.request.get(`${base}/api/state`)).json();
  assert.ok(!JSON.stringify(neighborState).includes('Consulta privada desde otro celular'));
  const original = neighborState.data.reservations.find(row=>row.unit==='7B');
  assert.equal((await neighbor.request.delete(`${base}/api/reservations/${original.id}`,{headers})).status(),403);

  const raceDate = new Date(Date.now()+15*86400000).toISOString().slice(0,10);
  const booking = {date:raceDate,time:'15:00',endTime:'18:30',acceptedRules:'Reglamento exclusivo para pruebas locales'};
  const contenders = [owner,neighbor];
  const results = await Promise.all(contenders.map(page=>page.request.post(`${base}/api/reservations`,{headers,data:booking})));
  assert.deepEqual(results.map(response=>response.status()).sort(),[201,409]);
  const winner = results.findIndex(response=>response.status()===201);
  const reservation = await results[winner].json();
  assert.equal((await contenders[winner].request.delete(`${base}/api/reservations/${reservation.id}`,{headers})).status(),200);
  assert.equal((await contenders[1-winner].request.post(`${base}/api/reservations`,{headers,data:booking})).status(),201);

  // Exercise duplicate submissions and interval conflicts through independent
  // authenticated requests, then inspect persisted rows rather than just HTTP codes.
  const bookingRaces=[
    {name:'same-unit duplicate',pages:[owner,owner],ranges:[['15:00','18:30'],['15:00','18:30']]},
    {name:'partial overlap',pages:[owner,neighbor],ranges:[['15:00','18:30'],['18:00','20:00']]},
    {name:'contained interval',pages:[owner,neighbor],ranges:[['15:00','20:00'],['16:00','17:00']]},
    {name:'overnight overlap',pages:[owner,neighbor],ranges:[['22:00','01:00'],['23:30','00:30']]},
    {name:'adjacent intervals',pages:[owner,neighbor],ranges:[['15:00','17:00'],['17:00','18:30']],expected:2},
  ];
  for(const [index,scenario] of bookingRaces.entries()){
    const date=new Date(Date.now()+(20+index)*86400000).toISOString().slice(0,10);
    const outcomes=await Promise.all(scenario.pages.map((page,i)=>page.request.post(`${base}/api/reservations`,{headers,data:{...booking,date,time:scenario.ranges[i][0],endTime:scenario.ranges[i][1]}})));
    assert.deepEqual(outcomes.map(response=>response.status()).sort(),scenario.expected===2?[201,201]:[201,409],scenario.name);
    const saved=(await(await owner.request.get(`${base}/api/reservations`)).json()).reservations.filter(row=>row.date===date&&row.status==='confirmed');
    assert.equal(saved.length,scenario.expected??1,scenario.name);
    for(const row of saved)assert.ok(['7B','8A'].includes(row.unit));
    if(!scenario.expected){
      const winningIndex=outcomes.findIndex(response=>response.status()===201);
      const retry=await scenario.pages[winningIndex].request.post(`${base}/api/reservations`,{headers,data:{...booking,date,time:scenario.ranges[winningIndex][0],endTime:scenario.ranges[winningIndex][1]}});
      assert.equal(retry.status(),409,`${scenario.name}: retry cannot create another booking`);
      const afterRetry=(await(await owner.request.get(`${base}/api/reservations`)).json()).reservations.filter(row=>row.date===date&&row.status==='confirmed');
      assert.equal(afterRetry.length,1,scenario.name);
    }
  }

  await admin.goto(`${base}/admin/finanzas?new=1`);
  await admin.getByLabel('Qué se anotó').fill('Reparación de prueba');
  await admin.getByLabel(/^Importe en pesos/).fill('1250,50');
  await admin.route('**/api/entities/movements',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Guardado no disponible de prueba'})}),{times:1});
  await admin.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
  await expect(admin.getByRole('alert')).toContainText('Guardado no disponible');
  await expect(admin.getByLabel('Qué se anotó')).toHaveValue('Reparación de prueba');
  await admin.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  const finances = (await (await owner.request.get(`${base}/api/state`)).json()).data;
  assert.equal(finances.movements.find(row=>row.title==='Reparación de prueba').amount,1250.5);

  await admin.goto(`${base}/admin/finanzas?tab=presupuestos&new=1`);
  const budgetForm = admin.getByRole('dialog');
  await budgetForm.getByLabel('Título',{exact:true}).fill('Presupuesto para reparar luminarias');
  await budgetForm.getByLabel('Importe presupuestado en pesos').fill('25000,50');
  await budgetForm.getByLabel('Categoría',{exact:true}).fill('Mantenimiento');
  await budgetForm.getByLabel(/^Estado/).selectOption('Aprobado');
  await admin.route('**/api/entities/budgets',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Presupuesto no guardado: prueba de conexión'})}),{times:1});
  await budgetForm.getByRole('button',{name:'Guardar presupuesto',exact:true}).click();
  await expect(budgetForm.getByRole('alert')).toContainText('Presupuesto no guardado');
  await expect(budgetForm.getByLabel('Título',{exact:true})).toHaveValue('Presupuesto para reparar luminarias');
  assert.equal((await(await admin.request.get(`${base}/api/state`)).json()).data.budgets.length,0);
  await budgetForm.getByRole('button',{name:'Guardar presupuesto',exact:true}).click();
  await expect(budgetForm).toHaveCount(0);
  const sharedBudgets=(await(await owner.request.get(`${base}/api/state`)).json()).data.budgets;
  assert.equal(sharedBudgets.length,1);
  assert.equal(sharedBudgets[0].amount,25000.5);
  await owner.goto(`${base}/demo/propietario/edificio/cuentas?tab=presupuestos`);
  await expect(owner.getByText('Presupuesto para reparar luminarias',{exact:true})).toBeVisible();
  await expect(owner.getByRole('button',{name:/Eliminar Presupuesto/})).toHaveCount(0);
  assert.equal((await owner.request.delete(`${base}/api/entities/budgets/${sharedBudgets[0].id}`,{headers})).status(),403);
  await admin.getByRole('button',{name:'Eliminar Presupuesto para reparar luminarias',exact:true}).click();
  await admin.route(`**/api/entities/budgets/${sharedBudgets[0].id}`,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Eliminación no disponible: prueba de conexión'})}),{times:1});
  const confirmation=admin.getByRole('dialog');
  await confirmation.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(confirmation.getByRole('alert')).toContainText('Eliminación no disponible');
  assert.equal((await(await owner.request.get(`${base}/api/state`)).json()).data.budgets.length,1);
  await confirmation.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(confirmation).toHaveCount(0);
  await owner.reload();
  await expect(owner.getByText('Presupuesto para reparar luminarias',{exact:true})).toHaveCount(0);
  const afterBudgetDeletion=(await(await owner.request.get(`${base}/api/state`)).json()).data;
  assert.equal(afterBudgetDeletion.budgets.length,0);
  assert.deepEqual(afterBudgetDeletion.movements,finances.movements);

  const pdfPage = await browser.newPage();
  await pdfPage.setContent('<h1>Liquidacion de prueba</h1><p>Archivo ficticio para QA local.</p>');
  const pdf = await pdfPage.pdf();
  await pdfPage.close();
  for(const unit of ['7B','8A']){
    await admin.goto(`${base}/admin/finanzas?tab=expensas&new=1`);
    await admin.getByLabel('Unidad',{exact:true}).selectOption(unit);
    await admin.getByLabel('Importe de la unidad en pesos').fill('35000');
    await admin.getByLabel('Liquidación en PDF').setInputFiles({name:`unidad-${unit}.pdf`,mimeType:'application/pdf',buffer:pdf});
    await expect(admin.getByText(`unidad-${unit}.pdf`,{exact:true})).toBeVisible();
    await admin.getByLabel('Estado',{exact:true}).selectOption('Publicado');
    await admin.getByRole('button',{name:'Guardar y publicar'}).click();
    await expect(admin.getByRole('dialog')).toHaveCount(0);
  }
  const ownerExpenses = (await (await owner.request.get(`${base}/api/state`)).json()).data.expenses;
  const neighborExpenses = (await (await neighbor.request.get(`${base}/api/state`)).json()).data.expenses;
  assert.deepEqual(ownerExpenses.map(row=>row.unit),['7B']);
  assert.deepEqual(neighborExpenses.map(row=>row.unit),['8A']);
  assert.equal((await owner.request.get(`${base}${ownerExpenses[0].attachment.url}`)).status(),200);
  assert.equal((await neighbor.request.get(`${base}${ownerExpenses[0].attachment.url}`)).status(),404);
  const expenseEndpoint=`${base}/api/entities/expenses/${ownerExpenses[0].id}`;
  assert.equal((await admin.request.patch(expenseEndpoint,{headers,data:{version:ownerExpenses[0].version,status:'Borrador'}})).status(),200);
  assert.equal((await owner.request.get(`${base}${ownerExpenses[0].attachment.url}`)).status(),404);
  assert.equal((await admin.request.get(`${base}${ownerExpenses[0].attachment.url}`)).status(),200);
  assert.equal((await admin.request.patch(expenseEndpoint,{headers,data:{version:ownerExpenses[0].version+1,status:'Publicado'}})).status(),200);
  assert.equal((await owner.request.get(`${base}${ownerExpenses[0].attachment.url}`)).status(),200);

  await admin.goto(`${base}/admin/finanzas?tab=importar`);
  await admin.getByLabel('Seleccionar o arrastrar archivo').setInputFiles({name:'caja.csv',mimeType:'text/csv',buffer:Buffer.from('Fecha,Concepto,Tipo,Categoria,Importe\n2026-11-23,Importacion prueba uno,Ingreso,Aportes,1000\n2026-11-23,Importacion prueba dos,Egreso,Mantenimiento,200\n')});
  await admin.getByRole('button',{name:'Importar 2 movimientos válidos'}).click();
  // The server commits, but the client loses the response. Retrying must not duplicate it.
  await admin.route('**/api/import/movements',async route=>{
    const response=await route.fetch();
    assert.equal(response.status(),200);
    await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Respuesta perdida de prueba'})});
  },{times:1});
  await admin.getByRole('button',{name:'Confirmar importación',exact:true}).click();
  await expect(admin.getByRole('alert')).toContainText('Respuesta perdida');
  await admin.getByRole('button',{name:'Reintentar importación'}).click();
  await admin.getByRole('button',{name:'Confirmar importación',exact:true}).click();
  await expect(admin.getByRole('status').filter({hasText:'2 movimientos guardados en el consorcio'})).toBeVisible();
  const afterImport=(await (await owner.request.get(`${base}/api/state`)).json()).data.movements;
  assert.equal(afterImport.filter(row=>row.title.startsWith('Importacion prueba')).length,2);
  const concurrentRow={title:'Importación simultánea',date:'2026-11-23',amount:300,type:'Ingreso',category:'Aportes'};
  const concurrent=await Promise.all([0,1].map(()=>admin.request.post(`${base}/api/import/movements`,{headers,data:{id:crypto.randomUUID(),items:[concurrentRow]}})));
  assert.deepEqual(concurrent.map(response=>response.status()),[200,200]);
  const receipts=await Promise.all(concurrent.map(response=>response.json()));
  assert.deepEqual(receipts.map(result=>result.ids.length).sort(),[0,1]);

  await admin.goto(`${base}/admin/comunicaciones?new=1`);
  await admin.getByLabel('Título',{exact:true}).fill('Aviso privado de prueba');
  await admin.getByLabel('Mensaje',{exact:true}).fill('Información reservada para propietarios.');
  await admin.route('**/api/entities/notices',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Publicación interrumpida de prueba'})}),{times:1});
  await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
  await expect(admin.getByRole('alert')).toContainText('Publicación interrumpida');
  await expect(admin.getByLabel('Título',{exact:true})).toHaveValue('Aviso privado de prueba');
  await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  const notice=(await (await owner.request.get(`${base}/api/state`)).json()).data.notices.find(row=>row.title==='Aviso privado de prueba');
  assert.ok(notice);
  const visitor=await pageFor();
  assert.equal((await (await visitor.request.get(`${base}/api/state`)).json()).data.notices.length,0);
  await admin.getByRole('button',{name:'Editar Aviso privado de prueba',exact:true}).click();
  await admin.getByRole('checkbox',{name:'Mostrar también en la página pública (sin iniciar sesión)',exact:true}).check();
  await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  assert.equal((await (await visitor.request.get(`${base}/api/state`)).json()).data.notices[0].id,notice.id);
  await owner.goto(`${base}/demo/propietario/novedades/${notice.id}`);
  await owner.getByRole('button',{name:'Marcar como leído',exact:true}).click();
  await expect(owner.getByRole('button',{name:'Marcado como leído',exact:true})).toBeDisabled();

  await admin.goto(`${base}/admin/contenido?tab=documents&new=1`);
  await admin.getByLabel('Título',{exact:true}).fill('Documento de prueba compartido');
  await admin.getByLabel(/^Adjuntar archivo/).setInputFiles({name:'reglamento.pdf',mimeType:'application/pdf',buffer:pdf});
  await expect(admin.getByText('reglamento.pdf',{exact:true})).toBeVisible();
  await admin.route('**/api/entities/documents',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Documento no guardado de prueba'})}),{times:1});
  await admin.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(admin.getByRole('alert')).toContainText('Documento no guardado');
  await expect(admin.getByLabel('Título',{exact:true})).toHaveValue('Documento de prueba compartido');
  await admin.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  const document=(await (await neighbor.request.get(`${base}/api/state`)).json()).data.documents[0];
  assert.equal((await neighbor.request.get(`${base}${document.attachment.url}`)).status(),200);
  assert.equal((await visitor.request.get(`${base}${document.attachment.url}`)).status(),401);

  await admin.goto(`${base}/admin/comunidad?tab=reuniones&new=1`);
  await admin.getByLabel('Título',{exact:true}).fill('Reunión de prueba');
  await admin.getByLabel('Lugar',{exact:true}).fill('SUM');
  await admin.getByLabel(/^Orden del día/).fill('Revisar las cuentas\nOrganizar reparaciones');
  await admin.getByRole('button',{name:'Guardar reunión',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  assert.equal((await (await owner.request.get(`${base}/api/state`)).json()).data.meetings[0].title,'Reunión de prueba');
  await admin.goto(`${base}/admin/comunidad?tab=encuestas&new=1`);
  await admin.getByLabel('Título',{exact:true}).fill('Consulta de prueba');
  await admin.getByLabel(/^Opciones/).fill('Por la mañana\nPor la tarde');
  await admin.getByRole('button',{name:'Guardar encuesta',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  assert.equal((await (await owner.request.get(`${base}/api/state`)).json()).data.polls[0].title,'Consulta de prueba');
  await owner.goto(`${base}/demo/propietario/edificio/encuestas`);
  await expect(owner.getByText('Datos demo.',{exact:false})).toHaveCount(0);
  await owner.getByRole('radio',{name:'Por la mañana',exact:true}).check();
  await owner.getByRole('button',{name:'Votar',exact:true}).click();
  await expect(owner.getByText('Tu voto: Por la mañana',{exact:true})).toBeVisible();
  await expect(owner.getByRole('button',{name:'Votar',exact:true})).toHaveCount(0);
  await owner.reload();
  await expect(owner.getByText('Tu voto: Por la mañana',{exact:true})).toBeVisible();
  const recordedPoll=(await (await owner.request.get(`${base}/api/state`)).json()).data.polls[0];
  assert.equal(recordedPoll.voted,0);
  assert.deepEqual(recordedPoll.votes,[1,0]);
  await owner.goto(`${base}/demo/propietario/edificio/reuniones?tab=temas`);
  await owner.getByRole('button',{name:'Proponer tema',exact:true}).click();
  await owner.getByLabel('Título del tema').fill('Propuesta de prueba');
  await owner.getByLabel('Contanos tu propuesta').fill('Mejorar la iluminación del hall.');
  await owner.getByRole('button',{name:'Enviar tema',exact:true}).click();
  await expect(owner.getByRole('dialog')).toHaveCount(0);
  const topic=(await (await admin.request.get(`${base}/api/state`)).json()).data.topics[0];
  assert.equal(topic.unit,'7B');
  await owner.getByRole('button',{name:'Comentarios de Propuesta de prueba',exact:true}).click();
  await owner.getByLabel('Agregar un comentario').fill('Podemos tratarlo en la reunión.');
  await owner.getByRole('button',{name:'Publicar comentario',exact:true}).click();
  await expect(owner.getByText('Podemos tratarlo en la reunión.',{exact:true})).toBeVisible();
  assert.equal((await (await admin.request.get(`${base}/api/state`)).json()).data.topics[0].messages[0].text,'Podemos tratarlo en la reunión.');
  await admin.goto(`${base}/admin/finanzas`);
  await admin.getByRole('button',{name:/^Saldo inicial:/}).click();
  await admin.getByLabel(/^Saldo inicial en pesos/).fill('999');
  const settings=(await (await admin.request.get(`${base}/api/state`)).json()).data.settings;
  const settingResults=await Promise.all([100,200].map(amount=>admin.request.patch(`${base}/api/settings`,{headers,data:{version:settings.version,openingBalance:amount}})));
  assert.deepEqual(settingResults.map(response=>response.status()).sort(),[200,409]);
  const savedBalance=(await (await admin.request.get(`${base}/api/state`)).json()).data.settings.openingBalance;
  await admin.getByRole('button',{name:'Guardar saldo inicial',exact:true}).click();
  await expect(admin.getByRole('alert')).toContainText('Otra persona actualizó');
  await expect(admin.getByLabel(/^Saldo inicial en pesos/)).toHaveValue('999');
  assert.equal((await (await admin.request.get(`${base}/api/state`)).json()).data.settings.openingBalance,savedBalance);
  await owner.goto(`${base}/demo/propietario/servicios/reclamos?new=1`);
  await owner.getByLabel('Categoría',{exact:true}).selectOption('Agua');
  await owner.getByLabel('¿Qué ocurrió?',{exact:true}).fill('Pérdida de agua de prueba');
  await owner.getByRole('button',{name:'Enviar reclamo',exact:true}).click();
  await expect(owner.getByRole('heading',{name:'Pérdida de agua de prueba',exact:true})).toBeVisible();
  const issue=(await(await owner.request.get(`${base}/api/state`)).json()).data.issues[0];
  await admin.goto(`${base}/admin/servicios?tab=reclamos`);
  await admin.getByRole('button',{name:'Abrir reclamo: Pérdida de agua de prueba',exact:true}).click();
  await admin.getByLabel('Estado del reclamo',{exact:true}).selectOption('En curso');
  await expect(admin.getByText('Estado actualizado: En curso.',{exact:true})).toBeVisible();
  await admin.getByRole('button',{name:'Resolver reclamo',exact:true}).click();
  await admin.getByRole('dialog',{name:'Resolver reclamo',exact:true}).getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(admin.getByText('Estado actualizado: Resuelto.',{exact:true})).toBeVisible();
  const tracked=(await(await owner.request.get(`${base}/api/state`)).json()).data.issues.find(row=>row.id===issue.id);
  assert.equal(tracked.status,'Resuelto');
  assert.equal(tracked.messages.length,2);
  assert.equal((await(await neighbor.request.get(`${base}/api/state`)).json()).data.issues.length,0);
  await admin.goto(`${base}/admin/contenido?tab=contacts&new=1`);
  await admin.getByLabel('Título',{exact:true}).fill('Plomería de prueba');
  await admin.getByLabel('Especialidad',{exact:true}).selectOption('Plomero');
  await admin.getByLabel('Teléfono con código de área',{exact:true}).fill('+54 (221) 555-0100');
  await admin.getByLabel('Email',{exact:true}).fill('plomeria@example.invalid');
  await admin.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  await owner.goto(`${base}/demo/propietario/servicios/contactos`);
  await expect(owner.getByRole('link',{name:'Llamar a Plomería de prueba'})).toHaveAttribute('href','tel:+542215550100');
  await expect(owner.getByRole('link',{name:'Enviar email a Plomería de prueba'})).toHaveAttribute('href','mailto:plomeria%40example.invalid');
  await expect(owner.getByText('Contacto demo · Sin teléfono verificado')).toHaveCount(0);
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await owner.screenshot({path:join(tmpdir(),'portal-production-contacts-mobile.png'),fullPage:true});
  await owner.setViewportSize({width:1280,height:900});
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await owner.screenshot({path:join(tmpdir(),'portal-production-contacts-desktop.png'),fullPage:true});
  await owner.setViewportSize({width:390,height:844});
  await owner.goto(`${base}/demo/propietario/servicios/urgencias`);
  await expect(owner.getByRole('link',{name:'Llamar a Plomería de prueba'})).toBeVisible();
  assert.equal((await admin.request.post(`${base}/api/entities/documents`,{headers,data:{title:'Documento sin archivo',date:'2026-11-23'}})).status(),201);
  await owner.goto(`${base}/demo/propietario/edificio/documentos`);
  const withoutFile=owner.locator('.list-row').filter({hasText:'Documento sin archivo'});
  await expect(withoutFile.getByText('Sin archivo adjunto')).toBeVisible();
  await expect(withoutFile.getByRole('button')).toHaveCount(0);
  await expect(owner.getByText(/Documento demo/)).toHaveCount(0);

  const recovering=await pageFor();
  await recovering.goto(`${base}/login`);
  await recovering.getByRole('button',{name:'Olvidé mi contraseña',exact:true}).click();
  await recovering.getByLabel('Unidad',{exact:true}).selectOption('7B');
  await recovering.getByLabel('Email registrado',{exact:true}).fill('owner@example.invalid');
  await recovering.getByRole('button',{name:'Solicitar ayuda para ingresar',exact:true}).click();
  await expect(recovering.getByRole('status')).toContainText('Administración recibirá tu solicitud');
  await admin.goto(`${base}/admin/accesos`);
  await admin.getByLabel('Ver solicitudes').selectOption('recovery');
  await admin.getByRole('button',{name:'Recuperar acceso',exact:true}).click();
  await admin.getByRole('checkbox',{name:'Verifiqué la identidad de este propietario por un medio conocido.',exact:true}).check();
  await admin.getByLabel('Tu contraseña de administración').fill(password);
  await admin.getByRole('button',{name:'Generar enlace temporal',exact:true}).click();
  const resetLink=await admin.getByLabel('Enlace de recuperación').inputValue();
  await recovering.goto(resetLink);
  await expect(recovering).toHaveURL(`${base}/login`);
  const newPassword=`New-${crypto.randomUUID()}`;
  await recovering.getByLabel('Nueva contraseña',{exact:true}).fill(newPassword);
  await recovering.getByLabel('Repetir contraseña',{exact:true}).fill(newPassword);
  const resetResponse=recovering.waitForResponse(response=>response.url().endsWith('/api/auth/recovery/reset'));
  await recovering.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();
  const resetResult=await resetResponse;
  assert.equal(resetResult.status(),200,await resetResult.text());
  await expect(recovering.getByRole('status')).toContainText('Contraseña actualizada');
  await recovering.getByLabel('Unidad',{exact:true}).selectOption('7B');
  await recovering.getByLabel('Contraseña',{exact:true}).fill(newPassword);
  await recovering.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(recovering).toHaveURL(/\/demo\/propietario$/);
  assert.equal((await owner.request.get(`${base}/api/reservations`)).status(),401);
  const account=(await(await admin.request.get(`${base}/api/admin/access`)).json()).users.find(user=>user.unit==='7B');
  const nextLink=await(await admin.request.post(`${base}/api/admin/access/${account.id}/recovery`,{headers,data:{password,verified:true}})).json();
  const resetData={token:nextLink.path.split('#reset=')[1],password:`Last-${crypto.randomUUID()}`};
  const resetRace=await Promise.all([recovering,visitor].map(page=>page.request.post(`${base}/api/auth/recovery/reset`,{headers,data:resetData})));
  assert.deepEqual(resetRace.map(response=>response.status()).sort(),[200,409]);
  assert.equal((await recovering.request.get(`${base}/api/reservations`)).status(),401);
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await neighbor.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
});
