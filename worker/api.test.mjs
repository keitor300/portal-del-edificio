import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from './index.mjs';
import { hashPassword } from './auth.mjs';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_production.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_participation.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0003_financial_imports.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0004_settings_version.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0005_issue_history.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0006_recovery.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0007_remove_dni.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0008_firebase_auth.sql', import.meta.url), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: sqlite.prepare(sql).run(...args) }),
  });
  const env = { AUTH_PROVIDER: 'local', RUNTIME_ENV: 'test', DB: { prepare: statement, batch: async statements => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } };
  const request = async (path, method = 'GET', data, cookie, origin = 'https://localhost') => {
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' };
    if (cookie) headers.Cookie = cookie;
    return worker.fetch(new Request(`https://localhost${path}`, { method, headers, ...(data ? { body: JSON.stringify(data) } : {}) }), env);
  };
  return { sqlite, request, env };
}
const password = 'Test-only-passphrase-2026';
const registration = unit => ({ unit, name: `Resident ${unit}`, email: `${unit.toLowerCase()}@example.invalid`, password });

test('privacy migration clears national identity numbers from existing accounts', () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(readFileSync(new URL('../migrations/0001_production.sql', import.meta.url), 'utf8'));
    sqlite.prepare("INSERT INTO users(id,name,email,dni,unit,role,status,password_hash) VALUES ('legacy-owner','Legacy owner','legacy@example.invalid','12345678','7B','owner','pending','legacy-hash')").run();
    sqlite.exec(readFileSync(new URL('../migrations/0007_remove_dni.sql', import.meta.url), 'utf8'));
    assert.equal(sqlite.prepare("SELECT dni FROM users WHERE id='legacy-owner'").get().dni, null);
  } finally { sqlite.close(); }
});

test('files enforce publication, unit boundaries, signatures and rollback after metadata failure', async () => {
  const {sqlite,request,env}=fixture();
  const objects=new Map();
  let failPut=false;
  env.FILES={
    put:async(key,bytes)=>{if(failPut)throw new Error('Injected storage failure');objects.set(key,bytes);},
    get:async key=>objects.has(key)?{body:objects.get(key)}:null,
    delete:async key=>{objects.delete(key);},
  };
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    for(const unit of ['7B','8A'])await request('/api/auth/register','POST',registration(unit));
    sqlite.exec("UPDATE users SET status='approved'");
    const login=async identity=>(await request('/api/auth/login','POST',{identity,password})).headers.get('set-cookie');
    const admin=await login('admin@example.invalid'),owner=await login('7B'),neighbor=await login('8A');
    const pdf={name:'Archivo.pdf',type:'application/pdf',url:`data:application/pdf;base64,${Buffer.from('%PDF-1.7\nTest fixture').toString('base64')}`};
    const upload=async(data,cookie=admin)=>request('/api/files','POST',data,cookie);
    assert.equal((await upload(pdf,null)).status,401);
    for(const data of [
      {...pdf,type:'text/html'}, {...pdf,url:'data:application/pdf;base64,!'},
      {...pdf,url:'data:application/pdf;base64,'},
      {...pdf,url:`data:application/pdf;base64,${Buffer.from('not a PDF').toString('base64')}`},
      {...pdf,url:`data:application/pdf;base64,${Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(1048576)]).toString('base64')}`},
      {...pdf,unit:'99Z'},
    ])assert.equal((await upload(data)).status,400);
    assert.equal(objects.size,0);
    const privateFile=await(await upload({...pdf,unit:'8A'},owner)).json();
    assert.equal(sqlite.prepare('SELECT unit FROM files WHERE id=?').get(privateFile.id).unit,'7B');
    assert.equal((await request(privateFile.url,'GET',null,owner)).status,200);
    assert.equal((await request(privateFile.url,'GET',null,neighbor)).status,404);
    assert.equal((await request(privateFile.url)).status,401);
    assert.equal((await request('/api/messages','POST',{text:'Archivo ajeno',attachment:privateFile},neighbor)).status,400);
    const sharedFile=await(await upload(pdf)).json();
    assert.equal((await request(sharedFile.url,'GET',null,owner)).status,404);
    const document=await(await request('/api/entities/documents','POST',{title:'Borrador privado',status:'Borrador',attachment:sharedFile},admin)).json();
    assert.equal((await request(sharedFile.url,'GET',null,owner)).status,404);
    assert.equal((await request(`/api/entities/documents/${document.id}`,'PATCH',{version:1,status:'Publicado'},admin)).status,200);
    const response=await request(sharedFile.url,'GET',null,neighbor);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.match(response.headers.get('content-security-policy'),/sandbox/);
    assert.equal((await request(`/api/entities/documents/${document.id}`,'DELETE',null,admin)).status,200);
    assert.equal((await request(sharedFile.url,'GET',null,owner)).status,404);
    const replyFile=await(await upload({...pdf,unit:'7B'})).json();
    assert.equal((await request(replyFile.url,'GET',null,owner)).status,404);
    assert.equal((await request('/api/messages','POST',{unit:'7B',text:'Respuesta',attachment:replyFile},admin)).status,201);
    assert.equal((await request(replyFile.url,'GET',null,owner)).status,200);
    assert.equal((await request(replyFile.url,'GET',null,neighbor)).status,404);
    const count=objects.size;
    sqlite.exec("CREATE TRIGGER fail_file BEFORE INSERT ON files BEGIN SELECT RAISE(ABORT,'test metadata failure'); END;");
    assert.equal((await upload(pdf)).status,500);
    assert.equal(objects.size,count);
    sqlite.exec('DROP TRIGGER fail_file');
    failPut=true;
    assert.equal((await upload(pdf)).status,500);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM files').get().n,count);
    objects.delete(`attachments/${replyFile.id}`);
    assert.equal((await request(replyFile.url,'GET',null,owner)).status,404);
  } finally {sqlite.close();}
});

