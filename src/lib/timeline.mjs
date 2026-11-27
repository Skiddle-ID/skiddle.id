/**
 * The timeline (docs/v4/timeline.md): events from Jeff's id.skiddle.event records
 * (lexicons/id/skiddle/event.json), and the days, weeks and months /timeline/ shows them in. No
 * dependencies, so the site and the admin app share it.
 *
 * Rough until it's over: records are public, so an event that hasn't ended and isn't announced
 * shows only its kind, its days and its city. The admin app saves only those while it's upcoming;
 * the site applies the same rule as it reads (eventFromRecord), for records written elsewhere.
 *
 * Days are written YYYY-MM-DD and counted in Bangkok time (SITE_ZONE), so a day's entries don't
 * move with the reader. An event's times are HH:MM in its own time zone.
 */

export const EVENT_COLLECTION = 'id.skiddle.event';
/** The zone the site's days are counted in, and an event's times when it names none */
export const SITE_ZONE = 'Asia/Bangkok';

/** The kinds, with their labels, in the order the admin app lists them */
export const KINDS = {
  trip: 'Trip',
  flight: 'Flight',
  talk: 'Talk',
  class: 'Class',
  meeting: 'Meeting',
  deadline: 'Deadline',
  milestone: 'Milestone',
  personal: 'Personal',
  other: 'Event',
};

/** The fields an event keeps to itself until it's over, unless it's announced */
export const DETAIL_FIELDS = ['title', 'startTime', 'endTime', 'timeZone', 'place', 'note', 'link'];

const DAY_MS = 86400000;

