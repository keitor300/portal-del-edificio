import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, Pin, Plus, Search, Pencil, Trash2, Megaphone } from 'lucide-react';
import { usePortal } from '../../hooks/usePortal';
import type { Entity, Attachment } from '../../lib/types';
import { formatDate, id, today } from '../../lib/utils';
import { validDate } from '../services/model';
import { Confirm, DocumentActions, Empty, Field, Modal, PageHeader, Status, UploadField } from '../../components/UI';

const categories = ['Urgente', 'Información', 'Mantenimiento', 'Reunión', 'Comunidad'];
type NoticeContext = 'public' | 'owner' | 'admin';

export function NoticeRow({ notice, detailBase }: { notice: Entity; detailBase?: string }) {
  const location = useLocation();
  const base = detailBase ?? (location.pathname.startsWith('/admin') ? '/admin/comunicaciones' : location.pathname.startsWith('/demo/administracion') ? '/demo/administracion/comunicaciones' : '/novedades');
  return <Link className="notice-row" to={`${base}/${notice.id}`}>
    <div className={`notice-icon ${notice.urgent ? 'urgent-icon' : ''}`}><Megaphone size={22} /></div>
    <div className="row-main"><div className="row-meta"><span>{notice.category}</span><span>{formatDate(notice.date)}</span>{notice.pinned && <Pin size={14} />}</div><h3>{notice.title}</h3><p>{notice.description}</p></div>
    <ArrowUpRight className="row-arrow" size={21} />
  </Link>;
}

