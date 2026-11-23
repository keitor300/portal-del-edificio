import { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, KeyRound, Copy } from 'lucide-react';
import { Field, Modal, PageHeader } from '../../components/UI';
import { api } from '../../lib/api';
import { useAsyncAction } from '../../hooks/useAsyncAction';

interface AccessRequest { id:string; name:string; email:string; dni:string; unit:string; status:'pending'|'approved'|'rejected'|'suspended'; created_at:string; recovery_requested_at?:number }
const labels = { pending:'Pendiente', approved:'Aprobado', rejected:'Rechazado', suspended:'Suspendido' };
export function ProductionAccessAdmin() {
  const [items,setItems]=useState<AccessRequest[]>([]);
  const [filter,setFilter]=useState('pending');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [recovering,setRecovering]=useState<AccessRequest>();
  const visible=items.filter(item=>!filter||(filter==='recovery'?!!item.recovery_requested_at:item.status===filter));
  const load=useCallback(async()=>{
    try { const response=await api<{users:AccessRequest[]}>('/api/admin/access');setItems(response.users);setError(''); }
    catch(cause){setError((cause as Error).message);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer);},[load]);
  async function change(account:AccessRequest,status:AccessRequest['status']) {
    if(busy||!window.confirm(`${labels[status]}: ¿confirmás el cambio para ${account.name}, unidad ${account.unit}?`))return;
    setBusy(account.id);setError('');
    try{await api(`/api/admin/access/${account.id}`,'PATCH',{status});await load();}
    catch(cause){setError((cause as Error).message);}
    finally{setBusy('');}
  }
  return <><PageHeader title="Accesos de propietarios" description="Revisá los datos y habilitá el acceso de cada unidad."/>
    <div className="access-feedback"><UserPlus size={24}/><strong>{items.filter(item=>item.status==='pending').length} solicitudes pendientes</strong></div>
    {items.some(item=>item.recovery_requested_at)&&<button className="button secondary" onClick={()=>setFilter('recovery')}><KeyRound size={20}/>{items.filter(item=>item.recovery_requested_at).length} solicitudes de recuperación</button>}
    <Field label="Ver solicitudes"><select value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Todas</option><option value="recovery">Recuperar acceso</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
    {error&&<p role="alert" className="error">{error} <button className="button secondary" onClick={()=>void load()}>Volver a intentar</button></p>}
    {loading?<p role="status">Cargando solicitudes…</p>:<div className="access-requests">{visible.map(account=><article className="access-request" key={account.id}>
      <span className={`status ${account.status==='approved'?'status-green':'status-amber'}`}>{labels[account.status]}</span><h2>{account.name}</h2><p className="access-request-unit">Unidad <strong>{account.unit}</strong></p>
      <dl className="access-request-details"><div><dt>DNI</dt><dd>{account.dni}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div></dl>
      <small>Solicitud del {new Date(account.created_at).toLocaleDateString('es-AR')}</small>
      {account.recovery_requested_at&&<p className="status status-amber">Solicitó recuperar el acceso el {new Date(account.recovery_requested_at).toLocaleDateString('es-AR')}</p>}
      <div className="access-request-actions">{account.status!=='approved'&&<button className="button" disabled={!!busy} onClick={()=>void change(account,'approved')}><Check size={18}/>Aprobar acceso</button>}
      {account.status==='pending'&&<button className="button secondary" disabled={!!busy} onClick={()=>void change(account,'rejected')}>Rechazar</button>}
      {account.status==='approved'&&<><button className="button secondary" disabled={!!busy} onClick={()=>setRecovering(account)}><KeyRound size={18}/>Recuperar acceso</button><button className="button secondary" disabled={!!busy} onClick={()=>void change(account,'suspended')}>Suspender acceso</button></>}</div>
    </article>)}</div>}
    {!loading&&!error&&!visible.length&&<p className="empty">No hay solicitudes en esta lista.</p>}
    {recovering&&<RecoveryLink account={recovering} onClose={()=>{setRecovering(undefined);void load();}}/>}
  </>;
}

function RecoveryLink({account,onClose}:{account:AccessRequest;onClose:()=>void}){
  const action=useAsyncAction();
  const [password,setPassword]=useState('');
  const [verified,setVerified]=useState(false);
  const [link,setLink]=useState('');
  const [expires,setExpires]=useState(0);
  const [copied,setCopied]=useState(false);
  return <Modal title={`Recuperar acceso · Unidad ${account.unit}`} onClose={()=>{if(!action.isPending())onClose();}}>
    <p>Propietario: <strong>{account.name}</strong><br/>Email registrado: {account.email}</p>
    {link?<><p>Compartí el enlace únicamente con esta persona, por el email registrado o un medio que hayas verificado. No se envía automáticamente.</p><Field label="Enlace de recuperación"><input readOnly type="text" value={link} onFocus={event=>event.currentTarget.select()}/></Field><p>Vence a las {new Date(expires).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}. Solo se puede usar una vez.</p><button className="button" disabled={action.busy} onClick={()=>void action.run(async()=>{await navigator.clipboard.writeText(link);setCopied(true);})}><Copy size={18}/>{copied?'Enlace copiado':'Copiar enlace'}</button></>:<form className="admin-login-form" onSubmit={event=>{event.preventDefault();void action.run(async()=>{
      const result=await api<{path:string;expiresAt:number}>(`/api/admin/access/${account.id}/recovery`,'POST',{password,verified});
      setPassword('');setLink(new URL(result.path,window.location.origin).href);setExpires(result.expiresAt);
    });}}>
      <label className="check-field"><input type="checkbox" required checked={verified} onChange={event=>setVerified(event.target.checked)}/>Verifiqué la identidad de este propietario por un medio conocido.</label>
      <Field label="Tu contraseña de administración"><input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></Field>
      <button className="button" disabled={action.busy||!verified}>{action.busy?'Generando…':'Generar enlace temporal'}</button>
    </form>}
    {action.error&&<p role="alert" className="error">{action.error}</p>}
  </Modal>;
}
