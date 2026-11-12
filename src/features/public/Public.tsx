import { AlertTriangle, ArrowUpRight, Bell, Building2, CalendarDays, ChevronRight, FileText, Home, LockKeyhole, Mail, MessageCircle, ReceiptText, ShieldCheck, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { formatDate, today } from '../../lib/utils';

const gallery = [
  { src: '/images/fachada.jpg', alt: 'Fachada del Edificio 13 y 34', label: 'La fachada' },
  { src: '/images/hall.jpg', alt: 'Hall de entrada del edificio', label: 'El hall de entrada' },
  { src: '/images/sum.jpg', alt: 'Salón de usos múltiples con vista a la ciudad', label: 'El salón de usos múltiples' },
  { src: '/images/vista.jpg', alt: 'Vista panorámica de la ciudad desde el edificio', label: 'La vista desde arriba' },
];

function noticeTone(notice: Entity) {
  if (notice.urgent) return 'urgent';
  switch (notice.category) {
    case 'Mantenimiento': return 'maintenance';
    case 'Reunión': return 'meeting';
    case 'Comunidad': return 'community';
    default: return 'information';
  }
}

function PublicNoticeCard({ notice }: { notice: Entity }) {
  const category = notice.urgent ? 'Importante' : notice.category ?? 'Información';
  return <Link className={`public-news-row public-news-tone-${noticeTone(notice)}`} to={`/novedades/${notice.id}`}>
    <time className="public-news-date" dateTime={notice.date} aria-label={formatDate(notice.date)}><strong>{formatDate(notice.date, { day: 'numeric' })}</strong><small>{formatDate(notice.date, { month: 'short' })}</small></time>
    <span className="public-news-copy"><span className="public-news-topline"><span className="public-news-category">{category}</span></span><strong>{notice.title}</strong><span>{notice.description}</span></span>
    <ArrowUpRight size={19} />
  </Link>;
}

function PublicNotificationRow({ notice }: { notice: Entity }) {
  const label = notice.urgent ? 'Hoy' : formatDate(notice.date, { day: 'numeric', month: 'short' });
  return <Link className={`public-notification-row public-news-tone-${noticeTone(notice)}`} to={`/novedades/${notice.id}`}>
    <span className="public-notification-icon">{notice.urgent ? <AlertTriangle size={21} /> : notice.category === 'Reunión' ? <CalendarDays size={21} /> : <Bell size={21} />}</span>
    <span className="public-notification-copy"><strong>{notice.title}</strong><small>{notice.description}</small></span>
    <span className="public-notification-date">{label}</span>
    <ChevronRight size={18} />
  </Link>;
}

export function PublicHeader() {
  return <header className="public-header">
    <div className="public-header-inner">
      <Link to="/" className="public-brand" aria-label="Edificio 13 y 34, inicio">
        <span className="public-brand-mark"><Building2 size={21} /></span>
        <span><strong>Portal del Edificio</strong><small>Edificio 13 y 34</small></span>
      </Link>
      <nav className="public-nav" aria-label="Navegación del edificio">
        <Link to="/novedades"><Bell size={17} />Novedades</Link>
        <Link to="/edificio">El edificio</Link>
        <Link to="/contacto">Contacto</Link>
        <Link to="/demo/propietario" className="public-demo-link">Explorar demo <ArrowUpRight size={16} /></Link>
      </nav>
    </div>
  </header>;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="public-layout"><PublicHeader /><main className="public-main">{children}</main><PublicFooter /></div>;
}

export function PublicHomePage() {
  const { data } = usePortal();
  const notices = [...data.notices].sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date)).slice(0, 4);
  const statuses = data.statuses.slice(0, 3);
  const nextMeeting = [...data.meetings].filter(item => item.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];

  return <PublicLayout>
    <section className="public-hero">
      <div className="public-hero-image"><img src="/images/fachada.jpg" alt="Fachada del Edificio 13 y 34" /></div>
      <div className="public-hero-content">
        <span className="public-kicker">Bienvenido al portal</span>
        <h1>Edificio 13 y 34</h1>
        <p>Información, espacios y vida en comunidad, reunidos en un mismo lugar.</p>
        <div className="public-hero-actions"><Link className="public-primary-link" to="/demo/propietario/servicios/sum"><CalendarDays size={18} />Reservar el SUM</Link><Link className="public-secondary-link" to="/novedades">Ver novedades <ArrowUpRight size={17} /></Link></div>
      </div>
    </section>

    <section className="public-notification-panel" aria-labelledby="news-title">
      <div className="public-notification-heading"><div><span className="public-notification-title"><Bell size={24} /> <strong id="news-title">Notificaciones</strong><em>{notices.length}</em></span><small>Lo importante del edificio, reunido para vos.</small></div><Link to="/novedades" className="public-text-link">Ver todas <ArrowUpRight size={17} /></Link></div>
      <div className="public-notification-list">{notices.slice(0, 3).map(notice => <PublicNotificationRow notice={notice} key={notice.id} />)}</div>
    </section>

    <section className="public-actions" aria-labelledby="actions-title">
      <div className="public-section-heading"><div><span className="public-kicker">Todo a mano</span><h2 id="actions-title">Elegí lo que necesitás</h2></div><span className="public-demo-badge">Recorrido demo</span></div>
      <div className="public-action-grid">
        <Link className="public-action public-action-expenses" to="/demo/propietario/edificio/expensas"><ReceiptText size={31} /><span><strong>Expensas</strong><small>Consultá y descargá tus expensas</small></span><ChevronRight size={19} /></Link>
        <Link className="public-action public-action-documents" to="/demo/propietario/edificio/documentos"><FileText size={31} /><span><strong>Documentos</strong><small>Reglamentos, actas y archivos</small></span><ChevronRight size={19} /></Link>
        <Link className="public-action public-action-issues" to="/demo/propietario/servicios/reclamos"><Wrench size={31} /><span><strong>Reclamos</strong><small>Informá un problema y seguí su estado</small></span><ChevronRight size={19} /></Link>
        <Link className="public-action public-action-meetings" to="/demo/propietario/edificio/reuniones"><CalendarDays size={31} /><span><strong>Reuniones</strong><small>Próximas reuniones, actas y encuestas</small></span><ChevronRight size={19} /></Link>
      </div>
    </section>

    <section className="public-state" aria-labelledby="state-title">
      <div className="public-section-heading"><div><span className="public-kicker">Información al día</span><h2 id="state-title">El edificio, en orden</h2></div></div>
      <div className="public-state-grid"><section className="public-status-panel"><div className="public-status-panel-heading"><Building2 size={24} /><strong>Estado del edificio</strong><Link to="/demo/propietario/mas/estado">Ver todo <ArrowUpRight size={16} /></Link></div><div className="public-status-list">{statuses.map(status => <div className="public-status-row" key={status.id}><span className="public-status-icon"><ShieldCheck size={19} /></span><span><strong>{status.title}</strong><small>{status.description}</small></span><em>{status.status}</em></div>)}</div></section>{nextMeeting ? <Link className="public-event-feature" to="/demo/propietario/edificio/reuniones"><img src="/images/hall.jpg" alt="Hall del Edificio 13 y 34" /><span className="public-event-overlay"><span className="public-event-kicker"><CalendarDays size={19} />Próximo evento</span><strong>{nextMeeting.title}</strong><small>{formatDate(nextMeeting.date)} · {nextMeeting.time} h</small><span className="public-event-action">Ver detalles <ArrowUpRight size={17} /></span></span></Link> : <Link className="public-event-feature" to="/demo/propietario/servicios/sum"><img src="/images/sum.jpg" alt="Salón de usos múltiples" /><span className="public-event-overlay"><span className="public-event-kicker"><Users size={19} />Espacio común</span><strong>Reservá el SUM</strong><small>Consultá disponibilidad y reglas.</small><span className="public-event-action">Ver horarios <ArrowUpRight size={17} /></span></span></Link>}</div>
    </section>

    <section className="public-building" aria-labelledby="building-title">
      <div className="public-section-heading"><div><span className="public-kicker">Un poco más cerca</span><h2 id="building-title">Los espacios que compartimos</h2></div><Link to="/edificio" className="public-text-link">Conocer el edificio <ArrowUpRight size={17} /></Link></div>
      <div className="public-building-grid">{gallery.map(item => <figure key={item.src}><img src={item.src} alt={item.alt} /><figcaption>{item.label}</figcaption></figure>)}</div>
    </section>

    <section className="public-about" aria-labelledby="about-title"><div><span className="public-kicker">Un solo lugar</span><h2 id="about-title">Lo cotidiano, más claro.</h2></div><div className="public-about-copy"><p>El portal reúne comunicaciones, documentos, espacios comunes, cuentas y el estado general del edificio para que cada vecino encuentre lo importante sin perderse.</p><Link to="/demo/propietario" className="public-text-link">Explorar la demostración <ArrowUpRight size={17} /></Link></div></section>
  </PublicLayout>;
}

