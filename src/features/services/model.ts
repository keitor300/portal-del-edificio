import type { DemoData, Entity, Settings } from '../../lib/types';
import { relativeDate, today } from '../../lib/utils';

export const OWNER_UNIT = '7B';
export const ISSUE_CATEGORIES = ['Agua', 'Ascensor', 'Gas', 'Electricidad', 'Limpieza', 'Otro'];
export const ISSUE_STATUSES = ['Recibido', 'En curso', 'Resuelto'];
export const SUM_SLOTS = [
  { time: '10:00', endTime: '15:00', label: '10:00 a 15:00' },
  { time: '17:00', endTime: '22:00', label: '17:00 a 22:00' },
] as const;

export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(date.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(date.slice(5, 7)) && parsed.getDate() === Number(date.slice(8, 10));
}

export const activeReservation = (reservation: Entity) => !['cancelada', 'cancelado', 'cancelled'].includes((reservation.status ?? '').toLowerCase());
export const sameUnit = (unit: string | undefined, expected = OWNER_UNIT) => (unit ?? '').replace(/^unidad\s*/i, '').replace(/\s/g, '').toUpperCase() === expected.toUpperCase();

export function slotUnavailable(date: string, time: string, reservations: Entity[], settings: Settings, now = new Date()) {
  const slot = SUM_SLOTS.find(item => item.time === time);
  if (!validDate(date)) return 'Elegí una fecha válida.';
  if (!slot) return 'Elegí un turno.';
  if (new Date(`${date}T${time}:00`).getTime() <= now.getTime()) return 'Este turno ya pasó.';
  if (settings.blockedDates.includes(date)) return 'Fecha bloqueada por administración.';
  if (reservations.some(item => item.date === date && activeReservation(item) &&
    (!item.time || (item.time < slot.endTime && (item.endTime ?? SUM_SLOTS.find(s => s.time === item.time)?.endTime ?? '23:59') > slot.time)))) {
    return 'Turno reservado.';
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
