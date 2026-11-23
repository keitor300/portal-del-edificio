import { authRoute, requireUser, rateLimit } from './auth.mjs';
import { bookingRange } from './booking.mjs';
import { HttpError, body, json, sameOrigin } from './http.mjs';
import { dataRoute } from './data.mjs';
import { fileRoute } from './files.mjs';
import { entityRoute } from './entities.mjs';
import { participationRoute } from './participation.mjs';
import { importRoute } from './imports.mjs';
import { recoveryRoute } from './recovery.mjs';

async function reservations(request, env, path) {
  if (!path.startsWith('/api/reservations')) return null;
  const user = await requireUser(request, env);
  if (path === '/api/reservations' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id,unit,date,end_date,start_minute,end_minute,status FROM reservations ORDER BY start_minute DESC LIMIT 1000').all();
    return json({ reservations: results });
  }
  if (path === '/api/reservations' && request.method === 'POST') {
    await rateLimit(env, `reserve:${user.id}`, 30);
    const data = await body(request);
    const unit = user.role === 'admin' ? data.unit : user.unit;
    if (!unit || !await env.DB.prepare('SELECT id FROM units WHERE id=? AND active=1').bind(unit).first()) throw new HttpError(400, 'Elegí una unidad válida.');
    const settings = await env.DB.prepare('SELECT rules FROM settings WHERE id=1').first();
    if (!settings?.rules.trim()) throw new HttpError(409, 'Administración debe cargar el reglamento antes de habilitar las reservas.');
    if (data.acceptedRules !== settings.rules) throw new HttpError(409, 'Leé y aceptá el reglamento vigente antes de reservar.');
    let range;
    try { range = bookingRange(data.date, data.time, data.endTime); }
    catch { throw new HttpError(400, 'Revisá la fecha y el horario. El SUM abre a las 08:30 y cierra a la 01:00; viernes y sábados a las 03:00.'); }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO reservations(id,unit,created_by,date,end_date,start_minute,end_minute,accepted_rules) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, unit, user.id, range.date, range.endDate, range.startMinute, range.endMinute, settings.rules),
      env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id) VALUES (?,?,?)').bind(user.id, 'reservation.create', id),
    ]);
    return json({ id, ...range, unit, status: 'confirmed' }, 201);
  }
  if (path.startsWith('/api/reservations/') && request.method === 'DELETE') {
    const id = path.slice('/api/reservations/'.length);
    const row = await env.DB.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first();
    if (!row) throw new HttpError(404, 'No se encontró la reserva.');
    if (user.role !== 'admin' && row.unit !== user.unit) throw new HttpError(403, 'Solo podés cancelar reservas de tu unidad.');
    if (user.role !== 'admin' && row.start_minute * 60000 + 10800000 <= Date.now()) throw new HttpError(409, 'La reserva ya comenzó. Consultá con Administración.');
    await env.DB.batch([
      env.DB.prepare("UPDATE reservations SET status='cancelled',cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='confirmed'").bind(id),
      env.DB.prepare('INSERT INTO audit_log(actor_id,action,entity_id) VALUES (?,?,?)').bind(user.id, 'reservation.cancel', id),
    ]);
    return json({ ok: true });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      sameOrigin(request);
      if (path === '/api/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT id FROM settings WHERE id=1').first();
        return json({ ok: true, mode: 'production' });
      }
      const recovery = await recoveryRoute(request,env,path);
      if(recovery)return recovery;
      return await authRoute(request, env, path) || await reservations(request, env, path) || await dataRoute(request, env, path) || await fileRoute(request, env, path) || await entityRoute(request, env, path) || await participationRoute(request, env, path) || await importRoute(request, env, path) || json({ error: 'No se encontró la operación.' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (/SETTINGS_CONFLICT/.test(String(error))) return json({error:'Otra persona actualizó los ajustes. Recargá la página antes de guardar.'},409);
      if (/RESERVATION_RULES_CHANGED/.test(String(error))) return json({error:'El reglamento cambió. Leé y aceptá la versión vigente antes de reservar.'},409);
      if (/IMPORT_REQUEST_CHANGED/.test(String(error))) return json({error:'La solicitud ya fue usada para otro archivo.'},409);
      if (/RESERVATION_CONFLICT|DATE_BLOCKED|DATE_HAS_RESERVATIONS/.test(String(error))) return json({ error: 'Ese horario ya no está disponible. Consultá las reservas y elegí otro.' }, 409);
      if (/POLL_OPTIONS_LOCKED/.test(String(error))) return json({ error: 'La encuesta ya tiene votos. No se pueden cambiar sus opciones.' }, 409);
      if (/ISSUE_CLOSED_OR_INVALID/.test(String(error))) return json({ error: 'El reclamo está cerrado o ya no está disponible.' }, 409);
      if (/UNIQUE constraint failed/.test(String(error))) return json({ error: path.includes('/movements') ? 'Ya existe un movimiento con esa fecha, concepto, tipo e importe.' : 'Ya existe un registro para esos datos. Revisá la unidad y el período.' }, 409);
      // Avoid logging request bodies, cookies, passwords or personal registration fields.
      console.error('API failure', request.method, path, error?.name);
      return json({ error: 'No se pudo completar la operación. Volvé a intentar.' }, 500);
    }
  },
};
