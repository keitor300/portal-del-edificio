import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { makeSeed } from '../data/seed';
import { DEMO_STORAGE_KEY, repository } from '../lib/repository';
import type { Collection, DemoData, Entity, Message, Settings } from '../lib/types';
import { api, emptyData, productionPortal, refreshSession, SESSION_EVENT, serverUser, uploadAttachment } from '../lib/api';
interface Portal { data:DemoData; save:(key:Collection,item:Entity)=>void|Promise<void>; remove:(key:Collection,id:string)=>void|Promise<void>; update:(key:Collection,id:string,patch:Partial<Entity>)=>void|Promise<void>; setSettings:(patch:Partial<Settings>)=>void|Promise<void>; sendMessage:(message:Message)=>void|Promise<void>; importMovements?:(requestId:string,items:Entity[])=>Promise<{ids:string[];skipped:number}>; reset:()=>void; notify:(message:string)=>void; toast:string; }
const Context=createContext<Portal|null>(null);
export function PortalProvider({children}:{children:ReactNode}) {
 return productionPortal ? <ServerPortalProvider>{children}</ServerPortalProvider> : <DemoPortalProvider>{children}</DemoPortalProvider>;
}
function DemoPortalProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState<DemoData>(()=>repository.load() ?? makeSeed()); const [toast,setToast]=useState('');
 useEffect(() => {
  function refresh(event: StorageEvent) { if (event.key === DEMO_STORAGE_KEY) setData(repository.load() ?? makeSeed()); }
  window.addEventListener('storage', refresh);
  return () => window.removeEventListener('storage', refresh);
 }, []);
 const notify=useCallback((message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),5500);},[]);
 const commit=useCallback((fn:(previous:DemoData)=>DemoData)=>{setData(previous=>{const next=fn(previous);try{repository.save(next);}catch{window.setTimeout(()=>notify('No se pudo guardar. El almacenamiento está lleno; quitá archivos o restablecé la demo.'),0);return previous;}return next;});},[notify]);
 const save=(key:Collection,item:Entity)=>commit(d=>({...d,[key]:d[key].some(x=>x.id===item.id)?d[key].map(x=>x.id===item.id?item:x):[item,...d[key]]}));
 const remove=(key:Collection,itemId:string)=>commit(d=>({...d,[key]:d[key].filter(x=>x.id!==itemId)}));
 const update=(key:Collection,itemId:string,patch:Partial<Entity>)=>commit(d=>({...d,[key]:d[key].map(x=>x.id===itemId?{...x,...patch}:x)}));
 return <Context.Provider value={{data,save,remove,update,setSettings:patch=>commit(d=>({...d,settings:{...d.settings,...patch}})),sendMessage:message=>commit(d=>({...d,messages:[...d.messages,message]})),reset:()=>{commit(()=>makeSeed());notify('Datos demo restablecidos.');},notify,toast}}>{children}</Context.Provider>;
}
function ServerPortalProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState<DemoData>(emptyData);
 const [toast,setToast]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const generation=useRef(0);
 const advanceGeneration=useCallback(()=>++generation.current,[]);
 const dataRef=useRef(data);
 const notify=useCallback((message:string)=>{ setToast(message); window.setTimeout(()=>setToast(''),5500); },[]);
 const load=useCallback(async()=>{
   const current=generation.current;
   const result=await api<{data:DemoData}>('/api/state');
   if(current===generation.current){dataRef.current=result.data;setData(result.data);}
 },[]);
 const initialize=useCallback(async()=>{
   const current=advanceGeneration();
   setLoading(true);setError('');setData(emptyData());dataRef.current=emptyData();
   try{await refreshSession();await load();if(current===generation.current)setLoading(false);}
   catch(cause){if(current===generation.current){setError((cause as Error).message);setLoading(false);}}
 },[load,advanceGeneration]);
 useEffect(()=>{
   const changed=()=>{void initialize();};
   window.addEventListener(SESSION_EVENT,changed);
   void initialize();
   const refresh=()=>{if(!document.hidden)void refreshSession().then(load).catch(()=>{});};
   const timer=window.setInterval(refresh,15000);
   window.addEventListener('focus',refresh);
   return()=>{advanceGeneration();window.removeEventListener(SESSION_EVENT,changed);window.removeEventListener('focus',refresh);window.clearInterval(timer);};
 },[initialize,load,advanceGeneration]);
 async function mutate(path:string,method:string,value?:unknown){
   await api(path,method,value);
   try{await load();}catch{notify('El cambio se guardó. No pudimos actualizar la vista; recargá la página.');}
 }
 async function entityPayload(key:Collection,item:Entity){
   const privateUnit=['issues','expenses'].includes(key)?item.unit:undefined;
   const attachment=await uploadAttachment(item.attachment,privateUnit);
   return {...item,attachment:attachment ?? null};
 }
 async function save(key:Collection,item:Entity){
   if(key==='reservations'){
     await mutate('/api/reservations','POST',item);return;
   }
   const existing=dataRef.current[key].find(row=>row.id===item.id);
   await mutate(`/api/entities/${key}${existing?`/${item.id}`:''}`,existing?'PATCH':'POST',await entityPayload(key,item));
 }
 async function update(key:Collection,itemId:string,patch:Partial<Entity>){
   const current=dataRef.current[key].find(item=>item.id===itemId);
   if(!current)throw new Error('El registro ya no está disponible. Actualizá la página.');
   if(key==='reservations'){
     if(patch.status!=='Cancelada')throw new Error('Para cambiar el horario, cancelá y creá una reserva nueva.');
     await mutate(`/api/reservations/${itemId}`,'DELETE');return;
   }
   if(key==='polls'&&patch.voted!==undefined){await mutate(`/api/polls/${itemId}/vote`,'POST',{option:patch.voted});return;}
   if(key==='notices'&&patch.read){await mutate(`/api/notices/${itemId}/read`,'POST',{});return;}
   if(key==='topics'&&patch.interested!==undefined){await mutate(`/api/topics/${itemId}/interest`,'POST',{interested:patch.interested});return;}
   if(patch.messages&&patch.status===undefined){
     const added=patch.messages.filter(message=>!(current.messages||[]).some(old=>old.id===message.id));
     if(added.length!==1)throw new Error('Enviá un mensaje por vez.');
     const message=added[0];
     if(key==='topics')await mutate(`/api/topics/${itemId}/comments`,'POST',{text:message.text});
     else if(key==='issues')await mutate('/api/messages','POST',{...message,issueId:itemId,unit:current.unit,attachment:await uploadAttachment(message.attachment,current.unit)});
     else throw new Error('Esta sección no admite mensajes.');
     return;
   }
   await mutate(`/api/entities/${key}/${itemId}`,'PATCH',await entityPayload(key,{...current,...patch}));
 }
 async function sendMessage(message:Message){
   const unit=serverUser()?.role==='admin'?message.unit:serverUser()?.unit;
   await mutate('/api/messages','POST',{...message,unit,attachment:await uploadAttachment(message.attachment,unit)});
 }
 if(loading)return <main className="admin-login-page"><p role="status">Cargando tu portal…</p></main>;
 if(error)return <main className="admin-login-page"><section><h1>No pudimos cargar el portal</h1><p role="alert">{error}</p><button className="button" onClick={()=>void initialize()}>Volver a intentar</button></section></main>;
 return <Context.Provider value={{data,save,update,sendMessage,
   importMovements:async(requestId,items)=>{
     const receipt=await api<{ids:string[];skipped:number}>('/api/import/movements','POST',{id:requestId,items});
     try{await load();}catch{notify('Importación guardada. Recargá para actualizar los movimientos.');}
     return receipt;
   },
   remove:(key,itemId)=>mutate(`/api/entities/${key}/${itemId}`,'DELETE'),
   setSettings:patch=>mutate('/api/settings','PATCH',{...patch,version:patch.version ?? dataRef.current.settings.version}),
   reset:()=>notify('Los datos del edificio no se pueden restablecer como una demostración.'),notify,toast,
 }}>{children}</Context.Provider>;
}
export function usePortal(){const value=useContext(Context);if(!value)throw new Error('PortalProvider missing');return value;}
