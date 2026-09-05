import { useId, useRef, useState, type FormEvent } from 'react';
import { Check, Vote } from 'lucide-react';
import { DocumentActions, Empty, PageHeader, Status, Tabs } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { ballotPatch, BUILDING_UNITS, FORMAL_NOTICE, fullDate, pollHasEnded, pollResults } from './model';
import './community.css';

export function PollResults({ poll }: { poll: Entity }) {
  const { votes, total } = pollResults(poll);
  return <div className="community-results">
    <p className="muted">Participación: <strong>{total} de {BUILDING_UNITS} unidades</strong> ({Math.round(total / BUILDING_UNITS * 100)} %). Datos demo.</p>
    <ul className="community-result-list" aria-label={`Resultados: ${poll.title}`}>
      {(poll.options ?? []).map((option, index) => {
        const percent = total ? Math.round(votes[index] / total * 100) : 0;
        return <li key={index}><div className="community-result-label"><span>{option}{poll.voted === index && <strong className="community-choice"> · Tu voto</strong>}</span><span>{votes[index]} {votes[index] === 1 ? 'voto' : 'votos'} · {percent} %</span></div><meter min={0} max={Math.max(total, 1)} value={votes[index]} aria-label={`${option}: ${votes[index]} votos, ${percent} %`} /></li>;
      })}
    </ul>
    {total === 0 && <p className="muted">Todavía no se registraron votos.</p>}
  </div>;
}

function PollCard({ poll }: { poll: Entity }) {
  const { data, update, notify } = usePortal();
  const [choice, setChoice] = useState<number>();
  const submitted = useRef(false);
  const radioName = useId();
  const ended = pollHasEnded(poll);
  const hasVoted = poll.voted !== undefined;
  function vote(event: FormEvent) {
    event.preventDefault();
    if (submitted.current || choice === undefined) return;
    const current = data.polls.find(item => item.id === poll.id);
    const patch = current && ballotPatch(current, choice);
    if (!patch) { notify('Esta consulta ya no admite tu voto.'); return; }
    submitted.current = true;
    update('polls', poll.id, patch);
    notify('Tu voto demo quedó registrado para la Unidad 7B.');
    window.setTimeout(() => { submitted.current = false; }, 0);
  }
  return <article className="section community-poll" aria-labelledby={`${radioName}-title`}>
    <div className="section-heading"><h2 id={`${radioName}-title`}>{poll.title}</h2><Status tone={ended ? 'neutral' : 'green'}>{ended ? 'Cerrada' : 'Abierta'}</Status></div>
    <p className="community-preserve">{poll.description}</p>
    {poll.formal && <p className="community-notice">{FORMAL_NOTICE}</p>}
    {poll.dueDate && <p className="muted">{ended ? 'Fecha de cierre' : 'Disponible hasta el'}: {fullDate(poll.dueDate)}.</p>}
    {poll.attachment && <DocumentActions attachment={poll.attachment} label="Ver documento" />}
    {!hasVoted && !ended && <form onSubmit={vote}>
      <fieldset className="community-options"><legend>Tu elección · Unidad 7B</legend>{(poll.options ?? []).map((option, index) => <label className="community-option" key={index}><input type="radio" required name={radioName} value={index} checked={choice === index} onChange={() => setChoice(index)} /><span>{option}</span></label>)}</fieldset>
      <button className="button" type="submit" disabled={choice === undefined}><Vote size={20} />{poll.formal ? 'Registrar voto demo' : 'Votar'}</button>
      <p className="muted">Un voto por unidad en esta demo. Una vez registrado, no se puede cambiar.</p>
    </form>}
    {hasVoted && <p className="community-voted" role="status"><Check size={20} />Tu voto: {poll.options?.[poll.voted!] ?? 'Registrado'}</p>}
    <PollResults poll={poll} />
  </article>;
}

export function PollList() {
  const { data } = usePortal();
  const [filter, setFilter] = useState('abiertas');
  const polls = data.polls.filter(poll => filter === 'todas' || (filter === 'abiertas' ? !pollHasEnded(poll) : pollHasEnded(poll))).sort((a, b) => b.date.localeCompare(a.date));
  return <><Tabs items={[{ id: 'abiertas', label: 'Abiertas' }, { id: 'cerradas', label: 'Cerradas' }, { id: 'todas', label: 'Todas' }]} value={filter} onChange={setFilter} />{polls.length ? polls.map(poll => <PollCard key={poll.id} poll={poll} />) : <Empty>No hay consultas {filter === 'todas' ? 'publicadas' : filter}.</Empty>}</>;
}

export function PollsPage() {
  return <div className="community-page"><PageHeader title="Encuestas y votaciones" description="Consultá las propuestas, participá y seguí los resultados del edificio." back="/edificio" /><PollList /></div>;
}