export function NoticesPage({ admin = false }: { admin?: boolean }) {
  const { data, save, remove, update, notify } = usePortal();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [editing, setEditing] = useState<Entity | null | undefined>();
  const [deleting, setDeleting] = useState<Entity>();
  const [file, setFile] = useState<Attachment>();
  const [formError, setFormError] = useState('');
  const detailBase = admin ? (location.pathname.startsWith('/admin') ? '/admin/comunicaciones' : '/demo/administracion/comunicaciones') : (location.pathname.startsWith('/demo/') ? '/demo/propietario/novedades' : '/novedades');
  const show = editing !== undefined || params.get('new') === '1';
  const close = () => { setEditing(undefined); setFile(undefined); setFormError(''); setParams({}); };
  const filtered = data.notices.filter(item => (category === 'Todas' || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const date = String(form.get('date') ?? '');
    if (!title || !description) { setFormError('Completá el título y el mensaje.'); return; }
    if (!validDate(date) || date > today()) { setFormError('La fecha debe ser válida y no puede ser futura.'); return; }
    save('notices', { ...editing, id: editing?.id ?? id(), title, description, date, category: String(form.get('category')), urgent: form.get('urgent') === 'on', pinned: form.get('pinned') === 'on', views: editing?.views ?? 0, attachment: file });
    notify('Aviso guardado. Ya está disponible en Novedades.');
    close();
  }

  return <>
    <PageHeader title={admin ? 'Comunicaciones' : 'Novedades'} description={admin ? 'La información que compartimos con el edificio.' : 'Lo que está pasando en tu edificio.'} action={admin && <button className="button" onClick={() => { setFormError(''); setEditing(null); }}><Plus size={19} />Nuevo aviso</button>} />
    <div className="toolbar"><label className="search-field"><Search size={20} /><input aria-label="Buscar novedades" placeholder="Buscar una novedad" value={query} onChange={event => setQuery(event.target.value)} /></label><Field label="Categoría"><select value={category} onChange={event => setCategory(event.target.value)}>{['Todas', ...categories].map(item => <option key={item}>{item}</option>)}</select></Field></div>
    <div className="list">{filtered.map(notice => <div key={notice.id}><NoticeRow notice={notice} detailBase={detailBase} />{admin && <div className="admin-row-tools"><span className="muted">{notice.views ?? 0} de 52 unidades · lectura demo</span><button className="button secondary small" onClick={() => update('notices', notice.id, { pinned: !notice.pinned })}><Pin size={16} />{notice.pinned ? 'Desfijar' : 'Fijar'}</button><button className="icon-button" title={`Editar ${notice.title}`} aria-label={`Editar ${notice.title}`} onClick={() => { setEditing(notice); setFile(notice.attachment); setFormError(''); }}><Pencil size={18} /></button><button className="icon-button" title={`Eliminar ${notice.title}`} aria-label={`Eliminar ${notice.title}`} onClick={() => setDeleting(notice)}><Trash2 size={18} /></button></div>}</div>)}{!filtered.length && <Empty />}</div>
    {show && <Modal title={editing ? 'Editar aviso' : 'Nuevo aviso'} onClose={close}><form className="form-grid" onSubmit={submit}><Field label="Título"><input name="title" required maxLength={120} defaultValue={editing?.title} /></Field><Field label="Mensaje"><textarea name="description" required rows={5} maxLength={3000} defaultValue={editing?.description} /></Field><Field label="Categoría"><select name="category" defaultValue={editing?.category ?? 'Información'}>{categories.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Fecha de publicación"><input name="date" type="date" required max={today()} defaultValue={editing?.date ?? today()} /></Field><label className="check-field"><input name="pinned" type="checkbox" defaultChecked={editing?.pinned} />Fijar al principio</label><label className="check-field"><input name="urgent" type="checkbox" defaultChecked={editing?.urgent} />Destacar como urgente</label><UploadField value={file} onChange={setFile} />{formError && <p role="alert" className="error">{formError}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button">Publicar aviso</button></div></form></Modal>}
    {deleting && <Confirm description={`Se eliminará “${deleting.title}” de ambas vistas.`} onClose={() => setDeleting(undefined)} onConfirm={() => { remove('notices', deleting.id); notify('Aviso eliminado.'); }} />}
  </>;
}

export function NoticeDetail({ context = 'public' }: { context?: NoticeContext }) {
  const { id: noticeId } = useParams();
  const { data, update, notify } = usePortal();
  const detailBase = context === 'admin' ? '/demo/administracion/comunicaciones' : context === 'owner' ? '/demo/propietario/novedades' : '/novedades';
  const notice = data.notices.find(item => item.id === noticeId);
  if (!notice) return <><PageHeader title="Aviso no disponible" back={detailBase} /><Empty>El aviso se eliminó. Podés consultar el resto de las novedades.</Empty></>;
  const relatedPath = context === 'admin' ? '/demo/administracion/contenido' : context === 'owner' ? '/demo/propietario/edificio/obras' : '/edificio/obras';
  const meetingPath = context === 'admin' ? '/demo/administracion/comunidad' : context === 'owner' ? '/demo/propietario/edificio/reuniones' : '/edificio/reuniones';
  return <article className="reading-page"><PageHeader title={notice.title} back={detailBase} /><div className="row-meta"><Status tone={notice.urgent ? 'amber' : 'green'}>{notice.category}</Status><span>{formatDate(notice.date)}</span>{notice.pinned && <span>Fijado</span>}</div><p className="detail-copy">{notice.description}</p>{notice.attachment && <DocumentActions attachment={notice.attachment} label="Ver adjunto" />}{notice.category === 'Mantenimiento' && <Link className="text-link" to={relatedPath}>Ver obras y avances<ArrowUpRight size={18} /></Link>}{notice.category === 'Reunión' && <Link className="button secondary" to={meetingPath}>Ver reuniones</Link>}<div className="notice-read"><button className={`button ${notice.read ? 'secondary' : ''}`} disabled={notice.read} onClick={() => { update('notices', notice.id, { read: true, views: Math.min(52, (notice.views ?? 0) + 1) }); notify('Aviso marcado como leído.'); }}><Check size={18} />{notice.read ? 'Marcado como leído' : 'Marcar como leído'}</button><p className="muted">{notice.views ?? 0} de 52 unidades lo visualizaron · Demo</p></div></article>;
}
