import { ArrowUpRight, CalendarDays, ChevronRight, CircleHelp, ClipboardList, ContactRound, FileText, KeyRound, MessageCircle, Search, ShieldAlert, Users, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/UI';

type MenuItem = { to: string; title: string; description: string; Icon: typeof CalendarDays };

const groups: { title: string; items: MenuItem[] }[] = [
  { title: 'Uso diario', items: [
    { to: '/demo/propietario/servicios/sum', title: 'Reservar el SUM', description: 'Disponibilidad, reglamento y reservas', Icon: CalendarDays },
    { to: '/demo/propietario/servicios/reclamos', title: 'Reclamos', description: 'Informar un problema y seguirlo', Icon: ClipboardList },
    { to: '/demo/propietario/servicios/chat', title: 'Hablar con administración', description: 'Enviar una consulta de tu unidad', Icon: MessageCircle },
  ] },
  { title: 'Mi edificio', items: [
    { to: '/demo/propietario/edificio/cuentas', title: 'Cuentas del edificio', description: 'Movimientos, liquidaciones y presupuestos', Icon: FileText },
    { to: '/demo/propietario/edificio/documentos', title: 'Documentos', description: 'Actas, reglamento y archivos', Icon: FileText },
    { to: '/demo/propietario/mas/estado', title: 'Estado del edificio', description: 'Servicios y mantenimiento', Icon: Wrench },
    { to: '/demo/propietario/edificio/obras', title: 'Obras y avances', description: 'Seguimiento de trabajos', Icon: Wrench },
  ] },
  { title: 'Comunidad', items: [
    { to: '/demo/propietario/edificio/reuniones', title: 'Reuniones y encuestas', description: 'Participar y consultar actas', Icon: Users },
    { to: '/demo/propietario/mas/calendario', title: 'Calendario', description: 'Fechas, reservas y vencimientos', Icon: CalendarDays },
    { to: '/demo/propietario/mas/disponibilidades', title: 'Disponibilidades', description: 'Departamentos y cocheras', Icon: KeyRound },
  ] },
  { title: 'Ayuda', items: [
    { to: '/demo/propietario/servicios/contactos', title: 'Contactos útiles', description: 'Administración y mantenimiento', Icon: ContactRound },
    { to: '/demo/propietario/servicios/urgencias', title: 'Urgencias', description: 'Orientación para situaciones urgentes', Icon: ShieldAlert },
    { to: '/demo/propietario/mas/preguntas', title: 'Preguntas frecuentes', description: 'Respuestas para el día a día', Icon: CircleHelp },
    { to: '/demo/propietario/mas/objetos', title: 'Objetos perdidos', description: 'Objetos encontrados en espacios comunes', Icon: Search },
  ] },
];

export function OwnerMenuPage() {
  return <><PageHeader title="Menú principal" description="Todo lo que podés consultar del edificio, organizado por tema." /><div className="owner-menu-groups">{groups.map(group => <section className="owner-menu-group" key={group.title} aria-labelledby={`menu-${group.title}`}><h2 id={`menu-${group.title}`}>{group.title}</h2><div className="owner-menu-list">{group.items.map(({ to, title, description, Icon }) => <Link className="owner-menu-row" to={to} key={to}><span className="owner-menu-icon"><Icon size={21} /></span><span className="owner-menu-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight size={20} /></Link>)}</div></section>)}</div><p className="owner-menu-demo-note"><ArrowUpRight size={17} />Esta es una demostración. Las acciones se guardan solo en este navegador.</p></>;
}
