import type { Entity } from '../../lib/types';
import { localDate, money, today } from '../../lib/utils';

export const categories = ['Expensas', 'Mantenimiento', 'Servicios', 'Personal', 'Seguros', 'Administración', 'Obras', 'Otros'];
export const budgetStatuses = ['Borrador', 'En evaluación', 'Aprobado', 'Rechazado', 'Finalizado'];
export const currentPeriod = () => today().slice(0, 7);
export function monthOffset(offset: number) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return localDate(date).slice(0, 7);
}
export function periodLabel(period: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
    ? new Date(`${period}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    : period;
}
export const entityPeriod = (item: Entity) => item.period || item.date.slice(0, 7);
export const cents = (amount: number) => Math.round(amount * 100);
export const formatAmount = (amount: number) => cents(amount) % 100 === 0 ? money(amount) : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
export const sumAmounts = (items: Entity[]) => items.reduce((sum, item) => sum + cents(item.amount || 0), 0) / 100;
export const signedTotal = (items: Entity[]) => items.reduce((sum, item) => sum + cents(item.amount || 0) * (item.type === 'Ingreso' ? 1 : -1), 0) / 100;
export function availablePeriods(items: Entity[]) {
  return [...new Set([currentPeriod(), ...items.map(entityPeriod)])].filter(Boolean).sort().reverse();
}
export const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value <= 1e12 && Math.abs(value * 100 - Math.round(value * 100)) < 0.001 ? Math.round(value * 100) / 100 : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^(?:ARS\s*|\$\s*)/i, '').replace(/\s/g, '');
  let normalized: string;
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(text)) normalized = text;
  else return null;
  return parseAmount(Number(normalized));
}

export function parseDate(value: unknown, date1904 = false): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : parseDate(localDate(value));
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < (date1904 ? 0 : 1) || value > 2958465 || (!date1904 && value === 60)) return null;
    const days = date1904 ? value + 1462 : value < 60 ? value + 1 : value;
    const date = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
    return parseDate(date.toISOString().slice(0, 10));
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const ar = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (!iso && !ar) return null;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(ar![3]), Number(ar![2]), Number(ar![1])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseType(value: unknown): 'Ingreso' | 'Egreso' | null {
  const type = normalizeText(String(value ?? ''));
  if (['ingreso', 'ingresos', 'credito', 'cobro', 'entrada'].includes(type)) return 'Ingreso';
  if (['egreso', 'egresos', 'debito', 'gasto', 'pago', 'salida'].includes(type)) return 'Egreso';
  return null;
}
export function movementKey(item: Pick<Entity, 'date' | 'title' | 'type' | 'amount'>) {
  return JSON.stringify([item.date, normalizeText(item.title), item.type, cents(item.amount || 0)]);
}

export const importFields = ['date', 'title', 'type', 'category', 'amount'] as const;
export type ImportField = typeof importFields[number];
export type ColumnMapping = Record<ImportField, number>;
export const fieldLabels: Record<ImportField, string> = { date: 'Fecha', title: 'Concepto', type: 'Tipo', category: 'Categoría', amount: 'Importe' };
export function suggestMapping(headers: unknown[]): ColumnMapping {
  const aliases: Record<ImportField, string[]> = {
    date: ['fecha', 'date'], title: ['concepto', 'descripcion', 'detalle', 'title'],
    type: ['tipo', 'type', 'movimiento'], category: ['categoria', 'category', 'rubro'], amount: ['importe', 'monto', 'amount', 'valor'],
  };
  return Object.fromEntries(importFields.map(field => [field, headers.findIndex(header => aliases[field].includes(normalizeText(String(header ?? ''))))])) as ColumnMapping;
}
export interface ImportRow { row: number; item?: Omit<Entity, 'id'>; errors: string[]; duplicate: boolean }
export function validateRows(rows: unknown[][], mapping: ColumnMapping, existing: Entity[], firstRow = 2, date1904 = false): ImportRow[] {
  const seen = new Set(existing.map(movementKey));
  return rows.flatMap<ImportRow>((cells, index) => {
    if (cells.every(cell => cell == null || String(cell).trim() === '')) return [];
    const date = parseDate(cells[mapping.date], date1904);
    const amount = parseAmount(cells[mapping.amount]);
    const type = parseType(cells[mapping.type]);
    const title = String(cells[mapping.title] ?? '').trim();
    const rawCategory = String(cells[mapping.category] ?? '').trim();
    const category = [...categories, ...existing.map(item => item.category || '')].find(value => normalizeText(value) === normalizeText(rawCategory)) || rawCategory;
    const errors = [!date && 'Fecha inválida (DD/MM/AAAA)', amount === null && 'Importe positivo con hasta 2 decimales', !type && 'Tipo: Ingreso o Egreso', (!title || title.length > 240) && 'Concepto obligatorio, hasta 240 caracteres', (!category || category.length > 80) && 'Categoría obligatoria, hasta 80 caracteres'].filter((error): error is string => Boolean(error));
    if (errors.length) return [{ row: firstRow + index, errors, duplicate: false }];
    const item = { title, description: '', date: date!, amount: amount!, type: type!, category };
    const key = movementKey(item);
    const duplicate = seen.has(key);
    seen.add(key);
    return [{ row: firstRow + index, item, duplicate, errors: duplicate ? ['Movimiento duplicado'] : [] }];
  });
}
