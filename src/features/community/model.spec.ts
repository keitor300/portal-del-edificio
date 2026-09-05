import { expect, test } from '@playwright/test';
import type { DemoData, Entity } from '../../lib/types';
import { relativeDate, today } from '../../lib/utils';
import { ballotPatch, calendarEvents, isPastMeeting, pollHasEnded, pollResults, shiftMonth } from './model';
import { communitySeed } from './seed';

const poll = (): Entity => ({ id: 'vote', title: 'Consulta', description: '', date: today(), options: ['Sí', 'No'], votes: [2, 1], closed: false });

test('a local ballot increments only its option and rejects every second vote, including option zero', () => {
  const original = poll();
  const patch = ballotPatch(original, 0);
  expect(patch).toEqual({ voted: 0, votes: [3, 1] });
  expect(original.votes).toEqual([2, 1]);
  const persisted = JSON.parse(JSON.stringify({ ...original, ...patch }));
  expect(ballotPatch(persisted, 1)).toBeNull();
  expect(ballotPatch(persisted, 0)).toBeNull();
});

test('closed, expired and invalid choices cannot receive a vote; closing today stays open', () => {
  expect(ballotPatch({ ...poll(), closed: true }, 0)).toBeNull();
  expect(ballotPatch({ ...poll(), dueDate: relativeDate(-1) }, 0)).toBeNull();
  for (const choice of [-1, 2, 0.5, NaN]) expect(ballotPatch(poll(), choice)).toBeNull();
  expect(pollHasEnded({ ...poll(), dueDate: today() })).toBe(false);
});

test('result totals match available options even for incomplete or invalid counts', () => {
  expect(pollResults({ ...poll(), votes: [3] })).toEqual({ votes: [3, 0], total: 3 });
  expect(pollResults({ ...poll(), votes: [-1, Infinity] })).toEqual({ votes: [0, 0], total: 0 });
  expect(pollResults({ ...poll(), votes: [2, 3, 90] }).total).toBe(5);
});

test('calendar unifies five kinds, uses due/start dates and omits cancelled or invalid entries', () => {
  const entity = (id: string, extra: Partial<Entity> = {}): Entity => ({ id, title: id, description: '', date: today(), ...extra });
  const data = { meetings: [entity('meeting'), entity('cancelled', { status: 'Cancelada' })], reservations: [entity('reservation'), entity('invalid', { date: '2027-02-30' })], works: [entity('work', { startDate: relativeDate(2) })], notices: [entity('cut', { category: 'Corte de agua' }), entity('other')], statuses: [], expenses: [entity('expense', { dueDate: relativeDate(4) })] } as unknown as DemoData;
  const events = calendarEvents(data);
  expect(events).toHaveLength(5);
  expect(new Set(events.map(event => event.kind)).size).toBe(5);
  expect(events.find(event => event.kind === 'works')?.date).toBe(relativeDate(2));
  expect(events.find(event => event.kind === 'expenses')?.date).toBe(relativeDate(4));
});

test('month navigation handles year changes and seed dates remain relative', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  const seed = communitySeed();
  expect(seed.meetings.some(item => !isPastMeeting(item))).toBe(true);
  expect(seed.meetings.some(item => isPastMeeting(item))).toBe(true);
  expect(seed.polls.some(item => item.formal && !pollHasEnded(item))).toBe(true);
});
