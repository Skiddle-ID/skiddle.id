/**
 * Saved designs for the site's theme (id.skiddle.themePreset, lexicons/id/skiddle/themePreset.json,
 * docs/v4/themes.md, phase 7). A preset holds a theme's design (DESIGN_FIELDS: its colours, fonts,
 * sizes, corners, spacing and terminal touches, in the theme's own shapes) and a name. Applying one
 * puts its design into id.skiddle.theme (key 'self') and keeps the theme's mode, accent and cards'
 * design; Reset in the Theme editor applies TODAYS_LOOK, the built-in preset, whose design is empty.
 *
 * Only the admin app reads presets: the site never does, so they cost a page nothing. A preset file
 * (Export, Import) is the record as JSON. An imported one is checked here before it's saved as a
 * preset, never straight into the theme. No dependencies but the theme's tables, so it can be tested
 * in Node; the lexicon check takes a loaded Lexicons from @atproto/lexicon.
 */

export const THEME_PRESET_COLLECTION = 'id.skiddle.themePreset';

/** The theme's fields that make its design: what a preset holds, and what applying one replaces */
export const DESIGN_FIELDS = ['colors', 'fonts', 'textSize', 'textLineHeight', 'postLineHeight', 'radius', 'spacing', 'noPrompt', 'noCursor', 'noHeadingMarks'];

/** @typedef {Record<string, unknown>} Value */
/** @typedef {{ name: string, design: Value }} Preset A preset as the admin app lists it */

/** The built-in preset: today's look, an empty design. It isn't a record, so it can't be deleted */
/** @type {Preset} */
export const TODAYS_LOOK = { name: 'Today’s look', design: {} };

/**
 * The design fields a theme or a preset holds, and nothing else
 * @param {Value} value
 * @returns {Value}
 */
export const designOf = (value) => Object.fromEntries(DESIGN_FIELDS.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]));

/**
 * A theme with its design replaced by `design`: its other fields (the mode, the accent, the cards'
 * design, any the app doesn't know) stay
 * @param {Value} theme
 * @param {Value} design
 * @returns {Value}
 */
export const withDesign = (theme, design) => ({ ...Object.fromEntries(Object.entries(theme).filter(([k]) => !DESIGN_FIELDS.includes(k))), ...designOf(design) });

/**
 * A new preset's record key, from its name: lowercase letters, digits and hyphens, with -2, -3…
 * when another preset has it. The key stays when the preset is renamed.
 * @param {string} name
 * @param {string[]} taken The keys the presets have
 */
export function presetKey(name, taken) {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '') || 'preset';
  let key = slug;
  for (let n = 2; taken.includes(key); n++) key = `${slug}-${n}`;
  return key;
}

/**
 * A preset's record
 * @param {string} name
 * @param {Value} design
 * @param {string} at Its creation date
 */
export const presetRecord = (name, design, at) => ({ $type: THEME_PRESET_COLLECTION, name, ...designOf(design), createdAt: at });

/**
 * A preset as a file to download: its record, as JSON
 * @param {Value} record
 */
export const presetFile = (record) => `${JSON.stringify({ $type: THEME_PRESET_COLLECTION, ...record }, null, 2)}\n`;

/**
 * The fields of `value` that its schema doesn't have, and the values it doesn't know (a font the site
 * doesn't bundle, a size it has no name for), by their paths ("colors.dark.glow", "fonts.text"),
 * looking through refs and objects. The lexicon lets an unknown value through, but applying it would
 * quietly keep today's, so Import refuses it.
 * @param {{ getDefOrThrow: (uri: string) => any }} lex
 * @param {any} schema
 * @param {unknown} value
 * @param {string} where
 * @returns {string[]}
 */
function unknownFields(lex, schema, value, where = '') {
  const s = schema.type === 'ref' ? lex.getDefOrThrow(schema.ref) : schema;
  if (s.type === 'string' && s.knownValues && typeof value === 'string' && !s.knownValues.includes(value)) return [`${where.slice(0, -1)} (${value})`];
  if (s.type !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return [];
  const properties = s.properties ?? {};
  return Object.entries(value).flatMap(([k, v]) => (k === '$type' && !where ? [] : Object.hasOwn(properties, k) ? unknownFields(lex, properties[k], v, `${where}${k}.`) : [`${where}${k}`]));
}

/**
 * A preset file read for Import: its record, ready to save (its own dates dropped, created `at`), or
 * what's wrong with it. It must be JSON, a theme preset, with no field the lexicon doesn't have, and
 * valid by the lexicon: a colour is { r, g, b } from 0 to 255, so no file can put CSS into the site.
 * Whether its colours are readable is the Theme editor's check (themeProblems).
 * @param {string} text The file's contents
 * @param {{ getDefOrThrow: (uri: string) => any, assertValidRecord: (nsid: string, record: unknown) => unknown }} lex Lexicons with id.skiddle.theme and id.skiddle.themePreset
 * @param {(value: unknown) => unknown} toLex @atproto/lexicon's jsonToLex
 * @param {string} at
 * @returns {{ record: Value } | { problem: string }}
 */
export function presetFromFile(text, lex, toLex, at) {
  /** @type {unknown} */
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { problem: 'The file isn’t JSON. Pick a preset file exported from here.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { problem: 'The file isn’t a theme preset: it has no fields.' };
  const v = /** @type {Value} */ (value);
  if (v.$type !== undefined && v.$type !== THEME_PRESET_COLLECTION) return { problem: `The file holds another kind of record (${String(v.$type)}), not a theme preset (${THEME_PRESET_COLLECTION}).` };
  if (typeof v.name !== 'string' || !v.name.trim()) return { problem: 'The preset has no name.' };
  const unknown = unknownFields(lex, lex.getDefOrThrow(`lex:${THEME_PRESET_COLLECTION}`).record, v);
  if (unknown.length) return { problem: `The preset has fields or values a preset can’t have: ${unknown.join(', ')}.` };
  const record = presetRecord(v.name.trim(), v, at);
  try {
    lex.assertValidRecord(THEME_PRESET_COLLECTION, toLex(record));
  } catch (err) {
    return { problem: `The preset doesn’t fit the lexicon: ${err instanceof Error ? err.message.replace(/^Record\//, '') : err}.` };
  }
  return { record };
}
