import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Check, Clock3, DoorOpen, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { Field, PageHeader } from '../../components/UI';
import { BUILDING_UNITS } from '../services/model';
import { ACCESS_EVENT, accountForUnit, accounts, ownerDestination, passwordHash, saveAccounts, signedOwner, startDemoOwnerSession, startOwnerSession, type OwnerAccount } from './ownerAccounts';
import { api, productionPortal, serverLogin } from '../../lib/api';
import { ProductionAccessAdmin } from './ProductionAccessAdmin';
import { PasswordReset } from './PasswordReset';

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
  const [resetToken,setResetToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('reset'));
  const location=useLocation();
  useEffect(()=>{
    const token=new URLSearchParams(location.hash.slice(1)).get('reset');
    if(token)setResetToken(token);
  },[location.hash]);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = ownerDestination(params.get('next'));
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(() => params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
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
  function enterDemo() { startDemoOwnerSession(); navigate(next, {replace:true}); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      if (productionPortal) {
        if (mode === 'register') {
          if (password !== confirmation) throw new Error('Repetí la misma contraseña en ambos campos.');
          const response = await api<{ message: string }>('/api/auth/register', 'POST', { name, email, unit, password });
          setMessage(response.message); setMode('login'); setPassword(''); setConfirmation('');
        } else if (mode === 'login') {
          await serverLogin(unit, password); navigate(next, { replace: true });
        } else {
          const response=await api<{message:string}>('/api/auth/recovery/request','POST',{unit,email});
          setMessage(response.message);setMode('login');
        }
        return;
      }
      const existing = accountForUnit(unit);
      if (mode === 'register') {
        if (!name.trim() || !BUILDING_UNITS.some(value => value === unit)) throw new Error('Completá tu nombre y elegí tu unidad.');
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Ingresá un email válido.');
        if (existing) throw new Error('Esta unidad ya tiene una solicitud. Ingresá para consultar su estado.');
        if (accounts().some(item => item.email?.toLowerCase() === email.trim().toLowerCase())) throw new Error('Este email ya está registrado en otra unidad.');
        if (password.length < 8 || password !== confirmation) throw new Error('Usá al menos 8 caracteres y repetí la misma contraseña.');
        const salt = crypto.randomUUID();
        const recoveryCode = crypto.randomUUID();
        const record: OwnerAccount = {id:crypto.randomUUID(), email:email.trim().toLowerCase(), name:name.trim(), unit, salt, hash:await passwordHash(password,salt), recoveryHash:await passwordHash(recoveryCode,salt), status:'Pendiente', created:new Date().toISOString()};
        saveAccounts([...accounts(), record]);
        setIssuedRecovery(recoveryCode); setMode('login'); setPassword(''); setConfirmation('');
        setMessage('Solicitud enviada. Administración debe aprobar tu acceso antes de que puedas ingresar.');
      } else if (mode === 'recover') {
        if (!existing || await passwordHash(recovery.trim(), existing.salt) !== existing.recoveryHash) throw new Error('La unidad o la clave de recuperación no son correctas.');
        if (password.length < 8 || password !== confirmation) throw new Error('Usá al menos 8 caracteres y repetí la misma contraseña.');
        const hash = await passwordHash(password, existing.salt);
        saveAccounts(accounts().map(item => item.id === existing.id ? {...item, hash} : item));
        setMode('login'); setPassword(''); setConfirmation(''); setMessage('Contraseña actualizada. Ya podés ingresar si tu solicitud está aprobada.');
      } else {
        if (!existing || await passwordHash(password, existing.salt) !== existing.hash) throw new Error('La unidad o la contraseña no son correctas.');
        const current = accounts().find(item => item.id === existing.id);
        if (current?.status !== 'Aprobado') { setMessage(current?.status === 'Pendiente' ? 'Tu solicitud está pendiente de aprobación por Administración.' : 'Tu acceso no está habilitado. Consultá con Administración.'); return; }
        startOwnerSession(current); navigate(next, {replace:true});
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  if(productionPortal&&resetToken)return <PasswordReset token={resetToken} onDone={message=>{setResetToken(null);setMode('login');setMessage(message);}}/>;
  return <div className="admin-login-page"><main className="admin-login-card owner-login-card">
    <Link to="/" className="admin-login-brand"><span className="brand-mark"><Building2 size={26}/></span><span><strong>Edificio 13 y 34</strong><small>Acceso de propietarios</small></span></Link>
    <div className="admin-login-heading"><ShieldCheck size={28}/><div><h1>{mode === 'register' ? 'Solicitá tu acceso' : mode === 'recover' ? 'Recuperar contraseña' : 'Ingresá a tu cuenta'}</h1><p>{mode === 'register' ? 'Completá tus datos para que Administración verifique la solicitud.' : mode === 'recover' ? productionPortal ? 'Indicá tu unidad y el email registrado. Administración verificará tu identidad para ayudarte a recuperar el acceso.' : 'Elegí tu unidad y usá la clave de recuperación.' : 'Elegí tu unidad y escribí tu contraseña.'}</p></div></div>
    {!productionPortal && mode === 'login' && <section className="access-demo-entry" aria-labelledby="demo-entry-title"><span className="access-demo-entry-icon"><DoorOpen size={25}/></span><div><strong id="demo-entry-title">Entrar a la demostración</strong><p>Accedé ahora como propietario de la Unidad 7B.</p></div><button type="button" className="button" onClick={enterDemo}>Entrar como Unidad 7B</button></section>}
    {!productionPortal && mode === 'login' && <div className="access-login-divider"><span>o ingresá con tu cuenta</span></div>}
    {mode === 'login' && <section className="access-first-time" aria-labelledby="first-time-title"><span className="access-first-time-icon"><UserPlus size={25}/></span><div><strong id="first-time-title">¿Primera vez en el portal?</strong><p>Antes de ingresar, tenés que solicitar el acceso de tu unidad.</p></div><button type="button" className="button secondary" onClick={() => switchMode('register')}>Solicitar acceso</button></section>}
    {mode === 'register' && <ol className="access-register-steps"><li><span>1</span><strong>Completás tus datos</strong></li><li><span>2</span><strong>Administración los revisa</strong></li><li><span>3</span><strong>Ingresás con tu unidad</strong></li></ol>}
    {message && <div className="access-feedback" role="status"><Clock3 size={22}/><p>{message}</p></div>}
    {issuedRecovery && <div className="access-recovery"><strong>Tu clave de recuperación</strong><code>{issuedRecovery}</code><p>Guardala para recuperar tu contraseña en esta demostración.</p></div>}
    <form className="admin-login-form" onSubmit={submit}>
      {mode === 'register' && <Field label="Nombre y apellido"><input required autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)}/></Field>}
      <Field label="Unidad"><select aria-label="Unidad" autoComplete="username" required value={unit} onChange={event => setUnit(event.target.value)}><option value="">Elegí tu unidad</option>{BUILDING_UNITS.map(value => <option key={value} value={value}>Unidad {value}</option>)}</select></Field>
      {mode === 'register' && <Field label="Email"><input required type="email" autoComplete="email" maxLength={120} value={email} onChange={event => setEmail(event.target.value)}/></Field>}
      {mode === 'recover' && productionPortal && <Field label="Email registrado"><input type="email" autoComplete="email" required maxLength={120} value={email} onChange={event=>setEmail(event.target.value)}/></Field>}{mode === 'recover' && !productionPortal && <Field label="Clave de recuperación"><input required value={recovery} onChange={event => setRecovery(event.target.value)}/></Field>}
      {!(productionPortal && mode === 'recover') && <Field label={mode === 'recover' ? 'Nueva contraseña' : 'Contraseña'} hint={mode !== 'login' ? `Al menos ${productionPortal ? 12 : 8} caracteres.` : undefined}><input aria-label={mode === 'recover' ? 'Nueva contraseña' : 'Contraseña'} required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : productionPortal ? 12 : 8} maxLength={productionPortal ? 128 : undefined} value={password} onChange={event => setPassword(event.target.value)}/></Field>}
      {mode !== 'login' && !(productionPortal && mode === 'recover') && <Field label="Repetir contraseña"><input required type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)}/></Field>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}
      <button className="button" disabled={busy}><LogIn size={20}/>{busy ? 'Procesando…' : mode === 'register' ? 'Enviar solicitud' : mode === 'recover' ? productionPortal ? 'Solicitar ayuda para ingresar' : 'Guardar contraseña' : 'Ingresar'}</button>
    </form>
    <div className="access-secondary-actions">{mode === 'login' ? <button type="button" className="access-text-button" onClick={() => switchMode('recover')}>Olvidé mi contraseña</button> : <button type="button" className="button secondary" onClick={() => switchMode('login')}>Volver al ingreso</button>}<Link to="/">Volver al inicio</Link></div>
    {!productionPortal && <p className="access-demo-note access-demo-note-compact">Demostración local: usá datos ficticios. Las solicitudes se guardan únicamente en este navegador.</p>}
  </main></div>;
}
export function OwnerAccessAdminPage() {
  return productionPortal ? <ProductionAccessAdmin /> : <DemoOwnerAccessAdminPage />;
}
function DemoOwnerAccessAdminPage() {
  useAccessRefresh();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todas');
  const items = accounts();
  function change(account: OwnerAccount, status: OwnerAccount['status']) {
    if (!window.confirm(`${status === 'Aprobado' ? 'Aprobar' : status === 'Rechazado' ? 'Rechazar' : 'Suspender'} el acceso de ${account.name}, unidad ${account.unit}?`)) return;
    try { saveAccounts(accounts().map(item => item.id === account.id ? {...item, status} : item)); setError(''); } catch { setError('No se pudo guardar el cambio.'); }
  }
  return <><PageHeader title="Accesos de propietarios" description="Revisá la unidad y el email antes de habilitar una cuenta."/><p className="access-demo-note">Demostración: solo aparecen las solicitudes realizadas en este navegador. No ingreses datos personales reales.</p><div className="access-feedback"><UserPlus size={24}/><strong>{items.filter(item => item.status === 'Pendiente').length} solicitudes pendientes</strong></div><Field label="Ver solicitudes"><select value={filter} onChange={event => setFilter(event.target.value)}>{['Todas','Pendiente','Aprobado','Rechazado','Suspendido'].map(value => <option key={value}>{value}</option>)}</select></Field>{error && <p role="alert">{error}</p>}<div className="access-requests">{items.filter(item => filter === 'Todas' || item.status === filter).map(account => <article className="access-request" key={account.id}><span className={`status ${account.status === 'Aprobado' ? 'status-green' : 'status-amber'}`}>{account.status}</span><h2>{account.name}</h2><p className="access-request-unit">Unidad <strong>{account.unit}</strong></p><dl className="access-request-details"><div><dt>Email</dt><dd>{account.email || 'No informado'}</dd></div></dl><small>Solicitud del {new Date(account.created).toLocaleDateString('es-AR')}</small><div className="access-request-actions">{account.status !== 'Aprobado' && <button className="button" onClick={() => change(account,'Aprobado')}><Check size={18}/>Aprobar acceso</button>}{account.status === 'Pendiente' && <button className="button secondary" onClick={() => change(account,'Rechazado')}>Rechazar</button>}{account.status === 'Aprobado' && <button className="button secondary" onClick={() => change(account,'Suspendido')}>Suspender acceso</button>}</div></article>)}</div>{!items.some(item => filter === 'Todas' || item.status === filter) && <p className="empty">No hay solicitudes en esta lista.</p>}</>;
}
