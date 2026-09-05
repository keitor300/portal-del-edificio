import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('./model.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'node' });
const { slotUnavailable, bookingError, serviceSeed, validDate, sameUnit, isValidReservation, reservationEndsAt } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const settings = { rules: 'Reglamento demo', blockedDates: [], openingBalance: 0, seedDate: '2026-09-05' };
const now = new Date('2026-09-05T09:00:00');
const reservation = { id: 'booking', title: 'SUM', description: '', date: '2026-09-06', time: '10:00', endTime: '15:00', unit: '3A', status: 'Confirmada' };

test('both roles see an occupied turn regardless of unit; another turn stays free', () => {
  assert.equal(slotUnavailable('2026-09-06', '10:00', [reservation], settings, now), 'Turno reservado.');
  assert.equal(slotUnavailable('2026-09-06', '17:00', [reservation], settings, now), '');
});
test('cancellation releases the slot, including migrated canceled status', () => {
  for (const status of ['Cancelada', 'cancelado', 'cancelled']) assert.equal(slotUnavailable('2026-09-06', '10:00', [{ ...reservation, status }], settings, now), '');
});
test('block applies to both slots and unblocking restores them', () => {
  for (const time of ['10:00', '17:00']) {
    assert.equal(slotUnavailable('2026-09-06', time, [], { ...settings, blockedDates: ['2026-09-06'] }, now), 'Fecha bloqueada por administración.');
    assert.equal(slotUnavailable('2026-09-06', time, [], settings, now), '');
  }
});
test('past days, already started turns, invalid dates and unknown turns are refused', () => {
  assert.equal(slotUnavailable('2026-09-04', '17:00', [], settings, now), 'Este turno ya pasó.');
  assert.equal(slotUnavailable('2026-09-05', '10:00', [], settings, new Date('2026-09-05T10:00:00')), 'Este turno ya pasó.');
  assert.equal(slotUnavailable('2026-09-05', '17:00', [], settings, new Date('2026-09-05T10:00:00')), '');
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('not-a-date'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(slotUnavailable('', '10:00', [], settings, now), 'Elegí una fecha válida.');
  assert.equal(slotUnavailable('2026-09-06', '12:00', [], settings, now), 'Elegí un turno.');
});
test('rules must be present and explicitly accepted and a unit is required', () => {
  assert.equal(bookingError('2099-09-06', '10:00', '7B', false, [], settings), 'Aceptá el reglamento para continuar.');
  assert.equal(bookingError('2099-09-06', '10:00', '7B', true, [], { ...settings, rules: '' }), 'Administración debe cargar el reglamento antes de reservar.');
  assert.equal(bookingError('2099-09-06', '10:00', ' ', true, [], settings), 'Indicá la unidad.');
  assert.equal(bookingError('2099-09-06', '10:00', '7B', true, [], settings), '');
});
test('partial overlaps collide and absent legacy end times are conservative', () => {
  assert.equal(slotUnavailable('2026-09-06', '10:00', [{ ...reservation, time: '14:00', endTime: '18:00' }], settings, now), 'Turno reservado.');
  assert.equal(slotUnavailable('2026-09-06', '17:00', [{ ...reservation, time: '14:00', endTime: '18:00' }], settings, now), 'Turno reservado.');
  assert.equal(slotUnavailable('2026-09-06', '17:00', [{ ...reservation, time: '16:00', endTime: undefined }], settings, now), 'Turno reservado.');
});
test('reservation validation rejects malformed dates, times and reversed ranges without hiding valid slots', () => {
  assert.equal(isValidReservation({ ...reservation, date: '2026-02-30' }), false);
  assert.equal(isValidReservation({ ...reservation, time: '25:00' }), false);
  assert.equal(isValidReservation({ ...reservation, time: '17:00', endTime: '10:00' }), false);
  assert.equal(isValidReservation({ ...reservation, endTime: undefined }), true);
  assert.equal(typeof reservationEndsAt({ ...reservation, endTime: undefined }), 'number');
  assert.equal(slotUnavailable('2026-09-06', '10:00', [{ ...reservation, status: ' Cancelada ' }], settings, now), '');
  assert.equal(slotUnavailable('2026-09-06', '10:00', [{ ...reservation, date: '2026-02-30' }], settings, now), '');
});
test('seed provides separate owner and neighbor examples without callable invented contacts', () => {
  const seed = serviceSeed();
  assert.deepEqual(Object.keys(seed).sort(), ['contacts', 'issues', 'reservations']);
  assert.ok(seed.reservations.some(item => sameUnit(item.unit)));
  assert.ok(seed.reservations.some(item => !sameUnit(item.unit)));
  assert.ok(seed.contacts.every(item => !item.phone && !item.email));
  assert.ok(seed.issues.some(item => item.messages.length));
});
