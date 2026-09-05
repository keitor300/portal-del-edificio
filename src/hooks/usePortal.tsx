import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { makeSeed } from '../data/seed';
import { DEMO_STORAGE_KEY, repository } from '../lib/repository';
import type { Collection, DemoData, Entity, Message, Settings } from '../lib/types';
interface Portal { data:DemoData; save:(key:Collection,item:Entity)=>void; remove:(key:Collection,id:string)=>void; update:(key:Collection,id:string,patch:Partial<Entity>)=>void; setSettings:(patch:Partial<Settings>)=>void; sendMessage:(message:Message)=>void; reset:()=>void; notify:(message:string)=>void; toast:string; }
const Context=createContext<Portal|null>(null);
export function PortalProvider({children}:{children:ReactNode}) {
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
export function usePortal(){const value=useContext(Context);if(!value)throw new Error('PortalProvider missing');return value;}