/** A day, YYYY-MM-DD, that exists */
export const isDate = (/** @type {unknown} */ s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** A time of day, HH:MM */
export const isTime = (/** @type {unknown} */ s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** @param {unknown} tz */
export function isZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A link the timeline may show: a path on the site, or an https:, http: or mailto: URL */
export const isSafeLink = (/** @type {unknown} */ s) => typeof s === 'string' && /^(\/(?![/\\])|https?:\/\/|mailto:)/i.test(s);

/**
 * The day it is in a time zone, YYYY-MM-DD
 * @param {string} [zone]
 * @param {number} [now]
 */
export function todayIn(zone = SITE_ZONE, now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: isZone(zone) ? zone : SITE_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toMs = (/** @type {string} */ day) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (/** @type {number} */ ms) => new Date(ms).toISOString().slice(0, 10);
/** @param {string} day @param {number} n */
export const addDays = (day, n) => fromMs(toMs(day) + n * DAY_MS);
/** Monday 0 … Sunday 6 */
const weekday = (/** @type {string} */ day) => (new Date(toMs(day)).getUTCDay() + 6) % 7;

/**
 * The ISO week a day is in: its year (which can differ from the day's near New Year) and number
 * @param {string} day
 */
export function isoWeek(day) {
  const thursday = addDays(day, 3 - weekday(day));
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(`${year}-01-04`, 3 - weekday(`${year}-01-04`));
  return { year, week: 1 + Math.round((toMs(thursday) - toMs(firstThursday)) / (7 * DAY_MS)) };
}

/** The Monday of an ISO week */
const mondayOf = (/** @type {number} */ year, /** @type {number} */ week) => addDays(`${year}-01-04`, -weekday(`${year}-01-04`) + (week - 1) * 7);

const weekKey = (/** @type {string} */ day) => {
  const { year, week } = isoWeek(day);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Fri 27 Nov" */
export const dayLabel = (/** @type {string} */ day) => `${DAYS[weekday(day)].slice(0, 3)} ${Number(day.slice(8))} ${SHORT[Number(day.slice(5, 7)) - 1]}`;
/** "Friday 27 November 2026" */
export const longDayLabel = (/** @type {string} */ day) => `${DAYS[weekday(day)]} ${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

/** "26–27 Nov", "30 Nov – 2 Dec", "27 Nov" */
export function spanLabel(/** @type {string} */ start, /** @type {string} */ end = start) {
  const d = (/** @type {string} */ x) => Number(x.slice(8));
  const m = (/** @type {string} */ x) => SHORT[Number(x.slice(5, 7)) - 1];
  if (start === end) return `${d(start)} ${m(start)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${d(start)}–${d(end)} ${m(end)}`;
  return `${d(start)} ${m(start)} – ${d(end)} ${m(end)}`;
}

/**
 * @typedef {{
 *   kind: 'week' | 'month' | 'day',
 *   key: string,
 *   label: string,
 *   start: string,
 *   end: string,
 *   prev: string,
 *   next: string,
 * }} Period
 */

/**
 * A period from its address: 2026-W48 (a week), 2026-11 (a month) or 2026-11-27 (a day); null for
 * anything else
 * @param {string} key
 * @returns {Period | null}
 */
export function parsePeriod(key) {
  let m;
  if ((m = /^(\d{4})-W(\d{2})$/.exec(key))) {
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week < 1 || week > 53) return null;
    const start = mondayOf(year, week);
    if (weekKey(start) !== key) return null; // a week 53 the year doesn't have
    return weekOf(start);
  }
  if ((m = /^(\d{4})-(\d{2})$/.exec(key))) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return monthOf(`${key}-01`);
  }
  if (isDate(key)) return dayOf(key);
  return null;
}

/** The week a day is in, Monday to Sunday @returns {Period} */
export function weekOf(/** @type {string} */ day) {
  const start = addDays(day, -weekday(day));
  const end = addDays(start, 6);
  return { kind: 'week', key: weekKey(start), label: `${spanLabel(start, end)} ${end.slice(0, 4)}`, start, end, prev: weekKey(addDays(start, -7)), next: weekKey(addDays(start, 7)) };
}

/** The month a day is in @returns {Period} */
export function monthOf(/** @type {string} */ day) {
  const start = `${day.slice(0, 7)}-01`;
  const end = addDays(`${addDays(start, 31).slice(0, 7)}-01`, -1);
  return {
    kind: 'month',
    key: day.slice(0, 7),
    label: `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`,
    start,
    end,
    prev: addDays(start, -1).slice(0, 7),
    next: addDays(end, 1).slice(0, 7),
  };
}

/** One day @returns {Period} */
export function dayOf(/** @type {string} */ day) {
  return { kind: 'day', key: day, label: longDayLabel(day), start: day, end: day, prev: addDays(day, -1), next: addDays(day, 1) };
}

/** The days of a period, in order */
export function daysOf(/** @type {Period} */ p) {
  const out = [];
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The month's grid: whole weeks, Monday first, with the days outside the month as null */
export function monthGrid(/** @type {Period} */ p) {
  const cells = [...Array(weekday(p.start)).fill(null), ...daysOf(p)];
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Whether an event is over: its last day has passed where it happens
 * @param {Record<string, any>} v The record
 * @param {number} [now]
 */
export function isOver(v, now = Date.now()) {
  const last = isDate(v.endsOn) ? v.endsOn : v.startsOn;
  return isDate(last) && todayIn(isZone(v.timeZone) ? v.timeZone : SITE_ZONE, now) > last;
}

/** Whether only an event's rough fields may show (and be saved): it isn't over or announced */
export const isRough = (/** @type {Record<string, any>} */ v, now = Date.now()) => v.announced !== true && !isOver(v, now);

/**
 * @typedef {{
 *   rkey: string,
 *   kind: string,
 *   label: string,
 *   startsOn: string,
 *   endsOn: string,
 *   city?: string,
 *   rough: boolean,
 *   over: boolean,
 *   title?: string,
 *   startTime?: string,
 *   endTime?: string,
 *   timeZone: string,
 *   place?: string,
 *   note?: string,
 *   link?: string,
 * }} TimelineEvent
 */

/**
 * An event as the timeline shows it, or null if it has no kind or start day. A rough event keeps
 * only its kind, days and city.
 * @param {string} uri
 * @param {Record<string, any>} v
 * @param {number} [now]
 * @returns {TimelineEvent | null}
 */
export function eventFromRecord(uri, v, now = Date.now()) {
  if (!v || typeof v !== 'object' || typeof v.kind !== 'string' || !v.kind || !isDate(v.startsOn)) return null;
  const str = (/** @type {unknown} */ s) => (typeof s === 'string' && s.trim() ? s.trim() : undefined);
  const endsOn = isDate(v.endsOn) && v.endsOn > v.startsOn ? v.endsOn : v.startsOn;
  const rough = isRough(v, now);
  /** @type {TimelineEvent} */
  const e = {
    rkey: uri.split('/').pop() ?? '',
    kind: v.kind,
    label: KINDS[/** @type {keyof typeof KINDS} */ (v.kind)] ?? KINDS.other,
    startsOn: v.startsOn,
    endsOn,
    rough,
    over: isOver(v, now),
    timeZone: !rough && isZone(v.timeZone) ? v.timeZone : SITE_ZONE,
  };
  if (str(v.city)) e.city = str(v.city);
  if (rough) return e;
  if (str(v.title)) e.title = str(v.title);
  if (isTime(v.startTime)) {
    e.startTime = v.startTime;
    if (isTime(v.endTime) && (endsOn > v.startsOn || v.endTime >= v.startTime)) e.endTime = v.endTime;
  }
  if (str(v.place)) e.place = str(v.place);
  if (str(v.note)) e.note = str(v.note);
  if (isSafeLink(v.link)) e.link = v.link;
  return e;
}

/**
 * Every event, by start day (all-day ones first on a day, then by time)
 * @param {{ uri: string, value: Record<string, any> }[]} records
 * @param {number} [now]
 */
export function eventsFromRecords(records, now = Date.now()) {
  return records
    .map((r) => eventFromRecord(r.uri, r.value, now))
    .filter((e) => !!e)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.rkey.localeCompare(b.rkey));
}

/**
 * The events on a day: those that start, run through or end on it. On a day an event only runs
 * through or ends on, it has no start time.
 * @param {TimelineEvent[]} events
 * @param {string} day
 */
export function eventsOn(events, day) {
  return events
    .filter((e) => e.startsOn <= day && day <= e.endsOn)
    .map((e) => ({ event: e, first: e.startsOn === day, last: e.endsOn === day }))
    .sort((a, b) => (a.first && a.event.startTime ? a.event.startTime : '').localeCompare(b.first && b.event.startTime ? b.event.startTime : ''));
}

/**
 * The events still to come or under way, soonest first
 * @param {TimelineEvent[]} events
 * @param {string} today
 * @param {number} [limit]
 */
export function upcoming(events, today, limit = 5) {
  return events.filter((e) => e.endsOn >= today).slice(0, limit);
}

/**
 * What's wrong with an event the admin app is about to save, in words (the lexicon can't say)
 * @param {Record<string, any>} v
 */
export function eventProblems(v) {
  const out = [];
  if (v.startsOn !== undefined && !isDate(v.startsOn)) out.push('Starts on isn’t a date.');
  if (v.endsOn !== undefined) {
    if (!isDate(v.endsOn)) out.push('Ends on isn’t a date.');
    else if (isDate(v.startsOn) && v.endsOn < v.startsOn) out.push('Ends on is before Starts on.');
  }
  if (v.startTime !== undefined && !isTime(v.startTime)) out.push('Start time isn’t a time, like 14:30.');
  if (v.endTime !== undefined) {
    if (!isTime(v.endTime)) out.push('End time isn’t a time, like 16:00.');
    else if (v.startTime === undefined) out.push('An end time needs a start time.');
    else if ((v.endsOn === undefined || v.endsOn === v.startsOn) && isTime(v.startTime) && v.endTime < v.startTime) out.push('End time is before Start time.');
  }
  if (v.timeZone !== undefined && !isZone(v.timeZone)) out.push(`Unknown time zone: ${v.timeZone}. Use one like Europe/Paris.`);
  if (v.link !== undefined && !isSafeLink(v.link)) out.push('Link is a path on the site, like /posts/…/, or a full URL.');
  return out;
}

/** An event's record with only its rough fields: what's saved while it's upcoming and not announced */
export function roughOnly(/** @type {Record<string, any>} */ v) {
  return Object.fromEntries(Object.entries(v).filter(([k]) => !DETAIL_FIELDS.includes(k)));
}
