import { currentOwnerUnit } from '../auth/ownerAccounts';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Camera, CheckCircle2, ChevronRight, Plus, Save, X } from 'lucide-react';
import { Confirm, DocumentActions, Field, Modal, PageHeader } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import type { Attachment } from '../../lib/types';
import { formatDate, id, readAttachment, today } from '../../lib/utils';
import { Conversation } from './Conversation';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, sameUnit } from './model';
import './services.css';
import { productionPortal } from '../../lib/api';

function IssueForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { save, notify } = usePortal();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<Attachment>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [issueId] = useState(id);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading) return;
    if (!ISSUE_CATEGORIES.includes(category) || !description.trim()) { setError('Elegí una categoría y contanos qué ocurrió.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
    await save('issues', { id: issueId, title: description.trim().split('\n')[0].slice(0, 90), description: description.trim(), category, unit: currentOwnerUnit(), date: today(), status: 'Recibido', attachment: photo, messages: [] });
    notify(productionPortal ? 'Reclamo enviado a Administración.' : 'Reclamo guardado en esta demo. No se envió fuera del navegador.');
    onCreated(issueId);
    } catch(cause){setError((cause as Error).message);}
    finally {saving.current=false; setBusy(false);}
  }

  return <Modal title="Nuevo reclamo" onClose={() => { if(!saving.current)onClose(); }} wide><form onSubmit={submit} className="services-composer" aria-busy={busy}>
    <p className="muted">Unidad {currentOwnerUnit()}{!productionPortal && ' · Registro local de demostración.'} Para una situación de riesgo, consultá <Link to="/servicios/urgencias" onClick={onClose}>Urgencias</Link>.</p>
    <Field label="Categoría"><select aria-label="Categoría" required value={category} onChange={event => setCategory(event.target.value)}><option value="">Elegir categoría</option>{ISSUE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></Field>
    <Field label="¿Qué ocurrió?" hint="Indicá el lugar y una descripción breve."><textarea aria-label="¿Qué ocurrió?" required rows={4} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
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
    <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Volver</button><button className="button" type="submit" disabled={uploading || busy}><Save size={18} aria-hidden="true" />{busy ? 'Enviando…' : productionPortal ? 'Enviar reclamo' : 'Guardar reclamo demo'}</button></div>
  </form></Modal>;
}

