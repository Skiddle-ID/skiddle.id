/**
 * Comparing post pages: the same post built from git (Astro, Sätteri) and rendered from its AT
 * Protocol record (src/lib/post-html.mjs). Used by scripts/check-render-parity.mjs and
 * tests/parity.test.mjs, until the v4 launch makes records the only source.
 *
 * Differences that don't change the page are ignored: entity spellings, attribute order, whitespace
 * between tags, and an image's src, srcset and sizes (the build makes WebP sizes; records serve the
 * uploaded file).
 */
import { htmlText } from '../../src/lib/post-html.mjs';

const IGNORED_ATTRS = new Set(['src', 'srcset', 'sizes', 'loading', 'decoding', 'data-astro-image', 'data-astro-image-pos']);

/** The inner HTML of the first element on the page whose opening tag matches `start` (a div) */
function innerDiv(page, start) {
  const at = page.search(start);
  if (at < 0) return undefined;
  const open = page.indexOf('>', at) + 1;
  let depth = 1;
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = open;
  for (let m; (m = tag.exec(page)); ) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return page.slice(open, m.index);
  }
  return undefined;
}

/** The post body: the inner HTML of <div class="prose …"> */
export const proseHtml = (page) => innerDiv(page, /<div class="prose[ "]/);

/** HTML as a list of comparable tokens */
export function tokens(html) {
  const out = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      const text = htmlText(m[4]).replace(/\s+/g, ' ').trim();
      if (text) out.push(text);
      continue;
    }
    const attrs = [...m[3].matchAll(/([^\s=/]+)(?:="([^"]*)")?/g)]
      .filter((a) => !IGNORED_ATTRS.has(a[1].toLowerCase()))
      .map((a) => `${a[1].toLowerCase()}${a[2] !== undefined ? `="${htmlText(a[2])}"` : ''}`)
      .sort();
    out.push(`<${m[1]}${m[2].toLowerCase()}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`);
  }
  return out;
}

/** Headings in a post body, as "depth#id text" */
export const headings = (html) => [...html.matchAll(/<h([1-6]) id="([^"]*)">([\s\S]*?)<\/h\1>/g)].map((m) => `${m[1]}#${m[2]} ${htmlText(m[3]).trim()}`);

/**
 * Where two token lists first differ, with a little context, or undefined if they're the same
 * @returns {{ at: number, a: string[], b: string[] } | undefined}
 */
export function firstDifference(a, b) {
  let at = a.findIndex((t, i) => t !== b[i]);
  if (at < 0 && a.length === b.length) return undefined;
  if (at < 0) at = Math.min(a.length, b.length);
  return { at, a: a.slice(Math.max(0, at - 2), at + 3), b: b.slice(Math.max(0, at - 2), at + 3) };
}

/** The parts of a post page that should be the same whichever source it comes from */
export function pageFacts(page) {
  const meta = (attr, name) => htmlText(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(page)?.[1] ?? '');
  const posting = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return undefined;
      }
    })
    .find((j) => j?.['@type'] === 'BlogPosting');
  const article = /<article\b[\s\S]*?<\/article>/.exec(page)?.[0] ?? '';
  return {
    title: htmlText(/<title>([^<]*)<\/title>/.exec(page)?.[1] ?? ''),
    description: meta('name', 'description'),
    canonical: /<link rel="canonical" href="([^"]*)"/.exec(page)?.[1],
    document: /<link rel="site.standard.document" href="([^"]*)"/.exec(page)?.[1],
    posting: posting && {
      headline: posting.headline,
      datePublished: posting.datePublished,
      dateModified: posting.dateModified,
      inLanguage: posting.inLanguage,
      keywords: posting.keywords,
      description: posting.description,
    },
    minutes: /(\d+) min read/.exec(article)?.[1],
    toc: [...page.matchAll(/data-toc="([^"]*)"/g)].map((m) => m[1]),
    // Every link in the article: tags, series parts, older/newer, "Keep reading", comments
    links: [...article.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => htmlText(m[1])),
  };
}