test('content API rejects invalid submissions without writes and preserves valid records after invalid edits', async () => {
  const { sqlite, request } = fixture();
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    const admin = (await request('/api/auth/login','POST',{identity:'admin@example.invalid',password})).headers.get('set-cookie');
    for (const [collection, fields] of [
      ['meetings',{time:'26:00',place:'SUM',agenda:'Cuentas',status:'Programada'}],
      ['works',{provider:'Proveedor',amount:15000,progress:101,startDate:'2026-11-23',status:'Planificada'}],
      ['budgets',{amount:15000,category:'Obras',period:'2026-13',status:'Aprobado'}],
      ['contacts',{email:'no-es-email'}],
      ['faqs',{description:''}],
      ['listings',{category:'Cochera',type:'Inventado'}],
    ]) {
      const response = await request(`/api/entities/${collection}`,'POST',{title:'Prueba',date:'2026-11-23',...fields},admin);
      assert.equal(response.status,400,collection);
    }
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM entities').get().n,0);
    const response = await request('/api/entities/meetings','POST',{title:'Reunión',date:'2026-11-23',time:'19:00',endTime:'20:00',place:'SUM',agenda:'Cuentas',status:'Programada'},admin);
    assert.equal(response.status,201);
    const { id } = await response.json();
    assert.equal((await request(`/api/entities/meetings/${id}`,'PATCH',{version:1,endTime:'18:00'},admin)).status,400);
    const row = sqlite.prepare('SELECT data,version FROM entities WHERE id=?').get(id);
    assert.equal(row.version,1);
    assert.equal(JSON.parse(row.data).endTime,'20:00');
    assert.equal((await request(`/api/entities/meetings/${id}`,'PATCH',{version:1,summary:'Resumen de la reunión'},admin)).status,200);
  } finally { sqlite.close(); }
});

