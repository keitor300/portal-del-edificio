export const ACCOUNTS_KEY = 'portal-owner-accounts-demo-v1';
const SESSION_KEY = 'portal-owner-session-demo-v1';
export const ACCESS_EVENT = 'portal-owner-access-change';
export type OwnerAccount = { id: string; dni: string; name: string; unit: string; salt: string; hash: string; recoveryHash: string; status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Suspendido'; created: string };
export function accounts(): OwnerAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
}
export function saveAccounts(items: OwnerAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:210000, hash:'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
export function signedOwner() {
  const account = accounts().find(item => item.id === sessionStorage.getItem(SESSION_KEY));
  return account?.status === 'Aprobado' ? account : undefined;
}
export function currentOwnerUnit() { return signedOwner()?.unit || '7B'; }
export function startOwnerSession(account: OwnerAccount) {
  sessionStorage.setItem(SESSION_KEY, account.id);
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export function logoutOwner() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
export function ownerDestination(value: string | null) {
  return value && /^\/demo\/propietario(?:\/[^?#]*)?$/.test(value) ? value : '/demo/propietario';
}
