import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  ContactRound,
  FileText,
  FolderOpen,
  KeyRound,
  MessageCircle,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productionPortal } from '../../lib/api';
import { PageHeader } from '../../components/UI';

type MenuTone = 'green' | 'blue' | 'amber' | 'sand';
type MenuItem = { to: string; title: string; description: string; Icon: typeof CalendarDays; tone: MenuTone };
type MenuGroup = { title: string; description: string; Icon: typeof CalendarDays; tone: MenuTone; items: MenuItem[] };

const frequentActions: MenuItem[] = [
  { to: '/demo/propietario/servicios/sum', title: 'Reservar el SUM', description: 'Elegí una fecha y un horario disponible.', Icon: CalendarDays, tone: 'green' },
  { to: '/demo/propietario/edificio/cuentas', title: 'Ver cuentas', description: 'Consultá movimientos y presupuestos.', Icon: FileText, tone: 'blue' },
  { to: '/demo/propietario/servicios/reclamos', title: 'Informar un problema', description: 'Creá un reclamo y seguí su estado.', Icon: ClipboardList, tone: 'amber' },
  { to: '/demo/propietario/servicios/chat', title: 'Hablar con Administración', description: 'Enviá una consulta desde tu unidad.', Icon: MessageCircle, tone: 'sand' },
];

const groups: MenuGroup[] = [
  { title: 'Servicios de todos los días', description: 'Reservas, reclamos y consultas de tu unidad.', Icon: Sparkles, tone: 'green', items: [
    { to: '/demo/propietario/servicios/sum', title: 'Consultar el SUM', description: 'Disponibilidad, reglas y reservas.', Icon: CalendarDays, tone: 'green' },
    { to: '/demo/propietario/servicios/reclamos', title: 'Reclamos y seguimiento', description: 'Informá un problema y mirá su avance.', Icon: ClipboardList, tone: 'amber' },
    { to: '/demo/propietario/servicios/chat', title: 'Consultas a Administración', description: 'Leé y enviá mensajes de tu unidad.', Icon: MessageCircle, tone: 'blue' },
  ] },
  { title: 'Información y cuentas', description: 'Todo lo importante sobre el edificio.', Icon: Building2, tone: 'blue', items: [
    { to: '/demo/propietario/edificio/cuentas', title: 'Cuentas del edificio', description: 'Movimientos, liquidaciones y presupuestos.', Icon: FileText, tone: 'blue' },
    { to: '/demo/propietario/edificio/documentos', title: 'Documentos', description: 'Actas, reglamentos y archivos.', Icon: FolderOpen, tone: 'sand' },
    { to: '/demo/propietario/mas/estado', title: 'Estado del edificio', description: 'Servicios y tareas de mantenimiento.', Icon: Wrench, tone: 'green' },
    { to: '/demo/propietario/edificio/obras', title: 'Obras y avances', description: 'Seguimiento de los trabajos en curso.', Icon: Wrench, tone: 'amber' },
  ] },
  { title: 'Participación', description: 'Reuniones, fechas y vida en comunidad.', Icon: Users, tone: 'amber', items: [
    { to: '/demo/propietario/edificio/reuniones', title: 'Reuniones y encuestas', description: 'Participá y consultá las actas.', Icon: Users, tone: 'amber' },
    { to: '/demo/propietario/mas/calendario', title: 'Calendario del edificio', description: 'Fechas, reservas y vencimientos.', Icon: CalendarDays, tone: 'blue' },
    { to: '/demo/propietario/mas/disponibilidades', title: 'Ventas y alquileres', description: 'Departamentos y cocheras disponibles.', Icon: KeyRound, tone: 'sand' },
  ] },
  { title: 'Ayuda y contactos', description: 'Información clara cuando necesitás asistencia.', Icon: CircleHelp, tone: 'sand', items: [
    { to: '/demo/propietario/servicios/contactos', title: 'Contactos útiles', description: 'Administración y mantenimiento.', Icon: ContactRound, tone: 'blue' },
    { to: '/demo/propietario/servicios/urgencias', title: 'Urgencias', description: 'Qué hacer ante una situación urgente.', Icon: ShieldAlert, tone: 'amber' },
    { to: '/demo/propietario/mas/preguntas', title: 'Preguntas frecuentes', description: 'Respuestas simples para el día a día.', Icon: CircleHelp, tone: 'green' },
    { to: '/demo/propietario/mas/objetos', title: 'Objetos perdidos', description: 'Objetos encontrados en espacios comunes.', Icon: Search, tone: 'sand' },
  ] },
];

export function OwnerMenuPage() {
  return (
    <>
      <PageHeader title="Más del edificio" description="Encontrá rápido los servicios, la información y la ayuda que necesitás." />

      <section className="admin-tool-frequent owner-tool-frequent" aria-labelledby="owner-frequent-title">
        <div className="admin-tool-heading">
          <div>
            <span className="admin-tool-kicker">Accesos directos</span>
            <h2 id="owner-frequent-title">¿Qué necesitás hacer?</h2>
          </div>
          <p>Las acciones más usadas, listas para entrar con un toque.</p>
        </div>
        <div className="admin-tool-quick-grid">
          {frequentActions.map(({ to, title, description, Icon, tone }) => (
            <Link className={`admin-tool-quick admin-tool-${tone}`} to={to} key={title}>
              <span className="admin-tool-icon"><Icon size={26} /></span>
              <span className="admin-tool-copy"><strong>{title}</strong><small>{description}</small></span>
              <span className="admin-tool-arrow" aria-hidden="true"><ArrowRight size={19} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-tool-directory owner-tool-directory" aria-labelledby="owner-directory-title">
        <div className="admin-tool-heading admin-tool-heading-compact">
          <div>
            <span className="admin-tool-kicker">Todas las opciones</span>
            <h2 id="owner-directory-title">Explorá por tema</h2>
          </div>
          <p>Todo está a la vista para que no tengas que buscar dentro de otros menús.</p>
        </div>
        <div className="owner-menu-groups admin-menu-groups">
          {groups.map(({ title, description, Icon: GroupIcon, tone, items }) => (
            <section className={`owner-menu-group admin-menu-group admin-tool-section admin-tool-${tone}`} key={title}>
              <header className="admin-tool-section-header">
                <span className="admin-tool-section-icon"><GroupIcon size={23} /></span>
                <span>
                  <span className="admin-tool-kicker">Sección</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </span>
                <span className="admin-tool-count">{items.length} opciones</span>
              </header>
              <div className="owner-menu-list admin-menu-list admin-tool-card-grid">
                {items.map(({ to, title: itemTitle, description: itemDescription, Icon, tone: itemTone }) => (
                  <Link className={`owner-menu-row admin-menu-row admin-tool-card admin-tool-${itemTone}`} to={to} key={to}>
                    <span className="owner-menu-icon admin-menu-icon admin-tool-icon"><Icon size={22} /></span>
                    <span className="owner-menu-copy admin-menu-copy admin-tool-copy"><strong>{itemTitle}</strong><small>{itemDescription}</small></span>
                    <span className="admin-tool-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {!productionPortal && <p className="owner-menu-demo-note"><ArrowUpRight size={17} />Esta es una demostración. Las acciones se guardan solo en este navegador.</p>}
    </>
  );
}
