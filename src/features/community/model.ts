import type { DemoData, Entity } from '../../lib/types';
import { localDate, today } from '../../lib/utils';

export const FORMAL_NOTICE = 'Votación formal de demostración. No tiene validez legal ni carácter vinculante. No reemplaza una asamblea ni sus mecanismos de votación.';
export const BUILDING_UNITS = 52;
export const fullDate = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
export const lines = (value = '') => value.split('\n').map(line => line.trim()).filter(Boolean);
export const isCancelled = (item: Entity) => /cancelad|anulad/i.test(item.status ?? '');
export const isPastMeeting = (item: Entity) => {
  if (/realizada|finalizada/i.test(item.status ?? '') || item.date.slice(0, 10) < today()) return true;
  const endTime = item.endTime || item.time;
  return Boolean(endTime && item.date.slice(0, 10) === today() && new Date(`${item.date.slice(0, 10)}T${endTime}:00`).getTime() < Date.now());
};

export function pollResults(poll: Entity) {
  const votes = (poll.options ?? []).map((_, index) => {
    const count = Number(poll.votes?.[index]);
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  });
  return { votes, total: votes.reduce((sum, vote) => sum + vote, 0) };
}

export function pollHasEnded(poll: Entity) {
  return Boolean(poll.closed || (poll.dueDate && poll.dueDate.slice(0, 10) < today()));
}

export function ballotPatch(poll: Entity, option: number): Partial<Entity> | null {
  if (poll.voted !== undefined || pollHasEnded(poll) || !Number.isInteger(option) || option < 0 || option >= (poll.options?.length ?? 0)) return null;
  const { votes } = pollResults(poll);
  votes[option] += 1;
  return { votes, voted: option };
}

export const calendarKinds = [
  { id: 'meetings', label: 'Reuniones' },
  { id: 'reservations', label: 'Reservas' },
  { id: 'works', label: 'Obras' },
  { id: 'cuts', label: 'Cortes de servicios' },
  { id: 'expenses', label: 'Expensas' },
] as const;
export type CalendarKind = typeof calendarKinds[number]['id'];
export interface CalendarEvent { id: string; kind: CalendarKind; title: string; date: string; time?: string; endTime?: string; place?: string; description: string; status?: string; amount?: number; item: Entity }

export function calendarEvents(data: DemoData): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  function add(items: Entity[], kind: CalendarKind, dateFor: (item: Entity) => string) {
    items.filter(item => !isCancelled(item)).forEach(item => {
      const date = dateFor(item)?.slice(0, 10);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || localDate(new Date(`${date}T12:00:00`)) !== date) return;
      events.push({ id: `${kind}-${item.id}`, kind, title: item.title, date, time: item.time, endTime: item.endTime, place: item.place, description: item.description, status: item.status, amount: item.amount, item });
    });
  }
  add(data.meetings, 'meetings', item => item.date);
  add(data.reservations, 'reservations', item => item.date);
  add(data.works, 'works', item => item.startDate || item.date);
  const cuts = [...data.notices, ...data.statuses].filter(item => /corte|interrupci[oó]n/i.test(`${item.category ?? ''} ${item.type ?? ''} ${item.title}`));
  add(cuts, 'cuts', item => item.startDate || item.date);
  add(data.expenses, 'expenses', item => item.dueDate || item.date);
  return events.sort((a, b) => `${a.date} ${a.time ?? '99:99'}`.localeCompare(`${b.date} ${b.time ?? '99:99'}`) || a.title.localeCompare(b.title));
}

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return localDate(date).slice(0, 7);
}
