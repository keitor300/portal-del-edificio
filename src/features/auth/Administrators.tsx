import { useEffect, useState, type FormEvent } from 'react';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { api, productionPortal, serverUser } from '../../lib/api';
import { Empty, Field, Modal, PageHeader, Status } from '../../components/UI';

type Administrator = { id:string; name:string; email:string; username?:string; status:string; email_sent_at:number|null };
export function AdministratorsPage() {
  const [users,setUsers]=useState<Administrator[]>([]);
  const [name,setName]=useState(''), [email,setEmail]=useState(''), [password,setPassword]=useState('');
  const [error,setError]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false);
  const [confirmation,setConfirmation]=useState<{user:Administrator;resend:boolean}|null>(null);
  async function load(){const result=await api<{users:Administrator[]}>('/api/admin/administrators');setUsers(result.users);}
  useEffect(()=>{if(productionPortal)void load().catch(error=>setError(error.message));},[]);
  async function action(path:string,method:string,payload:object){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try {const result=await api<{message:string}>(path,method,{...payload,password});setMessage(result.message);setPassword('');setConfirmation(null);await load();}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  function invite(event:FormEvent){event.preventDefault();void action('/api/admin/administrators','POST',{name,email});}
  if(!productionPortal)return <><PageHeader title="Administradores" description="Accesos del equipo de administración."/><Empty>Las invitaciones se envían desde el portal real.</Empty></>;
  return <div className="administrators-page"><PageHeader title="Administradores" description="Cada persona entra por /admin con su propia cuenta."/>
    <section className="section"><h2><UserPlus size={24}/> Invitar por correo</h2><p>Recibirá un correo para elegir su contraseña. Después podrá ingresar con su email en /admin. La invitación dura 7 días.</p>
      <form onSubmit={invite} className="admin-login-form">
        <Field label="Nombre"><input required value={name} maxLength={80} onChange={e=>setName(e.target.value)} autoComplete="off"/></Field>
        <Field label="Correo del administrador"><input type="email" required value={email} maxLength={120} onChange={e=>setEmail(e.target.value)} autoComplete="off"/></Field>
        <Field label="Tu contraseña para autorizar"><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></Field>
        <button className="button" disabled={busy}><Mail size={20}/>{busy?'Guardando…':'Enviar invitación'}</button>
      </form>
      {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="access-feedback">{message}</p>}
    </section>
    <section className="section"><h2><ShieldCheck size={24}/> Cuentas de administración</h2><div className="access-requests">{users.map(user=><article className="access-request" key={user.id}>
      <Status tone={user.status==='approved'?'green':'amber'}>{user.status==='approved'?'Activo':user.status==='pending'?'Invitación pendiente':'Suspendido'}</Status>
      <h3>{user.name}{user.id===serverUser()?.id?' (tu cuenta)':''}</h3><p>{user.email}</p>{user.username&&<p>Usuario: {user.username}</p>}
      {user.status==='pending'&&!user.email_sent_at&&<p>El correo todavía no se envió.</p>}
      <div className="form-actions">{user.status==='pending'?<button className="button secondary" disabled={busy} onClick={()=>{setPassword('');setError('');setConfirmation({user,resend:true});}}>Reenviar invitación</button>:user.id!==serverUser()?.id&&<button className="button secondary" disabled={busy} onClick={()=>{setPassword('');setError('');setConfirmation({user,resend:false});}}>{user.status==='approved'?'Suspender acceso':'Habilitar acceso'}</button>}</div>
    </article>)}</div></section>
    {confirmation&&<Modal title={confirmation.resend?'Reenviar invitación':confirmation.user.status==='approved'?'Suspender acceso':'Habilitar acceso'} onClose={()=>{if(!busy){setConfirmation(null);setPassword('');}}} icon={<ShieldCheck size={24}/>}>
      <p>{confirmation.user.name} · {confirmation.user.email}</p>
      <form onSubmit={event=>{event.preventDefault();void action(`/api/admin/administrators/${confirmation.user.id}${confirmation.resend?'/resend':''}`,confirmation.resend?'POST':'PATCH',confirmation.resend?{}:{status:confirmation.user.status==='approved'?'suspended':'approved'});}}>
        <Field label="Tu contraseña para confirmar"><input required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></Field>
        {error&&<p role="alert" className="error">{error}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>{setConfirmation(null);setPassword('');}}>Cancelar</button><button className="button" disabled={busy}>{busy?'Guardando…':'Confirmar'}</button></div>
      </form></Modal>}
    </div>;
}
