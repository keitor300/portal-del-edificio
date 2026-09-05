import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Confirm, DocumentActions, Empty, Field, Modal, Status, UploadField } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { id, today } from '../../lib/utils';
import { availablePeriods, budgetStatuses, categories, currentPeriod, entityPeriod, formatAmount as money, parseAmount, periodLabel, sumAmounts } from './helpers';

function BudgetForm({ item, onClose }: { item: Entity; onClose: () => void }) {
  const { data, save, notify } = usePortal();
  const [draft, setDraft] = useState(item);
  const [amount, setAmount] = useState(item.amount ? String(item.amount).replace('.', ',') : '');
  const [error, setError] = useState('');
  const set = (patch: Partial<Entity>) => setDraft(previous => ({ ...previous, ...patch }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null || !draft.title.trim() || !draft.category?.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period || '')) { setError('Completá el título, período, categoría e importe positivo.'); return; }
    save('budgets', { ...draft, title: draft.title.trim(), category: draft.category.trim(), amount: parsed }); notify('Presupuesto guardado.'); onClose();
  }
  return <Modal title={data.budgets.some(row => row.id === item.id) ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={onClose}>
    <form onSubmit={submit} className="finance-form"><Field label="Título"><input required maxLength={240} value={draft.title} onChange={e => set({ title: e.target.value })}/></Field>
      <div className="form-grid"><Field label="Período"><input type="month" required value={draft.period} onChange={e => set({ period: e.target.value })}/></Field><Field label="Importe presupuestado en pesos"><input inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)}/></Field></div>
      <Field label="Categoría"><input list="budget-categories" maxLength={80} required value={draft.category || ''} onChange={e => set({ category: e.target.value })}/><datalist id="budget-categories">{[...new Set([...categories, ...data.movements.map(row => row.category || '').filter(Boolean)])].map(category => <option key={category} value={category}/>)}</datalist></Field>
      <Field label="Proveedor"><input maxLength={160} value={draft.provider || ''} onChange={e => set({ provider: e.target.value })}/></Field>
      <Field label="Detalle"><textarea rows={3} maxLength={2000} value={draft.description} onChange={e => set({ description: e.target.value })}/></Field>
      <Field label="Estado"><select value={draft.status} onChange={e => set({ status: e.target.value })}>{budgetStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>
      <UploadField value={draft.attachment} onChange={attachment => set({ attachment })}/>{error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button" type="submit">Guardar presupuesto</button></div>
    </form>
  </Modal>;
}

export function Budgets({ admin = false, newRequested = false, onNewHandled }: { admin?: boolean; newRequested?: boolean; onNewHandled?: () => void }) {
  const { data, remove, notify } = usePortal();
  const makeNew = (): Entity => ({ id: id(), title: '', description: '', date: today(), period: currentPeriod(), category: 'Mantenimiento', status: 'Borrador' });
  const [editing, setEditing] = useState<Entity | null>(() => admin && newRequested ? makeNew() : null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [period, setPeriod] = useState(currentPeriod);
  const [status, setStatus] = useState('');
  const visible = data.budgets.filter(row => admin || row.status !== 'Borrador');
  const periodBudgets = visible.filter(row => !period || entityPeriod(row) === period);
  const rows = periodBudgets.filter(row => !status || row.status === status).sort((a, b) => entityPeriod(b).localeCompare(entityPeriod(a)) || b.date.localeCompare(a.date));
  const approved = periodBudgets.filter(row => row.status === 'Aprobado' || row.status === 'Finalizado');
  const categoryPeriods = [...new Set(approved.map(row => JSON.stringify([entityPeriod(row), row.category || 'Otros'])))].map(key => JSON.parse(key) as [string, string]);
  const comparisons = categoryPeriods.map(([month, category]) => ({ month, category, planned: sumAmounts(approved.filter(row => entityPeriod(row) === month && (row.category || 'Otros') === category)), actual: sumAmounts(data.movements.filter(row => row.type === 'Egreso' && row.date.startsWith(month) && (row.category || 'Otros') === category)) }));
  return <div className="finance-surface"><section className="section"><div className="section-heading"><h2>Presupuestos</h2>{admin && <button className="button" onClick={() => setEditing(makeNew())}><Plus size={19}/>Nuevo presupuesto</button>}</div>
    <div className="finance-filters"><Field label="Período"><select value={period} onChange={e => setPeriod(e.target.value)}><option value="">Todos los períodos</option>{availablePeriods(visible).map(value => <option key={value} value={value}>{periodLabel(value)}</option>)}</select></Field><Field label="Estado"><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{budgetStatuses.filter(value => admin || value !== 'Borrador').map(value => <option key={value}>{value}</option>)}</select></Field></div>
    {rows.length ? <ul className="list finance-list">{rows.map(row => <li className="list-row finance-document" key={row.id}><div className="row-main"><strong>{row.title}</strong><span className="muted">{periodLabel(entityPeriod(row))} · {row.category}{row.provider ? ` · ${row.provider}` : ''}</span>{row.description && <p>{row.description}</p>}<Status tone={row.status === 'Aprobado' || row.status === 'Finalizado' ? 'green' : row.status === 'Rechazado' ? 'red' : 'amber'}>{row.status || 'En evaluación'}</Status></div><div className="finance-amount"><strong>{money(row.amount || 0)}</strong><span className="muted">Presupuestado</span></div><div className="row-actions">{row.attachment && <DocumentActions attachment={row.attachment} label="Ver presupuesto"/>}{admin && <><button className="button secondary small" aria-label={`Editar ${row.title}`} onClick={() => setEditing(row)}><Pencil size={18}/>Editar</button><button className="button danger small" aria-label={`Eliminar ${row.title}`} onClick={() => setDeleting(row)}><Trash2 size={18}/>Eliminar</button></>}</div></li>)}</ul> : <Empty>No hay presupuestos con estos filtros.</Empty>}
    </section><section className="section" aria-label="Comparación de presupuestos"><div className="section-heading"><h2>Presupuestado y gastado</h2></div><p className="muted">Presupuestos aprobados o finalizados frente a egresos de la misma categoría y período.</p>
    {comparisons.length ? <ul className="list finance-list">{comparisons.map(row => { const difference = Math.round((row.planned - row.actual) * 100) / 100; return <li className="list-row finance-comparison" key={`${row.month}-${row.category}`}><div className="row-main"><strong>{row.category}</strong><span className="muted">{periodLabel(row.month)}</span></div><dl><div><dt>Presupuestado</dt><dd>{money(row.planned)}</dd></div><div><dt>Gastado</dt><dd>{money(row.actual)}</dd></div><div><dt>{difference < 0 ? 'Excedido' : 'Disponible'}</dt><dd className={difference < 0 ? 'finance-over' : ''}>{money(Math.abs(difference))}</dd></div></dl></li>; })}</ul> : <Empty>No hay presupuestos aprobados para comparar en este período.</Empty>}
    </section>{editing && <BudgetForm item={editing} onClose={() => { setEditing(null); onNewHandled?.(); }}/>} {deleting && <Confirm description={`Se eliminará el presupuesto “${deleting.title}”. Los movimientos registrados se conservarán.`} onClose={() => setDeleting(null)} onConfirm={() => { remove('budgets', deleting.id); notify('Presupuesto eliminado.'); }}/>} </div>;
}
