/**
 * Markdown from records as HTML: the Now and home records' text, and the text in a page's blocks
 * (src/lib/page-blocks.mjs).
 * Raw HTML in it shows as text, a link the site wouldn't show (isPageHref, like javascript:) shows as
 * its text, and a link off the site opens in a new tab, as the links blocks' do. Outside .prose,
 * links get the site's link style; inside it, the prose styles them.
 */
import { Marked, type Tokens } from 'marked';
import { isExternal, isPageHref } from './site-meta.mjs';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escape(s).replace(/"/g, '&quot;');

/** A renderer: with linkClass, links get class="link"; with brightStrong, bold text is the text colour instead (for muted lines) */
function markdown({ linkClass, brightStrong = false }: { linkClass: boolean; brightStrong?: boolean }) {
  return new Marked({
    renderer: {
      html: ({ text }: Tokens.HTML | Tokens.Tag) => escape(text),
      link({ href, title, tokens }: Tokens.Link) {
        if (!isPageHref(href)) return this.parser.parseInline(tokens);
        const attrs = [`href="${escapeAttr(href)}"`, linkClass && 'class="link"', title && `title="${escapeAttr(title)}"`, isExternal(href) && 'target="_blank" rel="noopener"'];
        return `<a ${attrs.filter(Boolean).join(' ')}>${this.parser.parseInline(tokens)}</a>`;
      },
      ...(brightStrong ? { strong({ tokens }: Tokens.Strong) { return `<span class="text-[var(--color-text)]">${this.parser.parseInline(tokens)}</span>`; } } : {}),
    },
  });
}

const styled = markdown({ linkClass: true });
const prose = markdown({ linkClass: false });
const muted = markdown({ linkClass: true, brightStrong: true });

/** A line of Markdown: an item of the Now list, a page's lead */
export const lineHtml = (text: string) => styled.parseInline(text, { async: false });

/** A line of Markdown in muted text, where bold is the text colour rather than bold */
export const mutedLineHtml = (text: string) => muted.parseInline(text, { async: false });

/** Paragraphs of Markdown, on /now/ and the home page */
export const introHtml = (text: string) => styled.parse(text, { async: false });

/** Paragraphs of Markdown inside .prose, which styles their links */
export const proseHtml = (text: string) => prose.parse(text, { async: false });
