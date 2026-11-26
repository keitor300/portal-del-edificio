import { currentOwnerUnit } from '../auth/ownerAccounts';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronRight, ClipboardList, ContactRound, Mail, MessageCircle, Phone } from 'lucide-react';
import { productionPortal } from '../../lib/api';
import { Field, Gateway, PageHeader, Tabs } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity, Message } from '../../lib/types';
import { Conversation } from './Conversation';
import { IssuesPanel } from './IssuesPage';
import { AdminSum } from './SumPage';

import './services.css';

export function ServicesPage() {
  return <div className="services-page"><PageHeader title="Servicios" description="Elegí lo que necesitás hacer en el edificio." />
    <div className="services-gateways">
      <Gateway className="service-gateway service-sum" to="/servicios/sum" title="Reservar el SUM" description="Disponibilidad, reglas y mis reservas" icon={<CalendarDays aria-hidden="true" />} />
      <Gateway className="service-gateway service-issues" to="/servicios/reclamos" title="Informar un problema" description="Crear un reclamo y seguirlo" icon={<ClipboardList aria-hidden="true" />} />
      <Gateway className="service-gateway service-chat" to="/servicios/chat" title="Hablar con administración" description="Enviar una consulta de tu unidad" icon={<MessageCircle aria-hidden="true" />} />
      <Gateway className="service-gateway service-contacts" to="/servicios/contactos" title="Contactos y ayuda" description="Administración, mantenimiento y urgencias" icon={<ContactRound aria-hidden="true" />} />
    </div>
    <div className="services-urgent"><AlertTriangle aria-hidden="true" /><div><p><strong>¿Hay una urgencia?</strong></p><p>Encontrá una orientación segura y los contactos del edificio.</p><Link className="button secondary" to="/servicios/urgencias">Ver ayuda urgente<ChevronRight size={18} aria-hidden="true" /></Link></div></div>
  </div>;
}

export function ChatPanel({ admin = false }: { admin?: boolean }) {
  const { data, sendMessage } = usePortal();
  const unitOf = (message: Message) => message.unit || (/unidad\s+([a-z0-9-]+)/i.exec(message.author)?.[1] ?? currentOwnerUnit()).toUpperCase();
  const units = useMemo(() => [...new Set([currentOwnerUnit(), ...data.messages.map(unitOf)].filter(Boolean))], [data.messages]);
  const [selectedUnit, setSelectedUnit] = useState(currentOwnerUnit());
  useEffect(() => { if (!units.includes(selectedUnit)) setSelectedUnit(units[0] ?? currentOwnerUnit()); }, [selectedUnit, units]);
  const messages = data.messages.filter(message => unitOf(message) === (admin ? selectedUnit : currentOwnerUnit()));
  const send = (message: Message) => sendMessage({ ...message, unit: admin ? selectedUnit : currentOwnerUnit() });
  if(admin&&!units.length)return <section className="section"><h2>Consultas de propietarios</h2><p className="empty">Todavía no recibiste consultas de los propietarios.</p></section>;
  if (!admin) return <section className="section owner-chat-section"><div className="owner-chat-contact"><span className="owner-chat-contact-icon"><MessageCircle size={24} aria-hidden="true" /></span><div><h2>Administración</h2><p>Consultas generales de tu unidad.</p></div>{!productionPortal&&<span className="owner-chat-hours">Lun. a vie. · 9 a 17 h</span>}</div><Conversation messages={messages} author={`Unidad ${currentOwnerUnit()}`} onSend={send} /></section>;
  return <section className="section admin-chat-section"><div className="admin-chat-heading"><div><h2>Consultas de propietarios</h2><p className="muted">Todas las conversaciones, ordenadas por unidad.</p></div><span className="status status-green">{units.length} unidades</span></div><div className="admin-chat-inbox"><nav className="admin-chat-threads" aria-label="Consultas por unidad">{units.map(unit => { const thread = data.messages.filter(message => unitOf(message) === unit); const last = thread[thread.length - 1]; return <button key={unit} type="button" className={selectedUnit === unit ? 'active' : ''} aria-pressed={selectedUnit === unit} onClick={() => setSelectedUnit(unit)}><span><strong>Unidad {unit}</strong><small>{last?.text || 'Sin mensajes todavía.'}</small></span><em>{thread.length}</em></button>; })}</nav><div className="admin-chat-conversation"><div className="admin-chat-conversation-heading"><h3>Conversación con Unidad {selectedUnit}</h3><span className="muted">{messages.length} mensajes</span></div><Conversation key={selectedUnit} messages={messages} author="Administración" onSend={send} /></div></div></section>;
}

