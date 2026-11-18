/**
 * Markdown editing for the admin app's text boxes (src/lib/admin/markdown-tools.ts): bold, italic,
 * links, headings, quotes, lists and code, continuing a list on Enter, and turning a pasted link
 * into a Markdown link. Plain JavaScript, so the tests can use it (scripts/markdown-edit.test.mjs).
 *
 * Each function takes the text and the selection, and gives back one edit: replace text[from, to)
 * with `insert`, then select [start, end) in the new text. The box applies it as one step, so
 * ⌘Z undoes it. null means "nothing to do here" (let the browser do what it would).
 */

/**
 * @typedef {{ text: string, start: number, end: number }} State The text and its selection
 * @typedef {{ from: number, to: number, insert: string, start: number, end: number }} Edit
 */

/** The text after an edit, and the edit's selection (for the tests, and the fallback) */
export function applyEdit(/** @type {string} */ text, /** @type {Edit} */ e) {
  return { text: text.slice(0, e.from) + e.insert + text.slice(e.to), start: e.start, end: e.end };
}

/**
 * Wraps the selection in `marker` (** for bold, _ for italic, ` for code), or unwraps it if it's
 * already wrapped. Spaces at the selection's edges stay outside, since "**bold **" isn't bold. With
 * nothing selected, it inserts the markers around `placeholder` and selects it.
 * @param {State} s
 * @param {string} marker
 * @param {string} placeholder
 * @returns {Edit}
 */
export function wrap(s, marker, placeholder) {
  let { start, end } = s;
  while (start < end && /\s/.test(s.text[start])) start++;
  while (end > start && /\s/.test(s.text[end - 1])) end--;
  const m = marker.length;
  // Already wrapped, with the markers outside the selection or inside it
  if (s.text.slice(start - m, start) === marker && s.text.slice(end, end + m) === marker) {
    const inner = s.text.slice(start, end);
    return { from: start - m, to: end + m, insert: inner, start: start - m, end: end - m };
  }
  const inner = s.text.slice(start, end);
  if (inner.length >= 2 * m && inner.startsWith(marker) && inner.endsWith(marker)) {
    const plain = inner.slice(m, inner.length - m);
    return { from: start, to: end, insert: plain, start, end: start + plain.length };
  }
  const word = inner || placeholder;
  return { from: start, to: end, insert: `${marker}${word}${marker}`, start: start + m, end: start + m + word.length };
}

const URL_ONLY = /^https?:\/\/[^\s<>()]+$/i;

/** Whether a piece of text is just a web address */
export const isUrl = (/** @type {string} */ text) => URL_ONLY.test(text.trim());

/**
 * Makes the selection a link: [selection](url). With no url, "url" is selected to type over it; if
 * the selection is itself an address, it becomes the link and its text is selected instead. With
 * nothing selected, it inserts [link text](url) and selects "link text".
 * @param {State} s
 * @param {string} [url]
 * @returns {Edit}
 */
export function link(s, url) {
  const { start, end } = s;
  const selected = s.text.slice(start, end);
  if (!url && isUrl(selected)) {
    const text = 'link text';
    return { from: start, to: end, insert: `[${text}](${selected.trim()})`, start: start + 1, end: start + 1 + text.length };
  }
  const label = selected || 'link text';
  const href = url ?? 'url';
  const insert = `[${label}](${href})`;
  if (url) return { from: start, to: end, insert, start: start + insert.length, end: start + insert.length };
  if (!selected) return { from: start, to: end, insert, start: start + 1, end: start + 1 + label.length };
  const at = start + label.length + 3;
  return { from: start, to: end, insert, start: at, end: at + href.length };
}

/**
 * A pasted address over selected text makes it a link. Anything else (no selection, more than an
 * address, the selection itself an address): null, an ordinary paste.
 * @param {State} s
 * @param {string} pasted
 * @returns {Edit | null}
 */
export function pasteLink(s, pasted) {
  const selected = s.text.slice(s.start, s.end);
  if (!selected || selected.includes('\n') || !isUrl(pasted) || isUrl(selected)) return null;
  return link(s, pasted.trim());
}

/** The start and end of the lines the selection touches */
function lineRange(/** @type {State} */ s) {
  const from = s.text.lastIndexOf('\n', s.start - 1) + 1;
  let to = s.text.indexOf('\n', s.end > s.start && s.text[s.end - 1] === '\n' ? s.end - 1 : s.end);
  if (to === -1) to = s.text.length;
  return { from, to };
}

