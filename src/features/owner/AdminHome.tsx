import { ArrowUpRight, CalendarDays, CalendarPlus, FilePlus2, FileText, Landmark, Megaphone, MessageCircle, Users, Wrench } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Empty, Section, Status } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { formatDate, money, today } from '../../lib/utils';
import { NoticeRow } from '../notices/Notices';

export function AdminHomePage() {
  const { data } = usePortal();
  const adminBase = useLocation().pathname.startsWith('/admin') ? '/admin' : '/demo/administracion';
  const open = data.issues.filter(item => item.status !== 'Resuelto');
  const balance = data.settings.openingBalance + data.movements.reduce((total, movement) => total + (movement.type === 'Ingreso' ? 1 : -1) * (movement.amount ?? 0), 0);
  const meeting = [...data.meetings].filter(item => item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const reservation = [...data.reservations].filter(item => item.status !== 'Cancelada' && item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const upcomingReservations = data.reservations.filter(item => item.status !== 'Cancelada' && item.date >= today()).length;
  const consultationUnits = new Set(data.messages.map(item => item.unit).filter(Boolean)).size;
  const creationActions = [
    { label: 'Nuevo aviso', description: 'Informá una novedad a todo el edificio', to: `${adminBase}/comunicaciones?new=1`, Icon: Megaphone, tone: 'notice', featured: true },
    { label: 'Crear reunión', description: 'Convocá y armá el orden del día', to: `${adminBase}/comunidad?tab=reuniones&new=1`, Icon: CalendarPlus, tone: 'meeting' },
    { label: 'Registrar movimiento', description: 'Anotá un ingreso o un gasto de caja', to: `${adminBase}/finanzas?tab=movimientos&new=1`, Icon: Landmark, tone: 'finance' },
    { label: 'Publicar reparación', description: 'Contá un trabajo o su avance', to: `${adminBase}/contenido?tab=works&new=1`, Icon: Wrench, tone: 'works' },
    { label: 'Agregar documento', description: 'Subí un acta, reglamento o archivo', to: `${adminBase}/contenido?tab=documents&new=1`, Icon: FilePlus2, tone: 'document' },
    { label: 'Crear encuesta', description: 'Pedí opinión a las unidades', to: `${adminBase}/comunidad?tab=encuestas&new=1`, Icon: Users, tone: 'survey' },
  ];
  const monitoring = [
    { label: 'Reclamos abiertos', value: open.length, description: open.length ? 'Requieren seguimiento' : 'No hay pendientes', to: `${adminBase}/servicios?tab=reclamos`, Icon: Wrench, tone: 'attention' },
    { label: 'Consultas activas', value: consultationUnits, description: 'Conversaciones por unidad', to: `${adminBase}/servicios?tab=chat`, Icon: MessageCircle, tone: 'messages' },
    { label: 'Reservas próximas', value: upcomingReservations, description: 'Uso previsto del SUM', to: `${adminBase}/servicios?tab=sum`, Icon: CalendarDays, tone: 'reservations' },
    { label: 'Caja del consorcio', value: money(balance), description: 'Ver movimientos y saldo', to: `${adminBase}/finanzas`, Icon: Landmark, tone: 'balance' },
  ];

  return <>
    <div className="home-hero admin-home-hero">
      <div className="home-greeting"><div><p className="greeting-date">{formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="home-kicker">Centro de gestión</p><h1>El edificio, al día<span className="greeting-dot">.</span></h1><p>Una vista clara de lo que necesita atención.</p></div></div>
      <figure className="home-hero-image"><img src="/images/vista.jpg" alt="Vista de la ciudad desde el edificio" width="1200" height="800" /><figcaption><span>Administración</span><small>Información clara, comunidad al día</small></figcaption></figure>
    </div>

    <section className="admin-creation-desk" aria-labelledby="admin-actions-title"><div className="admin-creation-heading"><div><span className="eyebrow">Acciones rápidas</span><h2 id="admin-actions-title">Crear y comunicar</h2><p>Elegí una acción para poner al edificio al día.</p></div><span className="admin-desk-note">Los cambios se reflejan en Propietario</span></div><div className="admin-creation-grid">{creationActions.map(({ label, description, to, Icon, tone, featured }) => <Link className={`admin-create-card ${tone}${featured ? ' featured' : ''}`} key={label} to={to}><span className="admin-create-icon"><Icon size={24} /></span><span className="admin-create-copy"><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={19} /></Link>)}</div></section>

    <section className="admin-monitoring" aria-labelledby="admin-monitoring-title"><div className="admin-monitoring-heading"><div><span className="eyebrow">Seguimiento</span><h2 id="admin-monitoring-title">Lo que requiere atención</h2></div><span className="muted">Actualizado en esta demo</span></div><div className="admin-monitoring-grid">{monitoring.map(({ label, value, description, to, Icon, tone }) => <Link className={`admin-monitor-card ${tone}`} to={to} key={label}><span className="admin-monitor-icon"><Icon size={20} /></span><span className="admin-monitor-copy"><span>{label}</span><strong>{value}</strong><small>{description}</small></span><ArrowUpRight size={18} /></Link>)}</div></section>

    <div className="admin-home-columns"><div><Section title="Requieren atención" action={<Link className="text-link" to={`${adminBase}/servicios?tab=reclamos`}>Ver reclamos <ArrowUpRight size={18} /></Link>}>{open.slice(0, 4).map(item => <Link to={`${adminBase}/servicios?tab=reclamos`} className="list-row" key={item.id}><Wrench size={22} /><div className="row-main"><h3>{item.title}</h3><p>Unidad {item.unit} · {item.category}</p></div><Status tone="amber">{item.status}</Status></Link>)}{!open.length && <Empty>No hay reclamos pendientes.</Empty>}</Section><Section title="Comunicaciones recientes">{data.notices.slice(0, 3).map(notice => <NoticeRow key={notice.id} notice={notice} />)}</Section></div><aside><Section title="Lo que viene">{meeting && <Link to={`${adminBase}/comunidad`} className="list-row"><CalendarDays /><div className="row-main"><h3>{meeting.title}</h3><p>{formatDate(meeting.date)} · {meeting.time} h</p></div></Link>}{reservation && <Link to={`${adminBase}/servicios?tab=sum`} className="list-row"><Users /><div className="row-main"><h3>Próxima reserva del SUM</h3><p>{formatDate(reservation.date)} · Unidad {reservation.unit}</p></div></Link>}{!meeting && !reservation && <p className="muted">No hay actividades próximas.</p>}</Section><Section title="Documentos recientes">{data.documents.slice(0, 3).map(document => <Link key={document.id} to={`${adminBase}/contenido`} className="list-row"><FileText size={20} /><div className="row-main"><h3>{document.title}</h3><p>{formatDate(document.date)}</p></div></Link>)}</Section></aside></div>
  </>;
}
