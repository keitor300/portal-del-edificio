import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Check, Clock3, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { Field, PageHeader } from '../../components/UI';
import { BUILDING_UNITS } from '../services/model';
import { ACCESS_EVENT, accounts, ownerDestination, passwordHash, saveAccounts, signedOwner, startOwnerSession, type OwnerAccount } from './ownerAccounts';

function useAccessRefresh() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('storage', update);
    window.addEventListener(ACCESS_EVENT, update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener(ACCESS_EVENT, update); };
  }, []);
}
export function OwnerGate({ children }: { children: ReactNode }) {
  useAccessRefresh();
  const location = useLocation();
  return signedOwner() ? <>{children}</> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
}
export function OwnerSessionButton() {
  useAccessRefresh();
  const owner = signedOwner();
  return <span className="owner-account-label">{owner ? `${owner.name} · Unidad ${owner.unit}` : 'Propietario'}</span>;
}
export function OwnerLoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = ownerDestination(params.get('next'));
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [dni, setDni] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recovery, setRecovery] = useState('');
  const [issuedRecovery, setIssuedRecovery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function switchMode(value: typeof mode) { setMode(value); setError(''); setMessage(''); setPassword(''); setConfirmation(''); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const normalized = dni.replace(/[.\s]/g, '');
      if (!/^\d{7,8}$/.test(normalized)) throw new Error('Ingresá un DNI de 7 u 8 números, sin puntos.');
      const existing = accounts().find(item => item.dni === normalized);
      if (mode === 'register') {
        if (!name.trim() || !BUILDING_UNITS.some(value => value === unit)) throw new Error('Completá tu nombre y elegí tu unidad.');
        if (existing) throw new Error('Este DNI ya tiene una solicitud. Ingresá para consultar su estado.');
        if (password.length < 8 || password !== confirmation) throw new Error('Usá al menos 8 caracteres y repetí la misma contraseña.');
        const salt = crypto.randomUUID();
        const recoveryCode = crypto.randomUUID();
        const record: OwnerAccount = {id:crypto.randomUUID(), dni:normalized, name:name.trim(), unit, salt, hash:await passwordHash(password,salt), recoveryHash:await passwordHash(recoveryCode,salt), status:'Pendiente', created:new Date().toISOString()};
        if (accounts().some(item => item.dni === normalized)) throw new Error('Este DNI ya está registrado.');
        saveAccounts([...accounts(), record]);
        setIssuedRecovery(recoveryCode); setMode('login'); setPassword(''); setConfirmation('');
        setMessage('Solicitud enviada. Administración debe aprobar tu acceso antes de que puedas ingresar.');
      } else if (mode === 'recover') {
        if (!existing || await passwordHash(recovery.trim(), existing.salt) !== existing.recoveryHash) throw new Error('El DNI o la clave de recuperación no son correctos.');
        if (password.length < 8 || password !== confirmation) throw new Error('Usá al menos 8 caracteres y repetí la misma contraseña.');
        const hash = await passwordHash(password, existing.salt);
        saveAccounts(accounts().map(item => item.id === existing.id ? {...item, hash} : item));
        setMode('login'); setPassword(''); setConfirmation(''); setMessage('Contraseña actualizada. Ya podés ingresar si tu solicitud está aprobada.');
      } else {
        if (!existing || await passwordHash(password, existing.salt) !== existing.hash) throw new Error('El DNI o la contraseña no son correctos.');
        const current = accounts().find(item => item.id === existing.id);
        if (current?.status !== 'Aprobado') { setMessage(current?.status === 'Pendiente' ? 'Tu solicitud está pendiente de aprobación por Administración.' : 'Tu acceso no está habilitado. Consultá con Administración.'); return; }
        startOwnerSession(current); navigate(next, {replace:true});
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-login-page"><main className="admin-login-card owner-login-card">
    <Link to="/" className="admin-login-brand"><span className="brand-mark"><Building2 size={26}/></span><span><strong>Edificio 13 y 34</strong><small>Acceso de propietarios</small></span></Link>
    <div className="admin-login-heading"><ShieldCheck size={28}/><div><h1>{mode === 'register' ? 'Solicitar acceso' : mode === 'recover' ? 'Recuperar contraseña' : 'Bienvenido a tu edificio'}</h1><p>{mode === 'register' ? 'Administración verificará tu DNI y tu unidad.' : 'Tu usuario es tu DNI.'}</p></div></div>
    <p className="access-demo-note">Demostración local. Usá datos ficticios. El registro y la aprobación funcionan únicamente en este navegador; no se comparten entre dispositivos.</p>
    {message && <div className="access-feedback" role="status"><Clock3 size={22}/><p>{message}</p></div>}
    {issuedRecovery && <div className="access-recovery"><strong>Tu clave de recuperación</strong><code>{issuedRecovery}</code><p>Guardala para recuperar tu contraseña en esta demostración.</p></div>}
    <form className="admin-login-form" onSubmit={submit}>
      {mode === 'register' && <Field label="Nombre y apellido"><input required autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)}/></Field>}
      <Field label="DNI (usuario)"><input required inputMode="numeric" autoComplete="username" maxLength={12} value={dni} onChange={event => setDni(event.target.value)}/></Field>
      {mode === 'register' && <Field label="Unidad"><select aria-label="Unidad" required value={unit} onChange={event => setUnit(event.target.value)}><option value="">Elegí tu unidad</option>{BUILDING_UNITS.map(value => <option key={value} value={value}>Unidad {value}</option>)}</select></Field>}
      {mode === 'recover' && <Field label="Clave de recuperación"><input required value={recovery} onChange={event => setRecovery(event.target.value)}/></Field>}
      <Field label={mode === 'recover' ? 'Nueva contraseña' : 'Contraseña'} hint={mode !== 'login' ? 'Al menos 8 caracteres.' : undefined}><input aria-label={mode === 'recover' ? 'Nueva contraseña' : 'Contraseña'} required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} value={password} onChange={event => setPassword(event.target.value)}/></Field>
      {mode !== 'login' && <Field label="Repetir contraseña"><input required type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)}/></Field>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}
      <button className="button" disabled={busy}><LogIn size={20}/>{busy ? 'Procesando…' : mode === 'register' ? 'Enviar solicitud' : mode === 'recover' ? 'Guardar contraseña' : 'Ingresar'}</button>
    </form>
    <div className="access-secondary-actions">{mode === 'login' ? <><button className="button secondary" onClick={() => switchMode('register')}><UserPlus size={20}/>Solicitar acceso</button><button className="button secondary" onClick={() => switchMode('recover')}>Olvidé mi contraseña</button></> : <button className="button secondary" onClick={() => switchMode('login')}>Volver al ingreso</button>}<Link to="/">Volver al inicio</Link></div>
  </main></div>;
}
export function OwnerAccessAdminPage() {
  useAccessRefresh();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todas');
  const items = accounts();
  function change(account: OwnerAccount, status: OwnerAccount['status']) {
    if (!window.confirm(`${status === 'Aprobado' ? 'Aprobar' : status === 'Rechazado' ? 'Rechazar' : 'Suspender'} el acceso de ${account.name}, unidad ${account.unit}?`)) return;
    try { saveAccounts(accounts().map(item => item.id === account.id ? {...item, status} : item)); setError(''); } catch { setError('No se pudo guardar el cambio.'); }
  }
  return <><PageHeader title="Accesos de propietarios" description="Revisá el DNI y la unidad antes de habilitar una cuenta."/><p className="access-demo-note">Demostración: solo aparecen las solicitudes realizadas en este navegador. No ingreses datos personales reales.</p><div className="access-feedback"><UserPlus size={24}/><strong>{items.filter(item => item.status === 'Pendiente').length} solicitudes pendientes</strong></div><Field label="Ver solicitudes"><select value={filter} onChange={event => setFilter(event.target.value)}>{['Todas','Pendiente','Aprobado','Rechazado','Suspendido'].map(value => <option key={value}>{value}</option>)}</select></Field>{error && <p role="alert">{error}</p>}<div className="access-requests">{items.filter(item => filter === 'Todas' || item.status === filter).map(account => <article className="access-request" key={account.id}><span className={`status ${account.status === 'Aprobado' ? 'status-green' : 'status-amber'}`}>{account.status}</span><h2>{account.name}</h2><p>Unidad <strong>{account.unit}</strong> · DNI {account.dni}</p><small>Solicitud del {new Date(account.created).toLocaleDateString('es-AR')}</small><div className="access-request-actions">{account.status !== 'Aprobado' && <button className="button" onClick={() => change(account,'Aprobado')}><Check size={18}/>Aprobar acceso</button>}{account.status === 'Pendiente' && <button className="button secondary" onClick={() => change(account,'Rechazado')}>Rechazar</button>}{account.status === 'Aprobado' && <button className="button secondary" onClick={() => change(account,'Suspendido')}>Suspender acceso</button>}</div></article>)}</div>{!items.some(item => filter === 'Todas' || item.status === filter) && <p className="empty">No hay solicitudes en esta lista.</p>}</>;
}
