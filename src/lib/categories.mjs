/**
 * Post categories: the sections of the site. They live in Jeff's AT Protocol repo, one
 * id.skiddle.categories record (key `self`, lexicons/id/skiddle/categories.json) listing them in
 * order, edited in the admin app (Posts → Categories). A post names its category by id.
 *
 * DEFAULT_CATEGORIES is what the site shows until that record exists, or if it can't be read: the
 * four the site started with. Plain JavaScript, so the admin app's editor can use it in the browser.
 */

export const CATEGORIES_COLLECTION = 'id.skiddle.categories';

/**
 * @typedef {object} Category
 * @property {string} id e.g. 'homelab': its page is /topics/<id>/
 * @property {string} label e.g. 'Homelab'
 * @property {string} [description]
 */

/** @type {Category[]} */
export const DEFAULT_CATEGORIES = [
  { id: 'infra', label: 'Infra & delivery' },
  { id: 'atproto', label: 'ATProto & the open web' },
  { id: 'homelab', label: 'Homelab' },
  { id: 'life', label: 'Life' },
];

/** The category a post without one gets */
export const FALLBACK_CATEGORY = 'infra';

/** An id: lower case letters, digits and hyphens, starting with a letter or digit */
export const CATEGORY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** Ids that would clash with other addresses under /topics/ */
export const RESERVED_CATEGORY_IDS = ['tag'];

/** Whether a string can be a category id */
export const isCategoryId = (/** @type {unknown} */ id) => typeof id === 'string' && CATEGORY_ID.test(id) && !RESERVED_CATEGORY_IDS.includes(id);

/**
 * The categories in an id.skiddle.categories record, in order. A category without a usable id or
 * label, or with an id that came earlier, is left out.
 * @param {unknown} value The record
 * @returns {Category[]}
 */
export function categoriesFromRecord(value) {
  const list = value && typeof value === 'object' && Array.isArray(/** @type {any} */ (value).categories) ? /** @type {any[]} */ (/** @type {any} */ (value).categories) : [];
  /** @type {Category[]} */
  const out = [];
  for (const c of list) {
    const id = typeof c?.id === 'string' ? c.id.trim() : '';
    const label = typeof c?.label === 'string' ? c.label.trim() : '';
    if (!isCategoryId(id) || !label || out.some((o) => o.id === id)) continue;
    const description = typeof c.description === 'string' && c.description.trim() ? c.description.trim() : undefined;
    out.push({ id, label, ...(description ? { description } : {}) });
  }
  return out;
}

/** A category's label, or its id if the list doesn't have it */
export const categoryLabel = (/** @type {Category[]} */ categories, /** @type {string} */ id) => categories.find((c) => c.id === id)?.label ?? id;

/**
 * What's wrong with a list of categories, in words, for the admin app's editor: ids that aren't
 * lower case letters, digits and hyphens, are reserved or come twice, and ids posts still use that
 * aren't in the list any more
 * @param {{ id?: string }[]} categories
 * @param {Map<string, number>} [used] How many posts use each id
 */
export function categoryProblems(categories, used = new Map()) {
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const [i, c] of categories.entries()) {
    const id = typeof c.id === 'string' ? c.id.trim() : '';
    if (!id) continue; // "required" is the form's to say
    if (RESERVED_CATEGORY_IDS.includes(id)) out.push(`Category ${i + 1}: “${id}” can’t be an id, since /topics/${id}/ is taken.`);
    else if (!CATEGORY_ID.test(id)) out.push(`Category ${i + 1}: an id is lower case letters, digits and hyphens, like “homelab”.`);
    if (seen.has(id)) out.push(`Two categories have the id “${id}”.`);
    seen.add(id);
  }
  for (const [id, n] of used) {
    if (!seen.has(id)) out.push(`${n} ${n === 1 ? 'post uses' : 'posts use'} “${id}”: change ${n === 1 ? 'its' : 'their'} category first, or keep it.`);
  }
  return out;
}
