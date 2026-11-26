/* global document, innerWidth */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect as baseExpect } from '@playwright/test';

const base=process.argv.find(arg=>arg.startsWith('https://'));
if(!process.argv.includes('--confirm-test-data')||base!=='https://portal-del-edificio.meme-scanner-nicolas.workers.dev')throw new Error('Explicit production URL and --confirm-test-data required.');
const root=resolve(import.meta.dirname,'..');
const credentials=JSON.parse(readFileSync(join(root,'.secrets/bootstrap-admin.json'),'utf8'));
const config=JSON.parse(readFileSync(join(root,'.secrets/firebase-config.json'),'utf8'));
const output=join(root,'studio/.qa/cloudflare-release');mkdirSync(output,{recursive:true});
const suffix=crypto.randomUUID();
const testPassword=`Qa-${crypto.randomUUID()}`;
const uiOnly=process.argv.includes('--ui-only');
const accounts=[],createdNotices=[];
let browser,adminCookie;
const errors=[];
const expect=baseExpect.configure({ timeout: 20000 });
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const cli=args=>execFileSync(process.execPath,[join(root,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:root,encoding:'utf8',stdio:'pipe',windowsHide:true});
async function api(path,method='GET',data,cookie){
  const response=await fetch(base+path,{method,headers:{Origin:base,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000)});
  const value=await response.json();return {status:response.status,data:value,cookie:response.headers.get('set-cookie')?.split(';')[0],header:response.headers.get('set-cookie')};
}
const okay=result=>{assert.ok(result.status>=200&&result.status<300,`API ${result.status}: ${result.data.error||'request failed'}`);return result;};
const firebase=async(operation,data)=>{
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,200,`Firebase ${operation} failed`);return response.json();
};
try{
  const initial=okay(await api('/api/state')).data.data;
  assert.equal(initial.notices.length,0);assert.equal(initial.reservations.length,0);assert.equal(initial.contacts.length,0);
  const login=okay(await api('/api/auth/login','POST',{identity:credentials.username,password:credentials.password}));adminCookie=login.cookie;
  assert.match(login.header,/HttpOnly; Secure; SameSite=Lax; Max-Age=604800/);
  assert.equal(okay(await api('/api/admin/administrators','GET',null,adminCookie)).data.users.length,1);
  const rules=okay(await api('/api/state','GET',null,adminCookie)).data.data.settings.rules;
  assert.ok(rules.includes('08:30'));
  for(const unit of uiOnly?['7B']:['7B','8A']){
    const email=`portal-qa-${unit.toLowerCase()}-${suffix}@example.invalid`;
    okay(await api('/api/auth/register','POST',{name:'Verificación temporal',unit,email,password:testPassword}));
    const user=okay(await api('/api/admin/access','GET',null,adminCookie)).data.users.find(user=>user.email===email);
    assert.ok(user);accounts.push({...user,password:testPassword});
    okay(await api(`/api/admin/access/${user.id}`,'PATCH',{status:'approved'},adminCookie));
    const signed=okay(await api('/api/auth/login','POST',{identity:unit,password:testPassword,remember:true}));
    assert.match(signed.header,/Max-Age=2592000/);accounts.at(-1).cookie=signed.cookie;
  }
  const [owner,neighbor]=accounts;
  if(!uiOnly){
  const future=new Date(Date.now()+7*86400000);while(future.getUTCDay()!==5)future.setUTCDate(future.getUTCDate()+1);
  const date=future.toISOString().slice(0,10);
  const book=(account,time,endTime)=>api('/api/reservations','POST',{date,time,endTime,acceptedRules:rules},account.cookie);
  const simultaneous=await Promise.all([book(owner,'15:00','18:00'),book(neighbor,'15:00','18:00')]);
  assert.deepEqual(simultaneous.map(r=>r.status).sort(),[201,409]);
  assert.equal((await book(owner,'16:00','19:00')).status,409);
  assert.equal((await book(neighbor,'14:00','19:00')).status,409);
  okay(await book(owner,'18:00','19:00'));
  const overnight=await Promise.all([book(owner,'23:00','03:00'),book(neighbor,'23:30','02:00')]);
  assert.deepEqual(overnight.map(r=>r.status).sort(),[201,409]);
  const winner=simultaneous.find(result=>result.status===201).data;
  const other=winner.unit===owner.unit?neighbor:owner;
  assert.equal((await api(`/api/reservations/${winner.id}`,'DELETE',null,other.cookie)).status,403);
  okay(await api(`/api/reservations/${winner.id}`,'DELETE',null,adminCookie));
  okay(await book(other,'15:00','18:00'));
  const reservations=okay(await api('/api/reservations','GET',null,owner.cookie)).data.reservations;
  assert.ok(reservations.some(row=>row.unit==='7B'));assert.ok(reservations.some(row=>row.unit==='8A'));
  console.log('Live D1: exact, partial, enclosing and overnight conflicts rejected; adjacent slot and cancellation release verified.');
  }
  const notice=okay(await api('/api/entities/notices','POST',{title:'Verificación privada temporal',description:'Se elimina al finalizar la verificación.',category:'Información',date:new Date().toISOString().slice(0,10)},adminCookie)).data;
  createdNotices.push(notice.id);
  okay(await api('/api/messages','POST',{unit:'7B',text:'Verificación privada temporal'},adminCookie));
  const inbox=okay(await api('/api/notifications','GET',null,owner.cookie)).data.items;
  const message=inbox.find(item=>item.id.startsWith('message:'));assert.ok(message);
  if(neighbor)assert.ok(!okay(await api('/api/notifications','GET',null,neighbor.cookie)).data.items.some(item=>item.id===message.id));
  okay(await api('/api/notifications/read','POST',{ids:inbox.map(item=>item.id)},owner.cookie));
  assert.ok(okay(await api('/api/notifications','GET',null,owner.cookie)).data.items.every(item=>item.read));
  okay(await api(`/api/entities/notices/${notice.id}`,'PATCH',{version:1,title:'Verificación privada actualizada'},adminCookie));
  assert.ok(okay(await api('/api/notifications','GET',null,owner.cookie)).data.items.some(item=>item.title==='Verificación privada actualizada'&&!item.read));
  assert.equal(okay(await api('/api/state')).data.data.notices.length,0,'QA notice must never be public');
  console.log('Live notification privacy, update unread state and server-persisted reading verified.');

  browser=await chromium.launch({channel:'msedge',headless:true});
  const pageFor=async(width=390)=>{
    const context=await browser.newContext({viewport:{width,height:844},locale:'es-AR'});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));return page;
  };
  const ownerPage=await pageFor();await ownerPage.goto(base+'/login');
  await ownerPage.getByLabel('Unidad',{exact:true}).selectOption('7B');await ownerPage.getByLabel('Contraseña',{exact:true}).fill(testPassword);await ownerPage.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(ownerPage.getByRole('heading',{name:/Hola, Unidad 7B/})).toBeVisible();
  const state=await ownerPage.context().storageState();
  assert.ok(state.cookies.some(cookie=>cookie.name==='__Host-portal_session'&&cookie.expires>Date.now()/1000+20*86400));
  const reopened=await browser.newContext({storageState:state,viewport:{width:390,height:844}});const qrPage=await reopened.newPage();
  await qrPage.goto(base+'/login?next=%2Fdemo%2Fpropietario%2Fservicios%2Fsum');await expect(qrPage.getByRole('heading',{name:'Reservar el SUM',exact:true})).toBeVisible();
  const ownerRoutes=['','/novedades','/edificio','/edificio/expensas','/edificio/documentos','/edificio/cuentas','/edificio/reuniones','/edificio/encuestas','/edificio/obras','/servicios','/servicios/sum','/servicios/reclamos','/servicios/chat','/servicios/contactos','/servicios/urgencias','/mas','/mas/estado','/mas/calendario','/mas/preguntas','/mas/objetos','/mas/disponibilidades','/notificaciones'];
  for(const route of ownerRoutes){
    await ownerPage.goto(base+'/demo/propietario'+route);await expect(ownerPage.locator('main h1').first()).toBeVisible();
    const text=await ownerPage.locator('body').innerText();assert.doesNotMatch(text,/\bdemo\b|demostraci[oó]n|datos ficticios/i,`Demo text in ${route}`);
    assert.ok(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${route}`);
  }
  await ownerPage.getByRole('button',{name:/Verificación privada actualizada/}).click();await expect(ownerPage.getByRole('heading',{name:'Verificación privada actualizada'})).toBeVisible();
  await ownerPage.goto(base+'/demo/propietario/notificaciones');await expect(ownerPage.getByRole('button',{name:/Verificación privada actualizada/})).toBeVisible();await ownerPage.screenshot({path:join(output,'notifications-mobile.png'),fullPage:true});
  const adminPage=await pageFor(1440);await adminPage.goto(base+'/admin');
  await adminPage.getByLabel('Usuario o email',{exact:true}).fill(credentials.username);await adminPage.getByLabel('Contraseña',{exact:true}).fill(credentials.password);await adminPage.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(adminPage.getByRole('heading',{name:/El edificio, al día/})).toBeVisible();
  for(const width of [1440,390]){
    await adminPage.setViewportSize({width,height:844});
    for(const route of ['/administradores','/accesos','/menu','/comunicaciones','/finanzas','/comunidad','/servicios','/contenido','/notificaciones']){
      await adminPage.goto(base+'/admin'+route);await expect(adminPage.locator('main h1').first()).toBeVisible();
      assert.doesNotMatch(await adminPage.locator('body').innerText(),/\bdemo\b|demostraci[oó]n|datos ficticios/i,`Admin demo text ${route}`);
      assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Admin overflow ${width} ${route}`);
      if(route==='/administradores'){await expect(adminPage.getByText(credentials.email,{exact:true})).toBeVisible();await adminPage.screenshot({path:join(output,`administrators-${width}.png`),fullPage:true});}
    }
  }
  const practice=await pageFor();await practice.goto(base+'/login');await practice.getByRole('link',{name:'Entrar como Unidad 7B',exact:true}).click();
  await expect(practice.getByText('Espacio de prueba 7B',{exact:true})).toBeVisible();await practice.getByRole('button',{name:'Entrar como Unidad 7B',exact:true}).click();
  await expect(practice.getByRole('heading',{name:/Hola, Unidad 7B/})).toBeVisible();
  assert.equal((await practice.request.get(base+'/api/notifications')).status(),401,'Practice entry must not authenticate to real API');
  await practice.goto(base+'/prueba/demo/propietario/servicios/sum');await expect(practice.getByRole('heading',{name:'Reservar el SUM',exact:true})).toBeVisible();
  assert.equal((await practice.request.get(base+'/api/reservations')).status(),401);
  assert.deepEqual(errors,[]);
  console.log('Mobile/desktop routes, clean text, overflow, QR session reuse and isolated 7B practice verified.');
}finally{
  await browser?.close();
  for(const id of createdNotices)if(adminCookie)okay(await api(`/api/entities/notices/${id}`,'DELETE',null,adminCookie));
  // Remove only exact temporary identities from this run, never a pre-existing unit.
  if(accounts.length){
    const ids=accounts.map(account=>q(account.id)).join(',');
    const verified=JSON.parse(cli(['d1','execute','portal-edificio-produccion','--remote','--json','--command',`SELECT id,email FROM users WHERE id IN (${ids})`]))[0].results;
    assert.equal(verified.length,accounts.length);assert.ok(verified.every(row=>accounts.some(account=>account.id===row.id&&account.email===row.email&&row.email.includes(suffix))));
    const cleanup=join(root,'.secrets/release-cleanup.sql');
    try{
      writeFileSync(cleanup,`DELETE FROM messages WHERE author_id IN (${ids}) OR (unit IN (${accounts.map(a=>q(a.unit)).join(',')}) AND text='Verificación privada temporal'); DELETE FROM audit_log WHERE actor_id IN (${ids}); DELETE FROM reservations WHERE created_by IN (${ids}); DELETE FROM users WHERE id IN (${ids});`,{flag:'wx',mode:0o600});
      cli(['d1','execute','portal-edificio-produccion','--remote','--file',cleanup]);
    }finally{unlinkSync(cleanup);}
    for(const account of accounts){const signed=await firebase('signInWithPassword',{email:account.email,password:account.password,returnSecureToken:true});await firebase('delete',{idToken:signed.idToken});}
    console.log('All temporary owners, reservations, messages and notices from this run removed.');
  }
  if(adminCookie)await api('/api/auth/logout','POST',{},adminCookie);
}
