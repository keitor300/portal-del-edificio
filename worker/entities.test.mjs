import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEntity } from './entities.mjs';

const admin = { id: 'admin', role: 'admin' };
const owner = { id: 'owner', role: 'owner', unit: '7B' };
const base = { title: 'Registro de prueba', date: '2026-11-23', description: '' };
const fileId = '11111111-1111-4111-8111-111111111111';
const environment = (file = null) => ({ DB: { prepare: sql => ({ bind: value => ({ first: async () => {
  if (sql.includes('FROM files')) return value === fileId ? file : null;
  if (sql.includes('FROM units')) return value === '7B' ? { id: value } : null;
  return null;
} }) }) } });
const validate = (collection, fields, user = admin, env = environment()) => validateEntity(env, { ...base, ...fields }, collection, user);
const invalid = (collection, fields, user, env) => assert.rejects(validate(collection, fields, user, env), error => error.status === 400);

test('meetings require actual clock times, place, agenda and ordered optional ending', async () => {
  const meeting = { time: '19:00', endTime: '20:30', place: 'SUM', agenda: 'Cuentas del mes', status: 'Programada' };
  assert.equal((await validate('meetings', meeting)).endTime, '20:30');
  await validate('meetings', { ...meeting, endTime: '' });
  for (const patch of [{ time: '' }, { time: '25:00' }, { time: '9:00' }, { endTime: '20:75' }, { endTime: '18:00' }, { endTime: '19:00' }, { place: ' ' }, { agenda: '' }, { status: 'Inventado' }]) await invalid('meetings', { ...meeting, ...patch });
});

test('works and budgets require the information their forms promise', async () => {
  const work = { provider: 'Proveedor', amount: 12000, progress: 0, startDate: '2026-11-23', status: 'Planificada' };
  assert.equal((await validate('works', work)).progress, 0);
  for (const patch of [{ provider: '' }, { amount: undefined }, { amount: 0.001 }, { progress: undefined }, { progress: 101 }, { progress: 0.5 }, { startDate: '' }, { startDate: '2026-02-30' }, { status: 'Inválido' }]) await invalid('works', { ...work, ...patch });
  const budget = { amount: 15000, category: 'Mantenimiento', period: '2026-11', status: 'En evaluación' };
  assert.equal((await validate('budgets', budget)).amount, 15000);
  for (const patch of [{ amount: undefined }, { amount: -1 }, { category: '' }, { period: '2026-13' }, { period: '' }, { status: 'Otro' }]) await invalid('budgets', { ...budget, ...patch });
});

test('content rejects invalid operation, empty FAQ answers, missing places and invalid contacts', async () => {
  await validate('listings', { category: 'Departamento', type: 'Venta' });
  await invalid('listings', { category: 'Otro', type: 'Venta' });
  await invalid('listings', { category: 'Cochera', type: 'Otro' });
  await validate('lost', { place: 'Hall', status: 'En custodia' });
  await invalid('lost', { place: '', status: 'En custodia' });
  await invalid('faqs', { description: ' ' });
  await validate('faqs', { description: 'Respuesta' });
  await validate('contacts', { email: 'responsable@example.invalid', phone: '+54 (221) 555-0100' });
  await validate('contacts', { email: '', phone: '' });
  for (const fields of [{ email: 'sin-arroba' }, { email: 'a@b' }, { phone: 'javascript:alert(1)' }, { phone: '123' }]) await invalid('contacts', fields);
  await validate('statuses', { status: 'En mantenimiento' });
  await invalid('statuses', { status: 'Inventado' });
});

test('server keeps owner identity and initial state authoritative', async () => {
  const topic = await validate('topics', { unit: '8A', status: 'Resuelto', summary: 'Respuesta falsa' }, owner);
  assert.equal(topic.unit, '7B');
  assert.equal(topic.status, 'Pendiente');
  assert.equal(topic.summary, undefined);
  await invalid('topics', { status: 'Inventado' });
  await invalid('notices', { date: '' });
  await invalid('documents', { date: '2026-02-30' });
});

test('expense attachments must be unit-scoped PDFs from stored file metadata', async () => {
  const expense = { unit: '7B', amount: 15000, period: '2026-11', dueDate: '2026-11-30', status: 'Publicado', attachment: { url: `/api/files/${fileId}`, type: 'application/pdf' } };
  const file = { id: fileId, owner_id: 'admin', visibility: 'unit', unit: '7B', mime: 'application/pdf', name: 'Liquidacion.pdf' };
  assert.equal((await validate('expenses', expense, admin, environment(file))).attachment.type, 'application/pdf');
  await invalid('expenses', expense, admin, environment({ ...file, mime: 'image/png' }));
  await invalid('expenses', expense, admin, environment({ ...file, unit: '8A' }));
  await invalid('expenses', expense, admin, environment({ ...file, visibility: 'building' }));
  await invalid('expenses', { ...expense, attachment: null });
  await validate('expenses', { ...expense, status: 'Borrador', attachment: null });
});
