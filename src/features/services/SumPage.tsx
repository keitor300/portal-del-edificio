import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Expand, Plus, Save, Trash2, Unlock } from 'lucide-react';
import { Confirm, Field, Modal, PageHeader } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { formatDate, id, today } from '../../lib/utils';
import { activeReservation, bookingError, isValidReservation, OWNER_UNIT, rangeUnavailable, reservationEndsAt, reservationTouchesDate, sameUnit, sumOperatingWindow, sumTimeOptions, SUM_SLOTS, validBookingRange, validDate } from './model';
import './services.css';

export function SumRangePicker({ date, startTime, endTime, onStartChange, onEndChange }: { date: string; startTime: string; endTime: string; onStartChange: (value: string) => void; onEndChange: (value: string) => void }) {
  const { data } = usePortal();
  const window = sumOperatingWindow(date);
  const feedback = startTime && endTime ? rangeUnavailable(date, startTime, endTime, data.reservations, data.settings) : '';
  const endOptions = sumTimeOptions(date, true).filter(option => !startTime || !!validBookingRange(date, startTime, option.value));
  return <fieldset className="sum-range-picker">
    <legend>Elegí el horario</legend>
    <p className="muted">Todos los días podés elegir desde las 08:30, en bloques de 30 minutos.</p>
    <div className="sum-range-fields">
      <Field label="Desde"><select value={startTime} required onChange={event => onStartChange(event.target.value)}><option value="">Elegí una hora</option>{sumTimeOptions(date).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      <span className="sum-range-separator" aria-hidden="true">a</span>
      <Field label="Hasta"><select value={endTime} required onChange={event => onEndChange(event.target.value)}><option value="">Elegí una hora</option>{endOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
    </div>
    <p className="sum-range-help">{window?.closeTime === '03:00' ? 'Viernes y sábado: opciones hasta las 03:00 del día siguiente.' : 'Domingo a jueves: opciones hasta la 01:00 del día siguiente.'} Las horas se eligen de la lista, en punto o media hora.</p>
    {startTime && endTime && <p className={`sum-range-feedback ${feedback ? 'is-error' : 'is-ok'}`} role="status">{feedback || 'Este horario está disponible.'}</p>}
  </fieldset>;
}

export function CommunityAvailability({ date }: { date: string }) {
  const { data } = usePortal();
  const reservations = data.reservations.filter(item => isValidReservation(item) && activeReservation(item) && reservationTouchesDate(item, date)).sort((a, b) => `${a.date}${a.time}${a.unit}`.localeCompare(`${b.date}${b.time}${b.unit}`));
  return <section className="sum-community-availability" aria-labelledby="sum-community-title">
    <div className="section-heading sum-community-heading">
      <div><h3 id="sum-community-title">Disponibilidad de todas las unidades</h3><p className="muted">Las reservas de otros propietarios son visibles para evitar confusiones.</p></div>
      <span className="sum-community-date">{validDate(date) ? formatDate(date, { day: 'numeric', month: 'short' }) : 'Elegí una fecha'}</span>
    </div>
    {reservations.length ? <div className="sum-community-list">{reservations.map(item => <div className="sum-community-row" key={item.id}>
      <div><strong>{item.time} a {item.endTime || SUM_SLOTS.find(slot => slot.time === item.time)?.endTime}</strong><span>Unidad {item.unit || 'sin indicar'}{item.endDate && item.endDate !== item.date ? ` · continúa el ${formatDate(item.endDate, { day: 'numeric', month: 'short' })}` : ''}</span></div>
      <span className="status status-green">Reservado</span>
    </div>)}</div> : <p className="empty">No hay reservas visibles para esta fecha. Los horarios habilitados aparecen arriba.</p>}
  </section>;
}

export function BookingForm({ admin = false }: { admin?: boolean }) {
  const { data, save, notify } = usePortal();
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [unit, setUnit] = useState(admin ? '' : OWNER_UNIT);
  const [acceptedRules, setAcceptedRules] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const saving = useRef(false);
  const accepted = acceptedRules !== null && acceptedRules === data.settings.rules;
  const selectedRange = validBookingRange(date, startTime, endTime);

  function validate() {
    const reason = bookingError(date, startTime, endTime, unit, accepted, data.reservations, data.settings);
    setError(reason);
    return !reason;
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (validate()) setConfirmation(true);
  }

  function reserve() {
    if (saving.current) return;
    if (!validate() || !selectedRange) { setConfirmation(false); return; }
    saving.current = true;
    save('reservations', {
      id: id(), title: 'Reserva del SUM', description: admin ? 'Reserva cargada por administración. Reglamento aceptado.' : 'Reserva de propietario. Reglamento aceptado.',
      date, time: startTime, endTime, endDate: selectedRange.endDate === date ? undefined : selectedRange.endDate, unit: unit.trim().replace(/^unidad\s*/i, '').toUpperCase(), status: 'Confirmada', place: 'SUM',
    });
    setConfirmation(false); setStartTime(''); setEndTime(''); setAcceptedRules(null);
    notify('Reserva guardada en la demo.');
    queueMicrotask(() => { saving.current = false; });
  }

  return <>
    <form onSubmit={review} className="services-booking-form">
      {admin && <Field label="Unidad" hint="Unidad para la que se carga la reserva."><input aria-label="Unidad" required value={unit} maxLength={20} placeholder="Ej. 3A" onChange={event => setUnit(event.target.value)} /></Field>}
      <Field label="Fecha de reserva"><input type="date" required min={today()} value={date} onChange={event => { setDate(event.target.value); setStartTime(''); setEndTime(''); setError(''); }} /></Field>
      <SumRangePicker date={date} startTime={startTime} endTime={endTime} onStartChange={value => { setStartTime(value); setEndTime(''); setError(''); }} onEndChange={value => { setEndTime(value); setError(''); }} />
      <CommunityAvailability date={date} />
      <div><h3>Reglamento del SUM</h3><div className="services-rules" role="region" aria-label="Reglamento del SUM" tabIndex={0}>{data.settings.rules || 'El reglamento todavía no está cargado.'}</div></div>
      <label className="services-check"><input type="checkbox" checked={accepted} onChange={event => setAcceptedRules(event.target.checked ? data.settings.rules : null)} />{admin ? 'Confirmo la aceptación del reglamento por esta unidad.' : 'Leí y acepto el reglamento del SUM.'}</label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="button" type="submit"><CalendarDays size={20} aria-hidden="true" />Revisar reserva</button>
    </form>
    {confirmation && <Modal title="Confirmar reserva del SUM" onClose={() => setConfirmation(false)}>
      <p><strong>Unidad {unit.trim().replace(/^unidad\s*/i, '').toUpperCase()}</strong></p>
      <p>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<br />{startTime} a {endTime}{selectedRange?.endDate !== date && ` · continúa el ${formatDate(selectedRange?.endDate ?? date, { weekday: 'long', day: 'numeric', month: 'long' })}`}</p>
      <p>Reglamento aceptado. La reserva se guardará en esta demo.</p>
      <div className="form-actions"><button className="button secondary" onClick={() => setConfirmation(false)}>Volver</button><button className="button" onClick={reserve}><Check size={18} aria-hidden="true" />Confirmar reserva</button></div>
    </Modal>}
  </>;
}

export function ReservationList({ admin = false }: { admin?: boolean }) {
  const { data, update, notify } = usePortal();
  const [cancel, setCancel] = useState<Entity>();
  const [filter, setFilter] = useState('Próximas');
  const [unit, setUnit] = useState('');
  const now = new Date();
  const reservations = data.reservations.filter(item => isValidReservation(item)).filter(item => {
    const end = reservationEndsAt(item);
    const ended = end !== null && end < now.getTime();
    return (filter === 'Todas' || (filter === 'Canceladas' ? !activeReservation(item) : activeReservation(item) && !ended)) &&
      (!unit.trim() || (item.unit ?? '').toLowerCase().includes(unit.trim().toLowerCase()));
  }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return <section className="section">
    <div className="section-heading"><div><h2>{admin ? 'Reservas del edificio' : 'Reservas del SUM'}</h2>{!admin && <p className="muted">Podés ver las reservas de todas las unidades. Solo podés cancelar las de tu unidad.</p>}</div></div>
    <div className="services-filters">
      <Field label="Mostrar reservas"><select value={filter} onChange={event => setFilter(event.target.value)}>{['Próximas', 'Todas', 'Canceladas'].map(value => <option key={value}>{value}</option>)}</select></Field>
      {admin && <Field label="Filtrar por unidad"><input value={unit} onChange={event => setUnit(event.target.value)} placeholder="Ej. 7B" /></Field>}
    </div>
    <div className="list">{reservations.length ? reservations.map(item => <div className="list-row" key={item.id}>
      <div className="row-main"><strong>{formatDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><p>{item.time} a {item.endTime || SUM_SLOTS.find(slot => slot.time === item.time)?.endTime} · Unidad {item.unit}</p><span className={`status ${activeReservation(item) ? 'status-green' : ''}`}>{item.status || 'Confirmada'}</span></div>
      {activeReservation(item) && (admin || sameUnit(item.unit)) && (reservationEndsAt(item) ?? 0) > now.getTime() && <div className="row-actions"><button className="button secondary" aria-label={`Cancelar reserva del ${formatDate(item.date)} a las ${item.time}, unidad ${item.unit}`} onClick={() => setCancel(item)}><Trash2 size={18} aria-hidden="true" />Cancelar</button></div>}
    </div>) : <p className="empty">No hay reservas para este filtro.</p>}</div>
    {cancel && <Confirm title="Cancelar reserva" description={`Se liberará el turno del ${formatDate(cancel.date)} de ${cancel.time} a ${cancel.endTime}, unidad ${cancel.unit}.`} onClose={() => setCancel(undefined)} onConfirm={() => { update('reservations', cancel.id, { status: 'Cancelada' }); notify('Reserva cancelada en la demo. El turno vuelve a estar disponible.'); }} />}
  </section>;
}

export function SumPage() {
  const [fullPhoto, setFullPhoto] = useState(false);
  return <div className="services-page">
    <PageHeader title="Reservar el SUM" description="Elegí una fecha y un horario disponible para tu unidad 7B." back="/servicios" />
    <div className="services-sum-layout"><div><img className="services-photo" src="/images/sum.jpg" alt="Salón de usos múltiples del edificio, con mesas, sillas y ventanales" width={1200} height={675} fetchPriority="high" /><div className="services-photo-caption"><p className="muted">Salón de usos múltiples</p><button className="button secondary small" onClick={() => setFullPhoto(true)}><Expand size={18} aria-hidden="true" />Foto completa</button></div></div><BookingForm /></div>
    <ReservationList />
    {fullPhoto && <Modal title="Salón de usos múltiples" wide onClose={() => setFullPhoto(false)}><img className="services-photo-full" src="/images/sum.jpg" alt="Fotografía completa del salón de usos múltiples del edificio" width={1200} height={675} /></Modal>}
  </div>;
}

export function AdminSum() {
  const { data, setSettings, notify } = usePortal();
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const [editingRules, setEditingRules] = useState(false);
  const [rules, setRules] = useState('');

  function block(event: FormEvent) {
    event.preventDefault();
    if (!validDate(date) || date < today()) { setError('Elegí hoy o una fecha futura.'); return; }
    if (data.settings.blockedDates.includes(date)) { setError('La fecha ya está bloqueada.'); return; }
    if (data.reservations.some(item => isValidReservation(item) && activeReservation(item) && reservationTouchesDate(item, date))) { setError('La fecha tiene reservas. Cancelalas antes de bloquear el día.'); return; }
    setSettings({ blockedDates: [...data.settings.blockedDates, date].sort() });
    setError(''); notify('Fecha bloqueada en la demo.');
  }

  function saveRules(event: FormEvent) {
    event.preventDefault();
    if (!rules.trim()) return;
    setSettings({ rules: rules.trim() }); setEditingRules(false); notify('Reglamento actualizado en la demo.');
  }

  return <>
    <section className="section"><div className="section-heading"><h2>Reserva manual</h2><button className="button secondary" onClick={() => { setRules(data.settings.rules); setEditingRules(true); }}><Save size={18} aria-hidden="true" />Editar reglamento</button></div><BookingForm admin /></section>
    <ReservationList admin />
    <section className="section"><div className="section-heading"><h2>Fechas bloqueadas</h2></div>
      <form onSubmit={block} className="services-filters"><Field label="Fecha a bloquear"><input type="date" required min={today()} value={date} onChange={event => { setDate(event.target.value); setError(''); }} /></Field><button className="button secondary" type="submit"><Plus size={18} aria-hidden="true" />Bloquear día</button></form>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="list">{[...data.settings.blockedDates].sort().map(blocked => <div className="list-row" key={blocked}><div className="row-main"><strong>{formatDate(blocked, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><p className="muted">Todos los horarios bloqueados</p></div><button className="button secondary" aria-label={`Desbloquear ${formatDate(blocked)}`} onClick={() => { setSettings({ blockedDates: data.settings.blockedDates.filter(item => item !== blocked) }); notify('Fecha desbloqueada en la demo.'); }}><Unlock size={18} aria-hidden="true" />Desbloquear</button></div>)}</div>
      {!data.settings.blockedDates.length && <p className="empty">No hay fechas bloqueadas.</p>}
    </section>
    {editingRules && <Modal title="Editar reglamento del SUM" wide onClose={() => setEditingRules(false)}><form onSubmit={saveRules}><Field label="Reglamento"><textarea aria-label="Reglamento" rows={10} maxLength={10000} required value={rules} onChange={event => setRules(event.target.value)} /></Field><div className="form-actions"><button type="button" className="button secondary" onClick={() => setEditingRules(false)}>Volver</button><button className="button" type="submit" disabled={!rules.trim()}><Save size={18} aria-hidden="true" />Guardar reglamento</button></div></form></Modal>}
  </>;
}