function IssueDetail({ issueId, admin, onClose }: { issueId: string; admin: boolean; onClose: () => void }) {
  const action = useAsyncAction();
  const { data, update, notify } = usePortal();
  const issue = data.issues.find(item => item.id === issueId && (admin || sameUnit(item.unit)));
  const [resolve, setResolve] = useState(false);
  if (!issue) return <Modal title="Reclamo no disponible" onClose={onClose}><p>Este reclamo ya no está disponible.</p></Modal>;

  async function changeStatus(status: string) {
    if (!issue || issue.status === status) return;
    await update('issues', issue.id, productionPortal ? {status,version:issue.version} : { status, messages: [...(issue.messages ?? []), { id: id(), author: 'Administración', date: new Date().toISOString(), text: `Estado actualizado: ${status}. Registro demo.` }] });
    notify(`Reclamo actualizado: ${status}.`);
  }

  return <Modal title={`Reclamo #${issue.id.slice(-8).toUpperCase()}`} onClose={onClose} wide>
    <h3>{issue.title}</h3><div className="services-detail-meta"><span className="status">{issue.status || 'Recibido'}</span><span>{issue.category}</span><span>Unidad {issue.unit}</span><time dateTime={issue.date}>{formatDate(issue.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
    <p className="services-preserve">{issue.description}</p>
    {issue.attachment && <DocumentActions attachment={issue.attachment} label="Ver foto adjunta" />}
    {action.error && <p className="error" role="alert">{action.error}</p>}
    {admin && <div className="services-filters"><Field label="Estado del reclamo"><select aria-label="Estado del reclamo" disabled={action.busy} value={issue.status || 'Recibido'} onChange={event => { const status=event.target.value; if (status === 'Resuelto') setResolve(true); else void action.run(()=>changeStatus(status)); }}>{ISSUE_STATUSES.map(status => <option key={status}>{status}</option>)}</select></Field>{issue.status !== 'Resuelto' && <button className="button secondary" onClick={() => setResolve(true)}><CheckCircle2 size={18} aria-hidden="true" />Resolver reclamo</button>}</div>}
    <h3>Seguimiento del reclamo</h3>
    <Conversation messages={issue.messages ?? []} author={admin ? 'Administración' : `Unidad ${currentOwnerUnit()}`} closed={issue.status === 'Resuelto'} onSend={message => {
      const current = data.issues.find(item => item.id === issueId);
      if (current && current.status !== 'Resuelto') return update('issues', issueId, { messages: [...(current.messages ?? []), message] });
      throw new Error('El reclamo está cerrado.');
    }} />
    {resolve && <Confirm title="Resolver reclamo" description="Se marcará como resuelto y se conservará toda la conversación. Administración podrá reabrirlo cambiando su estado." onClose={() => setResolve(false)} onConfirm={() => changeStatus('Resuelto')} />}
  </Modal>;
}

export function IssuesPanel({ admin = false }: { admin?: boolean }) {
  const { data } = usePortal();
  const [params, setParams] = useSearchParams();
  const [newIssue, setNewIssue] = useState(() => !admin && params.get('new') === '1');
  const selected = params.get('issue') || undefined;
  function setSelected(issueId?: string) {
    const next = new URLSearchParams(params);
    if (issueId) next.set('issue', issueId); else next.delete('issue');
    next.delete('new');
    setParams(next);
  }
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const issues = data.issues.filter(item => admin || sameUnit(item.unit)).filter(item => (!status || (item.status || 'Recibido') === status) && (!category || item.category === category) &&
    `${item.title} ${item.description} ${item.unit} ${item.id}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))).sort((a, b) => b.date.localeCompare(a.date));

  function closeIssueForm() { setNewIssue(false); if (params.has('new')) { const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true }); } }

  return <>
    <div className={`issues-overview${admin ? ' issues-overview-admin' : ''}`}><div><span className="eyebrow">{admin ? 'Seguimiento del edificio' : 'Tus reclamos'}</span><h2>{admin ? 'Reclamos de propietarios' : '¿Necesitás informar un problema?'}</h2><p>{admin ? 'Abrí cada reclamo para responder, actualizar el estado o resolverlo.' : 'Contanos qué pasó y seguí la respuesta de administración.'}</p></div>{!admin && <button className="button" onClick={() => setNewIssue(true)}><Plus size={20} aria-hidden="true" />Informar un problema</button>}</div>
    <p className="muted" role="status">{issues.length} {issues.length === 1 ? 'reclamo' : 'reclamos'}</p>
    <details className="service-filters-disclosure"><summary><span><strong>Filtrar reclamos</strong><small>Estado, categoría o búsqueda</small></span><ChevronRight size={20} aria-hidden="true" /></summary><div className="services-filters">
      <Field label="Estado"><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos los estados</option>{ISSUE_STATUSES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Categoría"><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{ISSUE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label={admin ? 'Buscar reclamo o unidad' : 'Buscar reclamo'}><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
    </div></details>
    <div className="list issues-list">{issues.map(issue => <article className="list-row" key={issue.id}><div className="row-main"><strong>{issue.title}</strong><p>{issue.category} · {formatDate(issue.date)}{admin ? ` · Unidad ${issue.unit}` : ''}</p><span className={`status ${issue.status === 'Resuelto' ? 'status-green' : ''}`}>{issue.status || 'Recibido'}</span>{issue.attachment && <span className="services-attachment-note"> <Camera size={16} aria-hidden="true" /> Con foto</span>}</div><div className="row-actions"><button className="button secondary" onClick={() => setSelected(issue.id)} aria-label={`Abrir reclamo: ${issue.title}`}>Abrir reclamo<ArrowRight size={18} aria-hidden="true" /></button></div></article>)}</div>
    {!issues.length && <p className="empty">No hay reclamos para estos filtros.</p>}
    {newIssue && <IssueForm onClose={closeIssueForm} onCreated={issueId => { closeIssueForm(); setSelected(issueId); }} />}
    {selected && <IssueDetail key={selected} issueId={selected} admin={admin} onClose={() => setSelected(undefined)} />}
  </>;
}

export function IssuesPage() {
  return <div className="services-page"><PageHeader title="Reclamos" description="Consultá el estado y la conversación de cada reclamo de tu unidad." back="/servicios" /><IssuesPanel /></div>;
}
