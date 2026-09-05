import { ArrowRight, ArrowUpRight, CalendarDays, Clock3, FileText, MessageSquare, Wrench, Droplets, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../hooks/usePortal';
import { formatDate, money, today } from '../../lib/utils';
import { Empty, Section, Status } from '../../components/UI';
import { StatusList } from '../content/Content';

export function OwnerHomePage() {
  const { data } = usePortal();
  const urgent = data.notices.find(item => item.urgent);
  const meeting = [...data.meetings].filter(item => item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const expense = [...data.expenses].sort((a, b) => (b.period ?? b.date).localeCompare(a.period ?? a.date))[0];
  const reservation = [...data.reservations].filter(item => item.unit === '7B' && item.status !== 'Cancelada' && item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const issue = data.issues.find(item => (item.unit === '7B' || item.unit === 'Unidad 7B') && item.status !== 'Resuelto');
  const recentNotices = data.notices.filter(item => !item.urgent).slice(0, 2);

  return <>
    <div className="home-greeting"><div><p className="greeting-date">{formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>Hola, Unidad 7B<span className="greeting-dot">.</span></h1><p>Tu edificio, un poco más cerca.</p></div><span className="unit-mark"><Building2 size={20} />52 unidades · Una comunidad</span></div>

    {urgent && <Link to={`/demo/propietario/novedades/${urgent.id}`} className="urgent-notice"><span className="urgent-symbol"><Droplets size={25} /></span><div><strong>{urgent.title}</strong><p>{urgent.description.split('. ')[0]}.</p></div><span className="urgent-link">Ver información<ArrowRight size={19} /></span></Link>}

    <section className="owner-primary-actions" aria-labelledby="owner-actions-title"><div className="owner-primary-heading"><div><span className="eyebrow">Acciones principales</span><h2 id="owner-actions-title">¿Qué necesitás hacer?</h2></div><span className="muted">Unidad 7B</span></div><div className="owner-primary-grid"><Link to="/demo/propietario/servicios/sum"><CalendarDays size={23} /><span><strong>Reservar el SUM</strong><small>Elegí fecha y turno</small></span><ArrowUpRight size={18} /></Link><Link to="/demo/propietario/edificio/cuentas"><FileText size={23} /><span><strong>Ver cuentas</strong><small>Movimientos y liquidaciones</small></span><ArrowUpRight size={18} /></Link><Link to="/demo/propietario/servicios/reclamos?new=1"><Wrench size={23} /><span><strong>Informar un problema</strong><small>Crear y seguir un reclamo</small></span><ArrowUpRight size={18} /></Link></div></section>

    <div className="owner-home-columns"><div>
      <Section title="Tu actividad"><div className="owner-activity-list">{meeting && <Link className="list-row" to="/demo/propietario/edificio/reuniones"><CalendarDays size={21} /><div className="row-main"><span className="eyebrow">Próxima reunión</span><h3>{meeting.title}</h3><p>{formatDate(meeting.date)} · {meeting.time} h · {meeting.place}</p></div><ArrowUpRight size={19} /></Link>}{reservation && <Link to="/demo/propietario/servicios/sum" className="list-row"><CalendarDays size={21} /><div className="row-main"><h3>Tu reserva del SUM</h3><p>{formatDate(reservation.date)} · {reservation.time} a {reservation.endTime} h</p></div><Status tone="green">Confirmada</Status></Link>}{issue && <Link to="/demo/propietario/servicios/reclamos" className="list-row"><MessageSquare size={21} /><div className="row-main"><h3>{issue.title}</h3><p>Tu reclamo · {issue.status}</p></div><ArrowUpRight size={19} /></Link>}{!meeting && !reservation && !issue && <Empty>No tenés actividad pendiente.</Empty>}</div></Section>
      <Section title="Últimas novedades" action={<Link className="text-link" to="/demo/propietario/novedades">Ver todas<ArrowUpRight size={18} /></Link>}><div className="list">{recentNotices.map(notice => <Link className="notice-row" to={`/demo/propietario/novedades/${notice.id}`} key={notice.id}><div className="notice-icon"><MessageSquare size={20} /></div><div className="row-main"><div className="row-meta"><span>{notice.category}</span><span>{formatDate(notice.date)}</span></div><h3>{notice.title}</h3><p>{notice.description}</p></div><ArrowUpRight className="row-arrow" size={19} /></Link>)}{!recentNotices.length && <Empty>No hay novedades publicadas.</Empty>}</div></Section>
    </div><aside className="owner-home-aside">{expense && <section className="expense-summary"><div className="expense-top"><FileText size={24} /><span>Cuentas de tu unidad</span></div><h2>{expense.title.replace(/^Expensas/, 'Cuentas')}</h2><p className="expense-amount">{money(expense.amount ?? 0)}</p><p className="expense-due"><Clock3 size={17} />Vence el {formatDate(expense.dueDate ?? expense.date)}</p><Link className="button" to="/demo/propietario/edificio/cuentas">Ver cuenta<ArrowRight size={18} /></Link><small>Importe de muestra · Sin pagos online</small></section>}<Section title="Cómo está el edificio" action={<Link className="text-link" to="/demo/propietario/mas">Ver más<ArrowUpRight size={18} /></Link>}><StatusList compact /></Section><figure className="home-building"><img src="/images/fachada.jpg" alt="El edificio: fachada con amplios balcones y entrada en la esquina" width="802" height="829" /><figcaption><Building2 size={18} /><span>Un espacio que compartimos.</span></figcaption></figure></aside></div>
  </>;
}
