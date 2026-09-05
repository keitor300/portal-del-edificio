import type { DemoData, Entity, Settings } from '../../lib/types';
import { relativeDate, today } from '../../lib/utils';

export const OWNER_UNIT = '7B';
export const ISSUE_CATEGORIES = ['Agua', 'Ascensor', 'Gas', 'Electricidad', 'Limpieza', 'Otro'];
export const ISSUE_STATUSES = ['Recibido', 'En curso', 'Resuelto'];
export const SUM_SLOTS = [
  { time: '10:00', endTime: '15:00', label: '10:00 a 15:00' },
  { time: '17:00', endTime: '22:00', label: '17:00 a 22:00' },
] as const;

export type SumSlot = typeof SUM_SLOTS[number];

export function timeToMinutes(value: string | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(date.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(date.slice(5, 7)) && parsed.getDate() === Number(date.slice(8, 10));
}

export const activeReservation = (reservation: Entity) => !['cancelada', 'cancelado', 'cancelled'].includes((reservation.status ?? '').trim().toLowerCase());
export const sameUnit = (unit: string | undefined, expected = OWNER_UNIT) => (unit ?? '').replace(/^unidad\s*/i, '').replace(/\s/g, '').toUpperCase() === expected.toUpperCase();

function calendarMinutes(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 60000;
}

function nextDate(date: string) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function sumOperatingWindow(date: string) {
  if (!validDate(date)) return null;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const overnight = true;
  return { openTime: '08:30', closeTime: weekday === 5 || weekday === 6 ? '03:00' : '01:00', closeDate: nextDate(date), overnight };
}

export function sumTimeOptions(date: string, includeNextDay = false) {
  const window = sumOperatingWindow(date);
  if (!window) return [];
  const options = [] as { value: string; label: string }[];
  for (let minute = timeToMinutes(window.openTime)!; minute <= 23 * 60 + 30; minute += 30) {
    const hours = String(Math.floor(minute / 60)).padStart(2, '0');
    const minutes = String(minute % 60).padStart(2, '0');
    options.push({ value: `${hours}:${minutes}`, label: `${hours}:${minutes}` });
  }
  if (includeNextDay) {
    for (let minute = 0; minute <= timeToMinutes(window.closeTime)!; minute += 30) {
      const hours = String(Math.floor(minute / 60)).padStart(2, '0');
      const minutes = String(minute % 60).padStart(2, '0');
      options.push({ value: `${hours}:${minutes}`, label: `${hours}:${minutes} (día siguiente)` });
    }
  }
  return options;
}

export function reservationEndDate(date: string, startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end === start) return date;
  return end < start ? nextDate(date) : date;
}

export function validBookingRange(date: string, startTime: string, endTime: string) {
  const window = sumOperatingWindow(date);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!window || start === null || end === null || start % 30 !== 0 || end % 30 !== 0 || start < timeToMinutes(window.openTime)!) return null;
  const endDate = reservationEndDate(date, startTime, endTime);
  if (!window.overnight && endDate !== date) return null;
  if (window.overnight && endDate !== date && end > timeToMinutes(window.closeTime)!) return null;
  if (endDate === date && end <= start) return null;
  const absoluteStart = calendarMinutes(date) + start;
  const absoluteEnd = calendarMinutes(endDate) + end;
  if (absoluteEnd <= absoluteStart) return null;
  if (absoluteEnd > calendarMinutes(window.closeDate) + timeToMinutes(window.closeTime)!) return null;
  return { start: absoluteStart, end: absoluteEnd, endDate };
}

export function reservationRange(reservation: Entity, conservative = false) {
  const start = timeToMinutes(reservation.time);
  const fallbackEnd = SUM_SLOTS.find(slot => slot.time === reservation.time)?.endTime;
  const endTime = reservation.endTime ?? fallbackEnd;
  if (!validDate(reservation.date) || start === null) return null;
  const parsedEnd = timeToMinutes(endTime);
  if (parsedEnd === null && !(conservative && !reservation.endTime)) return null;
  const absoluteStart = calendarMinutes(reservation.date) + start;
  if (parsedEnd === null) return { start: absoluteStart, end: absoluteStart + 24 * 60 };
  const booking = validBookingRange(reservation.date, reservation.time!, endTime!);
  if (!booking || (reservation.endDate && reservation.endDate !== booking.endDate)) return null;
  const endDate = reservation.endDate ?? (parsedEnd <= start ? nextDate(reservation.date) : reservation.date);
  if (!validDate(endDate)) return null;
  const end = calendarMinutes(endDate) + parsedEnd;
  if (end <= absoluteStart) return null;
  return { start: absoluteStart, end };
}

export function isValidReservation(reservation: Entity) {
  return reservationRange(reservation) !== null;
}

export function reservationEndsAt(reservation: Entity) {
  const range = reservationRange(reservation);
  if (!range) return null;
  const endTime = reservation.endTime ?? SUM_SLOTS.find(slot => slot.time === reservation.time)?.endTime;
  if (!endTime) return null;
  const endDate = reservation.endDate ?? reservation.date;
  return new Date(`${endDate}T${endTime}:00`).getTime();
}

export function reservationsOverlap(first: Entity, second: Entity) {
  const firstRange = reservationRange(first);
  const secondRange = reservationRange(second, true);
  return !!firstRange && !!secondRange && firstRange.start < secondRange.end && secondRange.start < firstRange.end;
}

