import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { api, productionPortal, serverUser, SESSION_EVENT } from '../../lib/api';
import { Empty, PageHeader } from '../../components/UI';
import { formatDate } from '../../lib/utils';
import './notifications.css';

type Notice={id:string;title:string;description:string;date:string;href:string;read:boolean;important:boolean};
type Inbox={items:Notice[];error:string;read:(ids:string[])=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<Inbox>({items:[],error:'',read:async()=>{},refresh:async()=>{}});
export function NotificationsProvider({children}:{children:ReactNode}){
  const [items,setItems]=useState<Notice[]>([]),[error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const user=serverUser();
    if(!productionPortal||!user){setItems([]);return;}
    try{const result=await api<{items:Notice[]}>('/api/notifications');if(serverUser()?.id===user.id){setItems(result.items);setError('');}}
    catch(error){if(serverUser()?.id===user.id)setError((error as Error).message);}
  },[]);
  useEffect(()=>{
    void refresh();const update=()=>{setItems([]);void refresh();};
    const poll=()=>{if(!document.hidden)void refresh();};
    const timer=window.setInterval(poll,30000);
    window.addEventListener(SESSION_EVENT,update);window.addEventListener('focus',poll);
    return()=>{window.clearInterval(timer);window.removeEventListener(SESSION_EVENT,update);window.removeEventListener('focus',poll);};
  },[refresh]);
  async function read(ids:string[]){await api('/api/notifications/read','POST',{ids});await refresh();}
  return <Context.Provider value={{items,error,read,refresh}}>{children}</Context.Provider>;
}
export function NotificationBell({fallback}:{fallback:string}){
  const {items,error}=useContext(Context);const count=items.filter(item=>!item.read).length;
  const admin=useLocation().pathname.startsWith('/admin');
  return <Link className="header-icon-link notification-bell" to={productionPortal?admin?'/admin/notificaciones':'/demo/propietario/notificaciones':fallback} aria-label={count?`Notificaciones: ${count} sin leer`:'Ver notificaciones'} title="Notificaciones"><Bell size={21}/>{productionPortal&&count>0&&<span className="notification-count">{count>99?'99+':count}</span>}{error&&<span className="notification-count">!</span>}</Link>;
}
export function NotificationsPage(){
  const {items,error,read,refresh}=useContext(Context),navigate=useNavigate();
  const [busy,setBusy]=useState(false),[failure,setFailure]=useState('');
  const unread=items.filter(item=>!item.read);
  async function mark(ids:string[],href?:string){setBusy(true);setFailure('');try{await read(ids);if(href)navigate(href);}catch(error){setFailure((error as Error).message);}finally{setBusy(false);}}
  return <><PageHeader title="Tus notificaciones" description={unread.length?`${unread.length} novedades sin leer`:'Estás al día'}/>
    {(error||failure)&&<p role="alert" className="error">{failure||error} <button className="button secondary" onClick={()=>void refresh()}>Reintentar</button></p>}
    {unread.length>0&&<button className="button secondary" disabled={busy} onClick={()=>void mark(unread.map(item=>item.id))}><CheckCheck size={20}/>Marcar todas como leídas</button>}
    <div className="notification-list">{items.map(item=><button key={item.id} disabled={busy} className={`notification-row ${item.read?'is-read':''} ${item.important?'is-important':''}`} onClick={()=>void mark([item.id],item.href)}><span className="notification-symbol"><Bell size={22}/></span><span><strong>{item.title}</strong><span>{item.description}</span><small>{formatDate(item.date)}{item.read?' · Leída':' · Sin leer'}</small></span><ChevronRight size={20}/></button>)}</div>
    {!items.length&&!error&&<Empty>No hay novedades pendientes. Los avisos y cambios del edificio aparecerán acá.</Empty>}
  </>;
}
