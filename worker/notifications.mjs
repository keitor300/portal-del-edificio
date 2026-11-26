import { requireUser } from './auth.mjs';
import { body, json, HttpError } from './http.mjs';

const destinations = {
  notices: ['novedades', 'comunicaciones'],
  documents: ['edificio/documentos', 'contenido?tab=documents'],
  expenses: ['edificio/expensas', 'finanzas?tab=expensas'],
  meetings: ['edificio/reuniones', 'comunidad?tab=reuniones'],
  polls: ['edificio/encuestas', 'comunidad?tab=encuestas'],
  works: ['edificio/obras', 'contenido?tab=works'],
  statuses: ['mas/estado', 'contenido?tab=statuses'],
  issues: ['servicios/reclamos', 'servicios?tab=reclamos'],
};
export async function notificationItems(env, user) {
  const admin = user.role === 'admin', base = admin ? '/admin/' : '/demo/propietario/';
  const items = [];
  const { results: rows } = await env.DB.prepare(`SELECT * FROM entities WHERE
    collection IN ('notices','documents','expenses','meetings','polls','works','statuses','issues')
    AND (?='admin' OR collection NOT IN ('expenses','issues') OR unit=?)
    ORDER BY updated_at DESC LIMIT 500`).bind(user.role, user.unit).all();
  for (const row of rows) {
    const data = JSON.parse(row.data);
    if (data.status === 'Borrador') continue;
    const destination = destinations[row.collection][admin ? 1 : 0];
    items.push({ id: `entity:${row.id}:${row.version}`, title: data.title,
      description: row.collection === 'issues' ? `Reclamo: ${data.status}` : row.version > 1 ? 'Información actualizada' : 'Nueva publicación',
      href: base + destination + (row.collection === 'notices' ? `/${row.id}` : ''),
      date: row.updated_at, important: !!data.urgent });
  }
  const { results: messages } = await env.DB.prepare(`SELECT m.*,u.role FROM messages m JOIN users u ON u.id=m.author_id
    WHERE m.author_id<>? AND (?='admin' OR (m.unit=? AND u.role='admin')) ORDER BY m.created_at DESC LIMIT 100`).bind(user.id, user.role, user.unit).all();
  for (const message of messages) items.push({ id: `message:${message.id}`, title: admin ? `Consulta de Unidad ${message.unit}` : 'Mensaje de Administración',
    description: message.issue_id ? 'Nueva respuesta en un reclamo' : 'Tenés un mensaje para leer', date: message.created_at,
    href: base + (admin ? `servicios?tab=${message.issue_id ? 'reclamos' : 'chat'}` : `servicios/${message.issue_id ? 'reclamos' : 'chat'}`), important: false });
  const { results: bookings } = await env.DB.prepare("SELECT * FROM reservations WHERE (?='admin' OR unit=?) ORDER BY created_at DESC LIMIT 100").bind(user.role, user.unit).all();
  for (const booking of bookings) items.push({ id: `reservation:${booking.id}:${booking.status}`,
    title: booking.status === 'confirmed' ? 'Reserva del SUM confirmada' : 'Reserva del SUM cancelada',
    description: `Unidad ${booking.unit} · ${booking.date}`, date: booking.cancelled_at || booking.created_at,
    href: base + (admin ? 'servicios?tab=sum' : 'servicios/sum'), important: false });
  if (admin) {
    const { results: owners } = await env.DB.prepare("SELECT id,unit,created_at FROM users WHERE role='owner' AND status='pending'").all();
    for (const owner of owners) items.push({ id: `access:${owner.id}`, title: `Solicitud de Unidad ${owner.unit}`,
      description: 'Pendiente de aprobación', date: owner.created_at, href: '/admin/accesos', important: true });
  }
  const { results: reads } = await env.DB.prepare('SELECT event_key FROM notification_reads WHERE user_id=?').bind(user.id).all();
  const seen = new Set(reads.map(row => row.event_key));
  return items.sort((a,b) => b.date.localeCompare(a.date)).slice(0,100).map(item => ({ ...item, read: seen.has(item.id) }));
}
export async function notificationsRoute(request, env, path) {
  if (path !== '/api/notifications' && path !== '/api/notifications/read') return null;
  const user = await requireUser(request, env);
  const items = await notificationItems(env, user);
  if (path === '/api/notifications' && request.method === 'GET') return json({ items });
  if (path === '/api/notifications/read' && request.method === 'POST') {
    const data = await body(request);
    if (!Array.isArray(data.ids) || data.ids.length > 100 || data.ids.some(id => typeof id !== 'string')) throw new HttpError(400, 'Revisá las novedades seleccionadas.');
    const allowed = new Set(items.map(item => item.id));
    const ids = [...new Set(data.ids)].filter(id => allowed.has(id));
    if (ids.length) await env.DB.batch(ids.map(id => env.DB.prepare('INSERT OR IGNORE INTO notification_reads(user_id,event_key,read_at) VALUES (?,?,?)').bind(user.id, id, Date.now())));
    return json({ ok: true });
  }
  throw new HttpError(405, 'Operación no disponible.');
}
