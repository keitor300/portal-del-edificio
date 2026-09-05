import type { DemoData, Entity } from '../../lib/types';
import { demoPdf, today } from '../../lib/utils';
import { monthOffset, periodLabel } from './helpers';

export function financeSeed(): Pick<DemoData, 'movements' | 'expenses' | 'budgets'> {
  const movements: Entity[] = [];
  const expenses: Entity[] = [];
  const budgets: Entity[] = [];
  // Current statement plus six complete earlier periods, relative to the demo date.
  for (let offset = 0; offset >= -6; offset--) {
    const period = monthOffset(offset);
    const date = `${period}-01`;
    const amount = 2184000 + (offset + 6) * 26000;
    expenses.push({ id: `expense-${period}`, title: `Expensas · ${periodLabel(period)}`, description: 'Liquidación mensual del consorcio. Documento de demostración.', date, period, dueDate: `${period}-10`, amount: Math.round(amount / 52), status: 'Publicado', attachment: { ...demoPdf, name: `Expensas-${period}-demo.pdf` }, unit: '7B' });
    movements.push(
      { id: `movement-${period}-income`, title: 'Cobro de expensas ordinarias', description: 'Aportes de las unidades del edificio.', date, amount, type: 'Ingreso', category: 'Expensas', attachment: { ...demoPdf, name: `Cobros-${period}.pdf` } },
      { id: `movement-${period}-staff`, title: 'Haberes y cargas sociales', description: 'Personal del edificio.', date, amount: 1180000 + (offset + 6) * 15000, type: 'Egreso', category: 'Personal', attachment: { ...demoPdf, name: `Haberes-${period}.pdf` } },
      { id: `movement-${period}-services`, title: 'Servicios de espacios comunes', description: 'Electricidad, agua y servicios comunes.', date, amount: 345000 + (offset + 6) * 7000, type: 'Egreso', category: 'Servicios' },
      { id: `movement-${period}-maintenance`, title: 'Mantenimiento de ascensores y bombas', description: 'Servicio preventivo mensual.', date, amount: 260000 + (offset + 6) * 5000, type: 'Egreso', category: 'Mantenimiento', attachment: { ...demoPdf, name: `Mantenimiento-${period}.pdf` } },
      { id: `movement-${period}-insurance`, title: 'Seguro integral del consorcio', description: 'Cuota mensual de la póliza.', date, amount: 125000, type: 'Egreso', category: 'Seguros' },
    );
    budgets.push({ id: `budget-${period}-maintenance`, title: 'Mantenimiento preventivo', description: 'Ascensores, bombas y revisión técnica mensual.', date, period, category: 'Mantenimiento', amount: 300000 + (offset + 6) * 5000, status: offset === 0 ? 'Aprobado' : 'Finalizado', provider: 'Servicio técnico del edificio', attachment: { ...demoPdf, name: `Presupuesto-mantenimiento-${period}.pdf` } });
  }
  budgets.push({ id: 'budget-waterproofing', title: 'Impermeabilización de terraza', description: 'Propuesta pendiente de evaluación por el consorcio.', date: today(), period: monthOffset(0), category: 'Obras', amount: 1750000, status: 'En evaluación', provider: 'Proveedor a confirmar', attachment: { ...demoPdf, name: 'Presupuesto-terraza-demo.pdf' } });
  return { movements, expenses, budgets };
}
