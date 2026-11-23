import { requireUser, rateLimit } from './auth.mjs';
import { HttpError, body, json, text } from './http.mjs';
import { collections } from './data.mjs';

const strings = ['title','description','date','category','status','provider','period','dueDate','time','endTime','endDate','place','agenda','summary','unit','startDate','contact','phone','email','type'];
const booleans = ['pinned','urgent','closed','formal','public'];
const dateFields = ['date','dueDate','endDate','startDate'];
const argDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

export async function validateEntity(env, data, collection, user, previous) {
  const item = {};
  for (const field of strings) if (data[field] !== undefined) {
    if (typeof data[field] !== 'string' || data[field].length > (['description','agenda','summary'].includes(field) ? 12000 : 300)) throw new HttpError(400, `Revisá el campo ${field}.`);
    item[field] = data[field].trim();
  }
  item.title = text(item.title, 160);
  item.description ??= '';
  item.date ??= argDate();
  for (const field of dateFields) if (item[field]) {
    const parsed = new Date(`${item[field]}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item[field]) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== item[field]) throw new HttpError(400, 'La fecha no es válida.');
  }
  for (const field of booleans) if (data[field] !== undefined) {
    if (typeof data[field] !== 'boolean') throw new HttpError(400, 'Revisá los campos de la publicación.');
    item[field] = data[field];
  }
  if (data.amount !== undefined) {
    if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 1000000000) throw new HttpError(400, 'Ingresá un importe positivo válido.');
    item.amount = Math.round(data.amount * 100) / 100;
  }
  if (collection === 'movements') {
    if (!item.amount || !['Ingreso','Egreso'].includes(data.type)) throw new HttpError(400, 'Completá el importe y elegí ingreso o egreso.');
    item.type = data.type;
    const normalizedTitle = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    item.movementKey = JSON.stringify([item.date, normalizedTitle, item.type, Math.round(item.amount * 100)]);
  }
  if (data.progress !== undefined) {
    if (!Number.isInteger(data.progress) || data.progress < 0 || data.progress > 100) throw new HttpError(400, 'El progreso debe estar entre 0 y 100.');
    item.progress = data.progress;
  }
  if (data.milestones !== undefined) {
    if (!Array.isArray(data.milestones) || data.milestones.length > 100) throw new HttpError(400, 'Revisá los avances.');
    item.milestones = data.milestones.map(v => text(v, 2000));
  }
  if (collection === 'polls') {
    if (!Array.isArray(data.options) || data.options.length < 2 || data.options.length > 12) throw new HttpError(400, 'Agregá entre 2 y 12 opciones.');
    item.options = data.options.map(option => text(option, 200));
    if (new Set(item.options).size !== item.options.length) throw new HttpError(400, 'Las opciones no pueden repetirse.');
    if (previous && JSON.stringify(item.options) !== JSON.stringify(previous.options)) {
      if (await env.DB.prepare('SELECT 1 FROM votes WHERE poll_id=? LIMIT 1').bind(data.id).first()) throw new HttpError(409, 'No se pueden cambiar las opciones de una encuesta que ya tiene votos.');
    }
  }
  if (user.role === 'owner') {
    item.unit = user.unit;
    item.status = collection === 'issues' ? 'Recibido' : 'Pendiente';
    item.date = argDate();
    delete item.summary;
  }
  if (collection === 'issues' && (!item.unit || !['Recibido','En curso','Resuelto'].includes(item.status))) throw new HttpError(400, 'Revisá la unidad y el estado del reclamo.');
  if (item.unit && !await env.DB.prepare('SELECT id FROM units WHERE id=?').bind(item.unit).first()) throw new HttpError(400, 'Elegí una unidad del edificio.');
  if (collection === 'expenses' && (!item.unit || !item.amount || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.period || '') || !item.dueDate || !['Borrador','Publicado'].includes(item.status))) throw new HttpError(400, 'Completá unidad, período, importe, vencimiento y estado.');
  if (data.attachment) {
    const id = /^\/api\/files\/([a-f0-9-]{36})$/.exec(data.attachment.url || '')?.[1];
    const file = id && await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(id).first();
    if (!file || (user.role !== 'admin' && file.owner_id !== user.id)) throw new HttpError(400, 'Adjuntá un archivo válido.');
    if (['issues','expenses'].includes(collection) && (file.visibility !== 'unit' || file.unit !== item.unit)) throw new HttpError(400, 'El archivo debe corresponder a la unidad.');
    if (!['issues','expenses'].includes(collection) && file.visibility !== 'building') throw new HttpError(400, 'Este archivo es privado y no puede publicarse para todo el edificio.');
    item.attachment = { name: file.name, url: `/api/files/${file.id}`, type: file.mime };
    if (file.mime.startsWith('image/')) item.image = item.attachment.url;
  }
  if (collection === 'expenses' && item.status === 'Publicado' && !item.attachment) throw new HttpError(400, 'Adjuntá la liquidación antes de publicarla.');
  return item;
}

export async function entityRoute(request, env, path) {
  const match = /^\/api\/entities\/([a-z]+)(?:\/([^/]+))?$/.exec(path);
  if (!match) return null;
  const [, collection, id] = match;
  if (!collections.includes(collection)) throw new HttpError(404, 'Sección no encontrada.');
  const user = await requireUser(request, env);
  await rateLimit(env, `entity:${user.id}`, 200);
  if (user.role !== 'admin' && !(request.method === 'POST' && !id && ['issues','topics'].includes(collection))) throw new HttpError(403, 'Esta acción requiere acceso de Administración.');
  if (request.method === 'DELETE' && id) {
    const previous = await env.DB.prepare('SELECT data FROM entities WHERE id=? AND collection=?').bind(id, collection).first();
    if (!previous) throw new HttpError(404, 'El registro ya no existe.');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id,detail) VALUES (?,?,?,?)').bind(user.id, `${collection}.delete`, id, previous.data),
      env.DB.prepare('DELETE FROM messages WHERE issue_id=?').bind(id),
      env.DB.prepare('DELETE FROM entities WHERE id=? AND collection=?').bind(id, collection),
    ]);
    return json({ ok: true });
  }
  if ((request.method === 'POST' && !id) || (request.method === 'PATCH' && id)) {
    const data = await body(request, 50000);
    const existing = id ? await env.DB.prepare('SELECT data,version FROM entities WHERE id=? AND collection=?').bind(id, collection).first() : null;
    if (id && !existing) throw new HttpError(404, 'El registro ya no existe.');
    if (existing && data.version !== existing.version) throw new HttpError(409, 'Otra persona modificó este registro. Actualizá la página antes de guardar.');
    const previous = existing ? JSON.parse(existing.data) : null;
    const entityId = id || (typeof data.id === 'string' && /^[a-f0-9-]{36}$/.test(data.id) ? data.id : crypto.randomUUID());
    const item = await validateEntity(env, { ...previous, ...data, id: entityId }, collection, user, previous);
    if (existing) {
      // Optimistic locking also applies to the write, not only to the preceding read.
      const changed = await env.DB.batch([
        env.DB.prepare(`UPDATE entities SET data=?,unit=?,version=version+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id=? AND version=?`).bind(JSON.stringify(item), item.unit || null, user.id, id, existing.version),
        env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id,detail) SELECT ?,?,?,? WHERE changes()=1')
          .bind(user.id, `${collection}.update`, id, JSON.stringify({ previous, next: item })),
      ]);
      if (!changed[0].meta.changes) throw new HttpError(409, 'Otra persona modificó este registro. Actualizá la página.');
      return json({ id, version: existing.version + 1 });
    }
    await env.DB.batch([
      env.DB.prepare('INSERT INTO entities(id,collection,unit,data,created_by,updated_by) VALUES (?,?,?,?,?,?)').bind(entityId, collection, item.unit || null, JSON.stringify(item), user.id, user.id),
      env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id) VALUES (?,?,?)').bind(user.id, `${collection}.create`, entityId),
    ]);
    return json({ id: entityId, version: 1 }, 201);
  }
  return null;
}
