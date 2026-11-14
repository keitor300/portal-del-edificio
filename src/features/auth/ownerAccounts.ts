export const ACCOUNTS_KEY = 'portal-owner-accounts-demo-v1';
const SESSION_KEY = 'portal-owner-session-demo-v1';
export const ACCESS_EVENT = 'portal-owner-access-change';
export type OwnerAccount = { id: string; dni: string; email?: string; name: string; unit: string; salt: string; hash: string; recoveryHash: string; status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Suspendido'; created: string };
export const DEMO_OWNER: OwnerAccount = { id: 'owner-demo-7b', dni: '', name: 'Propietario demo', unit: '7B', salt: '', hash: '', recoveryHash: '', status: 'Aprobado', created: '2026-01-01T00:00:00.000Z' };
export function accounts(): OwnerAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
}
export function saveAccounts(items: OwnerAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export function accountForUnit(unit: string) {
  const normalized = unit.trim().toUpperCase();
  return accounts().find(item => item.unit.trim().toUpperCase() === normalized);
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:210000, hash:'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
export function signedOwner() {
  const sessionId = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (sessionId === DEMO_OWNER.id) return DEMO_OWNER;
  const account = accounts().find(item => item.id === sessionId);
  return account?.status === 'Aprobado' ? account : undefined;
}
export function currentOwnerUnit() { return signedOwner()?.unit || '7B'; }
export function startOwnerSession(account: OwnerAccount) {
  localStorage.setItem(SESSION_KEY, account.id);
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export function startDemoOwnerSession() { startOwnerSession(DEMO_OWNER); }
export function logoutOwner() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export function ownerDestination(value: string | null) {
  return value && /^\/demo\/propietario(?:\/[^?#]*)?$/.test(value) ? value : '/demo/propietario';
}
