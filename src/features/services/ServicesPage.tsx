import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronRight, ClipboardList, ContactRound, MessageCircle } from 'lucide-react';
import { Field, Gateway, PageHeader, Tabs } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { Conversation } from './Conversation';
import { IssuesPanel } from './IssuesPage';
import { AdminSum } from './SumPage';
import { OWNER_UNIT } from './model';
import './services.css';

export function ServicesPage() {
  return <div className="services-page"><PageHeader title="Servicios" description="Reservas, reclamos y contactos del edificio." />
    <div className="services-gateways">
      <Gateway to="/servicios/sum" title="Reservar el SUM" description="Disponibilidad, reglamento y mis reservas" icon={<CalendarDays aria-hidden="true" />} />
      <Gateway to="/servicios/reclamos" title="Reclamos" description="Crear un reclamo y consultar su seguimiento" icon={<ClipboardList aria-hidden="true" />} />
      <Gateway to="/servicios/chat" title="Chat con administración" description="Consultas de tu unidad" icon={<MessageCircle aria-hidden="true" />} />
      <Gateway to="/servicios/contactos" title="Contactos útiles" description="Administración y mantenimiento" icon={<ContactRound aria-hidden="true" />} />
    </div>
    <div className="services-urgent"><AlertTriangle aria-hidden="true" /><div><p><strong>¿Hay una urgencia?</strong></p><Link className="button secondary" to="/servicios/urgencias">Consultar urgencias<ChevronRight size={18} aria-hidden="true" /></Link></div></div>
  </div>;
}

export function ChatPanel({ admin = false }: { admin?: boolean }) {
  const { data, sendMessage } = usePortal();
  return <section className="section"><h2>{admin ? 'Conversación con Unidad 7B' : 'Administración'}</h2><Conversation messages={data.messages} author={admin ? 'Administración' : `Unidad ${OWNER_UNIT}`} onSend={sendMessage} /></section>;
}

export function ChatPage() {
  return <div className="services-page"><PageHeader title="Chat con administración" description="Conversación de la unidad 7B." back="/servicios" /><ChatPanel /></div>;
}

function ContactList({ contacts }: { contacts: Entity[] }) {
  return <div className="list">{contacts.length ? contacts.map(contact => <article className="list-row" key={contact.id}><div className="row-main"><strong>{contact.title}</strong><p>{contact.description}</p><p className="services-contact-meta">{contact.contact}</p><span className="status">Contacto demo · Sin teléfono verificado</span></div></article>) : <p className="empty">No hay contactos para esta categoría.</p>}</div>;
}

export function ContactsPage() {
  const { data } = usePortal();
  const [category, setCategory] = useState('');
  const categories = [...new Set(data.contacts.map(contact => contact.category).filter((value): value is string => !!value))];
  return <div className="services-page"><PageHeader title="Contactos útiles" description="Directorio de ejemplo. Los proveedores, horarios y teléfonos deben confirmarse con administración." back="/servicios" />
    <Field label="Categoría de contacto"><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos los contactos</option>{categories.map(value => <option key={value}>{value}</option>)}</select></Field>
    <ContactList contacts={data.contacts.filter(contact => !category || contact.category === category)} />
    <div className="form-actions"><Link className="button" to="/servicios/chat"><MessageCircle size={18} aria-hidden="true" />Consultar a administración</Link><Link className="button secondary" to="/servicios/urgencias"><AlertTriangle size={18} aria-hidden="true" />Urgencias</Link></div>
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
    <div className="services-urgent"><AlertTriangle aria-hidden="true" /><p><strong>Ante un peligro inmediato, buscá un lugar seguro y contactá al servicio local de emergencias.</strong><br />Esta demo no atiende emergencias. Usá contactos verificados en la cartelería del edificio, la cabina o la factura del servicio.</p></div>
    <Field label="Tipo de urgencia"><select value={category} onChange={event => setCategory(event.target.value)}>{Object.keys(URGENCY_INFO).map(value => <option key={value}>{value}</option>)}</select></Field>
    <section className="section" aria-live="polite"><h2>{info.title}</h2><ul className="services-instructions">{info.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ul></section>
    <section className="section"><h2>Contactos de {category.toLocaleLowerCase('es')}</h2><ContactList contacts={data.contacts.filter(contact => contact.category === category)} /></section>
    <Link className="button secondary" to="/servicios/contactos"><ContactRound size={18} aria-hidden="true" />Ver todos los contactos</Link>
  </div>;
}

export function AdminServicesPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = ['sum', 'reclamos', 'chat'].includes(requested ?? '') ? requested! : 'sum';
  return <div className="services-page"><PageHeader title="Servicios del edificio" description="Reservas, reclamos y conversación local de administración." />
    <Tabs items={[{ id: 'sum', label: 'SUM' }, { id: 'reclamos', label: 'Reclamos' }, { id: 'chat', label: 'Chat' }]} value={tab} onChange={value => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); }} />
    {tab === 'sum' && <AdminSum />}{tab === 'reclamos' && <IssuesPanel admin />}{tab === 'chat' && <ChatPanel admin />}
  </div>;
}