export function ChatPage() {
  return <div className="services-page"><PageHeader title="Chat con administración" description={`Consulta de la unidad ${currentOwnerUnit()}.`} back="/servicios" /><ChatPanel /></div>;
}

function ContactList({ contacts }: { contacts: Entity[] }) {
  return <div className="list">{contacts.length ? contacts.map(contact => <article className="list-row" key={contact.id}><div className="row-main"><strong>{contact.title}</strong><p>{contact.description}</p><p className="services-contact-meta">{contact.contact}</p>{productionPortal ? <div className="row-actions">{contact.phone&&<a className="button secondary" href={`tel:${contact.phone.replace(/[^+\d]/g,'')}`} aria-label={`Llamar a ${contact.title}`}><Phone size={18} aria-hidden="true"/>{contact.phone}</a>}{contact.email&&<a className="button secondary" href={`mailto:${encodeURIComponent(contact.email)}`} aria-label={`Enviar email a ${contact.title}`}><Mail size={18} aria-hidden="true"/>Enviar email</a>}{!contact.phone&&!contact.email&&<span className="muted">Administración aún no cargó un teléfono o email.</span>}</div> : <span className="status">Contacto demo · Sin teléfono verificado</span>}</div></article>) : <p className="empty">No hay contactos para esta categoría.</p>}</div>;
}

export function ContactsPage() {
  const { data } = usePortal();
  const [category, setCategory] = useState('');
  const categories = [...new Set(data.contacts.map(contact => contact.category).filter((value): value is string => !!value))];
  return <div className="services-page"><PageHeader title="Contactos y ayuda" description={productionPortal?'Contactos publicados por la administración del edificio.':'Directorio de ejemplo. Los proveedores, horarios y teléfonos deben confirmarse con administración.'} back="/servicios" />
    <div className="services-contact-actions"><Link className="button" to="/servicios/chat"><MessageCircle size={18} aria-hidden="true" />Hablar con administración</Link><Link className="button secondary" to="/servicios/urgencias"><AlertTriangle size={18} aria-hidden="true" />Ver ayuda urgente</Link></div>
    <Field label="Categoría de contacto"><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos los contactos</option>{categories.map(value => <option key={value}>{value}</option>)}</select></Field>
    <ContactList contacts={data.contacts.filter(contact => !category || contact.category === category)} />
  </div>;
}

