import { ArrowUpRight, Building2, CalendarDays, ChevronRight, ClipboardList, FileText, Home, Mail, MessageCircle, ShieldCheck, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../hooks/usePortal';
import { formatDate } from '../../lib/utils';

const gallery = [
  { src: '/images/fachada.jpg', alt: 'Fachada del Edificio 13 y 34', label: 'La fachada' },
  { src: '/images/hall.jpg', alt: 'Hall de entrada del edificio', label: 'El hall de entrada' },
  { src: '/images/sum.jpg', alt: 'Salón de usos múltiples con vista a la ciudad', label: 'El salón de usos múltiples' },
  { src: '/images/vista.jpg', alt: 'Vista panorámica de la ciudad desde el edificio', label: 'La vista desde arriba' },
];

export function PublicHeader() {
  return <header className="public-header">
    <div className="public-header-inner">
      <Link to="/" className="public-brand" aria-label="Edificio 13 y 34, inicio">
        <span className="public-brand-mark"><Building2 size={21} /></span>
        <span><strong>Edificio 13 y 34</strong><small>Información y comunidad</small></span>
      </Link>
      <nav className="public-nav" aria-label="Navegación del edificio">
        <Link to="/novedades">Novedades</Link>
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
  const currentWork = data.works[0];

  return <PublicLayout>
    <section className="public-hero">
      <div className="public-hero-image"><img src="/images/fachada.jpg" alt="Fachada del Edificio 13 y 34" /></div>
      <div className="public-hero-content">
        <span className="public-kicker">Un edificio, una comunidad</span>
        <h1>Edificio 13 y 34</h1>
        <p>Información, espacios y vida en comunidad, reunidos en un mismo lugar.</p>
        <div className="public-hero-actions"><Link className="public-primary-link" to="/demo/propietario/servicios/sum"><CalendarDays size={18} />Reservar el SUM</Link><Link className="public-secondary-link" to="/novedades">Ver novedades <ArrowUpRight size={17} /></Link></div>
      </div>
    </section>

    <section className="public-actions" aria-labelledby="actions-title">
      <div className="public-section-heading"><div><span className="public-kicker">Accesos rápidos</span><h2 id="actions-title">¿Qué necesitás consultar?</h2></div><span className="public-demo-badge">Recorrido demo</span></div>
      <div className="public-action-grid">
        <Link className="public-action public-action-sum" to="/demo/propietario/servicios/sum"><CalendarDays size={23} /><span><strong>Reservar el SUM</strong><small>Disponibilidad y reglamento</small></span><ChevronRight size={18} /></Link>
        <Link className="public-action" to="/demo/propietario/edificio/cuentas"><FileText size={23} /><span><strong>Cuentas del edificio</strong><small>Movimientos y liquidaciones</small></span><ChevronRight size={18} /></Link>
        <Link className="public-action" to="/demo/propietario/mas/estado"><ShieldCheck size={23} /><span><strong>Estado del edificio</strong><small>Servicios y mantenimiento</small></span><ChevronRight size={18} /></Link>
        <Link className="public-action" to="/demo/propietario/edificio/documentos"><FileText size={23} /><span><strong>Documentos</strong><small>Actas, reglamento y archivos</small></span><ChevronRight size={18} /></Link>
        <Link className="public-action" to="/demo/propietario/servicios/reclamos"><ClipboardList size={23} /><span><strong>Hacer un reclamo</strong><small>Seguimiento de solicitudes</small></span><ChevronRight size={18} /></Link>
        <Link className="public-action" to="/contacto"><MessageCircle size={23} /><span><strong>Contactar</strong><small>Canal de administración</small></span><ChevronRight size={18} /></Link>
      </div>
    </section>

    <section className="public-news" aria-labelledby="news-title">
      <div className="public-section-heading"><div><span className="public-kicker">Cartelera</span><h2 id="news-title">Lo que está pasando</h2></div><Link to="/novedades" className="public-text-link">Ver todas <ArrowUpRight size={17} /></Link></div>
      <div className="public-news-list">{notices.map((notice, index) => <Link className={`public-news-row ${index === 0 && notice.urgent ? 'public-news-primary' : ''}`} to={`/novedades/${notice.id}`} key={notice.id}><span className="public-news-date">{formatDate(notice.date)}</span><span className="public-news-copy"><strong>{notice.title}</strong><span>{notice.description}</span></span><span className="public-demo-badge">{notice.urgent ? 'Importante' : 'Demo'}</span><ArrowUpRight size={18} /></Link>)}</div>
    </section>

    <section className="public-sum" aria-labelledby="sum-title">
      <div className="public-sum-image"><img src="/images/sum.jpg" alt="Salón de usos múltiples del edificio" /></div>
      <div className="public-sum-copy"><span className="public-kicker">Espacio común</span><h2 id="sum-title">El SUM, listo para tu próximo encuentro.</h2><p>Consultá los turnos disponibles, revisá el reglamento y reservá el salón para una reunión, un festejo o una actividad de la comunidad.</p><Link className="public-primary-link" to="/demo/propietario/servicios/sum"><CalendarDays size={18} />Consultar disponibilidad</Link></div>
    </section>

    <section className="public-state" aria-labelledby="state-title">
      <div className="public-section-heading"><div><span className="public-kicker">Seguimiento</span><h2 id="state-title">El edificio en marcha</h2></div><Link to="/demo/propietario/mas/estado" className="public-text-link">Ver estado completo <ArrowUpRight size={17} /></Link></div>
      <div className="public-state-grid"><div className="public-status-list">{statuses.map(status => <div className="public-status-row" key={status.id}><span className="public-status-icon"><ShieldCheck size={18} /></span><span><strong>{status.title}</strong><small>{status.description}</small></span><em>{status.status}</em></div>)}</div>{currentWork && <Link className="public-work-feature" to="/demo/propietario/edificio/obras"><span className="public-kicker">Obra en curso</span><Wrench size={24} /><strong>{currentWork.title}</strong><p>{currentWork.status} · {currentWork.progress ?? 0}% de avance</p><span className="public-text-link">Ver avances <ArrowUpRight size={16} /></span></Link>}</div>
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
  return <PublicLayout><section className="public-inner-page"><span className="public-kicker">Cartelera del edificio</span><h1>Novedades</h1><p className="public-lead">Las comunicaciones más recientes de Edificio 13 y 34.</p><div className="public-news-list public-news-page-list">{[...data.notices].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.date.localeCompare(a.date)).map(notice => <Link className={`public-news-row ${notice.urgent ? 'public-news-primary' : ''}`} to={`/novedades/${notice.id}`} key={notice.id}><span className="public-news-date">{formatDate(notice.date)}</span><span className="public-news-copy"><strong>{notice.title}</strong><span>{notice.description}</span></span><span className="public-demo-badge">{notice.urgent ? 'Importante' : 'Demo'}</span><ArrowUpRight size={18} /></Link>)}</div></section></PublicLayout>;
}

