import { useMemo, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { WorkBook, utils as SheetUtils } from 'xlsx';
import { Field, Modal } from '../../components/UI';
import { usePortal } from '../../hooks/usePortal';
import { id } from '../../lib/utils';
import { fieldLabels, formatAmount as money, importFields, suggestMapping, validateRows, type ColumnMapping } from './helpers';

const MAX_ROWS = 500;
type Source = { name: string; book: WorkBook; utils: typeof SheetUtils };
const emptyMapping: ColumnMapping = { date: -1, title: -1, type: -1, category: -1, amount: -1 };

export function ImportMovements() {
  const { data, save } = usePortal();
  const [source, setSource] = useState<Source | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const committing = useRef(false);
  const loading = useRef(false);

  const sheet = useMemo(() => {
    if (!source || !sheetName) return { rows: [] as unknown[][], tooLarge: false };
    const worksheet = source.book.Sheets[sheetName];
    if (!worksheet?.['!ref']) return { rows: [] as unknown[][], tooLarge: false };
    const range = source.utils.decode_range(worksheet['!ref']);
    const tooLarge = range.e.r + 1 - headerRow > MAX_ROWS || range.e.c >= 64;
    const rows = source.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: '', blankrows: true, range: { s: { r: 0, c: 0 }, e: { r: Math.min(range.e.r, MAX_ROWS + 99), c: Math.min(range.e.c, 63) } } });
    return { rows, tooLarge };
  }, [source, sheetName, headerRow]);
  const headers = sheet.rows[headerRow - 1] || [];
  const mappingValid = importFields.every(field => mapping[field] >= 0 && mapping[field] < headers.length) && new Set(Object.values(mapping)).size === importFields.length;
  const validation = useMemo(() => mappingValid ? validateRows(sheet.rows.slice(headerRow), mapping, data.movements, headerRow + 1, Boolean(source?.book.Workbook?.WBProps?.date1904)) : [], [sheet.rows, headerRow, mapping, mappingValid, data.movements, source]);
  const valid = validation.filter(row => row.errors.length === 0);
  const duplicates = validation.filter(row => row.duplicate).length;
  const invalid = validation.length - valid.length - duplicates;
  const ready = mappingValid && !sheet.tooLarge && valid.length > 0 && !submitted.length;
  const savedCount = submitted.filter(itemId => data.movements.some(row => row.id === itemId)).length;

  function selectSheet(nextSource: Source, name: string, row = 1) {
    setSheetName(name); setHeaderRow(row); setSubmitted([]); setConfirming(false);
    const worksheet = nextSource.book.Sheets[name];
    const range = worksheet?.['!ref'] ? nextSource.utils.decode_range(worksheet['!ref']) : null;
    const first = range ? nextSource.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: '', range: { s: { r: row - 1, c: 0 }, e: { r: row - 1, c: Math.min(range.e.c, 63) } } })[0] || [] : [];
    setMapping(suggestMapping(first));
  }
  async function loadFile(file: File) {
    if (loading.current) return;
    loading.current = true; setBusy(true); setError(''); setSource(null); setSubmitted([]); setConfirming(false);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Elegí un archivo XLSX, XLS o CSV.');
      if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('El archivo debe tener contenido y pesar hasta 5 MB.');
      const xlsx = await import('xlsx');
      const buffer = await file.arrayBuffer();
      let content: string | ArrayBuffer = buffer;
      if (/\.csv$/i.test(file.name)) {
        try { content = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
        catch { content = new TextDecoder('windows-1252').decode(buffer); }
      }
      const book = xlsx.read(content, { type: typeof content === 'string' ? 'string' : 'array', raw: true, cellDates: false, sheetRows: MAX_ROWS + 101, bookVBA: false });
      if (!book.SheetNames.length) throw new Error('El archivo no contiene hojas legibles.');
      // SheetJS keeps the full extent when sheetRows truncates a large workbook.
      for (const worksheet of Object.values(book.Sheets)) {
        if (worksheet['!fullref']) worksheet['!ref'] = worksheet['!fullref'];
      }
      const nextSource = { name: file.name, book, utils: xlsx.utils };
      setSource(nextSource); selectSheet(nextSource, book.SheetNames[0]);
    } catch (err) { setError(`No se pudo leer el archivo. ${err instanceof Error ? err.message : 'Revisá el formato.'}`); }
    finally { loading.current = false; setBusy(false); }
  }
  function commit() {
    if (committing.current || !ready) return;
    committing.current = true;
    const rows = validateRows(sheet.rows.slice(headerRow), mapping, data.movements, headerRow + 1, Boolean(source?.book.Workbook?.WBProps?.date1904)).filter(row => !row.errors.length && row.item);
    const ids: string[] = [];
    rows.forEach(row => { const itemId = id(); ids.push(itemId); save('movements', { ...row.item!, id: itemId }); });
    setSubmitted(ids); setConfirming(false); committing.current = false;
  }
  function reset() { setSource(null); setSubmitted([]); setMapping(emptyMapping); setError(''); }

  return <section className="section finance-surface"><div className="section-heading"><h2>Importar movimientos</h2></div>
    <p className="muted">XLSX, XLS o CSV. Hasta 5 MB y 500 movimientos por hoja. Los archivos se procesan en este dispositivo.</p>
    <div className={`finance-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; if (event.dataTransfer.files.length !== 1) { setError('Seleccioná un solo archivo por importación.'); return; } void loadFile(event.dataTransfer.files[0]); }}>
      <Upload size={26} aria-hidden="true"/><Field label={busy ? 'Leyendo archivo…' : 'Seleccionar o arrastrar archivo'}><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; }}/></Field>
    </div>
    {busy && <p role="status">Preparando la vista previa…</p>}{error && <p className="error" role="alert">{error}</p>}
    {source && <>
      <div className="finance-file-heading"><FileSpreadsheet size={22} aria-hidden="true"/><strong className="finance-filename">{source.name}</strong><button className="button secondary small" onClick={reset}><X size={18}/>Quitar archivo</button></div>
      <div className="finance-filters"><Field label="Hoja"><select value={sheetName} onChange={event => selectSheet(source, event.target.value)}>{source.book.SheetNames.map(name => <option key={name}>{name}</option>)}</select></Field><Field label="Fila de encabezados"><select value={headerRow} onChange={event => selectSheet(source, sheetName, Number(event.target.value))}>{Array.from({ length: Math.min(100, sheet.rows.length) }, (_, index) => <option key={index} value={index + 1}>Fila {index + 1}</option>)}</select></Field></div>
      {sheet.tooLarge && <p className="error" role="alert">Esta hoja supera los 500 movimientos o las 64 columnas. Dividila en archivos más pequeños antes de confirmar.</p>}
      {!sheet.rows.length && <p className="error" role="alert">La hoja está vacía.</p>}
      <fieldset className="finance-mapping"><legend>Asignación de columnas</legend><div className="finance-filters">{importFields.map(field => <Field key={field} label={fieldLabels[field]}><select value={mapping[field]} disabled={Boolean(submitted.length)} onChange={event => setMapping(previous => ({ ...previous, [field]: Number(event.target.value) }))}><option value={-1}>Seleccionar columna</option>{headers.map((header, index) => <option key={index} value={index}>{source.utils.encode_col(index)} · {String(header || 'Sin encabezado').slice(0, 100)}</option>)}</select></Field>)}</div></fieldset>
      {!mappingValid && <p className="muted">Asigná una columna diferente a cada campo.</p>}
      <div className="finance-table-wrap" tabIndex={0} role="region" aria-label="Vista previa del archivo"><table className="finance-table"><caption>Vista previa · primeras {Math.min(8, Math.max(0, sheet.rows.length - headerRow))} filas de datos</caption><thead><tr><th scope="col">Fila</th>{headers.map((header, index) => <th key={index} scope="col">{String(header || `Columna ${index + 1}`)}</th>)}</tr></thead><tbody>{sheet.rows.slice(headerRow, headerRow + 8).map((row, index) => <tr key={index}><th scope="row">{headerRow + index + 1}</th>{headers.map((_, column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>
      {mappingValid && <><p role="status">{valid.length} filas válidas · {invalid} con errores · {duplicates} duplicadas</p>
        <div className="finance-table-wrap" tabIndex={0} role="region" aria-label="Validación de movimientos"><table className="finance-table"><caption>Validación · {validation.length > 50 ? 'primeras 50 filas' : 'todas las filas'}</caption><thead><tr><th scope="col">Fila</th><th scope="col">Concepto</th><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Categoría</th><th scope="col">Importe</th><th scope="col">Resultado</th></tr></thead><tbody>{validation.slice(0, 50).map(row => <tr key={row.row}><th scope="row">{row.row}</th><td>{row.item?.title || String(sheet.rows[row.row - 1]?.[mapping.title] || '')}</td><td>{row.item?.date || '—'}</td><td>{row.item?.type || '—'}</td><td>{row.item?.category || '—'}</td><td>{row.item ? money(row.item.amount || 0) : '—'}</td><td>{row.errors.join('; ') || 'Válida'}</td></tr>)}</tbody></table></div>
        <p className="muted">Se omiten filas vacías, inválidas y duplicadas. Los importes deben ser positivos; el tipo indica Ingreso o Egreso.</p>
        <div className="form-actions"><button className="button" disabled={!ready} onClick={() => setConfirming(true)}><Check size={19}/>Importar {valid.length} movimientos válidos</button></div>
      </>}
      {submitted.length > 0 && <p role="status" className={savedCount === submitted.length ? 'finance-success' : 'error'}>{savedCount === submitted.length ? `${savedCount} movimientos importados y guardados en este dispositivo.` : `Se guardaron ${savedCount} de ${submitted.length} movimientos. Revisá el espacio disponible y volvé a seleccionar el archivo; se omitirán los movimientos ya guardados.`}</p>}
    </>}
    {confirming && <Modal title="Confirmar importación" onClose={() => setConfirming(false)}><p>Se agregarán {valid.length} movimientos de “{source?.name}”, hoja “{sheetName}”. Se omitirán {invalid} filas inválidas y {duplicates} duplicadas.</p><div className="form-actions"><button className="button secondary" onClick={() => setConfirming(false)}>Volver</button><button className="button" disabled={!ready} onClick={commit}><Check size={19}/>Confirmar importación</button></div></Modal>}
  </section>;
}
