/**
 * The Now record's Markdown (lexicons/id/skiddle/now.json) as HTML, for /now/ and the home page.
 * Raw HTML in it shows as text, and links get the site's link style.
 */
import { Marked, type Tokens } from 'marked';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escape(s).replace(/"/g, '&quot;');

const marked = new Marked({
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escape(text),
    link({ href, title, tokens }: Tokens.Link) {
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(href)}" class="link"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
    },
  },
});

/** One item of the list: a line of Markdown */
export const nowItemHtml = (markdown: string) => marked.parseInline(markdown, { async: false });

/** The intro on /now/: paragraphs of Markdown */
export const nowIntroHtml = (markdown: string) => marked.parse(markdown, { async: false });
