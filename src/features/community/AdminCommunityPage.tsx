import { useState, type FormEvent } from 'react';
import { BarChart3, Check, ClipboardList, Edit, LockKeyhole, MessageCircle, Plus, UnlockKeyhole } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Empty, Field, Modal, PageHeader, Status, Tabs, UploadField } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Attachment, Entity } from '../../lib/types';
import { id, relativeDate, today } from '../../lib/utils';
import { FORMAL_NOTICE, fullDate, lines, pollHasEnded, pollResults } from './model';
import { PollResults } from './PollsPage';
import { TopicDiscussion, TopicForm } from './Topics';
import './community.css';

const adminTabs = [{ id: 'reuniones', label: 'Reuniones' }, { id: 'temas', label: 'Temas' }, { id: 'encuestas', label: 'Encuestas' }, { id: 'votaciones', label: 'Votaciones demo' }];

function MeetingForm({ initial, onClose }: { initial?: Entity; onClose: () => void }) {
  const { save, notify } = usePortal();
  const [draft, setDraft] = useState<Entity>(() => initial ?? { id: id(), title: '', description: '', date: relativeDate(7), time: '19:00', endTime: '20:00', place: '', status: 'Programada', agenda: '', summary: '', milestones: [] });
  const [decisions, setDecisions] = useState((initial?.milestones ?? []).join('\n'));
  const [error, setError] = useState('');
  const patch = (value: Partial<Entity>) => setDraft(previous => ({ ...previous, ...value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date || !draft.time || !draft.place?.trim() || !lines(draft.agenda).length) { setError('Completá título, fecha, horario, lugar y orden del día.'); return; }
    if (draft.endTime && draft.endTime <= draft.time) { setError('El horario de finalización debe ser posterior al de inicio.'); return; }
    save('meetings', { ...draft, title: draft.title.trim(), description: draft.description.trim(), place: draft.place.trim(), agenda: lines(draft.agenda).join('\n'), summary: draft.summary?.trim(), milestones: lines(decisions) });
    notify(initial ? 'Reunión actualizada.' : 'Reunión publicada.'); onClose();
  }
  return <Modal title={initial ? 'Editar reunión' : 'Crear reunión'} onClose={onClose} wide><form className="community-form" onSubmit={submit}><Field label="Título"><input required maxLength={120} value={draft.title} onChange={event => patch({ title: event.target.value })} autoFocus /></Field><Field label="Descripción"><textarea rows={3} maxLength={3000} value={draft.description} onChange={event => patch({ description: event.target.value })} /></Field><div className="form-grid"><Field label="Fecha"><input required type="date" value={draft.date.slice(0, 10)} onChange={event => patch({ date: event.target.value })} /></Field><Field label="Estado"><select value={draft.status} onChange={event => patch({ status: event.target.value })}><option>Programada</option><option>Realizada</option><option>Cancelada</option></select></Field><Field label="Hora de inicio"><input required type="time" value={draft.time ?? ''} onChange={event => patch({ time: event.target.value })} /></Field><Field label="Hora de finalización (opcional)"><input type="time" value={draft.endTime ?? ''} onChange={event => patch({ endTime: event.target.value })} /></Field></div><Field label="Lugar"><input required maxLength={160} value={draft.place ?? ''} onChange={event => patch({ place: event.target.value })} /></Field><Field label="Orden del día" hint="Un punto por línea."><textarea required rows={5} maxLength={6000} value={draft.agenda ?? ''} onChange={event => patch({ agenda: event.target.value })} /></Field><UploadField value={draft.attachment} onChange={attachment => patch({ attachment })} label="Documentación o acta" /><Field label="Resumen del acta (opcional)"><textarea rows={4} maxLength={6000} value={draft.summary ?? ''} onChange={event => patch({ summary: event.target.value })} /></Field><Field label="Decisiones acordadas (opcional)" hint="Una decisión por línea."><textarea rows={4} maxLength={6000} value={decisions} onChange={event => setDecisions(event.target.value)} /></Field>{error && <p role="alert" className="error">{error}</p>}<div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button" type="submit"><Check size={20} />Guardar reunión</button></div></form></Modal>;
}

function PollForm({ initial, formal, onClose }: { initial?: Entity; formal: boolean; onClose: () => void }) {
  const { data, save, notify } = usePortal();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [options, setOptions] = useState((initial?.options ?? (formal ? ['A favor', 'En contra', 'Abstención'] : ['', ''])).join('\n'));
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? relativeDate(7));
  const [closed, setClosed] = useState(initial?.closed ?? false);
  const [attachment, setAttachment] = useState<Attachment | undefined>(initial?.attachment);
  const [error, setError] = useState('');
  const current = initial ? data.polls.find(poll => poll.id === initial.id) : undefined;
  const locked = Boolean(current && (pollResults(current).total > 0 || current.voted !== undefined));
  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanOptions = locked ? current!.options ?? [] : lines(options);
    if (initial && !current) { setError('Esta consulta ya no está disponible.'); return; }
    if (!title.trim() || cleanOptions.length < 2 || cleanOptions.length > 10) { setError('Ingresá un título y entre 2 y 10 opciones.'); return; }
    if (new Set(cleanOptions.map(option => option.toLocaleLowerCase('es'))).size !== cleanOptions.length) { setError('Las opciones deben ser diferentes entre sí.'); return; }
    if (cleanOptions.some(option => option.length > 180)) { setError('Cada opción puede tener hasta 180 caracteres.'); return; }
    if (!closed && dueDate && dueDate < today()) { setError('Para abrir la consulta, elegí una fecha de cierre desde hoy o dejala sin fecha.'); return; }
    save('polls', { ...(current ?? {}), id: current?.id ?? id(), title: title.trim(), description: description.trim(), date: current?.date ?? today(), dueDate: dueDate || undefined, options: cleanOptions, votes: locked ? current!.votes : cleanOptions.map(() => 0), formal: initial?.formal ?? formal, closed, attachment });
    notify(initial ? 'Consulta actualizada.' : formal ? 'Votación demo publicada.' : 'Encuesta publicada.'); onClose();
  }
  return <Modal title={initial ? formal ? 'Editar votación demo' : 'Editar encuesta' : formal ? 'Crear votación demo' : 'Crear encuesta'} onClose={onClose} wide><form className="community-form" onSubmit={submit}>{formal && <p className="community-notice">{FORMAL_NOTICE}</p>}<Field label="Título"><input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} autoFocus /></Field><Field label="Descripción"><textarea maxLength={3000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></Field><Field label="Opciones" hint={locked ? 'Las opciones se conservan porque ya hay votos registrados.' : 'Entre 2 y 10 opciones diferentes, una por línea.'}><textarea required rows={5} maxLength={2000} value={locked ? current?.options?.join('\n') ?? '' : options} onChange={event => setOptions(event.target.value)} readOnly={locked} /></Field><div className="form-grid"><Field label="Fecha de cierre (opcional)"><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></Field><Field label="Estado"><select value={closed ? 'cerrada' : 'abierta'} onChange={event => setClosed(event.target.value === 'cerrada')}><option value="abierta">Abierta</option><option value="cerrada">Cerrada</option></select></Field></div><UploadField value={attachment} onChange={setAttachment} />{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button" type="submit"><Check size={20} />Guardar {formal ? 'votación demo' : 'encuesta'}</button></div></form></Modal>;
}

function TopicReview({ topicId, onClose }: { topicId: string; onClose: () => void }) {
  const { data, update, notify } = usePortal();
  const topic = data.topics.find(item => item.id === topicId);
  const [status, setStatus] = useState(topic?.status ?? 'Pendiente');
  const [summary, setSummary] = useState(topic?.summary ?? '');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!topic) return;
    update('topics', topic.id, { status, summary: summary.trim() });
    notify('Revisión publicada para los propietarios.'); onClose();
  }
  return <Modal title="Revisar tema" onClose={onClose}>{topic ? <form className="community-form" onSubmit={submit}><h3>{topic.title}</h3><p>{topic.description}</p><Field label="Estado de revisión"><select value={status} onChange={event => setStatus(event.target.value)}><option>Pendiente</option><option>En agenda</option><option>Resuelto</option><option>No incluido</option></select></Field><Field label="Respuesta de administración"><textarea rows={4} maxLength={3000} value={summary} onChange={event => setSummary(event.target.value)} /></Field><div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button" type="submit"><Check size={20} />Guardar revisión</button></div></form> : <Empty>Este tema ya no está disponible.</Empty>}</Modal>;
}

