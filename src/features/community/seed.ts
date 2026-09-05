import type { DemoData } from '../../lib/types';
import { demoPdf, relativeDate } from '../../lib/utils';

export function communitySeed(): Pick<DemoData, 'meetings' | 'topics' | 'polls'> {
  return {
    meetings: [
      { id: 'community-meeting-next', title: 'Reunión de propietarios', description: 'Encuentro para revisar los gastos y acordar las próximas mejoras del edificio.', date: relativeDate(8), time: '19:00', endTime: '20:30', place: 'SUM · Planta baja', status: 'Programada', agenda: 'Informe de ingresos y gastos\nMantenimiento del ascensor\nPropuestas para los espacios comunes\nPreguntas de propietarios', attachment: { ...demoPdf, name: 'Orden-del-dia-demo.pdf' } },
      { id: 'community-meeting-previous', title: 'Reunión mensual de propietarios', description: 'Revisión de mantenimiento y convivencia.', date: relativeDate(-24), time: '19:00', endTime: '20:15', place: 'SUM · Planta baja', status: 'Realizada', agenda: 'Estado de cuentas\nIluminación de pasillos\nReglamento del SUM', summary: 'Participaron representantes de 23 unidades. Se revisaron los gastos y se acordó solicitar presupuestos para mejorar la iluminación.', milestones: ['Solicitar tres presupuestos para luces LED.', 'Mantener los horarios vigentes del SUM.', 'Presentar el comparativo de presupuestos en la próxima reunión.'], attachment: { ...demoPdf, name: 'Acta-reunion-demo.pdf' } },
    ],
    topics: [
      { id: 'community-topic-lights', title: 'Mejorar la iluminación de la entrada', description: 'Proponemos revisar las luces de acceso para que la entrada sea más cómoda de noche.', date: relativeDate(-3), unit: 'Unidad 4A', status: 'En agenda', interests: 9, interested: false, summary: 'Se tratará en la próxima reunión de propietarios.', messages: [{ id: 'community-comment-lights', author: 'Unidad 2B', text: 'También sería útil revisar el sensor del pasillo.', date: relativeDate(-2) }] },
      { id: 'community-topic-plants', title: 'Plantas en la terraza', description: 'Evaluar macetas de bajo mantenimiento en un sector de la terraza, sin obstruir la circulación.', date: relativeDate(-1), unit: 'Unidad 7B', status: 'Pendiente', interests: 4, interested: false, messages: [] },
    ],
    polls: [
      { id: 'community-poll-hours', title: 'Horario para la próxima jornada de mantenimiento', description: 'Elegí la franja que te resulte más conveniente.', date: relativeDate(-2), dueDate: relativeDate(6), options: ['Sábado por la mañana', 'Sábado por la tarde', 'Día de semana por la tarde'], votes: [12, 7, 3], closed: false, formal: false },
      { id: 'community-poll-formal', title: 'Mejora de la iluminación de espacios comunes', description: 'Simulación de la propuesta de renovación de luminarias. El presupuesto se presentará en la reunión.', date: relativeDate(-1), dueDate: relativeDate(8), options: ['A favor', 'En contra', 'Abstención'], votes: [14, 2, 3], closed: false, formal: true, attachment: { ...demoPdf, name: 'Propuesta-iluminacion-demo.pdf' } },
      { id: 'community-poll-closed', title: 'Preferencia de día para las reuniones', description: 'Consulta finalizada a las unidades del edificio.', date: relativeDate(-20), dueDate: relativeDate(-10), options: ['Martes', 'Jueves', 'Sábado'], votes: [10, 19, 6], closed: true, formal: false },
    ],
  };
}
