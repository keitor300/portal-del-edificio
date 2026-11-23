import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '../../components/UI';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { api } from '../../lib/api';

export function PasswordReset({token,onDone}:{token:string;onDone:(message:string)=>void}) {
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [error,setError]=useState('');
  const action=useAsyncAction();
  useEffect(()=>{window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);},[]);
  function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(password!==confirmation){setError('Repetí la misma contraseña en ambos campos.');return;}
    void action.run(async()=>{
      const response=await api<{message:string}>('/api/auth/recovery/reset','POST',{token,password});
      onDone(response.message);
    });
  }
  return <main className="admin-login-page"><section className="admin-login-card"><h1>Elegí tu nueva contraseña</h1><p>El enlace se puede usar una sola vez. Al guardar, se cerrarán las sesiones anteriores de tu cuenta.</p>
    <form className="admin-login-form" onSubmit={submit}>
      <Field label="Nueva contraseña" hint="Entre 12 y 128 caracteres."><input aria-label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></Field>
      <Field label="Repetir contraseña"><input type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></Field>
      {(error||action.error)&&<p role="alert" className="error">{error||action.error}</p>}
      <button className="button" disabled={action.busy}>{action.busy?'Guardando…':'Guardar nueva contraseña'}</button>
      <button type="button" className="button secondary" disabled={action.busy} onClick={()=>onDone('')}>Volver al ingreso</button>
    </form>
  </section></main>;
}
