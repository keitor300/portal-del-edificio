export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  } });
}
export async function body(request, maxBytes = 24000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Formato de solicitud incorrecto.');
  if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'La solicitud es demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Faltan datos.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'La solicitud es demasiado grande.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Los datos no son válidos.'); }
}
export function text(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, 'Revisá los campos obligatorios.');
  return value.trim();
}
export function sameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new HttpError(403, 'Origen de solicitud no permitido.');
}