test('assisted recovery requires admin reauthentication and consumes tokens while revoking existing sessions',async()=>{
  const {sqlite,request}=fixture();
  try{
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    await request('/api/auth/register','POST',registration('7B'));
    sqlite.exec("UPDATE users SET status='approved'");
    const login=async identity=>(await request('/api/auth/login','POST',{identity,password})).headers.get('set-cookie');
    const admin=await login('admin@example.invalid'),owner=await login('7B');
    const ownerId=sqlite.prepare("SELECT id FROM users WHERE unit='7B'").get().id;
    const known=await(await request('/api/auth/recovery/request','POST',{unit:'7B',email:'7b@example.invalid'})).json();
    const unknown=await(await request('/api/auth/recovery/request','POST',{unit:'8A',email:'missing@example.invalid'})).json();
    assert.deepEqual(known,unknown);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM recovery_requests').get().n,1);
    const endpoint=`/api/admin/access/${ownerId}/recovery`;
    assert.equal((await request(endpoint,'POST',{verified:true,password},owner)).status,403);
    assert.equal((await request(endpoint,'POST',{verified:false,password},admin)).status,400);
    assert.equal((await request(endpoint,'POST',{verified:true,password:'wrong'},admin)).status,403);
    const first=await(await request(endpoint,'POST',{verified:true,password},admin)).json();
    const second=await(await request(endpoint,'POST',{verified:true,password},admin)).json();
    const token=second.path.split('#reset=')[1];
    assert.match(token,/^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM password_resets').all()).includes(token));
    assert.equal((await request('/api/auth/recovery/reset','POST',{token:first.path.split('#reset=')[1],password:'New-owner-passphrase-2026'})).status,409);
    assert.equal((await request('/api/auth/recovery/reset','POST',{token,password:'short'})).status,400);
    assert.equal((await request('/api/auth/recovery/reset','POST',{token,password:'New-owner-passphrase-2026'})).status,200);
    assert.equal((await request('/api/auth/recovery/reset','POST',{token,password:'Another-owner-passphrase-2026'})).status,409);
    assert.equal((await request('/api/reservations','GET',null,owner)).status,401);
    assert.equal((await request('/api/auth/login','POST',{identity:'7B',password})).status,401);
    assert.equal((await request('/api/auth/login','POST',{identity:'7B',password:'New-owner-passphrase-2026'})).status,200);
    assert.ok(sqlite.prepare('SELECT resolved_at FROM recovery_requests').get().resolved_at);
    const expiring=await(await request(endpoint,'POST',{verified:true,password},admin)).json();
    sqlite.exec('UPDATE password_resets SET expires_at=0');
    assert.equal((await request('/api/auth/recovery/reset','POST',{token:expiring.path.split('#reset=')[1],password:'Another-owner-passphrase-2026'})).status,409);
    const suspendedLink=await(await request(endpoint,'POST',{verified:true,password},admin)).json();
    assert.equal((await request(`/api/admin/access/${ownerId}`,'PATCH',{status:'suspended'},admin)).status,200);
    assert.equal((await request('/api/auth/recovery/reset','POST',{token:suspendedLink.path.split('#reset=')[1],password:'Another-owner-passphrase-2026'})).status,409);
    assert.equal((await request(endpoint,'POST',{verified:true,password},admin)).status,409);
  }finally{sqlite.close();}
});

test('issue status history is server-authored, private, conflict-safe and preserves conversation through closing', async()=>{
  const {sqlite,request}=fixture();
  try{
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    for(const unit of ['7B','8A'])await request('/api/auth/register','POST',registration(unit));
    sqlite.exec("UPDATE users SET status='approved'");
    const login=async identity=>(await request('/api/auth/login','POST',{identity,password})).headers.get('set-cookie');
    const admin=await login('admin@example.invalid'),owner=await login('7B'),neighbor=await login('8A');
    const issue=await(await request('/api/entities/issues','POST',{title:'Filtración',description:'Pérdida de agua'},owner)).json();
    assert.equal((await request('/api/messages','POST',{issueId:issue.id,text:'Mensaje del propietario'},owner)).status,201);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:1,status:'Resuelto'},owner)).status,403);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:1,status:'Inventado'},admin)).status,400);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:1,status:'En curso',messages:[{text:'Historia falsa'}]},admin)).status,200);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:1,status:'Resuelto'},admin)).status,409);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:2,status:'Resuelto'},admin)).status,200);
    assert.equal((await request('/api/messages','POST',{issueId:issue.id,text:'No debe guardarse'},owner)).status,409);
    assert.equal((await request(`/api/entities/issues/${issue.id}`,'PATCH',{version:3,status:'En curso'},admin)).status,200);
    assert.equal((await request('/api/messages','POST',{issueId:issue.id,text:'Mensaje al reabrir'},owner)).status,201);
    const state=(await(await request('/api/state','GET',null,owner)).json()).data;
    assert.equal(state.issues[0].messages.length,5);
    assert.ok(!JSON.stringify(state.issues).includes('Historia falsa'));
    assert.ok(state.issues[0].messages.some(message=>message.text==='Mensaje del propietario'));
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM issue_events').get().n,3);
    assert.equal((await(await request('/api/state','GET',null,neighbor)).json()).data.issues.length,0);
  }finally{sqlite.close();}
});

