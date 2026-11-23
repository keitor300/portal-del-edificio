import { useRef, useState, type FormEvent } from 'react';
import { Check, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Confirm, DocumentActions, Empty, Field, Modal, Status } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import type { Entity } from '../../lib/types';
import { formatDate, id, readAttachment, today } from '../../lib/utils';
import { currentPeriod, entityPeriod, formatAmount as money, parseAmount, parseDate, periodLabel } from './helpers';
import { currentOwnerUnit } from '../auth/ownerAccounts';
import { BUILDING_UNITS } from '../services/model';
import { productionPortal } from '../../lib/api';

function ExpenseForm({ item, onClose }: { item: Entity; onClose: () => void }) {
  const { data, save, notify } = usePortal();
  const [draft, setDraft] = useState(item);
  const [amount, setAmount] = useState(item.amount ? String(item.amount).replace('.', ',') : '');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Entity>) => setDraft(previous => ({ ...previous, ...patch }));
  async function attach(file: File) {
    setReading(true); setError('');
    try {
      if (file.size > 1024 * 1024) throw new Error('El PDF debe pesar hasta 1 MB.');
      if (!file.name.toLowerCase().endsWith('.pdf') || !new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer()).includes('%PDF-')) throw new Error('Seleccioná un archivo PDF válido.');
      set({ attachment: await readAttachment(new File([file], file.name, { type: 'application/pdf' })) });
    } catch (err) { setError((err as Error).message); }
    finally { setReading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || reading) return;
    const parsed = parseAmount(amount);
    if (!BUILDING_UNITS.some(unit => unit === draft.unit)) { setError('Elegí la unidad de esta liquidación.'); return; }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period || '') || !parseDate(draft.dueDate) || parsed === null || !draft.attachment) { setError('Completá el período, el vencimiento, un importe positivo y el PDF.'); return; }
    if (data.expenses.some(row => row.id !== draft.id && row.unit === draft.unit && entityPeriod(row) === draft.period)) { setError('Ya hay una liquidación para esta unidad y período. Editá la existente para reemplazar su PDF.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      await save('expenses', { ...draft, title: `Expensas · ${periodLabel(draft.period!)}`, amount: parsed });
      notify(draft.status === 'Publicado' ? 'Liquidación publicada.' : 'Borrador guardado.'); onClose();
    } catch (cause) { setError((cause as Error).message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal title={data.expenses.some(row => row.id === item.id) ? 'Editar liquidación o reemplazar PDF' : 'Nueva liquidación'} onClose={() => { if (!saving.current) onClose(); }} icon={<FileText size={23} aria-hidden="true"/>}>
    <form onSubmit={submit} className="finance-form" aria-busy={busy}>
      <Field label="Unidad"><select aria-label="Unidad" required value={draft.unit || ''} disabled={busy || reading || data.expenses.some(row => row.id === item.id)} onChange={e => set({ unit: e.target.value, attachment: undefined })}><option value="">Elegí una unidad</option>{BUILDING_UNITS.map(unit => <option key={unit} value={unit}>Unidad {unit}</option>)}</select></Field>
      <div className="form-grid"><Field label="Período"><input type="month" required value={draft.period || ''} onChange={e => set({ period: e.target.value })}/></Field><Field label="Vencimiento"><input type="date" required value={draft.dueDate || ''} onChange={e => set({ dueDate: e.target.value })}/></Field></div>
      <Field label="Importe de la unidad en pesos"><input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></Field>
      <Field label="Detalle"><textarea rows={3} maxLength={2000} value={draft.description} onChange={e => set({ description: e.target.value })}/></Field>
      <Field label={draft.attachment ? 'Reemplazar PDF' : 'Liquidación en PDF'} hint="Hasta 1 MB."><input type="file" accept=".pdf,application/pdf" disabled={reading} onChange={e => { const file = e.target.files?.[0]; if (file) void attach(file); e.target.value = ''; }}/></Field>
      {reading && <p role="status">Leyendo PDF…</p>}{draft.attachment && <p className="finance-filename">{draft.attachment.name}</p>}
      <Field label="Estado"><select aria-label="Estado" value={draft.status} onChange={e => set({ status: e.target.value })}><option>Borrador</option><option>Publicado</option></select></Field>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" type="submit" disabled={reading || busy}>{busy ? 'Guardando…' : draft.status === 'Publicado' ? 'Guardar y publicar' : 'Guardar borrador'}</button></div>
    </form>
  </Modal>;
}

export function Expenses({ admin = false, newRequested = false, onNewHandled }: { admin?: boolean; newRequested?: boolean; onNewHandled?: () => void }) {
  const { data, update, remove, notify } = usePortal();
  const makeNew = (): Entity => ({ id: id(), title: '', description: '', date: today(), period: currentPeriod(), dueDate: `${currentPeriod()}-10`, status: 'Borrador', unit: productionPortal ? '' : '7B' });
  const [editing, setEditing] = useState<Entity | null>(() => admin && newRequested ? makeNew() : null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [actionError, setActionError] = useState('');
  const publishing = useRef(false);
  const [publishingId, setPublishingId] = useState('');
  async function publish(row: Entity) {
    if (publishing.current) return;
    publishing.current = true; setPublishingId(row.id); setActionError('');
    try { await update('expenses', row.id, { status: 'Publicado' }); notify('Liquidación publicada.'); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { publishing.current = false; setPublishingId(''); }
  }
  const visible = data.expenses.filter(row => admin ? !unitFilter || row.unit === unitFilter : row.status === 'Publicado' && (row.unit || (productionPortal ? '' : '7B')) === currentOwnerUnit()).sort((a, b) => entityPeriod(b).localeCompare(entityPeriod(a)) || (a.unit || '').localeCompare(b.unit || '', 'es', { numeric: true }));
  const current = visible.filter(row => entityPeriod(row) === currentPeriod());
  const history = visible.filter(row => entityPeriod(row) !== currentPeriod());
  function renderRow(row: Entity) {
    return <li key={row.id} className="list-row finance-document">
      <div className="row-main"><strong>{periodLabel(entityPeriod(row))}</strong><span className="muted">Unidad {row.unit || '7B'}{row.dueDate ? ` · Vence ${formatDate(row.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>{row.description && <p>{row.description}</p>}<Status tone={row.status === 'Publicado' ? 'green' : 'amber'}>{row.status || 'Borrador'}</Status></div>
      <div className="finance-amount"><strong>{money(row.amount || 0)}</strong><span className="muted">Importe de la unidad</span></div>
      <div className="row-actions">{row.attachment ? <DocumentActions attachment={row.attachment}/> : <span className="muted">Sin PDF adjunto</span>}{admin && <>
        {row.status !== 'Publicado' && <button className="button secondary small" disabled={!row.attachment || !!publishingId} onClick={() => void publish(row)}><Check size={18}/>{publishingId === row.id ? 'Publicando…' : 'Publicar'}</button>}
        <button className="button secondary small" aria-label={`Editar expensas de ${periodLabel(entityPeriod(row))}, unidad ${row.unit}`} onClick={() => setEditing(row)}><Pencil size={18}/>Editar / PDF</button>
        <button className="button danger small" aria-label={`Eliminar expensas de ${periodLabel(entityPeriod(row))}, unidad ${row.unit}`} onClick={() => setDeleting(row)}><Trash2 size={18}/>Eliminar</button>
      </>}</div>
    </li>;
  }
  return <div className="finance-surface">
    {actionError && <p className="error" role="alert">{actionError}</p>}
    {admin && <Field label="Filtrar por unidad"><select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas las unidades</option>{BUILDING_UNITS.map(unit => <option key={unit} value={unit}>Unidad {unit}</option>)}</select></Field>}
    <section className="section"><div className="section-heading"><h2>{admin ? 'Liquidaciones del mes' : 'Liquidación actual'}</h2>{admin && <button className="button" onClick={() => setEditing(makeNew())}><Plus size={19}/>Nueva liquidación</button>}</div>{current.length ? <ul className="list finance-list">{current.map(renderRow)}</ul> : <Empty>{admin ? 'Todavía no hay una liquidación para este mes.' : 'La liquidación de este mes todavía no está publicada.'}</Empty>}</section>
    <section className="section"><div className="section-heading"><h2>Historial de expensas</h2></div><div className="finance-filters"><Field label="Período del historial"><select value={historyPeriod} onChange={e => setHistoryPeriod(e.target.value)}><option value="">Todos los períodos</option>{[...new Set(history.map(entityPeriod))].map(period => <option key={period} value={period}>{periodLabel(period)}</option>)}</select></Field></div>{history.filter(row => !historyPeriod || entityPeriod(row) === historyPeriod).length ? <ul className="list finance-list">{history.filter(row => !historyPeriod || entityPeriod(row) === historyPeriod).map(renderRow)}</ul> : <Empty>No hay liquidaciones para este período.</Empty>}</section>
    {editing && <ExpenseForm item={editing} onClose={() => { setEditing(null); onNewHandled?.(); }}/>}
    {deleting && <Confirm description={`Se eliminará la liquidación de ${periodLabel(entityPeriod(deleting))} y su PDF del historial.`} onClose={() => setDeleting(null)} onConfirm={async () => { await remove('expenses', deleting.id); notify('Liquidación eliminada.'); }}/>}
  </div>;
}
