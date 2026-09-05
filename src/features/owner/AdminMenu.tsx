import { ArrowUpRight, CalendarDays, ClipboardList, FileText, MessageCircle, Users, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/UI';

type AdminMenuItem = {
  label: string;
  description: string;
  to: string;
  Icon: typeof Wrench;
};

const groups: { title: string; items: AdminMenuItem[] }[] = [
  {
    title: 'Operación',
    items: [
      { label: 'Servicios del edificio', description: 'Mantenimiento, proveedores y tareas abiertas.', to: '/demo/administracion/servicios', Icon: Wrench },
      { label: 'Reservas del SUM', description: 'Revisá y coordiná el uso del salón.', to: '/demo/administracion/servicios?tab=sum', Icon: CalendarDays },
      { label: 'Reclamos', description: 'Seguimiento de pedidos de propietarios.', to: '/demo/administracion/servicios?tab=reclamos', Icon: ClipboardList },
      { label: 'Chat con propietarios', description: 'Respondé consultas desde un solo lugar.', to: '/demo/administracion/servicios?tab=chat', Icon: MessageCircle },
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { label: 'Reuniones y temas', description: 'Agenda, participantes y decisiones.', to: '/demo/administracion/comunidad?tab=reuniones', Icon: Users },
      { label: 'Encuestas', description: 'Consultas rápidas para tomar el pulso del edificio.', to: '/demo/administracion/comunidad?tab=encuestas', Icon: ClipboardList },
      { label: 'Votaciones demo', description: 'Simulá una votación de consorcio.', to: '/demo/administracion/comunidad?tab=votaciones', Icon: Users },
    ],
  },
  {
    title: 'Información',
    items: [
      { label: 'Documentos', description: 'Reglamento, actas y archivos compartidos.', to: '/demo/administracion/contenido?tab=documents', Icon: FileText },
      { label: 'Obras', description: 'Comunicá avances y próximos trabajos.', to: '/demo/administracion/contenido?tab=works', Icon: Wrench },
      { label: 'Estado del edificio', description: 'Actualizá servicios y espacios comunes.', to: '/demo/administracion/contenido?tab=statuses', Icon: ClipboardList },
      { label: 'Contenido del portal', description: 'Editá la información pública del edificio.', to: '/demo/administracion/contenido', Icon: FileText },
    ],
  },
];

export function AdminMenuPage() {
  return (
    <>
      <PageHeader title="Menú de administración" description="Accedé a cada tarea cuando la necesites, sin llenar la pantalla de opciones." />
      <div className="admin-menu-groups">
        {groups.map(group => (
          <section className="admin-menu-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="admin-menu-list">
              {group.items.map(({ label, description, to, Icon }) => (
                <Link className="admin-menu-row" to={to} key={label}>
                  <span className="admin-menu-icon"><Icon size={20} /></span>
                  <span className="admin-menu-copy"><strong>{label}</strong><small>{description}</small></span>
                  <ArrowUpRight size={19} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="admin-menu-demo-note"><ClipboardList size={17} />Esta es una vista demo: los cambios se guardan únicamente en este navegador.</p>
    </>
  );
}
