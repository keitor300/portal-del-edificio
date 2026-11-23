import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = await build({ stdin: { contents: `export { buildingDate, today, relativeDate, formatDate } from './utils'; export { reservationEndsAt, rangeUnavailable } from '../features/services/model'; export { isPastMeeting, pollHasEnded } from '../features/community/model';`, resolveDir: fileURLToPath(new URL('.', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'node' });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;

test('building dates, poll closing and SUM times stay in Argentina across device time zones', () => {
  const script = `
    import assert from 'node:assert/strict';
    const RealDate = Date;
    const instant = '2026-11-24T01:00:00Z';
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return new RealDate(instant).getTime(); }
    };
    const { buildingDate, today, relativeDate, formatDate, reservationEndsAt, rangeUnavailable, isPastMeeting, pollHasEnded } = await import(${JSON.stringify(moduleUrl)});
    assert.equal(today(), '2026-11-23');
    assert.equal(relativeDate(1), '2026-11-24');
    assert.equal(buildingDate(new Date('2027-01-01T02:59:59Z')), '2026-12-31');
    assert.equal(buildingDate(new Date('2027-01-01T03:00:00Z')), '2027-01-01');
    assert.equal(formatDate(instant, {day:'numeric'}), '23');
    assert.equal(pollHasEnded({dueDate:'2026-11-23'}), false);
    assert.equal(pollHasEnded({dueDate:'2026-11-22'}), true);
    assert.equal(isPastMeeting({date:'2026-11-23',time:'23:00'}), false);
    assert.equal(isPastMeeting({date:'2026-11-23',time:'21:00'}), true);
    const settings = {rules:'Test',blockedDates:[]};
    assert.equal(rangeUnavailable('2026-11-23','23:00','01:00',[],settings), '');
    assert.equal(rangeUnavailable('2026-11-23','21:00','01:00',[],settings), 'La hora de inicio ya pasó.');
    assert.equal(reservationEndsAt({date:'2026-11-23',time:'23:00',endTime:'01:00'}), new Date('2026-11-24T04:00:00Z').getTime());
  `;
  for (const TZ of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'America/Argentina/Buenos_Aires']) {
    try { execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: {...process.env, TZ}, stdio:'pipe' }); }
    catch (error) { assert.fail(`${TZ}: ${error.stderr?.toString() || 'Timezone subprocess failed'}`); }
  }
});
