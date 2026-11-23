import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { test } from 'node:test';
import { bookingRange } from './booking.mjs';

const migration = readFileSync(new URL('../migrations/0001_production.sql', import.meta.url), 'utf8');
const now = Date.parse('2026-11-23T08:00:00-03:00');
function database(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(migration);
  db.prepare("INSERT INTO users(id,name,email,unit,role,status,password_hash) VALUES ('owner','Test','owner@example.invalid','7B','owner','approved','test-only')").run();
  return db;
}
function insert(db, id, date, start, end, status = 'confirmed') {
  const range = bookingRange(date, start, end, now);
  return db.prepare(`INSERT INTO reservations(id,unit,created_by,date,end_date,start_minute,end_minute,status,accepted_rules)
    VALUES (?,'7B','owner',?,?,?,?,?,'Reglamento aceptado')`).run(id, date, range.endDate, range.startMinute, range.endMinute, status);
}

test('opening and closing apply every day, including Friday/Saturday overnight and half-hour choices', () => {
  for (let d = 23; d <= 29; d++) {
    const date = `2026-11-${d}`;
    assert.ok(bookingRange(date, '08:30', '09:00', now));
    assert.ok(bookingRange(date, '15:00', '23:30', now));
    assert.ok(bookingRange(date, '15:30', '01:00', now));
    assert.throws(() => bookingRange(date, '08:00', '09:00', now), /INVALID_TIME/);
    assert.throws(() => bookingRange(date, '15:15', '17:00', now), /INVALID_TIME/);
    if (d === 27 || d === 28) {
      assert.ok(bookingRange(date, '23:30', '03:00', now));
      assert.throws(() => bookingRange(date, '23:30', '03:30', now), /AFTER_CLOSING/);
    } else assert.throws(() => bookingRange(date, '23:30', '01:30', now), /AFTER_CLOSING/);
  }
});

test('invalid dates, equal times, malformed times and past starts are rejected', () => {
  for (const date of ['2026-02-30', '2026-13-01', 'invalid']) assert.throws(() => bookingRange(date, '15:00', '17:00', now), /INVALID_DATE/);
  for (const [start, end] of [['15:00', '15:00'], ['25:00', '17:00'], ['15:00', '12:00'], ['8:30', '10:00']]) assert.throws(() => bookingRange('2026-11-24', start, end, now));
  assert.throws(() => bookingRange('2026-11-22', '15:00', '17:00', now), /START_IN_PAST/);
  assert.ok(bookingRange('2026-11-23', '08:30', '10:00', Date.parse('2026-11-23T11:29:59Z')));
  assert.throws(() => bookingRange('2026-11-23', '08:30', '10:00', Date.parse('2026-11-23T11:30:00Z')), /START_IN_PAST/);
});

test('database rejects overlap, permits adjacent ranges and releases cancelled reservations', () => {
  const db = database();
  try {
    insert(db, 'a', '2026-11-24', '15:00', '17:30');
    for (const [start, end] of [['14:00', '16:00'], ['15:30', '16:00'], ['17:00', '19:00'], ['14:00', '19:00']]) {
      assert.throws(() => insert(db, crypto.randomUUID(), '2026-11-24', start, end), /RESERVATION_CONFLICT/);
    }
    insert(db, 'before', '2026-11-24', '14:00', '15:00');
    insert(db, 'after', '2026-11-24', '17:30', '18:00');
    db.prepare("UPDATE reservations SET status='cancelled' WHERE id='a'").run();
    insert(db, 'replacement', '2026-11-24', '15:00', '17:30');
    assert.throws(() => db.prepare("UPDATE reservations SET status='confirmed' WHERE id='a'").run(), /RESERVATION_CONFLICT/);
  } finally { db.close(); }
});

test('overnight ranges block their continuation, blocked dates cannot silently invalidate bookings', () => {
  const db = database();
  try {
    insert(db, 'overnight', '2026-11-27', '23:00', '03:00');
    assert.throws(() => insert(db, 'overlap', '2026-11-27', '23:30', '02:00'), /RESERVATION_CONFLICT/);
    assert.throws(() => db.prepare("INSERT INTO blocked_dates(date,created_by) VALUES ('2026-11-28','owner')").run(), /DATE_HAS_RESERVATIONS/);
    insert(db, 'next-morning', '2026-11-28', '08:30', '10:00');
    db.prepare("INSERT INTO blocked_dates(date,created_by) VALUES ('2026-11-30','owner')").run();
    assert.throws(() => insert(db, 'blocked', '2026-11-29', '23:00', '01:00'), /DATE_BLOCKED/);
  } finally { db.close(); }
});

test('two independent connections racing for the same interval yield exactly one booking', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-booking-'));
  const path = join(dir, 'test.sqlite');
  const db = database(path);
  db.exec('PRAGMA journal_mode=WAL');
  db.close();
  const range = bookingRange('2026-11-27', '21:00', '03:00', now);
  const race = id => new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { DatabaseSync } = require('node:sqlite');
      const { parentPort, workerData } = require('node:worker_threads');
      const db = new DatabaseSync(workerData.path);
      db.exec('PRAGMA busy_timeout=5000');
      parentPort.postMessage('ready');
      parentPort.once('message', () => {
        try {
          db.prepare("INSERT INTO reservations(id,unit,created_by,date,end_date,start_minute,end_minute,accepted_rules) VALUES (?,'7B','owner',?,?,?,?, 'Rules')")
            .run(workerData.id, workerData.range.date, workerData.range.endDate, workerData.range.startMinute, workerData.range.endMinute);
          parentPort.postMessage('confirmed');
        } catch (error) { parentPort.postMessage(error.message); }
        finally { db.close(); }
      });
    `, { eval: true, workerData: { path, id, range } });
    worker.once('error', reject);
    worker.once('message', () => resolve({ worker, result: new Promise((done, fail) => { worker.once('message', done); worker.once('error', fail); }) }));
  });
  try {
    const contenders = await Promise.all([race('first'), race('second')]);
    contenders.forEach(({ worker }) => worker.postMessage('book'));
    const outcomes = await Promise.all(contenders.map(({ result }) => result));
    assert.equal(outcomes.filter(value => value === 'confirmed').length, 1);
    assert.equal(outcomes.filter(value => value.includes('RESERVATION_CONFLICT')).length, 1);
    await Promise.all(contenders.map(({ worker }) => worker.terminate()));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('suspension revokes sessions and unit login cannot be ambiguous', () => {
  const db = database();
  try {
    db.prepare("INSERT INTO sessions VALUES ('hash','owner',9999999999,1)").run();
    db.prepare("UPDATE users SET status='suspended' WHERE id='owner'").run();
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
    assert.throws(() => db.prepare("INSERT INTO users(id,name,email,unit,role,password_hash) VALUES ('other','Other','other@example.invalid','7B','owner','test')").run(), /UNIQUE/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM units').get().n, 52);
    assert.equal(db.prepare('SELECT count(*) AS n FROM entities').get().n, 0);
  } finally { db.close(); }
});
