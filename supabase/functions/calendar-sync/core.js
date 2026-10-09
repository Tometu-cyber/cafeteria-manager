// Pure calendar maths for the calendar-sync function. The ical.js module is
// injected so this file runs unchanged in Deno (npm:ical.js) and in Node tests.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Offset (ms) of `tz` from UTC at the given instant.
export function tzOffsetMs(epoch, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(epoch)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

// Epoch ms for a wall-clock time (month is 1-12) in `tz`.
export function zonedEpoch(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(first, tz);
}

export function todayIn(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day;
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

// Next occurrence (not yet finished) of a weekly shift such as ("Monday", "12:15–13:45").
export function nextOccurrence(dayName, timeLabel, tz, now = new Date()) {
  const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(timeLabel);
  const target = WEEKDAYS.indexOf(dayName);
  if (!m || target < 0) return null;
  const [sh, sm, eh, em] = [+m[1], +m[2], +m[3], +m[4]];
  const t = todayIn(tz, now);
  let add = (target - t.weekday + 7) % 7;
  for (let i = 0; i < 2; i++, add += 7) {
    const day = new Date(Date.UTC(t.y, t.m - 1, t.d + add));
    const [y, mo, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const start = zonedEpoch(y, mo, d, sh, sm, tz);
    const end = zonedEpoch(y, mo, d, eh, em, tz);
    if (end > now.getTime()) return { start, end };
  }
  return null;
}

// Busy [startMs, endMs] intervals between `from` and `to` (epoch ms) from an iCal feed.
// Ignores all-day, cancelled and "free" (transparent) events.
export function busyIntervals(ICAL, icsText, from, to) {
  ICAL.TimezoneService.reset();
  const root = new ICAL.Component(ICAL.parse(icsText));
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(vtz); } catch { /* unknown zone: fall back to UTC */ }
  }

  const masters = new Map();
  const exceptions = [];
  for (const c of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(c);
    if (ev.recurrenceId) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex);

  const out = [];
  const push = (s, e) => { if (e > from && s < to) out.push([s, e]); };
  const skip = (ev) =>
    String(ev.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED' ||
    String(ev.component.getFirstPropertyValue('transp') || '').toUpperCase() === 'TRANSPARENT' ||
    ev.startDate.isDate;

  for (const ev of masters.values()) {
    if (skip(ev)) continue;
    if (!ev.isRecurring()) {
      push(ev.startDate.toJSDate().getTime(), ev.endDate.toJSDate().getTime());
      continue;
    }
    const it = ev.iterator();
    let next;
    for (let n = 0; (next = it.next()) && n < 6000; n++) {
      const d = ev.getOccurrenceDetails(next);
      const s = d.startDate.toJSDate().getTime();
      if (s >= to) break;
      push(s, d.endDate.toJSDate().getTime());
    }
  }
  return out;
}

export const overlaps = (intervals, start, end) => intervals.some(([s, e]) => s < end && e > start);
