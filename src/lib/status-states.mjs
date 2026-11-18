/**
 * The kinds of status Jeff can set (the `state` of an id.skiddle.status record) and how long its
 * text may be, shared by the site, the admin app and scripts/status.mjs. Plain JavaScript so the
 * script can import it too.
 *
 * Records written before `state` existed only have `available`: true reads as 'available', false
 * as 'busy'. A state this code doesn't know reads the same way, so a newer value never breaks it.
 */

/** Most characters the text and the location may have (the lexicon's maxGraphemes) */
export const MAX_CHARS = 64;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/**
 * The characters of a string as people see them: an emoji like 🧑‍💻 or 🇹🇭 is one character,
 * however many code units it's made of
 * @param {string} s
 * @returns {string[]}
 */
function chars(s) {
  return segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s);
}

/**
 * How many characters a string has, counted as people see them
 * @param {string} s
 */
export function countChars(s) {
  return chars(s).length;
}

/**
 * At most `max` characters of a string, never cutting an emoji in half
 * @param {string} s
 * @param {number} [max]
 */
export function trimChars(s, max = MAX_CHARS) {
  return s.length <= max ? s : chars(s).slice(0, max).join('');
}

/** Emoji the admin app offers as quick picks for the status (any single emoji works) */
export const EMOJI_PICKS = ['💻', '🛠️', '☕', '✈️', '🏠', '🎧', '📚', '🌙', '🤒', '🏖️'];

/**
 * Whether a string is one emoji, as people see it: a single character that's a pictograph (☕, 🧑‍💻),
 * a flag (🇹🇭) or a keycap (1️⃣)
 * @param {unknown} s
 * @returns {s is string}
 */
export function isEmoji(s) {
  if (typeof s !== 'string' || !s || countChars(s) !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(s);
}

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
