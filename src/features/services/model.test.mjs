import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('./model.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'node' });
const { slotUnavailable, rangeUnavailable, bookingError, serviceSeed, validDate, sameUnit, isValidReservation, reservationEndsAt, reservationEndDate, sumOperatingWindow, validBookingRange } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const settings = { rules: 'Reglamento demo', blockedDates: [], openingBalance: 0, seedDate: '2026-09-05' };
const now = new Date('2026-09-05T09:00:00');
const reservation = { id: 'booking', title: 'SUM', description: '', date: '2026-09-06', time: '10:00', endTime: '15:00', unit: '3A', status: 'Confirmada' };

test('both roles see an overlapping range as occupied; another range stays free', () => {
  assert.equal(rangeUnavailable('2026-09-06', '11:00', '12:00', [reservation], settings, now), 'Ese horario se superpone con otra reserva.');
  assert.equal(rangeUnavailable('2026-09-06', '17:00', '19:30', [reservation], settings, now), '');
});
test('cancellation releases the slot, including migrated canceled status', () => {
  for (const status of ['Cancelada', 'cancelado', 'cancelled']) assert.equal(rangeUnavailable('2026-09-06', '11:00', '12:00', [{ ...reservation, status }], settings, now), '');
});
test('block applies to the selected range and unblocking restores it', () => {
  assert.equal(rangeUnavailable('2026-09-06', '10:00', '12:00', [], { ...settings, blockedDates: ['2026-09-06'] }, now), 'Fecha bloqueada por administración.');
  assert.equal(rangeUnavailable('2026-09-06', '10:00', '12:00', [], settings, now), '');
});
test('past days, already started ranges and invalid times are refused', () => {
  assert.equal(rangeUnavailable('2026-09-04', '17:00', '18:00', [], settings, now), 'La hora de inicio ya pasó.');
  assert.equal(rangeUnavailable('2026-09-05', '10:00', '11:00', [], settings, new Date('2026-09-05T10:00:00')), 'La hora de inicio ya pasó.');
  assert.equal(rangeUnavailable('2026-09-05', '17:00', '18:00', [], settings, new Date('2026-09-05T10:00:00')), '');
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('not-a-date'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(rangeUnavailable('', '10:00', '11:00', [], settings, now), 'Elegí una fecha válida.');
  assert.match(rangeUnavailable('2026-09-06', '16:00', '15:00', [], settings, now), /horario válido/);
});
test('rules must be present and explicitly accepted and a unit is required', () => {
  assert.equal(bookingError('2099-09-06', '10:00', '12:30', '7B', false, [], settings), 'Aceptá el reglamento para continuar.');
  assert.equal(bookingError('2099-09-06', '10:00', '12:30', '7B', true, [], { ...settings, rules: '' }), 'Administración debe cargar el reglamento antes de reservar.');
  assert.equal(bookingError('2099-09-06', '10:00', '12:30', ' ', true, [], settings), 'Indicá la unidad.');
  assert.equal(bookingError('2099-09-06', '10:00', '12:30', '7B', true, [], settings), '');
});
test('free ranges collide precisely and legacy reservations remain conservative', () => {
  assert.equal(rangeUnavailable('2026-09-06', '14:00', '16:00', [{ ...reservation, time: '14:00', endTime: '18:00' }], settings, now), 'Ese horario se superpone con otra reserva.');
  assert.equal(rangeUnavailable('2026-09-06', '18:00', '20:00', [{ ...reservation, time: '14:00', endTime: '18:00' }], settings, now), '');
  assert.equal(slotUnavailable('2026-09-06', '17:00', [{ ...reservation, time: '17:00', endTime: undefined }], settings, now), 'Ese horario se superpone con otra reserva.');
});
test('friday and saturday allow ranges through 03:00 the next day', () => {
  assert.equal(sumOperatingWindow('2026-09-11')?.closeDate, '2026-09-12');
  assert.equal(sumOperatingWindow('2026-09-11')?.closeTime, '03:00');
  assert.equal(reservationEndDate('2026-09-11', '23:30', '02:15'), '2026-09-12');
  assert.ok(validBookingRange('2026-09-11', '23:30', '02:15'));
  assert.equal(validBookingRange('2026-09-11', '23:30', '04:00'), null);
  assert.equal(validBookingRange('2026-09-06', '21:00', '02:00'), null);
});
test('reservation validation rejects malformed dates, times and reversed ranges without hiding valid slots', () => {
  assert.equal(isValidReservation({ ...reservation, date: '2026-02-30' }), false);
  assert.equal(isValidReservation({ ...reservation, time: '25:00' }), false);
  assert.equal(isValidReservation({ ...reservation, time: '17:00', endTime: '10:00' }), false);
  assert.equal(isValidReservation({ ...reservation, date: '2026-09-11', time: '23:00', endTime: '02:00', endDate: '2026-09-12' }), true);
  assert.equal(isValidReservation({ ...reservation, endTime: undefined }), true);
  assert.equal(typeof reservationEndsAt({ ...reservation, endTime: undefined }), 'number');
  assert.equal(rangeUnavailable('2026-09-06', '10:00', '12:00', [{ ...reservation, status: ' Cancelada ' }], settings, now), '');
  assert.equal(rangeUnavailable('2026-09-06', '10:00', '12:00', [{ ...reservation, date: '2026-02-30' }], settings, now), '');
});
test('seed provides separate owner and neighbor examples without callable invented contacts', () => {
  const seed = serviceSeed();
  assert.deepEqual(Object.keys(seed).sort(), ['contacts', 'issues', 'reservations']);
  assert.ok(seed.reservations.some(item => sameUnit(item.unit)));
  assert.ok(seed.reservations.some(item => !sameUnit(item.unit)));
  assert.ok(seed.contacts.every(item => !item.phone && !item.email));
  assert.ok(seed.issues.some(item => item.messages.length));
});
