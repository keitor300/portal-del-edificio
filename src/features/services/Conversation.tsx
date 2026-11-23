import { useRef, useState, type FormEvent } from 'react';
import { Building2, MessageCircle, Send, ShieldCheck, UserRound } from 'lucide-react';
import { DocumentActions, Field, UploadField } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Attachment, Message } from '../../lib/types';
import { formatDate, id } from '../../lib/utils';
import { productionPortal } from '../../lib/api';

export function Conversation({ messages, author, onSend, closed = false }: {
  messages: Message[]; author: string; onSend: (message: Message) => void|Promise<void>; closed?: boolean;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment>();
  const [error, setError] = useState('');
  const sending = useRef(false);
  const [busy,setBusy]=useState(false);
  const { notify } = usePortal();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (closed || sending.current) return;
    if (!text.trim() && !attachment) { setError('Escribí un mensaje o adjuntá un archivo.'); return; }
    sending.current = true;
    setBusy(true);
    try {
    await onSend({ id: id(), author, text: text.trim(), attachment, date: new Date().toISOString() });
    setText(''); setAttachment(undefined); setError('');
    notify(productionPortal ? 'Mensaje enviado.' : 'Mensaje guardado en esta demo. No se envió fuera del navegador.');
    } catch(cause) { setError((cause as Error).message); }
    finally { sending.current=false;setBusy(false); }
  }

  return <div className="services-conversation">
    <div className="services-chat-note" role="note">
      <span className="services-chat-note-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
      <div><strong>Canal de consultas del edificio</strong><p>{productionPortal ? 'Conversación privada de tu unidad con Administración. No atiende emergencias.' : 'Esta conversación demo se guarda en este navegador. No atiende emergencias.'}</p></div>
      <span className="services-chat-note-badge"><i aria-hidden="true" />{productionPortal ? 'Privado' : 'Demo local'}</span>
    </div>
    <div role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" className="services-messages">
      {!messages.length && <p className="empty">Todavía no hay mensajes.</p>}
      {messages.map(message => {
        const own = message.author === author;
        return <article key={message.id} className={`services-message ${own ? 'services-message-own' : ''}`}>
          <span className="services-message-avatar" aria-hidden="true">{message.author === 'Administración' ? <Building2 size={19} /> : <UserRound size={19} />}</span>
          <div className="services-message-bubble">
            <div className="services-message-meta"><strong>{message.author}</strong><time dateTime={message.date}>{formatDate(message.date, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.text && <p className="services-preserve">{message.text}</p>}
            {message.attachment && <DocumentActions attachment={message.attachment} label={`Ver ${message.attachment.name}`} />}
          </div>
        </article>;
      })}
    </div>
    {closed ? <p className="status">Reclamo resuelto. La conversación queda disponible para consulta.</p> : <form onSubmit={submit} className="services-composer">
      <div className="services-composer-heading"><span><MessageCircle size={21} aria-hidden="true" /></span><div><strong>Escribí un mensaje</strong><small>Podés agregar un archivo si necesitás mostrar un comprobante o una foto.</small></div></div>
      <Field label="Mensaje"><textarea value={text} onChange={event => setText(event.target.value)} rows={3} maxLength={3000} placeholder="Escribí tu consulta..." /></Field>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="services-composer-tools"><UploadField value={attachment} onChange={setAttachment} /><button type="submit" disabled={busy} className="button services-send-button"><Send size={18} aria-hidden="true" />{busy ? 'Enviando…' : productionPortal ? 'Enviar mensaje' : 'Guardar mensaje demo'}</button></div>
    </form>}
  </div>;
}
