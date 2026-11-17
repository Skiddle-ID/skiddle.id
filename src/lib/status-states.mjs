/**
 * The kinds of status Jeff can set (the `state` of an id.skiddle.status record), shared by the site,
 * the admin app and scripts/status.mjs. Plain JavaScript so the script can import it too.
 *
 * Records written before `state` existed only have `available`: true reads as 'available', false
 * as 'busy'. A state this code doesn't know reads the same way, so a newer value never breaks it.
 */

/** In the order the admin app offers them */
export const STATES = /** @type {const} */ (['available', 'busy', 'dnd', 'away']);

/** @typedef {(typeof STATES)[number]} StatusState */
/** @typedef {'ok' | 'warn' | 'err' | 'mute'} StatusTone */

/** @type {Record<StatusState, { label: string, tone: StatusTone }>} */
export const STATE_INFO = {
  available: { label: 'Available', tone: 'ok' },
  busy: { label: 'Busy', tone: 'warn' },
  dnd: { label: 'Do not disturb', tone: 'err' },
  away: { label: 'Away', tone: 'mute' },
};

/**
 * @param {unknown} value
 * @returns {value is StatusState}
 */
export function isState(value) {
  return typeof value === 'string' && /** @type {readonly string[]} */ (STATES).includes(value);
}

/**
 * The state of a record value: its `state` if known, else from `available`
 * @param {{ state?: unknown, available?: unknown }} record
 * @returns {StatusState}
 */
export function stateOf(record) {
  if (isState(record.state)) return record.state;
  return record.available === false ? 'busy' : 'available';
}

/**
 * The CSS colour for a tone, from the site's theme tokens (src/style.css)
 * @param {StatusTone} tone
 */
export function toneColour(tone) {
  return tone === 'mute' ? 'var(--color-muted)' : `var(--color-${tone})`;
}
