import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';
const domain=process.argv[2];
if(domain!=='portal-del-edificio.meme-scanner-nicolas.workers.dev')throw new Error('Expected the verified portal domain.');
const account=JSON.parse(readFileSync(new URL('../.secrets/firebase-service-account.json',import.meta.url),'utf8'));
const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/identitytoolkit'}).setProtectedHeader({alg:'RS256',typ:'JWT'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(await importPKCS8(account.private_key,'RS256'));
const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
if(!tokenResponse.ok)throw new Error('Could not authorize configuration request.');
const {access_token}=await tokenResponse.json();
const endpoint=`https://identitytoolkit.googleapis.com/admin/v2/projects/${account.project_id}/config`;
const headers={Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'};
const current=await fetch(endpoint,{headers});
if(!current.ok)throw new Error(`Cannot read Firebase configuration (${current.status}).`);
const config=await current.json();
const authorizedDomains=[...new Set([...config.authorizedDomains,domain])];
if(authorizedDomains.length!==config.authorizedDomains.length){
  const updated=await fetch(endpoint+'?updateMask=authorizedDomains',{method:'PATCH',headers,body:JSON.stringify({authorizedDomains})});
  if(!updated.ok)throw new Error(`Domain update failed (${updated.status}).`);
}
const verified=await(await fetch(endpoint,{headers})).json();
if(!verified.authorizedDomains.includes(domain))throw new Error('Domain not confirmed.');
console.log('Portal domain authorized for invitation return links. Other Firebase settings preserved.');