export function reservationTouchesDate(reservation: Entity, date: string) {
  const range = reservationRange(reservation, true);
  if (!range || !validDate(date)) return false;
  const dayStart = calendarMinutes(date);
  return range.start < dayStart + 24 * 60 && range.end > dayStart;
}

export function rangeUnavailable(date: string, startTime: string, endTime: string, reservations: Entity[], settings: Settings, now = new Date()) {
  if (!validDate(date)) return 'Elegí una fecha válida.';
  const range = validBookingRange(date, startTime, endTime);
  if (!range) return 'Elegí un horario válido dentro del horario habilitado.';
  if (new Date(`${date}T${startTime}:00`).getTime() <= now.getTime()) return 'La hora de inicio ya pasó.';
  if (settings.blockedDates.includes(date) || settings.blockedDates.includes(range.endDate)) return 'Fecha bloqueada por administración.';
  const candidate = { id: 'candidate', title: '', description: '', date, time: startTime, endTime, endDate: range.endDate };
  if (reservations.some(item => activeReservation(item) && reservationsOverlap(candidate, item))) return 'Ese horario se superpone con otra reserva.';
  return '';
}

export function slotUnavailable(date: string, time: string, reservations: Entity[], settings: Settings, now = new Date()) {
  const slot = SUM_SLOTS.find(item => item.time === time);
  return slot ? rangeUnavailable(date, slot.time, slot.endTime, reservations, settings, now) : 'Elegí un horario.';
}

export function bookingError(date: string, startTime: string, endTime: string, unit: string, accepted: boolean, reservations: Entity[], settings: Settings) {
  if (!unit.trim()) return 'Indicá la unidad.';
  if (!accepted) return 'Aceptá el reglamento para continuar.';
  if (!settings.rules.trim()) return 'Administración debe cargar el reglamento antes de reservar.';
  return rangeUnavailable(date, startTime, endTime, reservations, settings);
}

export function serviceSeed(): Pick<DemoData, 'reservations' | 'issues' | 'contacts'> {
  return {
    reservations: [
      { id: 'sum-demo-7b', title: 'Reserva del SUM', description: 'Encuentro familiar · Datos demo', date: relativeDate(4), time: '17:00', endTime: '22:00', unit: OWNER_UNIT, status: 'Confirmada', place: 'SUM' },
      { id: 'sum-demo-3a', title: 'Reserva del SUM', description: 'Reserva de ejemplo', date: relativeDate(2), time: '10:00', endTime: '15:00', unit: '3A', status: 'Confirmada', place: 'SUM' },
    ],
    issues: [
      { id: 'reclamo-demo-agua', title: 'Pérdida de agua en el hall', description: 'Hay una pequeña pérdida junto a la entrada. Datos de ejemplo.', date: relativeDate(-2), unit: OWNER_UNIT, category: 'Agua', status: 'En curso', messages: [
        { id: 'reclamo-demo-respuesta', author: 'Administración', text: 'Reclamo de ejemplo: coordinamos la revisión con mantenimiento.', date: `${relativeDate(-1)}T10:00:00` },
      ] },
      { id: 'reclamo-demo-luz', title: 'Luz del pasillo', description: 'La luz del tercer piso no enciende. Datos de ejemplo.', date: relativeDate(-5), unit: '3A', category: 'Electricidad', status: 'Resuelto', messages: [
        { id: 'reclamo-demo-cierre', author: 'Administración', text: 'Ejemplo de seguimiento: se reemplazó la lámpara y se resolvió el reclamo.', date: `${relativeDate(-3)}T15:00:00` },
      ] },
    ],
    contacts: [
      { id: 'contacto-admin', title: 'Administración', category: 'Administración', description: 'Consultas sobre el edificio, documentación y reservas.', date: today(), contact: 'Lunes a viernes, 9:00 a 17:00 · Horario de ejemplo', status: 'Demo' },
      { id: 'contacto-encargado', title: 'Encargado del edificio', category: 'Otro', description: 'Consultas sobre espacios comunes y mantenimiento cotidiano.', date: today(), contact: 'Disponibilidad a confirmar por administración', status: 'Demo' },
      { id: 'contacto-agua', title: 'Mantenimiento de agua', category: 'Agua', description: 'Pérdidas y problemas de agua en espacios comunes.', date: today(), contact: 'Proveedor y teléfono pendientes de confirmar', status: 'Demo' },
      { id: 'contacto-ascensor', title: 'Servicio de ascensores', category: 'Ascensor', description: 'Mantenimiento y atención del ascensor.', date: today(), contact: 'Consultar el contacto verificado en la cabina o el hall', status: 'Demo' },
      { id: 'contacto-gas', title: 'Guardia de gas', category: 'Gas', description: 'Contacto de la distribuidora correspondiente al edificio.', date: today(), contact: 'Consultar el número de emergencias en la factura de gas', status: 'Demo' },
      { id: 'contacto-electricidad', title: 'Mantenimiento eléctrico', category: 'Electricidad', description: 'Problemas eléctricos de áreas comunes.', date: today(), contact: 'Proveedor y teléfono pendientes de confirmar', status: 'Demo' },
    ],
  };
}
