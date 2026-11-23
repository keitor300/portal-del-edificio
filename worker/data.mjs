import { requireUser, userFor } from './auth.mjs';
import { HttpError, body, json, text } from './http.mjs';

export const collections = ['notices','movements','expenses','budgets','documents','meetings','topics','polls','issues','works','listings','lost','contacts','faqs','statuses'];
const publicCollections = ['notices', 'statuses'];
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const timeLabel = minute => `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
function visible(row, user) {
  const data = JSON.parse(row.data);
  if (!user) return publicCollections.includes(row.collection) && data.status !== 'Borrador';
  if (user.role === 'admin') return true;
  if (['issues','expenses'].includes(row.collection) && row.unit !== user.unit) return false;
  return data.status !== 'Borrador';
}
export async function state(env, user) {
  const result = Object.fromEntries([...collections, 'reservations', 'messages'].map(key => [key, []]));
  const settings = await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
  const blocked = await env.DB.prepare('SELECT date FROM blocked_dates ORDER BY date').all();
  result.settings = { rules: settings.rules, blockedDates: blocked.results.map(row => row.date), openingBalance: user ? settings.opening_balance_cents / 100 : 0, seedDate: dateToday() };
  const rows = await env.DB.prepare('SELECT id,collection,unit,data,version FROM entities ORDER BY created_at DESC').all();
  for (const row of rows.results) {
    if (visible(row, user)) result[row.collection].push({ ...JSON.parse(row.data), id: row.id, ...(row.unit ? { unit: row.unit } : {}), version: row.version });
  }
  if (!user) return result;
  const bookings = await env.DB.prepare('SELECT id,unit,date,end_date,start_minute,end_minute,status FROM reservations ORDER BY start_minute DESC').all();
  result.reservations = bookings.results.map(row => ({ id: row.id, unit: row.unit, date: row.date, endDate: row.end_date, time: timeLabel(row.start_minute), endTime: timeLabel(row.end_minute), title: 'Reserva del SUM', description: '', status: row.status === 'confirmed' ? 'Confirmada' : 'Cancelada', place: 'SUM' }));
  const messages = await env.DB.prepare(`SELECT m.*,u.name,u.role FROM messages m JOIN users u ON u.id=m.author_id
    WHERE (?='admin' OR m.unit=?) ORDER BY m.created_at`).bind(user.role, user.unit).all();
  for (const row of messages.results) {
    const message = { id: row.id, unit: row.unit, text: row.text, date: row.created_at, author: row.role === 'admin' ? 'Administración' : `Unidad ${row.unit}` };
    if (row.issue_id) {
      const issue = result.issues.find(item => item.id === row.issue_id);
      if (issue) (issue.messages ??= []).push(message);
    } else result.messages.push(message);
  }
  const votes = await env.DB.prepare('SELECT poll_id,unit,option_index FROM votes').all();
  for (const poll of result.polls) {
    poll.votes = (poll.options || []).map((_, i) => votes.results.filter(v => v.poll_id === poll.id && v.option_index === i).length);
    poll.voted = votes.results.find(v => v.poll_id === poll.id && v.unit === user.unit)?.option_index;
  }
  const reads = await env.DB.prepare('SELECT notice_id,unit FROM notice_reads').all();
  for (const notice of result.notices) {
    notice.views = reads.results.filter(r => r.notice_id === notice.id).length;
    notice.read = reads.results.some(r => r.notice_id === notice.id && r.unit === user.unit);
  }
  return result;
}

export async function dataRoute(request, env, path) {
  if (path === '/api/state' && request.method === 'GET') return json({ data: await state(env, await userFor(request, env)) });
  if (path === '/api/settings' && request.method === 'PATCH') {
    const admin = await requireUser(request, env, 'admin');
    const data = await body(request);
    const current = await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
    const rules = data.rules === undefined ? current.rules : text(data.rules, 12000);
    const cents = data.openingBalance === undefined ? current.opening_balance_cents : Math.round(data.openingBalance * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100000000000) throw new HttpError(400, 'El saldo ingresado no es válido.');
    const queries = [env.DB.prepare("UPDATE settings SET rules=?,opening_balance_cents=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1").bind(rules, cents)];
    if (data.blockedDates !== undefined) {
      if (!Array.isArray(data.blockedDates) || data.blockedDates.length > 366) throw new HttpError(400, 'Revisá las fechas bloqueadas.');
      for (const date of data.blockedDates) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new HttpError(400, 'Una fecha bloqueada no es válida.');
      }
      queries.push(env.DB.prepare('DELETE FROM blocked_dates'));
      for (const date of new Set(data.blockedDates)) queries.push(env.DB.prepare('INSERT INTO blocked_dates(date,created_by) VALUES (?,?)').bind(date, admin.id));
    }
    queries.push(env.DB.prepare('INSERT INTO audit_log(actor_id,action,detail) VALUES (?,?,?)').bind(admin.id, 'settings.update', JSON.stringify(data)));
    await env.DB.batch(queries);
    return json({ ok: true });
  }
  if (path === '/api/messages' && request.method === 'POST') {
    const user = await requireUser(request, env);
    const data = await body(request);
    const unit = user.role === 'admin' ? text(data.unit, 8) : user.unit;
    if (!await env.DB.prepare('SELECT id FROM units WHERE id=?').bind(unit).first()) throw new HttpError(400, 'Unidad inválida.');
    const content = text(data.text, 4000);
    const issueId = data.issueId || null;
    if (issueId) {
      const row = await env.DB.prepare("SELECT data FROM entities WHERE id=? AND collection='issues' AND unit=?").bind(issueId, unit).first();
      if (!row) throw new HttpError(404, 'No se encontró el reclamo.');
      if (JSON.parse(row.data).status === 'Resuelto') throw new HttpError(409, 'El reclamo está cerrado.');
    }
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO messages(id,unit,author_id,issue_id,text) VALUES (?,?,?,?,?)').bind(id, unit, user.id, issueId, content).run();
    return json({ id }, 201);
  }
  return null;
}