test('settings reject stale writes and roll back the full change when a date has reservations', async()=>{
  const {sqlite,request}=fixture();
  try{
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    const admin=(await request('/api/auth/login','POST',{identity:'admin@example.invalid',password})).headers.get('set-cookie');
    assert.equal((await request('/api/settings','PATCH',{rules:'Reglas vigentes'},admin)).status,409);
    assert.equal((await request('/api/settings','PATCH',{version:1,rules:'Reglas vigentes',openingBalance:100},admin)).status,200);
    assert.equal((await request('/api/settings','PATCH',{version:1,openingBalance:999},admin)).status,409);
    assert.equal((await request('/api/settings','PATCH',{version:2,openingBalance:-1},admin)).status,400);
    assert.equal((await request('/api/reservations','POST',{unit:'7B',date:'2030-11-22',time:'21:00',endTime:'03:00',acceptedRules:'Reglas vigentes'},admin)).status,201);
    assert.equal((await request('/api/settings','PATCH',{version:2,openingBalance:500,blockedDates:['2030-11-23']},admin)).status,409);
    const current=(await (await request('/api/state','GET',null,admin)).json()).data.settings;
    assert.equal(current.version,2);
    assert.equal(current.openingBalance,100);
    assert.deepEqual(current.blockedDates,[]);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit_log WHERE action='settings.update'").get().n,1);
    const dates=Array.from({length:366},(_,i)=>new Date(Date.UTC(2032,0,1)+i*86400000).toISOString().slice(0,10));
    assert.equal((await request('/api/settings','PATCH',{version:2,blockedDates:dates},admin)).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM blocked_dates').get().n,366);
    assert.throws(()=>sqlite.prepare("UPDATE settings SET opening_balance_cents=123,version=2 WHERE id=1").run(),/SETTINGS_CONFLICT/);
    assert.throws(()=>sqlite.prepare("INSERT INTO reservations(id,unit,created_by,date,end_date,start_minute,end_minute,accepted_rules) SELECT 'stale-rules',unit,created_by,date,end_date,start_minute+1440,end_minute+1440,'Reglas viejas' FROM reservations LIMIT 1").run(),/RESERVATION_RULES_CHANGED/);
  }finally{sqlite.close();}
});

test('financial imports are atomic, idempotent, bounded and deduplicate across manual and batch writes', async () => {
  const {sqlite,request}=fixture();
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    const admin=(await request('/api/auth/login','POST',{identity:'admin@example.invalid',password})).headers.get('set-cookie');
    const row={title:'Reparación general',date:'2026-11-23',amount:1234.5,type:'Egreso',category:'Mantenimiento'};
    assert.equal((await request('/api/import/movements','POST',{id:crypto.randomUUID(),items:[row]})).status,401);
    const invalid=await request('/api/import/movements','POST',{id:crypto.randomUUID(),items:[row,{...row,amount:-1}]},admin);
    assert.equal(invalid.status,400);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM entities WHERE collection='movements'").get().n,0);
    assert.equal((await request('/api/entities/movements','POST',row,admin)).status,201);
    const payload={id:crypto.randomUUID(),items:[{...row,title:' REPARACION   general '},{...row,title:'Otro gasto'},{...row,title:'Otro gasto'}]};
    const initial=await request('/api/import/movements','POST',payload,admin);
    assert.equal(initial.status,200);
    const receipt=await initial.json();
    assert.equal(receipt.ids.length,1);
    assert.equal(receipt.skipped,2);
    assert.deepEqual(await (await request('/api/import/movements','POST',payload,admin)).json(),receipt);
    assert.equal((await request('/api/import/movements','POST',{...payload,items:[row]},admin)).status,409);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit_log WHERE action='movements.import'").get().n,1);
    assert.equal((await request('/api/entities/movements','POST',{...row,title:'OTRO GASTO'},admin)).status,409);
    const large=Array.from({length:500},(_,i)=>({...row,title:`Lote ${i}`}));
    const largeResponse=await request('/api/import/movements','POST',{id:crypto.randomUUID(),items:large},admin);
    assert.equal(largeResponse.status,200);
    assert.equal((await largeResponse.json()).ids.length,500);
    assert.equal((await request('/api/import/movements','POST',{id:crypto.randomUUID(),items:[...large,row]},admin)).status,400);
    // Force a database failure after inserts to verify the whole transaction rolls back.
    sqlite.exec("CREATE TRIGGER fail_import_audit BEFORE INSERT ON audit_log WHEN NEW.action='movements.import' BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
    const failedId=crypto.randomUUID();
    assert.equal((await request('/api/import/movements','POST',{id:failedId,items:[{...row,title:'No debe persistir'}]},admin)).status,500);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM financial_imports WHERE id=?').get(failedId).n,0);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM entities WHERE json_extract(data,'$.title')='No debe persistir'").get().n,0);
  } finally {sqlite.close();}
});

test('registration, approval, private session, suspension and origin enforcement', async () => {
  const { sqlite, request } = fixture();
  try {
    const adminHash = await hashPassword(password);
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(adminHash);
    assert.equal((await request('/api/auth/register', 'POST', registration('7B'), null, 'https://attacker.example')).status, 403);
    assert.equal((await request('/api/admin/access')).status, 401);
    assert.equal((await request('/api/auth/register', 'POST', { ...registration('7B'), dni: '12345678' })).status, 201);
    assert.equal(sqlite.prepare("SELECT dni FROM users WHERE unit='7B'").get().dni, null);
    assert.equal((await request('/api/auth/login', 'POST', { identity: '7B', password })).status, 403);
    const adminLogin = await request('/api/auth/login', 'POST', { identity: 'admin@example.invalid', password });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get('set-cookie');
    assert.match(adminCookie, /HttpOnly; Secure; SameSite=Lax/);
    const adminBody = await adminLogin.json();
    assert.equal(adminBody.user.password_hash, undefined);
    const requests = await (await request('/api/admin/access', 'GET', null, adminCookie)).json();
    assert.equal(requests.users.length, 1);
    assert.equal('dni' in requests.users[0], false);
    const id = requests.users[0].id;
    assert.equal((await request(`/api/admin/access/${id}`, 'PATCH', { status: 'approved' }, adminCookie)).status, 200);
    const ownerLogin = await request('/api/auth/login', 'POST', { identity: '7b', password });
    assert.equal(ownerLogin.status, 200);
    const ownerCookie = ownerLogin.headers.get('set-cookie');
    const session = await (await request('/api/auth/session', 'GET', null, ownerCookie)).json();
    assert.equal(session.user.unit, '7B');
    assert.equal((await request('/api/admin/access', 'GET', null, ownerCookie)).status, 403);
    assert.equal((await request(`/api/admin/access/${id}`, 'PATCH', { status: 'suspended' }, adminCookie)).status, 200);
    assert.equal((await request('/api/reservations', 'GET', null, ownerCookie)).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', { identity: '7b', password })).status, 403);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM audit_log').get().n, 2);
  } finally { sqlite.close(); }
});

