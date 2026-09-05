import { useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { DocumentActions, Field, UploadField } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Attachment, Message } from '../../lib/types';
import { formatDate, id } from '../../lib/utils';

export function Conversation({ messages, author, onSend, closed = false }: {
  messages: Message[]; author: string; onSend: (message: Message) => void; closed?: boolean;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment>();
  const [error, setError] = useState('');
  const sending = useRef(false);
  const { notify } = usePortal();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (closed || sending.current) return;
    if (!text.trim() && !attachment) { setError('Escribí un mensaje o adjuntá un archivo.'); return; }
    sending.current = true;
    onSend({ id: id(), author, text: text.trim(), attachment, date: new Date().toISOString() });
    setText(''); setAttachment(undefined); setError('');
    notify('Mensaje guardado en esta demo. No se envió fuera del navegador.');
    queueMicrotask(() => { sending.current = false; });
  }

  return <div className="services-conversation">
    <p className="muted">Conversación demo, guardada en este navegador. No envía mensajes reales ni atiende emergencias.</p>
    <div role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" className="services-messages">
      {!messages.length && <p className="empty">Todavía no hay mensajes.</p>}
      {messages.map(message => <article key={message.id} className={`services-message ${message.author === author ? 'services-message-own' : ''}`}>
        <div className="services-message-meta"><strong>{message.author}</strong><time dateTime={message.date}>{formatDate(message.date, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
        {message.text && <p className="services-preserve">{message.text}</p>}
        {message.attachment && <DocumentActions attachment={message.attachment} label={`Ver ${message.attachment.name}`} />}
      </article>)}
    </div>
    {closed ? <p className="status">Reclamo resuelto. La conversación queda disponible para consulta.</p> : <form onSubmit={submit} className="services-composer">
      <Field label="Mensaje"><textarea value={text} onChange={event => setText(event.target.value)} rows={3} maxLength={3000} /></Field>
      <UploadField value={attachment} onChange={setAttachment} />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="form-actions"><button type="submit" className="button"><Send size={18} aria-hidden="true" />Guardar mensaje demo</button></div>
    </form>}
  </div>;
}
