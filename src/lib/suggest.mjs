/**
 * Suggestions for the admin app's fields: values already used, to pick instead of retyping (and
 * mistyping) them. Plain JavaScript, so the tests can use it (scripts/suggest.test.mjs).
 *   - the page editors' short fields (src/lib/admin/lexicon-form.ts): the values at the same place
 *     in the record, and in the other projects for a project, e.g. every "tech.languages[]"
 *   - the post editor's tags (src/lib/admin/tag-suggest.ts): the tags posts and drafts use, for the
 *     tag being typed in the comma-separated list
 */

/**
 * The strings at a path in a record. A path names properties with dots, "[]" after a list:
 * "tags[]", "tech.languages[]", "experience[].positions[].employment".
 * @param {unknown} value
 * @param {string} path
 * @returns {string[]}
 */
export function valuesAt(value, path) {
  /** @type {unknown[]} */
  let here = [value];
  for (const part of path.split('.')) {
    const list = part.endsWith('[]');
    const key = list ? part.slice(0, -2) : part;
    here = here.flatMap((v) => {
      const next = v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v)[key] : undefined;
      return list ? (Array.isArray(next) ? next : []) : [next];
    });
  }
  return here.filter((v) => typeof v === 'string').map((v) => /** @type {string} */ (v).trim()).filter(Boolean);
}

/**
 * Each value once, the most used first, then alphabetically; the same value in another case counts
 * as the same, kept as it was first written
 * @param {string[]} values
 * @returns {string[]}
 */
export function ranked(values) {
  /** @type {Map<string, { value: string, n: number }>} */
  const seen = new Map();
  for (const v of values) {
    const key = v.toLowerCase();
    const had = seen.get(key);
    if (had) had.n++;
    else seen.set(key, { value: v, n: 1 });
  }
  return [...seen.values()].sort((a, b) => b.n - a.n || a.value.localeCompare(b.value)).map((x) => x.value);
}

/**
 * The tag being typed in a comma-separated list: where it starts and ends around the cursor, and
 * the tags before and after it
 * @param {string} text
 * @param {number} cursor
 */
export function tagAt(text, cursor) {
  const start = text.lastIndexOf(',', cursor - 1) + 1;
  let end = text.indexOf(',', cursor);
  if (end === -1) end = text.length;
  const others = (text.slice(0, start) + text.slice(end)).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return { start, end, typed: text.slice(start, cursor).trim(), others };
}

/**
 * The tags to suggest for what's being typed: those starting with it first, then (from two letters
 * on) those containing it, leaving out the ones the list already has
 * @param {string[]} tags Ranked, most used first
 * @param {string} typed
 * @param {string[]} others The list's other tags, lower case
 * @param {number} [max]
 */
export function matchTags(tags, typed, others, max = 8) {
  const q = typed.toLowerCase();
  const free = tags.filter((t) => !others.includes(t.toLowerCase()) && t.toLowerCase() !== q);
  const starts = free.filter((t) => t.toLowerCase().startsWith(q));
  const contains = q.length >= 2 ? free.filter((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q)) : [];
  return [...starts, ...contains].slice(0, max);
}

/**
 * The list with the tag being typed replaced by `tag`, and where the cursor goes: after it and a
 * comma, ready for the next one
 * @param {string} text
 * @param {number} cursor
 * @param {string} tag
 */
export function putTag(text, cursor, tag) {
  const { start, end } = tagAt(text, cursor);
  const before = text.slice(0, start).replace(/\s*$/, start ? ' ' : '');
  const after = text.slice(end).replace(/^,?\s*/, '');
  const value = `${before}${tag}, ${after}`.replace(/,\s*$/, ', ');
  return { value, cursor: before.length + tag.length + 2 };
}