test('SUM API binds owner identity, enforces current rules, prevents overlaps and protects cancellation', async () => {
  const { sqlite, request } = fixture();
  try {
    for (const unit of ['7B', '8A']) {
      assert.equal((await request('/api/auth/register', 'POST', registration(unit))).status, 201);
    }
    sqlite.exec("UPDATE users SET status='approved'; UPDATE settings SET rules='Reglas vigentes',version=version+1 WHERE id=1");
    const login = async unit => (await request('/api/auth/login', 'POST', { identity: unit, password })).headers.get('set-cookie');
    const first = await login('7B');
    const second = await login('8A');
    const booking = { date: '2030-11-22', time: '21:00', endTime: '03:00', acceptedRules: 'Reglas vigentes', unit: '8A' };
    assert.equal((await request('/api/reservations', 'POST', { ...booking, acceptedRules: 'old' }, first)).status, 409);
    const created = await request('/api/reservations', 'POST', booking, first);
    assert.equal(created.status, 201);
    const record = await created.json();
    assert.equal(record.unit, '7B');
    assert.equal((await request('/api/reservations', 'POST', booking, second)).status, 409);
    assert.equal((await request(`/api/reservations/${record.id}`, 'DELETE', null, second)).status, 403);
    const shared = await (await request('/api/reservations', 'GET', null, second)).json();
    assert.equal(shared.reservations[0].unit, '7B');
    assert.equal(shared.reservations[0].created_by, undefined);
    assert.equal((await request(`/api/reservations/${record.id}`, 'DELETE', null, first)).status, 200);
    assert.equal((await request('/api/reservations', 'POST', booking, second)).status, 201);
  } finally { sqlite.close(); }
});

