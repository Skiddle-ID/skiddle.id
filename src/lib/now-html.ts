/**
 * The Now and home records' Markdown (lexicons/id/skiddle/{now,home}.json) as HTML, for /now/ and the
 * home page.
 * Raw HTML in it shows as text, links get the site's link style, and a link the site wouldn't
 * show (isPageHref, like javascript:) shows as its text.
 */
import { Marked, type Tokens } from 'marked';
import { isPageHref } from './site-meta.mjs';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escape(s).replace(/"/g, '&quot;');

const marked = new Marked({
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escape(text),
    link({ href, title, tokens }: Tokens.Link) {
      if (!isPageHref(href)) return this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(href)}" class="link"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
    },
  },
});

/** One item of the list: a line of Markdown */
export const nowItemHtml = (markdown: string) => marked.parseInline(markdown, { async: false });

/** An intro, on /now/ and the home page: paragraphs of Markdown */
export const introHtml = (markdown: string) => marked.parse(markdown, { async: false });
