import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Confirm, DocumentActions, Empty, Field, Modal, UploadField } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { formatDate, id, today } from '../../lib/utils';
import { availablePeriods, categories, currentPeriod, formatAmount as money, movementKey, parseAmount, parseDate, periodLabel, signedTotal, sumAmounts } from './helpers';

function MovementForm({ item, onClose }: { item: Entity; onClose: () => void }) {
  const { data, save, notify } = usePortal();
  const [draft, setDraft] = useState(item);
  const [amount, setAmount] = useState(item.amount ? String(item.amount).replace('.', ',') : '');
  const [error, setError] = useState('');
  const set = (patch: Partial<Entity>) => setDraft(previous => ({ ...previous, ...patch }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (!parseDate(draft.date) || parsed === null || !draft.title.trim() || !draft.category?.trim()) { setError('Revisá fecha, concepto, categoría e importe positivo (hasta 2 decimales).'); return; }
    const next = { ...draft, title: draft.title.trim(), category: draft.category.trim(), amount: parsed, period: undefined };
    if (data.movements.some(row => row.id !== next.id && movementKey(row) === movementKey(next))) { setError('Ya existe un movimiento con la misma fecha, concepto, tipo e importe.'); return; }
    save('movements', next); notify('Movimiento guardado.'); onClose();
  }
  return <Modal title={data.movements.some(row => row.id === item.id) ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
    <form onSubmit={submit} className="finance-form">
      <Field label="Concepto"><input required maxLength={240} value={draft.title} onChange={e => set({ title: e.target.value })}/></Field>
      <div className="form-grid"><Field label="Fecha"><input type="date" required value={draft.date} onChange={e => set({ date: e.target.value })}/></Field><Field label="Tipo"><select value={draft.type} onChange={e => set({ type: e.target.value })}><option>Ingreso</option><option>Egreso</option></select></Field></div>
      <div className="form-grid"><Field label="Importe en pesos" hint="Ejemplo: 125.000,50"><input inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)}/></Field><Field label="Categoría"><input list="movement-categories" maxLength={80} required value={draft.category || ''} onChange={e => set({ category: e.target.value })}/><datalist id="movement-categories">{[...new Set([...categories, ...data.movements.map(row => row.category || '').filter(Boolean)])].map(category => <option key={category} value={category}/>)}</datalist></Field></div>
      <Field label="Detalle"><textarea rows={3} maxLength={2000} value={draft.description} onChange={e => set({ description: e.target.value })}/></Field>
      <UploadField value={draft.attachment} onChange={attachment => set({ attachment })}/>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button" type="submit">Guardar movimiento</button></div>
    </form>
  </Modal>;
}

export function Movements({ admin = false, newRequested = false, onNewHandled }: { admin?: boolean; newRequested?: boolean; onNewHandled?: () => void }) {
  const { data, remove, notify } = usePortal();
  const makeNew = (): Entity => ({ id: id(), title: '', date: today(), description: '', type: 'Egreso', category: 'Mantenimiento' });
  const [editing, setEditing] = useState<Entity | null>(() => admin && newRequested ? makeNew() : null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [period, setPeriod] = useState(currentPeriod);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const periodRows = data.movements.filter(row => !period || row.date.startsWith(period));
  const filtered = periodRows.filter(row => (!type || row.type === type) && (!category || row.category === category)).sort((a, b) => b.date.localeCompare(a.date));
  const income = sumAmounts(periodRows.filter(row => row.type === 'Ingreso'));
  const outgoing = sumAmounts(periodRows.filter(row => row.type === 'Egreso'));
  const close = () => { setEditing(null); onNewHandled?.(); };
  return <section className="section finance-surface" aria-label="Movimientos y saldo">
    <div className="finance-summary" aria-label="Resumen de cuentas">
      <div><span>Saldo actual del consorcio</span><strong>{money(data.settings.openingBalance + signedTotal(data.movements))}</strong></div>
      <div><span>Ingresos · {period ? periodLabel(period) : 'todos los períodos'}</span><strong>{money(income)}</strong></div>
      <div><span>Egresos · {period ? periodLabel(period) : 'todos los períodos'}</span><strong>{money(outgoing)}</strong></div>
    </div>
    <div className="section-heading"><h2>Movimientos</h2>{admin && <button className="button" onClick={() => setEditing(makeNew())}><Plus size={19}/>Nuevo movimiento</button>}</div>
    <div className="finance-filters"><Field label="Período"><select value={period} onChange={e => setPeriod(e.target.value)}><option value="">Todos los períodos</option>{availablePeriods(data.movements).map(value => <option key={value} value={value}>{periodLabel(value)}</option>)}</select></Field><Field label="Tipo"><select value={type} onChange={e => setType(e.target.value)}><option value="">Todos</option><option>Ingreso</option><option>Egreso</option></select></Field><Field label="Categoría"><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{[...new Set(data.movements.map(row => row.category).filter((value): value is string => Boolean(value)))].sort().map(value => <option key={value}>{value}</option>)}</select></Field></div>
    <p className="muted" role="status">{filtered.length} movimientos · Neto de la selección: {money(signedTotal(filtered))}</p>
    {filtered.length === 0 ? <Empty>No hay movimientos con estos filtros.</Empty> : <ul className="list finance-list">{filtered.map(row => <li className="list-row finance-movement" key={row.id}>
      <span className={`finance-direction ${row.type === 'Ingreso' ? 'finance-income' : ''}`} aria-hidden="true">{row.type === 'Ingreso' ? <ArrowDownLeft size={23}/> : <ArrowUpRight size={23}/>}</span>
      <div className="row-main"><strong>{row.title}</strong><span className="muted">{formatDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {row.category}</span>{row.description && <p>{row.description}</p>}</div>
      <div className="finance-amount"><strong>{row.type === 'Ingreso' ? '+' : '−'}{money(row.amount || 0)}</strong><span className="muted">{row.type}</span></div>
      <div className="row-actions">{row.attachment && <DocumentActions attachment={row.attachment} label="Comprobante"/>}{admin && <><button className="button secondary small" aria-label={`Editar ${row.title}`} onClick={() => setEditing(row)}><Pencil size={18}/><span>Editar</span></button><button className="button danger small" aria-label={`Eliminar ${row.title}`} onClick={() => setDeleting(row)}><Trash2 size={18}/><span>Eliminar</span></button></>}</div>
    </li>)}</ul>}
    {editing && <MovementForm item={editing} onClose={close}/>}
    {deleting && <Confirm description={`Se eliminará “${deleting.title}” por ${money(deleting.amount || 0)} y se actualizará el saldo.`} onClose={() => setDeleting(null)} onConfirm={() => { remove('movements', deleting.id); notify('Movimiento eliminado.'); }}/>} 
  </section>;
}