const URGENCY_INFO: Record<string, { title: string; instructions: string[] }> = {
  Agua: { title: 'Pérdida o falta de agua', instructions: ['Alejate del agua si hay enchufes, cables o equipos eléctricos cerca.', 'No manipules instalaciones ni ingreses a zonas inundadas.', 'Avisá al encargado o al servicio de mantenimiento mediante un contacto verificado.'] },
  Ascensor: { title: 'Problema con el ascensor', instructions: ['Si estás dentro, usá la alarma o el intercomunicador de la cabina.', 'No fuerces las puertas ni intentes salir por tu cuenta.', 'Quienes estén afuera deben avisar al servicio de ascensores y evitar usarlo hasta su revisión.'] },
  Gas: { title: 'Olor a gas', instructions: ['No enciendas llamas ni acciones interruptores, enchufes o equipos eléctricos.', 'Alejate del lugar y evitá que otras personas ingresen.', 'Desde un lugar seguro, contactá a la guardia de tu distribuidora o al servicio local de emergencias mediante un número verificado.'] },
  Electricidad: { title: 'Problema eléctrico', instructions: ['No toques cables, tableros ni equipos dañados, especialmente si hay agua.', 'Alejate del sector afectado y evitá que otras personas se acerquen.', 'Si hay humo, chispas o riesgo inmediato, salí a un lugar seguro y contactá al servicio local de emergencias.'] },
  Otro: { title: 'Otra situación urgente', instructions: ['Alejate de cualquier peligro inmediato y buscá un lugar seguro.', 'Si hay riesgo para una persona, contactá directamente al servicio local de emergencias mediante un número verificado.', 'Avisá al encargado o administración cuando sea seguro hacerlo.'] },
};

export function UrgenciesPage() {
  const { data } = usePortal();
  const [category, setCategory] = useState('Agua');
  const info = URGENCY_INFO[category];
  return <div className="services-page"><PageHeader title="Urgencias" description="Orientación básica y contactos del edificio." back="/servicios" />
    <div className="services-urgent"><AlertTriangle aria-hidden="true" /><p><strong>Ante un peligro inmediato, buscá un lugar seguro y contactá al servicio local de emergencias.</strong><br />{productionPortal?'El chat del portal no atiende emergencias.':'Esta demo no atiende emergencias.'} Usá contactos verificados en la cartelería del edificio, la cabina o la factura del servicio.</p></div>
    <Field label="Tipo de urgencia"><select value={category} onChange={event => setCategory(event.target.value)}>{Object.keys(URGENCY_INFO).map(value => <option key={value}>{value}</option>)}</select></Field>
    <section className="section" aria-live="polite"><h2>{info.title}</h2><ul className="services-instructions">{info.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ul></section>
    <section className="section"><h2>Contactos de {category.toLocaleLowerCase('es')}</h2><ContactList contacts={data.contacts.filter(contact => contact.category === category || (productionPortal && (contact.category === 'Emergencias' || contact.category === ({Agua:'Plomero',Ascensor:'Ascensores',Electricidad:'Electricista'} as Record<string,string>)[category])))} /></section>
    <Link className="button secondary" to="/servicios/contactos"><ContactRound size={18} aria-hidden="true" />Ver todos los contactos</Link>
  </div>;
}

export function AdminServicesPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = ['sum', 'reclamos', 'chat'].includes(requested ?? '') ? requested! : 'sum';
  return <div className="services-page"><PageHeader title="Atención y servicios" description="Reservas, reclamos y consultas de los propietarios." />
    <div className="admin-service-choices" aria-label="Elegir tarea de administración"><button type="button" className={tab === 'sum' ? 'active sum' : 'sum'} onClick={() => setParams({ tab: 'sum' })}><CalendarDays size={22} /><span><strong>Reservas del SUM</strong><small>Horarios y uso del salón</small></span></button><button type="button" className={tab === 'reclamos' ? 'active issues' : 'issues'} onClick={() => setParams({ tab: 'reclamos' })}><ClipboardList size={22} /><span><strong>Reclamos</strong><small>Pedidos de las unidades</small></span></button><button type="button" className={tab === 'chat' ? 'active chat' : 'chat'} onClick={() => setParams({ tab: 'chat' })}><MessageCircle size={22} /><span><strong>Consultas</strong><small>Mensajes por unidad</small></span></button></div>
    <Tabs items={[{ id: 'sum', label: 'SUM' }, { id: 'reclamos', label: 'Reclamos' }, { id: 'chat', label: 'Chat' }]} value={tab} onChange={value => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); }} />
    {tab === 'sum' && <AdminSum />}{tab === 'reclamos' && <IssuesPanel admin />}{tab === 'chat' && <ChatPanel admin />}
  </div>;
}
