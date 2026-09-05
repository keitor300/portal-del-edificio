import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, CheckCircle2, Plus, Save, X } from 'lucide-react';
import { Confirm, DocumentActions, Field, Modal, PageHeader } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Attachment } from '../../lib/types';
import { formatDate, id, readAttachment, today } from '../../lib/utils';
import { Conversation } from './Conversation';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, OWNER_UNIT, sameUnit } from './model';
import './services.css';

function IssueForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { save, notify } = usePortal();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<Attachment>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading) return;
    if (!ISSUE_CATEGORIES.includes(category) || !description.trim()) { setError('Elegí una categoría y contanos qué ocurrió.'); return; }
    saving.current = true;
    const issueId = id();
    save('issues', { id: issueId, title: description.trim().split('\n')[0].slice(0, 90), description: description.trim(), category, unit: OWNER_UNIT, date: today(), status: 'Recibido', attachment: photo, messages: [] });
    notify('Reclamo guardado en esta demo. No se envió fuera del navegador.');
    onCreated(issueId);
  }

  return <Modal title="Nuevo reclamo" onClose={onClose} wide><form onSubmit={submit} className="services-composer">
    <p className="muted">Unidad 7B · Registro local de demostración. Para una situación de riesgo, consultá <Link to="/servicios/urgencias" onClick={onClose}>Urgencias</Link>.</p>
    <Field label="Categoría"><select required value={category} onChange={event => setCategory(event.target.value)}><option value="">Elegir categoría</option>{ISSUE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></Field>
    <Field label="¿Qué ocurrió?" hint="Indicá el lugar y una descripción breve."><textarea required rows={4} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
    <Field label="Foto (opcional)" hint="JPG, PNG o WebP. Hasta 1 MB."><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      setUploading(true); setError('');
      try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elegí una imagen JPG, PNG o WebP.');
        setPhoto(await readAttachment(file));
      } catch (cause) { setError((cause as Error).message); }
      finally { setUploading(false); }
    }} /></Field>
    {uploading && <p role="status">Cargando foto…</p>}
    {photo && <div><img className="services-photo-preview" src={photo.url} alt="Foto que se adjuntará al reclamo" width={400} height={300} /><button className="button secondary" type="button" onClick={() => setPhoto(undefined)}><X size={18} aria-hidden="true" />Quitar foto</button></div>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Volver</button><button className="button" type="submit" disabled={uploading}><Save size={18} aria-hidden="true" />Guardar reclamo demo</button></div>
  </form></Modal>;
}

function IssueDetail({ issueId, admin, onClose }: { issueId: string; admin: boolean; onClose: () => void }) {
  const { data, update, notify } = usePortal();
  const issue = data.issues.find(item => item.id === issueId && (admin || sameUnit(item.unit)));
  const [resolve, setResolve] = useState(false);
  if (!issue) return <Modal title="Reclamo no disponible" onClose={onClose}><p>Este reclamo ya no está disponible.</p></Modal>;

  function changeStatus(status: string) {
    if (!issue || issue.status === status) return;
    update('issues', issue.id, { status, messages: [...(issue.messages ?? []), { id: id(), author: 'Administración', date: new Date().toISOString(), text: `Estado actualizado: ${status}. Registro demo.` }] });
    notify(`Reclamo actualizado: ${status}.`);
  }

  return <Modal title={`Reclamo #${issue.id.slice(-8).toUpperCase()}`} onClose={onClose} wide>
    <h3>{issue.title}</h3><div className="services-detail-meta"><span className="status">{issue.status || 'Recibido'}</span><span>{issue.category}</span><span>Unidad {issue.unit}</span><time dateTime={issue.date}>{formatDate(issue.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
    <p className="services-preserve">{issue.description}</p>
    {issue.attachment && <DocumentActions attachment={issue.attachment} label="Ver foto adjunta" />}
    {admin && <div className="services-filters"><Field label="Estado del reclamo"><select value={issue.status || 'Recibido'} onChange={event => { if (event.target.value === 'Resuelto') setResolve(true); else changeStatus(event.target.value); }}>{ISSUE_STATUSES.map(status => <option key={status}>{status}</option>)}</select></Field>{issue.status !== 'Resuelto' && <button className="button secondary" onClick={() => setResolve(true)}><CheckCircle2 size={18} aria-hidden="true" />Resolver reclamo</button>}</div>}
    <h3>Seguimiento del reclamo</h3>
    <Conversation messages={issue.messages ?? []} author={admin ? 'Administración' : `Unidad ${OWNER_UNIT}`} closed={issue.status === 'Resuelto'} onSend={message => {
      const current = data.issues.find(item => item.id === issueId);
      if (current && current.status !== 'Resuelto') update('issues', issueId, { messages: [...(current.messages ?? []), message] });
    }} />
    {resolve && <Confirm title="Resolver reclamo" description="Se marcará como resuelto y se conservará toda la conversación. Administración podrá reabrirlo cambiando su estado." onClose={() => setResolve(false)} onConfirm={() => changeStatus('Resuelto')} />}
  </Modal>;
}

export function IssuesPanel({ admin = false }: { admin?: boolean }) {
  const { data } = usePortal();
  const [newIssue, setNewIssue] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const issues = data.issues.filter(item => admin || sameUnit(item.unit)).filter(item => (!status || (item.status || 'Recibido') === status) && (!category || item.category === category) &&
    `${item.title} ${item.description} ${item.unit} ${item.id}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))).sort((a, b) => b.date.localeCompare(a.date));

  return <>
    <div className="section-heading"><h2>{admin ? 'Reclamos del edificio' : 'Mis reclamos'}</h2>{!admin && <button className="button" onClick={() => setNewIssue(true)}><Plus size={20} aria-hidden="true" />Nuevo reclamo</button>}</div>
    <div className="services-filters">
      <Field label="Estado"><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos los estados</option>{ISSUE_STATUSES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Categoría"><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{ISSUE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label={admin ? 'Buscar reclamo o unidad' : 'Buscar reclamo'}><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
    </div>
    <p className="muted" role="status">{issues.length} {issues.length === 1 ? 'reclamo' : 'reclamos'}</p>
    <div className="list">{issues.map(issue => <article className="list-row" key={issue.id}><div className="row-main"><strong>{issue.title}</strong><p>{issue.category} · {formatDate(issue.date)}{admin ? ` · Unidad ${issue.unit}` : ''}</p><span className={`status ${issue.status === 'Resuelto' ? 'status-green' : ''}`}>{issue.status || 'Recibido'}</span>{issue.attachment && <span className="services-attachment-note"> <Camera size={16} aria-hidden="true" /> Con foto</span>}</div><div className="row-actions"><button className="button secondary" onClick={() => setSelected(issue.id)} aria-label={`Ver reclamo: ${issue.title}`}>Ver seguimiento<ArrowRight size={18} aria-hidden="true" /></button></div></article>)}</div>
    {!issues.length && <p className="empty">No hay reclamos para estos filtros.</p>}
    {newIssue && <IssueForm onClose={() => setNewIssue(false)} onCreated={issueId => { setNewIssue(false); setSelected(issueId); }} />}
    {selected && <IssueDetail issueId={selected} admin={admin} onClose={() => setSelected(undefined)} />}
  </>;
}

export function IssuesPage() {
  return <div className="services-page"><PageHeader title="Reclamos" description="Consultá el estado y la conversación de cada reclamo de tu unidad." back="/servicios" /><IssuesPanel /></div>;
}
