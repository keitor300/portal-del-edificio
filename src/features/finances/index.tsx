import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs } from '../../components/UI';
import { Movements } from './Movements';
import { Expenses } from './Expenses';
import { Budgets } from './Budgets';
import { ImportMovements } from './ImportMovements';
import './finances.css';

export { financeSeed } from './seed';

export function FinancesPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams();
  const items = [{ id: 'movimientos', label: 'Movimientos' }, { id: 'expensas', label: 'Expensas' }, { id: 'presupuestos', label: 'Presupuestos' }, ...(admin ? [{ id: 'importar', label: 'Importar' }] : [])];
  const requestedTab = params.get('tab') || 'movimientos';
  const tab = items.some(item => item.id === requestedTab) ? requestedTab : 'movimientos';
  const newRequested = admin && params.get('new') === '1';
  const onNewHandled = () => { if (params.has('new')) { const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true }); } };
  const shared = { admin, newRequested, onNewHandled };
  return <div className="finances"><PageHeader title={admin ? 'Finanzas' : 'Cuentas del edificio'} description={admin ? 'Movimientos, liquidaciones y presupuestos del consorcio.' : 'Saldo del consorcio, movimientos y presupuestos.'}/><Tabs items={items} value={tab} onChange={value => { const next = new URLSearchParams(params); next.set('tab', value); next.delete('new'); setParams(next); }}/>
    <div key={`${tab}-${newRequested ? 'new' : 'list'}`}>{tab === 'movimientos' ? <Movements {...shared}/> : tab === 'expensas' ? <Expenses {...shared}/> : tab === 'presupuestos' ? <Budgets {...shared}/> : <ImportMovements/>}</div>
  </div>;
}
export function ExpensesPage() { return <div className="finances"><PageHeader title="Expensas" description="Liquidaciones y vencimientos de tu unidad 7B."/><Expenses/></div>; }
export function BudgetsPage() { return <div className="finances"><PageHeader title="Presupuestos" description="Propuestas y gastos del consorcio por categoría."/><Budgets/></div>; }
