import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Building2, LockKeyhole, LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { productionPortal, serverLogin, serverLogout, serverUser } from '../../lib/api';

export const ADMIN_SESSION_KEY = 'portal-edificio-admin-session-v1';
const ADMIN_AUTH_EVENT = 'portal-edificio-admin-auth-change';

export function isAdminAuthenticated() {
  if (productionPortal) return serverUser()?.role === 'admin';
  return typeof window !== 'undefined' && window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'authenticated';
}

export function logoutAdmin() {
  if (productionPortal) { void serverLogout().catch(error => window.alert(error.message)); return; }
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  useEffect(() => {
    const refresh = () => setAuthenticated(isAdminAuthenticated());
    window.addEventListener(ADMIN_AUTH_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_AUTH_EVENT, refresh);
  }, []);
  if (!authenticated) return <AdminLoginPage onAuthenticated={() => setAuthenticated(true)} />;
  return <>{children}</>;
}

function AdminLoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (productionPortal) {
      setBusy(true); setError('');
      try {
        const user = await serverLogin(username.trim(), password);
        if (user.role !== 'admin') throw new Error('Esta cuenta no tiene permisos de Administración.');
        onAuthenticated();
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo ingresar.'); }
      finally { setBusy(false); }
      return;
    }
    if (username.trim() !== 'admin' || password !== 'admin') {
      setError('El usuario o la contraseña no son correctos.');
      return;
    }
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'authenticated');
    setError('');
    onAuthenticated();
  }

  return <div className="admin-login-page">
    <main className="admin-login-card" aria-labelledby="admin-login-title">
      <div className="admin-login-brand"><span className="brand-mark"><Building2 size={25} /></span><span><strong>Edificio 13 y 34</strong><small>Panel de administración</small></span></div>
      <div className="admin-login-heading"><LockKeyhole size={23} /><div><h1 id="admin-login-title">Ingresar a administración</h1><p>Accedé al panel de gestión del edificio.</p></div></div>
      <form className="admin-login-form" onSubmit={submit}>
        <label className="field"><span>{productionPortal ? 'Email' : 'Usuario'}</span><input aria-label={productionPortal ? 'Email' : 'Usuario'} type={productionPortal ? 'email' : 'text'} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label>
        <label className="field"><span>Contraseña</span><input aria-label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {error && <p className="admin-login-error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy}><LogIn size={18} />{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      {!productionPortal && <p className="admin-login-demo"><strong>Acceso de demostración</strong><br />Usuario: <code>admin</code> · Contraseña: <code>admin</code></p>}
      <Link className="admin-login-back" to="/" state={{ from: location.pathname }}>Volver al sitio público</Link>
    </main>
  </div>;
}
