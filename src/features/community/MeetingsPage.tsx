import { useState } from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DocumentActions, Empty, Modal, PageHeader, Status, Tabs } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { fullDate, isCancelled, isPastMeeting, lines } from './model';
import { PollList } from './PollsPage';
import { TopicList } from './Topics';
import './community.css';

export function MeetingContent({ meeting }: { meeting: Entity }) {
  return <div className="community-meeting-content"><Status tone={isCancelled(meeting) ? 'red' : isPastMeeting(meeting) ? 'neutral' : 'green'}>{meeting.status ?? (isPastMeeting(meeting) ? 'Realizada' : 'Programada')}</Status><dl className="community-facts"><div><dt><CalendarDays size={20} />Fecha</dt><dd>{fullDate(meeting.date)}</dd></div><div><dt><Clock size={20} />Horario</dt><dd>{meeting.time || 'A confirmar'}{meeting.endTime && ` a ${meeting.endTime}`}</dd></div><div><dt><MapPin size={20} />Lugar</dt><dd>{meeting.place || 'A confirmar'}</dd></div></dl><p className="community-preserve">{meeting.description}</p>{meeting.agenda && <><h3>Orden del día</h3><ol className="community-agenda">{lines(meeting.agenda).map((item, index) => <li key={index}>{item}</li>)}</ol></>}{meeting.summary && <><h3>Resumen de la reunión</h3><p className="community-preserve">{meeting.summary}</p></>}{Boolean(meeting.milestones?.length) && <><h3>Decisiones acordadas</h3><ul className="community-agenda">{meeting.milestones!.map((item, index) => <li key={index}>{item}</li>)}</ul></>}{isPastMeeting(meeting) && !meeting.summary && <p className="muted">El resumen de esta reunión todavía no fue publicado.</p>}{meeting.attachment && <DocumentActions attachment={meeting.attachment} label={isPastMeeting(meeting) ? 'Ver acta o documento' : 'Ver documentación'} />}</div>;
}

export function MeetingsPage() {
  const { data } = usePortal();
  const [search, setSearch] = useSearchParams();
  const requestedTab = search.get('tab');
  const tab = requestedTab === 'temas' || requestedTab === 'encuestas' ? requestedTab : 'reuniones';
  const [selectedId, setSelectedId] = useState<string>();
  const selected = data.meetings.find(meeting => meeting.id === selectedId);
  const upcoming = data.meetings.filter(item => !isPastMeeting(item) && !isCancelled(item)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const previous = data.meetings.filter(item => isPastMeeting(item) || isCancelled(item)).sort((a, b) => b.date.localeCompare(a.date));
  return <div className="community-page"><PageHeader title="Reuniones y participación" description="Fechas, actas y propuestas para decidir en comunidad." back="/edificio" /><Tabs items={[{ id: 'reuniones', label: 'Reuniones' }, { id: 'temas', label: 'Temas' }, { id: 'encuestas', label: 'Encuestas' }]} value={tab} onChange={value => setSearch({ tab: value })} />{tab === 'reuniones' && <><section className="section"><div className="section-heading"><h2>Próximas reuniones</h2></div>{upcoming.length ? upcoming.map(meeting => <article key={meeting.id} className="community-meeting"><h3>{meeting.title}</h3><MeetingContent meeting={meeting} /></article>) : <Empty>No hay reuniones programadas.</Empty>}</section><section className="section"><div className="section-heading"><h2>Reuniones anteriores y canceladas</h2></div>{previous.length ? <ul className="list">{previous.map(meeting => <li key={meeting.id} className="list-row"><div className="row-main"><h3>{meeting.title}</h3><p className="muted">{fullDate(meeting.date)} · {isCancelled(meeting) ? 'Cancelada' : 'Realizada'}</p><p>{meeting.summary || (isCancelled(meeting) ? 'Esta reunión fue cancelada.' : 'Resumen pendiente de publicación.')}</p></div><div className="row-actions"><button className="button secondary" onClick={() => setSelectedId(meeting.id)} aria-label={`Ver detalle de ${meeting.title}`}>Ver detalle</button></div></li>)}</ul> : <Empty>Todavía no hay reuniones anteriores.</Empty>}</section></>}{tab === 'temas' && <TopicList />}{tab === 'encuestas' && <PollList />}{selected && <Modal title={selected.title} onClose={() => setSelectedId(undefined)} wide><div className="community-page"><MeetingContent meeting={selected} /></div></Modal>}</div>;
}