const BULLET = /^(\s*)[-*+]\s+/;
const NUMBER = /^(\s*)\d+[.)]\s+/;
const QUOTE = /^>\s?/;
const HEADING = /^#{1,6}\s+/;

/**
 * Starts each selected line with a quote, a list marker or a heading, or takes it off again if every
 * line already has it. A line that has another kind (a bullet becoming a numbered item) changes kind.
 * @param {State} s
 * @param {'quote' | 'bullet' | 'number' | 'heading'} kind
 * @returns {Edit}
 */
export function toggleLines(s, kind) {
  const { from, to } = lineRange(s);
  const lines = s.text.slice(from, to).split('\n');
  const has = { quote: QUOTE, bullet: BULLET, number: NUMBER, heading: HEADING }[kind];
  // What a line loses when it gets this kind: a bullet becomes a number and back, and a heading
  // isn't a list item. A quote can hold anything, so it keeps what's there.
  const others = { quote: [], bullet: [NUMBER], number: [BULLET], heading: [BULLET, NUMBER] }[kind];
  const content = lines.filter((l) => l.trim());
  const remove = content.length > 0 && content.every((l) => has.test(l));
  let n = 0;
  const out = lines.map((line) => {
    if (!line.trim()) return line;
    if (remove) return line.replace(has, kind === 'bullet' || kind === 'number' ? '$1' : '');
    const bare = others.reduce((l, r) => l.replace(r, r === BULLET || r === NUMBER ? '$1' : ''), line.replace(has, kind === 'bullet' || kind === 'number' ? '$1' : ''));
    const indent = /^\s*/.exec(bare)?.[0] ?? '';
    const marker = { quote: '> ', bullet: '- ', number: `${++n}. `, heading: '## ' }[kind];
    return kind === 'quote' || kind === 'heading' ? `${marker}${bare}` : `${indent}${marker}${bare.slice(indent.length)}`;
  });
  const insert = out.join('\n');
  // A single line keeps the cursor where it was in the text, shifted by what was added or taken off
  if (lines.length === 1 && s.start === s.end) {
    const shift = insert.length - (to - from);
    const at = Math.max(from, s.start + shift);
    return { from, to, insert, start: at, end: at };
  }
  return { from, to, insert, start: from, end: from + insert.length };
}

/**
 * Code: `inline` for a selection within one line (or nothing selected), a fenced block for one that
 * spans lines
 * @param {State} s
 * @returns {Edit}
 */
export function code(s) {
  const selected = s.text.slice(s.start, s.end);
  if (!selected.includes('\n')) return wrap(s, '`', 'code');
  const { from, to } = lineRange(s);
  const body = s.text.slice(from, to);
  const insert = `\`\`\`\n${body}\n\`\`\``;
  return { from, to, insert, start: from + 4, end: from + 4 + body.length };
}

const LIST_ITEM = /^(\s*)([-*+]|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/;

/**
 * Enter in a list item starts the next one ("- ", "2. ", "- [ ] "); Enter in an empty item ends the
 * list instead. Elsewhere, or with text selected: null, an ordinary new line.
 * @param {State} s
 * @returns {Edit | null}
 */
export function continueList(s) {
  if (s.start !== s.end) return null;
  const lineStart = s.text.lastIndexOf('\n', s.start - 1) + 1;
  let lineEnd = s.text.indexOf('\n', s.start);
  if (lineEnd === -1) lineEnd = s.text.length;
  const line = s.text.slice(lineStart, lineEnd);
  const m = LIST_ITEM.exec(line);
  // Only when the cursor is past the marker, so Enter before it still moves the item down
  if (!m || s.start - lineStart < m[0].length) return null;
  if (!line.slice(m[0].length).trim()) {
    // An empty item: take its marker off, leaving the line empty, to end the list
    return { from: lineStart, to: lineEnd, insert: '', start: lineStart, end: lineStart };
  }
  const [, indent, bullet, num, punct, space, box] = m;
  const marker = num ? `${Number(num) + 1}${punct}` : bullet;
  const insert = `\n${indent}${marker}${space}${box ? '[ ] ' : ''}`;
  return { from: s.start, to: s.end, insert, start: s.start + insert.length, end: s.start + insert.length };
}

/**
 * Words, and minutes to read, counted as the post page counts them (src/lib/posts.ts): words split
 * on whitespace, 220 a minute, at least one
 * @param {string} markdown
 */
export function wordStats(markdown) {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 220)) };
}
