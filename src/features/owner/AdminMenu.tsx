import { ArrowUpRight, CalendarDays, ClipboardList, FileText, MessageCircle, Users, Wrench } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/UI';

type AdminMenuItem = {
  label: string;
  description: string;
  path: string;
  Icon: typeof Wrench;
};

const groups: { title: string; items: AdminMenuItem[] }[] = [
  {
    title: 'Atención y servicios',
    items: [
      { label: 'Atención y servicios', description: 'Reservas, reclamos y consultas de propietarios.', path: '/servicios', Icon: Wrench },
      { label: 'Reservas del SUM', description: 'Revisá y coordiná el uso del salón.', path: '/servicios?tab=sum', Icon: CalendarDays },
      { label: 'Reclamos', description: 'Seguimiento de pedidos de propietarios.', path: '/servicios?tab=reclamos', Icon: ClipboardList },
      { label: 'Consultas de propietarios', description: 'Respondé mensajes desde un solo lugar.', path: '/servicios?tab=chat', Icon: MessageCircle },
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { label: 'Reuniones y propuestas', description: 'Agenda, participantes y decisiones.', path: '/comunidad?tab=reuniones', Icon: Users },
      { label: 'Encuestas', description: 'Consultas rápidas para tomar el pulso del edificio.', path: '/comunidad?tab=encuestas', Icon: ClipboardList },
      { label: 'Votaciones', description: 'Simulá una votación de consorcio.', path: '/comunidad?tab=votaciones', Icon: Users },
    ],
  },
  {
    title: 'Información del edificio',
    items: [
      { label: 'Documentos', description: 'Reglamento, actas y archivos compartidos.', path: '/contenido?tab=documents', Icon: FileText },
      { label: 'Obras', description: 'Comunicá avances y próximos trabajos.', path: '/contenido?tab=works', Icon: Wrench },
      { label: 'Estado del edificio', description: 'Actualizá servicios y espacios comunes.', path: '/contenido?tab=statuses', Icon: ClipboardList },
      { label: 'Información del portal', description: 'Editá la información pública del edificio.', path: '/contenido', Icon: FileText },
    ],
  },
];

export function AdminMenuPage() {
  const base = useLocation().pathname.startsWith('/admin') ? '/admin' : '/demo/administracion';
  return (
    <>
      <PageHeader title="Más herramientas" description="Las funciones de administración, agrupadas por tarea." />
      <div className="admin-menu-groups">
        {groups.map((group, index) => (
          <details className="admin-menu-group" key={group.title} open={index === 0}>
            <summary><span><span className="owner-menu-summary-kicker">Sección</span><strong>{group.title}</strong></span><span className="owner-menu-count">{group.items.length} opciones<ArrowUpRight size={18} /></span></summary>
            <div className="admin-menu-list">
              {group.items.map(({ label, description, path, Icon }) => (
                <Link className="admin-menu-row" to={`${base}${path}`} key={label}>
                  <span className="admin-menu-icon"><Icon size={20} /></span>
                  <span className="admin-menu-copy"><strong>{label}</strong><small>{description}</small></span>
                  <ArrowUpRight size={19} />
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
      <p className="admin-menu-demo-note"><ClipboardList size={17} />Esta es una vista demo: los cambios se guardan únicamente en este navegador.</p>
    </>
  );
}
