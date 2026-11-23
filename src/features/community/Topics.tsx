import { currentOwnerUnit } from '../auth/ownerAccounts';
import { useState, type FormEvent } from 'react';
import { Heart, MessageCircle, Plus, Send } from 'lucide-react';
import { Empty, Field, Modal, Status } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { productionPortal } from '../../lib/api';
import type { Entity } from '../../lib/types';
import { formatDate, id, today } from '../../lib/utils';

export function TopicForm({ onClose, admin = false }: { onClose: () => void; admin?: boolean }) {
  const action = useAsyncAction();
  const [topicId] = useState(id);
  const { save, notify } = usePortal();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) { setError('Completá el título y la descripción.'); return; }
    void action.run(async () => {
      await save('topics', { id: topicId, title: title.trim(), description: description.trim(), date: today(), unit: productionPortal ? admin ? undefined : currentOwnerUnit() : admin ? 'Administración' : `Unidad ${currentOwnerUnit()}`, status: 'Pendiente', interests: 0, interested: false, messages: [] });
      notify('Tema enviado para revisión.'); onClose();
    });
  }
  return <Modal title="Proponer un tema" onClose={() => { if(!action.isPending())onClose(); }}><form onSubmit={submit} className="community-form"><Field label="Título del tema"><input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} autoFocus /></Field><Field label="Contanos tu propuesta"><textarea value={description} onChange={event => setDescription(event.target.value)} required maxLength={3000} rows={5} /></Field>{(error || action.error) && <p className="error" role="alert">{error || action.error}</p>}<div className="form-actions"><button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>Cancelar</button><button className="button" type="submit" disabled={action.busy}><Send size={20} />Enviar tema</button></div></form></Modal>;
}

export function TopicDiscussion({ topicId, onClose, admin = false }: { topicId: string; onClose: () => void; admin?: boolean }) {
  const action = useAsyncAction();
  const { data, update, notify } = usePortal();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const topic = data.topics.find(item => item.id === topicId);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!topic || action.isPending()) return;
    if (!text.trim()) { setError('Escribí un comentario antes de enviarlo.'); return; }
    void action.run(async () => {
      await update('topics', topic.id, { messages: [...(topic.messages ?? []), { id: id(), author: admin ? 'Administración' : `Unidad ${currentOwnerUnit()}`, text: text.trim(), date: new Date().toISOString() }] });
      setText(''); setError(''); notify('Comentario publicado.');
    });
  }
  return <Modal title={topic?.title ?? 'Tema no disponible'} onClose={() => { if(!action.isPending())onClose(); }} wide><div className="community-page">{topic ? <><p className="community-preserve">{topic.description}</p><Status>{topic.status ?? 'Pendiente'}</Status>{topic.summary && <p className="community-notice"><strong>Administración: </strong>{topic.summary}</p>}<h3>Comentarios ({topic.messages?.length ?? 0})</h3>{topic.messages?.length ? <ol className="list community-comments">{topic.messages.map(message => <li className="list-row" key={message.id}><div className="row-main"><strong>{message.author}</strong><span className="muted">{formatDate(message.date)}</span><p className="community-preserve">{message.text}</p></div></li>)}</ol> : <p className="muted">Todavía no hay comentarios.</p>}<form onSubmit={submit} className="community-form"><Field label="Agregar un comentario"><textarea disabled={action.busy} required maxLength={2000} rows={3} value={text} onChange={event => setText(event.target.value)} /></Field>{(error || action.error) && <p className="error" role="alert">{error || action.error}</p>}<button type="submit" className="button" disabled={action.busy}><Send size={20} />Publicar comentario</button></form></> : <Empty>Este tema ya no está disponible.</Empty>}</div></Modal>;
}

export function TopicList() {
  const action = useAsyncAction();
  const { data, update } = usePortal();
  const [proposing, setProposing] = useState(false);
  const [discussionId, setDiscussionId] = useState<string>();
  function toggleInterest(topic: Entity) {
    void action.run(() => update('topics', topic.id, { interested: !topic.interested, interests: Math.max(0, (topic.interests ?? 0) + (topic.interested ? -1 : 1)) }));
  }
  return <section className="section">{action.error && <p role="alert" className="error">{action.error}</p>}<div className="section-heading"><h2>Temas de propietarios</h2><button className="button" onClick={() => setProposing(true)}><Plus size={20} />Proponer tema</button></div>{data.topics.length ? <ul className="list">{[...data.topics].sort((a, b) => b.date.localeCompare(a.date)).map(topic => <li className="list-row community-topic" key={topic.id}><div className="row-main"><Status tone={topic.status === 'En agenda' ? 'green' : 'neutral'}>{topic.status ?? 'Pendiente'}</Status><h3>{topic.title}</h3><p className="community-preserve">{topic.description}</p><p className="muted">{topic.unit ?? 'Propietario'} · {formatDate(topic.date)}</p>{topic.summary && <p className="community-preserve"><strong>Administración: </strong>{topic.summary}</p>}</div><div className="row-actions"><button className="button secondary" disabled={action.busy} aria-pressed={Boolean(topic.interested)} onClick={() => toggleInterest(topic)}><Heart size={20} fill={topic.interested ? 'currentColor' : 'none'} />{topic.interested ? 'Te interesa' : 'Me interesa'} ({topic.interests ?? 0})</button><button className="button secondary" onClick={() => setDiscussionId(topic.id)} aria-label={`Comentarios de ${topic.title}`}><MessageCircle size={20} />Comentarios ({topic.messages?.length ?? 0})</button></div></li>)}</ul> : <Empty>Todavía no se propusieron temas.</Empty>}{proposing && <TopicForm onClose={() => setProposing(false)} />}{discussionId && <TopicDiscussion topicId={discussionId} onClose={() => setDiscussionId(undefined)} />}</section>;
}
