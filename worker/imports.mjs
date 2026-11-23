import { digest, requireUser, rateLimit } from './auth.mjs';
import { validateEntity } from './entities.mjs';
import { body, HttpError, json } from './http.mjs';

export async function importRoute(request, env, path) {
  if (path !== '/api/import/movements' || request.method !== 'POST') return null;
  const user = await requireUser(request, env, 'admin');
  await rateLimit(env, `import:${user.id}`, 20);
  const data = await body(request, 1000000);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.id || '') || !Array.isArray(data.items) || !data.items.length || data.items.length > 500) throw new HttpError(400, 'Importá entre 1 y 500 movimientos con una solicitud válida.');
  const items = [];
  for (const input of data.items) {
    if (!input || typeof input !== 'object' || !input.date) throw new HttpError(400, 'Revisá las filas del archivo.');
    const fields = Object.fromEntries(['date','title','type','amount','category','description'].map(key => [key,input[key]]));
    items.push(await validateEntity(env, fields, 'movements', user));
  }
  const fingerprint = await digest(JSON.stringify(items));
  const existing = await env.DB.prepare('SELECT actor_id,fingerprint,completed,result FROM financial_imports WHERE id=?').bind(data.id).first();
  if (existing && (existing.actor_id !== user.id || existing.fingerprint !== fingerprint)) throw new HttpError(409, 'La solicitud ya fue usada para otro archivo. Volvé a seleccionar el archivo.');
  if (existing?.completed) return json(JSON.parse(existing.result));
  const rows = items.map(item => ({ id:crypto.randomUUID(), item }));
  const payload = JSON.stringify(rows);
  // One D1 transaction commits the entire batch and its receipt, including retries.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO financial_imports(id,actor_id,fingerprint) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET actor_id=excluded.actor_id,fingerprint=excluded.fingerprint`).bind(data.id,user.id,fingerprint),
    env.DB.prepare(`INSERT INTO entities(id,collection,data,created_by,updated_by)
      SELECT json_extract(value,'$.id'),'movements',json_extract(value,'$.item'),?,? FROM json_each(?)
      WHERE (SELECT completed FROM financial_imports WHERE id=?)=0
      ON CONFLICT(json_extract(data,'$.movementKey')) WHERE collection='movements' DO NOTHING`).bind(user.id,user.id,payload,data.id),
    env.DB.prepare(`INSERT INTO audit_log(actor_id,action,entity_id,detail)
      SELECT ?,'movements.import',?,json_object('requested',?,'ids',json((SELECT json_group_array(id) FROM entities WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?)))))
      WHERE (SELECT completed FROM financial_imports WHERE id=?)=0`).bind(user.id,data.id,items.length,payload,data.id),
    env.DB.prepare(`UPDATE financial_imports SET completed=1,result=(
      SELECT json_object('ids',json_group_array(id),'skipped',?-count(*)) FROM entities WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?)))
      WHERE id=? AND completed=0`).bind(items.length,payload,data.id),
  ]);
  const receipt = await env.DB.prepare('SELECT result FROM financial_imports WHERE id=?').bind(data.id).first();
  return json(JSON.parse(receipt.result));
}
