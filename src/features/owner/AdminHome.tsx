import { ArrowUpRight, CalendarDays, FileText, MessageCircle, Users, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Empty, Section, Status } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { formatDate, money, today } from '../../lib/utils';
import { NoticeRow } from '../notices/Notices';

const adminBase = '/demo/administracion';

export function AdminHomePage() {
  const { data } = usePortal();
  const open = data.issues.filter(item => item.status !== 'Resuelto');
  const balance = data.settings.openingBalance + data.movements.reduce((total, movement) => total + (movement.type === 'Ingreso' ? 1 : -1) * (movement.amount ?? 0), 0);
  const meeting = [...data.meetings].filter(item => item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const reservation = [...data.reservations].filter(item => item.status !== 'Cancelada' && item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const actions = [
    { label: 'Nuevo aviso', description: 'Publicar una comunicación para el edificio', to: `${adminBase}/comunicaciones?new=1`, Icon: MessageCircle },
    { label: 'Registrar movimiento', description: 'Cargar un ingreso o un gasto', to: `${adminBase}/finanzas?tab=movimientos&new=1`, Icon: FileText },
    { label: 'Agregar documento', description: 'Compartir un archivo con la comunidad', to: `${adminBase}/contenido?tab=documents&new=1`, Icon: FileText },
    { label: 'Crear reunión', description: 'Convocar y publicar un orden del día', to: `${adminBase}/comunidad?tab=reuniones&new=1`, Icon: Users },
    { label: 'Crear encuesta', description: 'Consultar la opinión de las unidades', to: `${adminBase}/comunidad?tab=encuestas&new=1`, Icon: Users },
  ];

  return <>
    <div className="home-greeting"><div><p className="greeting-date">{formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>El edificio, al día<span className="greeting-dot">.</span></h1><p>Los pendientes y la actividad de tu comunidad.</p></div></div>

    <section className="admin-primary-actions" aria-labelledby="admin-actions-title"><div className="admin-primary-heading"><div><span className="eyebrow">Acciones de administración</span><h2 id="admin-actions-title">¿Qué necesitás hacer?</h2></div><span className="muted">Demo</span></div><div className="admin-action-list">{actions.map(({ label, description, to, Icon }) => <Link key={label} to={to}><span className="admin-action-icon"><Icon size={20} /></span><span><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={18} /></Link>)}</div></section>

    <div className="admin-dashboard-summary"><Link to={`${adminBase}/servicios?tab=reclamos`}><span>Reclamos abiertos</span><strong>{open.length}</strong><small>Ver pendientes <ArrowUpRight size={15} /></small></Link><Link to={`${adminBase}/comunicaciones`}><span>Lectura del último aviso</span><strong>{data.notices[0]?.views ?? 0}<small> / 52</small></strong><small>Unidades · simulación</small></Link><Link to={`${adminBase}/finanzas`}><span>Saldo del edificio</span><strong>{money(balance)}</strong><small>Cuentas demo <ArrowUpRight size={15} /></small></Link></div>

    <div className="admin-home-columns"><div><Section title="Requieren atención" action={<Link className="text-link" to={`${adminBase}/servicios?tab=reclamos`}>Ver reclamos <ArrowUpRight size={18} /></Link>}>{open.slice(0, 4).map(item => <Link to={`${adminBase}/servicios?tab=reclamos`} className="list-row" key={item.id}><Wrench size={22} /><div className="row-main"><h3>{item.title}</h3><p>Unidad {item.unit} · {item.category}</p></div><Status tone="amber">{item.status}</Status></Link>)}{!open.length && <Empty>No hay reclamos pendientes.</Empty>}</Section><Section title="Comunicaciones recientes">{data.notices.slice(0, 3).map(notice => <NoticeRow key={notice.id} notice={notice} />)}</Section></div><aside><Section title="Lo que viene">{meeting && <Link to={`${adminBase}/comunidad`} className="list-row"><CalendarDays /><div className="row-main"><h3>{meeting.title}</h3><p>{formatDate(meeting.date)} · {meeting.time} h</p></div></Link>}{reservation && <Link to={`${adminBase}/servicios?tab=sum`} className="list-row"><Users /><div className="row-main"><h3>Próxima reserva del SUM</h3><p>{formatDate(reservation.date)} · Unidad {reservation.unit}</p></div></Link>}{!meeting && !reservation && <p className="muted">No hay actividades próximas.</p>}</Section><Section title="Documentos recientes">{data.documents.slice(0, 3).map(document => <Link key={document.id} to={`${adminBase}/contenido`} className="list-row"><FileText size={20} /><div className="row-main"><h3>{document.title}</h3><p>{formatDate(document.date)}</p></div></Link>)}</Section></aside></div>
  </>;
}
