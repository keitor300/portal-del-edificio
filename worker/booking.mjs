// Calendar minutes intentionally ignore the machine timezone. Input dates belong to Buenos Aires.
const minute = value => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h < 24 && m < 60 && m % 30 === 0 ? h * 60 + m : null;
};

export function bookingRange(date, startTime, endTime, now = Date.now()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_DATE');
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error('INVALID_DATE');
  const start = minute(startTime);
  const end = minute(endTime);
  if (start === null || end === null || start < 510 || start === end) throw new Error('INVALID_TIME');
  const closing = [5, 6].includes(day.getUTCDay()) ? 180 : 60;
  const endOffset = end < start ? 1440 + end : end;
  if (endOffset > 1440 + closing) throw new Error('AFTER_CLOSING');
  const startMinute = day.getTime() / 60000 + start;
  const endMinute = day.getTime() / 60000 + endOffset;
  // America/Argentina/Buenos_Aires is UTC-03:00; use an explicit offset for the instant check.
  if (Date.parse(`${date}T${startTime}:00-03:00`) <= now) throw new Error('START_IN_PAST');
  return { date, endDate: new Date(endMinute * 60000).toISOString().slice(0, 10), startMinute, endMinute };
}
