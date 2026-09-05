import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { DocumentActions, Empty, Field, Modal, PageHeader, Status } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { money, today } from '../../lib/utils';
import { calendarEvents, calendarKinds, fullDate, shiftMonth, type CalendarEvent } from './model';
import { MeetingContent } from './MeetingsPage';
import './community.css';

export function CalendarPage() {
  const { data } = usePortal();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [kind, setKind] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();
  const events = useMemo(() => calendarEvents(data), [data]);
  const selected = events.find(event => event.id === selectedId);
  const visible = events.filter(event => event.date.startsWith(month) && (kind === 'all' || kind === event.kind));
  const days = [...new Set(visible.map(event => event.date))];
  const monthTitle = new Date(`${month}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  function detail(event: CalendarEvent) {
    if (event.kind === 'meetings') return <MeetingContent meeting={event.item} />;
    return <><Status>{calendarKinds.find(item => item.id === event.kind)?.label}</Status><dl className="community-facts"><div><dt><CalendarDays size={20} />Fecha</dt><dd>{fullDate(event.date)}</dd></div>{event.time && <div><dt><Clock size={20} />Horario</dt><dd>{event.time}{event.endTime && ` a ${event.endTime}`}</dd></div>}{event.place && <div><dt><MapPin size={20} />Lugar</dt><dd>{event.place}</dd></div>}</dl><p className="community-preserve">{event.description || 'Sin información adicional.'}</p>{event.status && <p>Estado: {event.status}</p>}{event.kind === 'expenses' && event.amount !== undefined && <p><strong>Importe: {money(event.amount)}</strong></p>}{event.item.attachment && <DocumentActions attachment={event.item.attachment} label="Ver documento" />}</>;
  }
  return <div className="community-page"><PageHeader title="Calendario del edificio" description="Reuniones, reservas, obras, cortes de servicios y vencimientos de expensas." back="/mas" /><div className="toolbar community-calendar-toolbar"><div className="community-month-nav"><button className="button secondary" aria-label="Mes anterior" title="Mes anterior" onClick={() => setMonth(previous => shiftMonth(previous, -1))}><ChevronLeft size={24} /></button><h2 aria-live="polite">{monthTitle}</h2><button className="button secondary" aria-label="Mes siguiente" title="Mes siguiente" onClick={() => setMonth(previous => shiftMonth(previous, 1))}><ChevronRight size={24} /></button></div><button className="button secondary" onClick={() => setMonth(today().slice(0, 7))}><CalendarDays size={20} />Mes actual</button></div><div className="community-calendar-filters"><Field label="Mes"><input type="month" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }} /></Field><Field label="Tipo de evento"><select value={kind} onChange={event => setKind(event.target.value)}><option value="all">Todos los eventos</option>{calendarKinds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field></div><p className="muted" role="status">{visible.length} {visible.length === 1 ? 'evento' : 'eventos'} en {monthTitle}</p><section className="section" aria-label="Agenda por fecha">{days.length ? days.map(date => <section className="community-day" key={date} aria-label={fullDate(date)}><h3><time dateTime={date}>{fullDate(date)}</time>{date === today() && <Status tone="green">Hoy</Status>}</h3><ul className="list">{visible.filter(event => event.date === date).map(event => <li className="list-row" key={event.id}><div className="row-main"><span className={`community-event-kind community-kind-${event.kind}`}>{calendarKinds.find(item => item.id === event.kind)?.label}</span><h4>{event.title}</h4><p className="muted">{event.time ? `${event.time}${event.endTime ? ` a ${event.endTime}` : ''}` : event.kind === 'expenses' ? 'Vencimiento' : 'Sin horario especificado'}{event.place && ` · ${event.place}`}</p></div><div className="row-actions"><button className="button secondary" onClick={() => setSelectedId(event.id)} aria-label={`Ver ${event.title}`}>Ver detalle</button></div></li>)}</ul></section>) : <Empty>No hay eventos de este tipo en el mes seleccionado.</Empty>}</section>{selected && <Modal title={selected.title} onClose={() => setSelectedId(undefined)} wide><div className="community-page">{detail(selected)}</div></Modal>}</div>;
}