test('logout removes server session and forged browser sessions cannot authenticate', async () => {
  const { sqlite, request } = fixture();
  try {
    assert.equal((await request('/api/auth/register', 'POST', registration('7B'))).status, 201);
    sqlite.exec("UPDATE users SET status='approved'");
    const login = await request('/api/auth/login', 'POST', { identity: '7B', password });
    const cookie = login.headers.get('set-cookie');
    assert.equal((await request('/api/auth/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await request('/api/reservations', 'GET', null, cookie)).status, 401);
    assert.equal((await request('/api/reservations', 'GET', null, '__Host-portal_session=owner-demo-7b')).status, 401);
  } finally { sqlite.close(); }
});

test('participation enforces one vote per unit, locks options, rejects closed ballots and keeps reads idempotent', async () => {
  const { sqlite, request } = fixture();
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    for (const unit of ['7B','8A']) assert.equal((await request('/api/auth/register','POST',registration(unit))).status,201);
    sqlite.exec("UPDATE users SET status='approved'");
    const login = async identity => (await request('/api/auth/login','POST',{identity,password})).headers.get('set-cookie');
    const admin = await login('admin@example.invalid');
    const owner = await login('7B');
    const neighbor = await login('8A');
    const poll = await (await request('/api/entities/polls','POST',{title:'Elegir horario',options:['Mañana','Tarde']},admin)).json();
    assert.equal((await request(`/api/polls/${poll.id}/vote`,'POST',{option:0},admin)).status,403);
    assert.equal((await request(`/api/polls/${poll.id}/vote`,'POST',{option:9},owner)).status,409);
    assert.equal((await request(`/api/polls/${poll.id}/vote`,'POST',{option:0},owner)).status,200);
    assert.equal((await request(`/api/polls/${poll.id}/vote`,'POST',{option:1},owner)).status,409);
    assert.equal((await request(`/api/entities/polls/${poll.id}`,'PATCH',{version:1,options:['Otra','Tarde']},admin)).status,409);
    assert.equal((await request(`/api/entities/polls/${poll.id}`,'PATCH',{version:1,closed:true},admin)).status,200);
    assert.equal((await request(`/api/polls/${poll.id}/vote`,'POST',{option:1},neighbor)).status,409);
    const state = await (await request('/api/state','GET',null,owner)).json();
    assert.deepEqual(state.data.polls[0].votes,[1,0]);
    assert.equal(state.data.polls[0].voted,0);

    const notice = await (await request('/api/entities/notices','POST',{title:'Aviso para leer'},admin)).json();
    for(let i=0;i<2;i++)assert.equal((await request(`/api/notices/${notice.id}/read`,'POST',{},owner)).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM notice_reads').get().n,1);
    const topic = await (await request('/api/entities/topics','POST',{title:'Propuesta de la unidad'},owner)).json();
    for(let i=0;i<2;i++)assert.equal((await request(`/api/topics/${topic.id}/interest`,'POST',{interested:true},neighbor)).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM interests').get().n,1);
    assert.equal((await request(`/api/topics/${topic.id}/comments`,'POST',{text:'Podemos revisarlo en la reunión.'},admin)).status,201);
    const topics = (await (await request('/api/state','GET',null,owner)).json()).data.topics;
    assert.equal(topics[0].messages[0].text,'Podemos revisarlo en la reunión.');
  } finally { sqlite.close(); }
});

test('private data stays within its unit, public visitors see no resident data, and edits detect stale versions', async () => {
  const { sqlite, request } = fixture();
  try {
    sqlite.prepare("INSERT INTO users(id,name,email,role,status,password_hash) VALUES ('admin','Admin','admin@example.invalid','admin','approved',?)").run(await hashPassword(password));
    for (const unit of ['7B','8A']) assert.equal((await request('/api/auth/register', 'POST', registration(unit))).status, 201);
    sqlite.exec("UPDATE users SET status='approved'");
    const login = async identity => (await request('/api/auth/login', 'POST', { identity, password })).headers.get('set-cookie');
    const admin = await login('admin@example.invalid');
    const owner = await login('7B');
    const neighbor = await login('8A');
    const notice = await (await request('/api/entities/notices', 'POST', { title: 'Aviso', description: 'Información del edificio', date: '2026-11-23', public:true }, admin)).json();
    assert.equal((await request('/api/entities/notices','POST',{title:'Aviso interno',description:'Solo propietarios'},admin)).status,201);
    const issue = await request('/api/entities/issues', 'POST', { title: 'Problema privado', description: 'Detalle privado', unit: '8A' }, owner);
    assert.equal(issue.status, 201);
    assert.equal((await request('/api/entities/movements', 'POST', { title: 'Fake', amount: 500, type: 'Ingreso' }, owner)).status, 403);
    assert.equal((await request('/api/messages', 'POST', { text: 'Consulta privada', unit: '8A' }, owner)).status, 201);
    const ownState = await (await request('/api/state', 'GET', null, owner)).json();
    assert.equal(ownState.data.issues.length, 1);
    assert.equal(ownState.data.issues[0].unit, '7B');
    assert.equal(ownState.data.messages.length, 1);
    assert.equal(ownState.data.notices.length, 2);
    const otherState = await (await request('/api/state', 'GET', null, neighbor)).json();
    assert.equal(otherState.data.issues.length, 0);
    assert.equal(otherState.data.messages.length, 0);
    const publicState = await (await request('/api/state')).json();
    assert.equal(publicState.data.notices.length, 1);
    assert.equal(publicState.data.notices[0].id, notice.id);
    assert.equal(publicState.data.issues.length, 0);
    assert.equal(publicState.data.messages.length, 0);
    assert.equal((await request(`/api/entities/notices/${notice.id}`, 'PATCH', { title: 'Actualizado', version: 1 }, admin)).status, 200);
    assert.equal((await request(`/api/entities/notices/${notice.id}`, 'PATCH', { title: 'Cambio obsoleto', version: 1 }, admin)).status, 409);
    assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM entities WHERE id=?').get(notice.id).data).title, 'Actualizado');
  } finally { sqlite.close(); }
});
