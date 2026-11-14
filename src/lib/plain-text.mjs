/**
 * Rough plain text from a post's Markdown: no code blocks, link URLs, HTML or markup.
 * Used for the command bar's search data (src/pages/search.json.ts) and the `textContent` of the
 * posts' AT Protocol records (scripts/standard-site-sync.mjs). Never rendered as HTML.
 * Plain JavaScript so the Node script can import it too.
 *
 * @param {string} md
 * @returns {string}
 */
export function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/^import .*$/gm, ' ') // MDX imports
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
    .replace(/^\s*-{3,}\s*$/gm, ' ') // horizontal rules
    .replace(/[*`~]/g, '') // emphasis, inline code
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '') // _emphasis_, but keep snake_case words
    .replace(/[<>|]/g, ' ') // tags, tables
    .replace(/\s+/g, ' ')
    .trim();
}
