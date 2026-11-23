import {
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  MessageCircle,
  Users,
  Vote,
  Wrench,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/UI';

import { productionPortal } from '../../lib/api';

type AdminMenuItem = {
  label: string;
  description: string;
  path: string;
  Icon: typeof Wrench;
  tone: 'green' | 'blue' | 'amber' | 'sand';
};

type AdminMenuGroup = {
  title: string;
  description: string;
  Icon: typeof Wrench;
  tone: AdminMenuItem['tone'];
  items: AdminMenuItem[];
};

const frequentActions: AdminMenuItem[] = [
  { label: 'Aprobar propietarios', description: 'Revisá nuevas solicitudes de acceso.', path: '/accesos', Icon: Users, tone: 'green' },
  { label: 'Coordinar el SUM', description: 'Consultá y coordiná las reservas.', path: '/servicios?tab=sum', Icon: CalendarDays, tone: 'amber' },
  { label: 'Ver reclamos', description: 'Seguí los problemas informados.', path: '/servicios?tab=reclamos', Icon: ClipboardList, tone: 'sand' },
  { label: 'Responder consultas', description: 'Leé y respondé mensajes de las unidades.', path: '/servicios?tab=chat', Icon: MessageCircle, tone: 'blue' },
];

const groups: AdminMenuGroup[] = [
  {
    title: 'Atención a propietarios',
    description: 'Accesos, consultas y servicios de uso diario.',
    Icon: MessageCircle,
    tone: 'green',
    items: [
      { label: 'Accesos de propietarios', description: 'Aprobá el ingreso de cada unidad.', path: '/accesos', Icon: Users, tone: 'green' },
      { label: 'Panel de atención', description: 'Mirá juntos reservas, reclamos y consultas.', path: '/servicios', Icon: Wrench, tone: 'green' },
      { label: 'Reservas del SUM', description: 'Revisá y coordiná el uso del salón.', path: '/servicios?tab=sum', Icon: CalendarDays, tone: 'amber' },
      { label: 'Reclamos', description: 'Seguí los pedidos de los propietarios.', path: '/servicios?tab=reclamos', Icon: ClipboardList, tone: 'sand' },
      { label: 'Consultas de propietarios', description: 'Respondé mensajes desde un solo lugar.', path: '/servicios?tab=chat', Icon: MessageCircle, tone: 'blue' },
    ],
  },
  {
    title: 'Comunidad',
    description: 'Organizá decisiones y participación del edificio.',
    Icon: Users,
    tone: 'amber',
    items: [
      { label: 'Reuniones y propuestas', description: 'Organizá la agenda y las decisiones.', path: '/comunidad?tab=reuniones', Icon: Users, tone: 'amber' },
      { label: 'Encuestas', description: 'Creá consultas rápidas para el edificio.', path: '/comunidad?tab=encuestas', Icon: ClipboardCheck, tone: 'blue' },
      { label: 'Votaciones', description: 'Prepará una votación de consorcio.', path: '/comunidad?tab=votaciones', Icon: Vote, tone: 'sand' },
    ],
  },
  {
    title: 'Información del edificio',
    description: 'Mantené al día los documentos, obras y servicios.',
    Icon: Building2,
    tone: 'blue',
    items: [
      { label: 'Documentos', description: 'Compartí reglamentos, actas y archivos.', path: '/contenido?tab=documents', Icon: FolderOpen, tone: 'blue' },
      { label: 'Obras', description: 'Publicá avances y próximos trabajos.', path: '/contenido?tab=works', Icon: Wrench, tone: 'amber' },
      { label: 'Estado del edificio', description: 'Actualizá servicios y espacios comunes.', path: '/contenido?tab=statuses', Icon: ClipboardCheck, tone: 'green' },
      { label: 'Información del portal', description: 'Editá los datos públicos del edificio.', path: '/contenido', Icon: FileText, tone: 'sand' },
    ],
  },
];

export function AdminMenuPage() {
  const base = useLocation().pathname.startsWith('/admin') ? '/admin' : '/demo/administracion';
  return (
    <>
      <PageHeader title="Más herramientas" description="Elegí qué necesitás gestionar. Las tareas más usadas están primero." />

      <section className="admin-tool-frequent" aria-labelledby="admin-frequent-title">
        <div className="admin-tool-heading">
          <div>
            <span className="admin-tool-kicker">Accesos directos</span>
            <h2 id="admin-frequent-title">¿Qué necesitás hacer?</h2>
          </div>
          <p>Entrá con un solo toque a las tareas de todos los días.</p>
        </div>
        <div className="admin-tool-quick-grid">
          {frequentActions.map(({ label, description, path, Icon, tone }) => (
            <Link className={`admin-tool-quick admin-tool-${tone}`} to={`${base}${path}`} key={label}>
              <span className="admin-tool-icon"><Icon size={26} /></span>
              <span className="admin-tool-copy"><strong>{label}</strong><small>{description}</small></span>
              <span className="admin-tool-arrow" aria-hidden="true"><ArrowRight size={19} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-tool-directory" aria-labelledby="admin-directory-title">
        <div className="admin-tool-heading admin-tool-heading-compact">
          <div>
            <span className="admin-tool-kicker">Todas las funciones</span>
            <h2 id="admin-directory-title">Herramientas por tema</h2>
          </div>
          <p>Ninguna función está escondida: elegí el tema y entrá directamente.</p>
        </div>
        <div className="admin-menu-groups">
          {groups.map(({ title, description, Icon: GroupIcon, tone, items }) => (
            <section className={`admin-menu-group admin-tool-section admin-tool-${tone}`} key={title}>
              <header className="admin-tool-section-header">
                <span className="admin-tool-section-icon"><GroupIcon size={23} /></span>
                <span>
                  <span className="admin-tool-kicker">Sección</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </span>
                <span className="admin-tool-count">{items.length} opciones</span>
              </header>
              <div className="admin-menu-list admin-tool-card-grid">
                {items.map(({ label, description: itemDescription, path, Icon, tone: itemTone }) => (
                  <Link className={`admin-menu-row admin-tool-card admin-tool-${itemTone}`} to={`${base}${path}`} key={label}>
                    <span className="admin-menu-icon admin-tool-icon"><Icon size={22} /></span>
                    <span className="admin-menu-copy admin-tool-copy"><strong>{label}</strong><small>{itemDescription}</small></span>
                    <span className="admin-tool-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      {!productionPortal && <p className="admin-menu-demo-note"><ClipboardList size={17} />Esta es una vista demo: los cambios se guardan únicamente en este navegador.</p>}
    </>
  );
}
