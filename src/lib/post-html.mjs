/**
 * Markdown to HTML for posts that come from AT Protocol records (an `id.skiddle.post`'s
 * `markdown`), made to match what Astro's build renders from git (Sätteri):
 *   - CommonMark with GitHub's extensions (tables, footnotes are rare; bare URLs become links)
 *   - smart punctuation: curly quotes, `--` → –, `---` → —, `...` → …; a lone ` - ` stays
 *   - heading ids from github-slugger over the heading's text, repeats get -1, -2…
 *   - raw HTML passed through; no attributes added to links, no anchors in headings
 *   - an image written ![alt](image:NAME) becomes the post's uploaded image, with its size
 *
 * Plain JavaScript with small, pure dependencies, so the Worker renders posts on request (about
 * half a millisecond each) and the admin app can use it for its live preview.
 */
import GithubSlugger from 'github-slugger';
import { Marked } from 'marked';
import { smartypants } from 'smartypants';

/** @typedef {{ depth: number, slug: string, text: string }} Heading */

/**
 * @typedef {object} PostImage An image of `id.skiddle.post`, as stored
 * @property {string} name
 * @property {{ ref?: { $link?: string }, mimeType?: string }} image The blob
 * @property {string} alt
 * @property {string} [caption]
 * @property {number} [width]
 * @property {number} [height]
 */

const escapeText = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (/** @type {string} */ s) => escapeText(s).replace(/"/g, '&quot;');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Text of an HTML fragment: tags dropped, entities decoded */
export function htmlText(/** @type {string} */ html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
      if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
      return ENTITIES[name.toLowerCase()] ?? whole;
    });
}

/**
 * Renders a post's Markdown
 * @param {string} markdown
 * @param {object} [options]
 * @param {PostImage[]} [options.images] The post's images, for ![alt](image:NAME)
 * @param {(cid: string) => string} [options.mediaUrl] URL of an uploaded image, by CID
 * @returns {{ html: string, headings: Heading[] }}
 */
export function renderPost(markdown, { images = [], mediaUrl = (cid) => `/media/${cid}` } = {}) {
  const slugger = new GithubSlugger();
  const byName = new Map(images.map((i) => [i.name, i]));
  const marked = new Marked({
    gfm: true,
    renderer: {
      // Escape <, > and & only: smartypants needs the straight quotes to curl them
      text(token) {
        if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
        return token.escaped ? token.text : escapeText(token.text);
      },
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        return `<h${depth} id="${escapeAttr(slugger.slug(htmlText(html)))}">${html}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        if (href.startsWith('image:')) {
          const image = byName.get(href.slice('image:'.length));
          const cid = image?.image?.ref?.$link;
          if (!image || !cid) return `<img alt="${escapeAttr(text)}"${titleAttr}>`;
          const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
          return `<img src="${escapeAttr(mediaUrl(cid))}" alt="${escapeAttr(image.alt || text)}"${size} loading="lazy" decoding="async"${titleAttr}>`;
        }
        return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr}>`;
      },
    },
  });
  // Quotes, dashes and ellipses everywhere but code; tags and their attributes are left alone
  const html = smartypants(/** @type {string} */ (marked.parse(markdown, { async: false })), 2);
  /** @type {Heading[]} */
  const headings = [];
  for (const m of html.matchAll(/<h([1-6]) id="([^"]*)">([\s\S]*?)<\/h\1>/g)) {
    headings.push({ depth: Number(m[1]), slug: htmlText(m[2]), text: htmlText(m[3]).trim() });
  }
  return { html, headings };
}
