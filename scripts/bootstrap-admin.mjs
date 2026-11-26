import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { firebaseRegister, firebaseAccount } from '../worker/firebase.mjs';

if (!process.argv.includes('--confirm-remote')) throw new Error('Remote bootstrap requires --confirm-remote.');
const root=resolve(import.meta.dirname,'..');
const input=JSON.parse(readFileSync(join(root,'.secrets/bootstrap-admin.json'),'utf8'));
const config=JSON.parse(readFileSync(join(root,'.secrets/firebase-config.json'),'utf8'));
const env={AUTH_PROVIDER:'firebase',FIREBASE_PROJECT_ID:config.projectId,FIREBASE_API_KEY:config.apiKey,FIREBASE_SERVICE_ACCOUNT:readFileSync(join(root,'.secrets/firebase-service-account.json'),'utf8')};
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const cli=args=>execFileSync(process.execPath,[join(root,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:root,encoding:'utf8',stdio:'pipe',windowsHide:true});
const query=sql=>JSON.parse(cli(['d1','execute','portal-edificio-produccion','--remote','--json','--command',sql]))[0].results;
const existing=query(`SELECT id,email,username,firebase_uid FROM users WHERE role='admin' OR email=${q(input.email)}`);
if(existing.length)throw new Error('Administrator already exists; inspect before attempting bootstrap again.');
const uid=await firebaseRegister(env,input.email,input.password);
const account=await firebaseAccount(env,uid);
if(!account||account.disabled||account.email!==input.email)throw new Error('Firebase identity validation failed.');
const rulesSource=readFileSync(join(root,'src/data/seed.ts'),'utf8');
const rules=/export const SUM_RULES = '([^']+)';/.exec(rulesSource)?.[1];
if(!rules)throw new Error('Cannot locate original SUM rules.');
const settings=query('SELECT rules FROM settings WHERE id=1')[0];
if(settings.rules&&settings.rules!==rules)throw new Error('Remote rules differ; preserving existing text, manual review required.');
const file=join(root,'.secrets/bootstrap.sql');
try{
  writeFileSync(file,`INSERT INTO users(id,name,email,username,role,status,password_hash,firebase_uid) VALUES (${q(crypto.randomUUID())},${q(input.name)},${q(input.email)},${q(input.username)},'admin','approved','firebase',${q(uid)}); UPDATE settings SET rules=${q(rules)},version=version+1 WHERE id=1 AND rules='';`,{flag:'wx',mode:0o600});
  cli(['d1','execute','portal-edificio-produccion','--remote','--file',file]);
  const verified=query(`SELECT id,username FROM users WHERE firebase_uid=${q(uid)} AND role='admin' AND status='approved'`);
  if(verified.length!==1)throw new Error('Could not verify administrator.');
  console.log('First administrator created and verified. Original SUM rules preserved. No sample data imported.');
}finally{unlinkSync(file);}