export function PublicNewsPage() {
  const { data } = usePortal();
  return <PublicLayout><section className="public-inner-page"><span className="public-kicker">Cartelera del edificio</span><h1>Novedades</h1><p className="public-lead">Las comunicaciones más recientes de Edificio 13 y 34.</p><div className="public-news-list public-news-page-list">{[...data.notices].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.date.localeCompare(a.date)).map(notice => <PublicNoticeCard notice={notice} key={notice.id} />)}</div></section></PublicLayout>;
}

export function PublicBuildingPage() {
  return <PublicLayout><section className="public-inner-page"><span className="public-kicker">Edificio 13 y 34</span><h1>Un lugar para vivir y compartir.</h1><p className="public-lead">Una mirada simple a los espacios comunes y a la información que hace al día a día del edificio.</p><div className="public-building-grid public-building-page-grid">{gallery.map(item => <figure key={item.src}><img src={item.src} alt={item.alt} /><figcaption>{item.label}</figcaption></figure>)}</div><div className="public-building-note"><Building2 size={23} /><p>La información de esta presentación es una muestra demo del portal del consorcio.</p></div></section></PublicLayout>;
}

export function PublicContactPage() {
  return <PublicLayout><section className="public-inner-page public-contact-page"><span className="public-kicker">Estamos cerca</span><h1>Contacto</h1><p className="public-lead">Para consultar información del edificio, la administración puede centralizar las respuestas dentro del portal.</p><div className="public-contact-lines"><div><Mail size={22} /><span><strong>Administración</strong><small>Canal demo de consultas del edificio</small></span></div><div><Home size={22} /><span><strong>Edificio 13 y 34</strong><small>Información institucional y novedades</small></span></div></div><Link className="public-primary-link" to="/demo/propietario/servicios/chat"><MessageCircle size={18} />Abrir canal demo <ArrowUpRight size={18} /></Link></section></PublicLayout>;
}

export function DemoEntryPage() {
  return <PublicLayout><section className="public-inner-page demo-entry"><span className="public-kicker">Recorrido interactivo</span><h1>Explorar la demo</h1><p className="public-lead">Elegí una vista para recorrer el portal con datos de ejemplo. No requiere usuario ni contraseña.</p><div className="demo-entry-links"><Link to="/demo/propietario"><Home size={21} /><span><strong>Vista propietario</strong><small>Novedades, edificio, servicios y comunidad</small></span><ArrowUpRight size={19} /></Link><Link to="/demo/administracion"><Wrench size={21} /><span><strong>Vista administración demo</strong><small>Recorrido abierto con datos de ejemplo</small></span><ArrowUpRight size={19} /></Link><Link to="/admin"><LockKeyhole size={21} /><span><strong>Acceso administración</strong><small>Panel protegido para la demostración</small></span><ArrowUpRight size={19} /></Link></div></section></PublicLayout>;
}

function PublicFooter() {
  return <footer className="public-footer"><span><strong>Edificio 13 y 34</strong> · Portal demo</span><span><Link to="/novedades">Novedades</Link><Link to="/contacto">Contacto</Link><Link to="/demo">Explorar demo</Link></span></footer>;
}