export function AdminCommunityPage() {
  const { data, update, notify } = usePortal();
  const [search, setSearch] = useSearchParams();
  const requested = search.get('tab') ?? 'reuniones';
  const tab = adminTabs.some(item => item.id === requested) ? requested : 'reuniones';
  const isNew = search.get('new') === '1';
  const [editing, setEditing] = useState<Entity>();
  const [reviewId, setReviewId] = useState<string>();
  const [discussionId, setDiscussionId] = useState<string>();
  const [resultId, setResultId] = useState<string>();
  const [topicFilter, setTopicFilter] = useState('Todos');
  const result = data.polls.find(item => item.id === resultId);
  const polls = data.polls.filter(item => Boolean(item.formal) === (tab === 'votaciones')).sort((a, b) => b.date.localeCompare(a.date));
  const topics = data.topics.filter(item => topicFilter === 'Todos' || (item.status ?? 'Pendiente') === topicFilter);
  function closeEditor() { setEditing(undefined); setSearch({ tab }, { replace: true }); }
  function switchTab(value: string) { setEditing(undefined); setReviewId(undefined); setDiscussionId(undefined); setResultId(undefined); setSearch({ tab: value }); }
  function togglePoll(poll: Entity) {
    if (pollHasEnded(poll) && poll.dueDate && poll.dueDate < today()) {
      setEditing({ ...poll, closed: false });
      notify('Actualizá la fecha de cierre para reabrir la consulta.');
      return;
    }
    const closed = !pollHasEnded(poll);
    update('polls', poll.id, { closed });
    notify(closed ? 'Consulta cerrada. Los resultados siguen disponibles.' : 'Consulta reabierta. Se conservan los votos.');
  }
  const actionLabel = tab === 'reuniones' ? 'Crear reunión' : tab === 'temas' ? 'Proponer tema' : tab === 'votaciones' ? 'Crear votación demo' : 'Crear encuesta';
  return <div className="community-page"><PageHeader title="Comunidad" description="Reuniones, propuestas y consultas del edificio." action={<button className="button" onClick={() => { setEditing(undefined); setSearch({ tab, new: '1' }); }}><Plus size={20} />{actionLabel}</button>} /><Tabs items={adminTabs} value={tab} onChange={switchTab} />
    {tab === 'reuniones' && <section className="section"><h2>Reuniones y actas</h2>{data.meetings.length ? <ul className="list">{[...data.meetings].sort((a, b) => b.date.localeCompare(a.date)).map(meeting => <li key={meeting.id} className="list-row"><div className="row-main"><h3>{meeting.title}</h3><p className="muted">{fullDate(meeting.date)} · {meeting.time || 'Sin horario'} · {meeting.place || 'Sin lugar'}</p><Status>{meeting.status ?? 'Programada'}</Status>{meeting.summary && <p>{meeting.summary}</p>}</div><div className="row-actions"><button className="button secondary" onClick={() => setEditing(meeting)} aria-label={`Editar ${meeting.title}`}><Edit size={20} />Editar reunión y acta</button></div></li>)}</ul> : <Empty>No hay reuniones. Creá la primera convocatoria.</Empty>}</section>}
    {tab === 'temas' && <section className="section"><div className="section-heading"><h2>Revisión de temas</h2><Field label="Filtrar por estado"><select value={topicFilter} onChange={event => setTopicFilter(event.target.value)}>{['Todos', 'Pendiente', 'En agenda', 'Resuelto', 'No incluido'].map(value => <option key={value}>{value}</option>)}</select></Field></div>{topics.length ? <ul className="list">{topics.map(topic => <li key={topic.id} className="list-row"><div className="row-main"><h3>{topic.title}</h3><p>{topic.description}</p><p className="muted">{topic.unit ?? 'Propietario'} · {topic.interests ?? 0} interesados</p><Status>{topic.status ?? 'Pendiente'}</Status>{topic.summary && <p>{topic.summary}</p>}</div><div className="row-actions"><button className="button secondary" onClick={() => setReviewId(topic.id)} aria-label={`Revisar ${topic.title}`}><ClipboardList size={20} />Revisar tema</button><button className="button secondary" onClick={() => setDiscussionId(topic.id)} aria-label={`Comentarios de ${topic.title}`}><MessageCircle size={20} />Comentarios ({topic.messages?.length ?? 0})</button></div></li>)}</ul> : <Empty>No hay temas con este estado.</Empty>}</section>}
    {(tab === 'encuestas' || tab === 'votaciones') && <section className="section"><h2>{tab === 'votaciones' ? 'Votaciones formales demo' : 'Encuestas del edificio'}</h2>{tab === 'votaciones' && <p className="community-notice">{FORMAL_NOTICE}</p>}{polls.length ? <ul className="list">{polls.map(poll => <li key={poll.id} className="list-row"><div className="row-main"><h3>{poll.title}</h3><p>{poll.description}</p><Status tone={pollHasEnded(poll) ? 'neutral' : 'green'}>{pollHasEnded(poll) ? 'Cerrada' : 'Abierta'}</Status><p className="muted">{pollResults(poll).total} votos{poll.dueDate ? ` · Cierre: ${fullDate(poll.dueDate)}` : ' · Sin fecha de cierre'}</p></div><div className="row-actions"><button className="button secondary" onClick={() => setEditing(poll)} aria-label={`Editar ${poll.title}`}><Edit size={20} />Editar</button><button className="button secondary" onClick={() => togglePoll(poll)} aria-label={`${pollHasEnded(poll) ? 'Reabrir' : 'Cerrar'} ${poll.title}`}>{pollHasEnded(poll) ? <UnlockKeyhole size={20} /> : <LockKeyhole size={20} />}{pollHasEnded(poll) ? 'Reabrir' : 'Cerrar'}</button><button className="button secondary" onClick={() => setResultId(poll.id)} aria-label={`Resultados de ${poll.title}`}><BarChart3 size={20} />Resultados</button></div></li>)}</ul> : <Empty>No hay {tab === 'votaciones' ? 'votaciones demo' : 'encuestas'} publicadas.</Empty>}</section>}
    {tab === 'reuniones' && (isNew || editing) && <MeetingForm key={editing?.id ?? 'new-meeting'} initial={editing} onClose={closeEditor} />}
    {(tab === 'encuestas' || tab === 'votaciones') && (isNew || editing) && <PollForm key={editing?.id ?? `new-${tab}`} initial={editing} formal={tab === 'votaciones'} onClose={closeEditor} />}
    {tab === 'temas' && isNew && <TopicForm admin onClose={closeEditor} />}
    {reviewId && <TopicReview topicId={reviewId} onClose={() => setReviewId(undefined)} />}
    {discussionId && <TopicDiscussion topicId={discussionId} admin onClose={() => setDiscussionId(undefined)} />}
    {result && <Modal title={`Resultados: ${result.title}`} onClose={() => setResultId(undefined)} wide><div className="community-page">{result.formal && <p className="community-notice">{FORMAL_NOTICE}</p>}<PollResults poll={result} /></div></Modal>}
  </div>;
}
