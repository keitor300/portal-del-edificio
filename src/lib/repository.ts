import type { DemoData, Entity, Message, Settings } from './types';
import { makeSeed } from '../data/seed';

export const DEMO_STORAGE_KEY = 'portal-edificio-demo-v1';
export interface DemoRepository { load():DemoData|null; save(data:DemoData):void }

const COLLECTIONS = ['notices', 'movements', 'expenses', 'budgets', 'documents', 'meetings', 'topics', 'polls', 'reservations', 'issues', 'works', 'listings', 'lost', 'contacts', 'faqs', 'statuses'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}

function normalizeEntity(value: unknown, fallback: Entity): Entity | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : fallback.id;
  const date = typeof value.date === 'string' && validDate(value.date) ? value.date : fallback.date;
  if (!id || !date) return null;
  return {
    ...fallback,
    ...value,
    id,
    title: typeof value.title === 'string' ? value.title : fallback.title,
    description: typeof value.description === 'string' ? value.description : fallback.description,
    date,
  } as Entity;
}

function normalizeMessages(value: unknown, fallback: Message[]): Message[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter(isRecord).map((item, index) => {
    const seed = fallback[index] ?? { id: `chat-${index + 1}`, author: 'Administración', text: '', date: fallback[0]?.date ?? '' };
    return { ...seed, ...item, id: typeof item.id === 'string' && item.id ? item.id : seed.id, author: typeof item.author === 'string' ? item.author : seed.author, text: typeof item.text === 'string' ? item.text : seed.text, date: validDate(item.date) ? item.date : seed.date } as Message;
  }).filter(item => item.date);
}

function normalizeSettings(value: unknown, fallback: Settings): Settings {
  const raw = isRecord(value) ? value : {};
  const blockedDates = Array.isArray(raw.blockedDates) ? raw.blockedDates.filter(validDate) as string[] : fallback.blockedDates;
  return {
    rules: typeof raw.rules === 'string' ? raw.rules : fallback.rules,
    blockedDates: [...new Set(blockedDates)].sort(),
    openingBalance: typeof raw.openingBalance === 'number' && Number.isFinite(raw.openingBalance) ? raw.openingBalance : fallback.openingBalance,
    seedDate: validDate(raw.seedDate) ? raw.seedDate as string : fallback.seedDate,
  };
}

export function normalizeDemoData(value: unknown, fallback = makeSeed()): DemoData {
  const raw = isRecord(value) ? value : {};
  const data = {} as DemoData;
  for (const key of COLLECTIONS) {
    const source = Array.isArray(raw[key]) ? raw[key] : [];
    const seed = fallback[key];
    data[key] = source.map((item, index) => normalizeEntity(item, seed[index] ?? { id: `${key}-${index + 1}`, title: '', description: '', date: fallback.settings.seedDate })).filter((item): item is Entity => !!item);
    if (!source.length) data[key] = seed.map(item => ({ ...item }));
  }
  data.messages = normalizeMessages(raw.messages, fallback.messages);
  data.settings = normalizeSettings(raw.settings, fallback.settings);
  return data;
}

export const repository:DemoRepository={
  load(){
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (value.version !== 1 || !isRecord(value.data)) return null;
      return normalizeDemoData(value.data);
    } catch { return null; }
  },
  save(data){ localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify({version:1,data})); },
};
