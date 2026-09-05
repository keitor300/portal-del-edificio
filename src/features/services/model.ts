import type { DemoData, Entity, Settings } from '../../lib/types';
import { relativeDate, today } from '../../lib/utils';

export const OWNER_UNIT = '7B';
export const ISSUE_CATEGORIES = ['Agua', 'Ascensor', 'Gas', 'Electricidad', 'Limpieza', 'Otro'];
export const ISSUE_STATUSES = ['Recibido', 'En curso', 'Resuelto'];
export const SUM_SLOTS = [
  { time: '10:00', endTime: '11:00', label: '10:00 a 11:00' },
  { time: '11:00', endTime: '12:00', label: '11:00 a 12:00' },
  { time: '12:00', endTime: '13:00', label: '12:00 a 13:00' },
  { time: '13:00', endTime: '14:00', label: '13:00 a 14:00' },
  { time: '14:00', endTime: '15:00', label: '14:00 a 15:00' },
  { time: '17:00', endTime: '18:00', label: '17:00 a 18:00' },
  { time: '18:00', endTime: '19:00', label: '18:00 a 19:00' },
  { time: '19:00', endTime: '20:00', label: '19:00 a 20:00' },
  { time: '20:00', endTime: '21:00', label: '20:00 a 21:00' },
  { time: '21:00', endTime: '22:00', label: '21:00 a 22:00' },
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

export function reservationRange(reservation: Entity, conservative = false) {
  const start = timeToMinutes(reservation.time);
  const fallbackEnd = SUM_SLOTS.find(slot => slot.time === reservation.time)?.endTime;
  const end = timeToMinutes(reservation.endTime ?? fallbackEnd) ?? (conservative && !reservation.endTime ? 24 * 60 : null);
  if (!validDate(reservation.date) || start === null || end === null || end <= start) return null;
  return { start, end };
}

export function isValidReservation(reservation: Entity) {
  return reservationRange(reservation) !== null;
}

export function reservationEndsAt(reservation: Entity) {
  const range = reservationRange(reservation);
  if (!range) return null;
  const endTime = reservation.endTime ?? SUM_SLOTS.find(slot => slot.time === reservation.time)?.endTime;
  if (!endTime) return null;
  return new Date(`${reservation.date}T${endTime}:00`).getTime();
}

export function reservationsOverlap(first: Entity, second: Entity) {
  if (first.date !== second.date) return false;
  const firstRange = reservationRange(first);
  const secondRange = reservationRange(second, true);
  return !!firstRange && !!secondRange && firstRange.start < secondRange.end && secondRange.start < firstRange.end;
}

export function slotUnavailable(date: string, time: string, reservations: Entity[], settings: Settings, now = new Date()) {
  const slot = SUM_SLOTS.find(item => item.time === time);
  if (!validDate(date)) return 'Elegí una fecha válida.';
  if (!slot) return 'Elegí un horario.';
  if (new Date(`${date}T${time}:00`).getTime() <= now.getTime()) return 'Este horario ya pasó.';
  if (settings.blockedDates.includes(date)) return 'Fecha bloqueada por administración.';
  const candidate = { id: 'candidate', title: '', description: '', date, time: slot.time, endTime: slot.endTime };
  if (reservations.some(item => activeReservation(item) && reservationsOverlap(candidate, item))) {
    return 'Horario reservado.';
  }
  return '';
}

export function bookingError(date: string, time: string, unit: string, accepted: boolean, reservations: Entity[], settings: Settings) {
  if (!unit.trim()) return 'Indicá la unidad.';
  if (!accepted) return 'Aceptá el reglamento para continuar.';
  if (!settings.rules.trim()) return 'Administración debe cargar el reglamento antes de reservar.';
  return slotUnavailable(date, time, reservations, settings);
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
