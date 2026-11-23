import { useRef, useState } from 'react';

export function useAsyncAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(operation: () => void | Promise<void>) {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError('');
    try { await operation(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Volvé a intentar.'); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  return { run, busy, error, clearError: () => setError(''), isPending: () => pending.current };
}
