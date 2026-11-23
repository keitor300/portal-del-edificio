import { requireUser, rateLimit } from './auth.mjs';
import { HttpError, body, json, text } from './http.mjs';

export async function participationRoute(request, env, path) {
  const match = /^\/api\/(polls|topics|notices)\/([^/]+)\/(vote|interest|comments|read)$/.exec(path);
  if (!match || request.method !== 'POST') return null;
  const [, collection, id, action] = match;
  const user = await requireUser(request, env);
  await rateLimit(env, `participate:${user.id}`, 120);
  const row = await env.DB.prepare('SELECT data FROM entities WHERE id=? AND collection=?').bind(id, collection).first();
  if (!row || JSON.parse(row.data).status === 'Borrador') throw new HttpError(404, 'No se encontró la publicación.');
  if (collection === 'topics' && action === 'comments') {
    const data = await body(request);
    const commentId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO topic_comments(id,topic_id,author_id,text) VALUES (?,?,?,?)').bind(commentId, id, user.id, text(data.text, 2000)).run();
    return json({ id: commentId }, 201);
  }
  if (!user.unit || user.role !== 'owner') throw new HttpError(403, 'Esta acción corresponde a los propietarios.');
  if (collection === 'polls' && action === 'vote') {
    const data = await body(request);
    if (!Number.isInteger(data.option) || data.option < 0) throw new HttpError(400, 'Elegí una opción válida.');
    try {
      await env.DB.prepare('INSERT INTO votes(poll_id,unit,user_id,option_index) VALUES (?,?,?,?)').bind(id, user.unit, user.id, data.option).run();
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new HttpError(409, 'Tu unidad ya votó en esta encuesta.');
      if (String(error).includes('POLL_CLOSED_OR_INVALID')) throw new HttpError(409, 'La encuesta está cerrada o la opción ya no está disponible.');
      throw error;
    }
    return json({ ok: true });
  }
  if (collection === 'notices' && action === 'read') {
    await env.DB.prepare('INSERT OR IGNORE INTO notice_reads(notice_id,unit) VALUES (?,?)').bind(id, user.unit).run();
    return json({ ok: true });
  }
  if (collection === 'topics' && action === 'interest') {
    const data = await body(request);
    if (typeof data.interested !== 'boolean') throw new HttpError(400, 'Solicitud inválida.');
    if (data.interested) await env.DB.prepare('INSERT OR IGNORE INTO interests(topic_id,unit) VALUES (?,?)').bind(id, user.unit).run();
    else await env.DB.prepare('DELETE FROM interests WHERE topic_id=? AND unit=?').bind(id, user.unit).run();
    return json({ ok: true });
  }
  throw new HttpError(404, 'Operación no encontrada.');
}
