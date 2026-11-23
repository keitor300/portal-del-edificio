import type { Attachment, DemoData } from './types';

export const productionPortal = import.meta.env?.VITE_PORTAL_MODE === 'production';
export const SESSION_EVENT = 'portal-server-session-change';
export interface ServerUser { id: string; name: string; email: string; unit: string | null; role: 'owner' | 'admin'; status: string }
let sessionUser: ServerUser | null = null;
let sessionRevision = 0;
export function serverUser() { return sessionUser; }
export function setServerUser(user: ServerUser | null) {
  sessionRevision++;
  sessionUser = user;
  window.dispatchEvent(new Event(SESSION_EVENT));
  window.dispatchEvent(new Event('portal-owner-access-change'));
  window.dispatchEvent(new Event('portal-edificio-admin-auth-change'));
}
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function api<T>(path: string, method = 'GET', value?: unknown): Promise<T> {
  const revision = sessionRevision;
  let response: Response;
  try {
    response = await fetch(path, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: value === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: value === undefined ? undefined : JSON.stringify(value),
      signal: AbortSignal.timeout(30000),
    });
  } catch { throw new ApiError(0, 'No pudimos conectar. Revisá tu conexión y volvé a intentar.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError(response.status, 'La respuesta del servidor no es válida. Volvé a intentar.'); }
  if (!response.ok) {
    if (response.status === 401 && sessionUser && revision === sessionRevision && path !== '/api/auth/login') setServerUser(null);
    throw new ApiError(response.status, data.error || 'No se pudo completar la operación.');
  }
  return data as T;
}
export async function refreshSession() {
  const revision = sessionRevision;
  const { user } = await api<{ user: ServerUser | null }>('/api/auth/session');
  if (revision !== sessionRevision) return sessionUser;
  if (JSON.stringify(user) !== JSON.stringify(sessionUser)) setServerUser(user);
  return user;
}
export async function serverLogin(identity: string, password: string) {
  const { user } = await api<{ user: ServerUser }>('/api/auth/login', 'POST', { identity, password });
  setServerUser(user);
  return user;
}
export async function serverLogout() {
  await api('/api/auth/logout', 'POST', {});
  setServerUser(null);
}
export async function uploadAttachment(attachment: Attachment | undefined, unit?: string | null) {
  if (!attachment || attachment.url.startsWith('/api/files/')) return attachment;
  return api<Attachment>('/api/files', 'POST', { ...attachment, unit });
}
export function emptyData(): DemoData {
  return { notices: [], movements: [], expenses: [], budgets: [], documents: [], meetings: [], topics: [], polls: [], reservations: [], issues: [], works: [], listings: [], lost: [], contacts: [], faqs: [], statuses: [], messages: [], settings: { rules: '', blockedDates: [], openingBalance: 0, seedDate: '' } };
}
