/**
 * The status history (lexicons/id/skiddle/statusLog.json): each time the status is set, the admin
 * app and scripts/status.mjs write the id.skiddle.status record (key `self`) and then add a copy of
 * it to id.skiddle.statusLog, keyed by time. /status/ lists them, and the admin app's Status
 * section lists the recent ones.
 *
 * The current status is written first, with its own check against a change made elsewhere, and the
 * copy second. If adding the copy fails, nothing is lost from view: the history always starts with
 * the current status, whether or not it has a copy yet (statusHistory). No dependencies, so the
 * site, the admin app and the script share it.
 */
import { isEmoji, isState, stateOf } from './status-states.mjs';

export const STATUS_LOG_COLLECTION = 'id.skiddle.statusLog';

/**
 * The history record for a status record: the same fields, with its updatedAt as createdAt
 * @param {Record<string, any>} status The id.skiddle.status record that was just written
 */
export function logEntryOf(status) {
  const { $type: _type, updatedAt, ...fields } = status;
  return { $type: STATUS_LOG_COLLECTION, ...fields, createdAt: updatedAt };
}

/**
 * @typedef {{
 *   state: import('./status-states.mjs').StatusState,
 *   emoji?: string,
 *   text: string,
 *   location?: string,
 *   timeZone?: string,
 *   at: string,
 *   rkey?: string,
 *   current: boolean,
 * }} PastStatus
 */

/**
 * One status from a record, or null if it has no text or no date
 * @param {Record<string, any>} v
 * @param {string} at
 */
function entry(v, at) {
  if (typeof v?.text !== 'string' || !v.text.trim() || typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof v.available !== 'boolean' && !isState(v.state)) return null;
  const str = (/** @type {unknown} */ s) => (typeof s === 'string' && s.trim() ? s.trim() : undefined);
  return {
    state: stateOf(v),
    ...(isEmoji(v.emoji) ? { emoji: v.emoji } : {}),
    text: v.text.trim(),
    ...(str(v.location) ? { location: str(v.location) } : {}),
    ...(str(v.timeZone) ? { timeZone: str(v.timeZone) } : {}),
    at,
  };
}

/**
 * Every status, newest first: the current one, then the copies in the history. The copy of the
 * current status (the same time) isn't listed twice. Records without text or a date are left out.
 * @param {Record<string, any> | null | undefined} current The id.skiddle.status record
 * @param {{ uri: string, value: Record<string, any> }[]} log The id.skiddle.statusLog records
 * @returns {PastStatus[]}
 */
export function statusHistory(current, log) {
  const now = current ? entry(current, current.updatedAt) : null;
  const past = log
    .map((r) => {
      const e = entry(r.value, r.value?.createdAt);
      return e && { ...e, rkey: r.uri.split('/').pop(), current: false };
    })
    .filter((e) => !!e)
    .filter((e) => !now || e.at !== now.at);
  const all = [...(now ? [{ ...now, current: true }] : []), ...past];
  return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || Number(b.current) - Number(a.current));
}
