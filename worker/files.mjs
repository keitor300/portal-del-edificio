import { requireUser, rateLimit } from './auth.mjs';
import { HttpError, body, json, text } from './http.mjs';

const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']);
function validSignature(bytes, mime) {
  const start = new TextDecoder().decode(bytes.slice(0, 12));
  if (mime === 'application/pdf') return start.startsWith('%PDF-');
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/png') return bytes.slice(0, 8).every((b,i) => b === [137,80,78,71,13,10,26,10][i]) && bytes.length > 8;
  if (mime === 'image/webp') return start.startsWith('RIFF') && start.slice(8, 12) === 'WEBP';
  return mime === 'text/plain';
}

export async function fileRoute(request, env, path) {
  if (!path.startsWith('/api/files')) return null;
  const user = await requireUser(request, env);
  if (path === '/api/files' && request.method === 'POST') {
    await rateLimit(env, `files:${user.id}`, 30);
    const data = await body(request, 1500000);
    const name = text(data.name, 200);
    const mime = text(data.type, 100);
    if (!allowed.has(mime)) throw new HttpError(400, 'Adjuntá un PDF, JPG, PNG, WebP o TXT.');
    const prefix = `data:${mime};base64,`;
    if (typeof data.url !== 'string' || !data.url.startsWith(prefix)) throw new HttpError(400, 'El archivo no es válido.');
    let bytes;
    try { bytes = Uint8Array.from(atob(data.url.slice(prefix.length)), char => char.charCodeAt(0)); }
    catch { throw new HttpError(400, 'No se pudo leer el archivo.'); }
    if (bytes.length === 0 || bytes.length > 1048576 || !validSignature(bytes, mime)) throw new HttpError(400, 'Revisá el formato del archivo y que no supere 1 MB.');
    const unit = user.role === 'admin' ? (data.unit || null) : user.unit;
    if (unit && !await env.DB.prepare('SELECT id FROM units WHERE id=?').bind(unit).first()) throw new HttpError(400, 'Unidad inválida.');
    const visibility = unit ? 'unit' : 'building';
    const id = crypto.randomUUID();
    const key = `attachments/${id}`;
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      await env.DB.prepare('INSERT INTO files(id,owner_id,unit,visibility,name,mime,size,object_key) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, user.id, unit, visibility, name, mime, bytes.length, key).run();
    } catch (error) { await env.FILES.delete(key); throw error; }
    return json({ id, name, type: mime, url: `/api/files/${id}` }, 201);
  }
  if (path.startsWith('/api/files/') && request.method === 'GET') {
    const file = await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(path.slice('/api/files/'.length)).first();
    if (!file || (user.role !== 'admin' && file.visibility === 'unit' && file.unit !== user.unit)) throw new HttpError(404, 'Archivo no disponible.');
    if (user.role !== 'admin' && file.owner_id !== user.id) {
      // An unguessable URL is not permission to read an unpublished attachment.
      const shared = await env.DB.prepare(`SELECT 1 FROM entities
        WHERE json_extract(data,'$.attachment.url')=?
        AND coalesce(json_extract(data,'$.status'),'')<>'Borrador'
        AND (unit IS NULL OR unit=?)
        UNION ALL SELECT 1 FROM messages WHERE attachment_id=? AND unit=? LIMIT 1`)
        .bind(`/api/files/${file.id}`, user.unit, file.id, user.unit).first();
      if (!shared) throw new HttpError(404, 'Archivo no disponible.');
    }
    const object = await env.FILES.get(file.object_key);
    if (!object) throw new HttpError(404, 'Archivo no disponible.');
    return new Response(object.body, { headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    } });
  }
  return null;
}
