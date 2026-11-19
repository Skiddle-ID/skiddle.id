/**
 * JSON for a data block in the page, like <script type="application/ld+json">. Every `<` is
 * written as its JSON escape (the same data), so text in a title or description, like
 * "</script>" or "<!--", can't end the block early or change how the HTML around it is read.
 * Plain JavaScript so the tests can import it.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