export function PublicBuildingPage() {
  return <PublicLayout><section className="public-inner-page"><span className="public-kicker">Edificio 13 y 34</span><h1>Un lugar para vivir y compartir.</h1><p className="public-lead">Una mirada simple a los espacios comunes y a la información que hace al día a día del edificio.</p><div className="public-building-grid public-building-page-grid">{gallery.map(item => <figure key={item.src}><img src={item.src} alt={item.alt} /><figcaption>{item.label}</figcaption></figure>)}</div><div className="public-building-note"><Building2 size={23} /><p>La información de esta presentación es una muestra demo del portal del consorcio.</p></div></section></PublicLayout>;
}

export function PublicContactPage() {
  return <PublicLayout><section className="public-inner-page public-contact-page"><span className="public-kicker">Estamos cerca</span><h1>Contacto</h1><p className="public-lead">Para consultar información del edificio, la administración puede centralizar las respuestas dentro del portal.</p><div className="public-contact-lines"><div><Mail size={22} /><span><strong>Administración</strong><small>Canal demo de consultas del edificio</small></span></div><div><Home size={22} /><span><strong>Edificio 13 y 34</strong><small>Información institucional y novedades</small></span></div></div><Link className="public-primary-link" to="/demo/propietario/servicios/chat"><MessageCircle size={18} />Abrir canal demo <ArrowUpRight size={18} /></Link></section></PublicLayout>;
}

export function DemoEntryPage() {
  return <PublicLayout><section className="public-inner-page demo-entry"><span className="public-kicker">Recorrido interactivo</span><h1>Explorar la demo</h1><p className="public-lead">Elegí una vista para recorrer el portal con datos de ejemplo. No requiere usuario ni contraseña.</p><div className="demo-entry-links"><Link to="/demo/propietario"><Home size={21} /><span><strong>Vista propietario</strong><small>Novedades, edificio, servicios y comunidad</small></span><ArrowUpRight size={19} /></Link><Link to="/demo/administracion"><Wrench size={21} /><span><strong>Vista administración</strong><small>Comunicaciones, finanzas, servicios y contenido</small></span><ArrowUpRight size={19} /></Link></div></section></PublicLayout>;
}

function PublicFooter() {
  return <footer className="public-footer"><span><strong>Edificio 13 y 34</strong> · Portal demo</span><span><Link to="/novedades">Novedades</Link><Link to="/contacto">Contacto</Link><Link to="/demo">Explorar demo</Link></span></footer>;
}
