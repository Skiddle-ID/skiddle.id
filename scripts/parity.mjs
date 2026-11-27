#!/usr/bin/env node
/**
 * Compares pages on a local build with the same pages on skiddle.id, for a page moved to blocks
 * (docs/v4/themes.md): its <main>, title, meta description and JSON-LD should come out the same.
 *
 *   npm run build && npx wrangler dev --port 8787
 *   node scripts/parity.mjs http://127.0.0.1:8787 / /about/
 *
 * Before comparing, each page is normalised: comments and runs of whitespace, the hashes in /_astro/
 * file names, Astro's data-astro-cid-* attributes, and what changes from one minute to the next
 * (the status line, relative times like "3 hours ago"). A difference prints with the lines around
 * it, and the script exits with 1. Whitespace between two tags is compared apart: it renders only
 * between inline elements, not between blocks or in flex rows, so a page that differs only there
 * passes, with the places listed to check. Pass --against <url> to compare with another site.
 */
const args = process.argv.slice(2);
const against = args.includes('--against') ? args.splice(args.indexOf('--against'), 2)[1] : 'https://skiddle.id';
const [base, ...paths] = args;
if (!base || !paths.length) {
  console.error('Usage: node scripts/parity.mjs <base url> <path>… [--against <url>]');
  process.exit(2);
}

/** What changes between two renders a minute apart, and isn't the page's layout */
const LIVE = [
  // The status line: its dot's colour, its emoji, its state and its text (src/components/blocks/profile.astro)
  [/(<span id="statusDot" class=")[^"]*(" style=")[^"]*"/g, '$1…$2…"'],
  [/(<span id="statusEmoji" class=")[^"]*("[^>]*>)[^<]*</g, '$1…$2…<'],
  [/(<span id="status(?:State|Text)"[^>]*>)[^<]*</g, '$1…<'],
  // Relative times
  [/\b\d+ (?:second|minute|hour|day|week|month|year)s? ago\b/g, '… ago'],
];

/** The page's parts to compare, normalised */
function partsOf(html) {
  const pick = (re) => re.exec(html)?.[1] ?? '';
  const main = pick(/(<main[\s\S]*<\/main>)/);
  const jsonLd = pick(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return {
    title: pick(/<title>([\s\S]*?)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    'JSON-LD': jsonLd ? JSON.stringify(JSON.parse(jsonLd), null, 1) : '',
    main: LIVE.reduce((s, [re, to]) => s.replace(re, to), main)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/(\/_astro\/[^"'\s)]+?)\.[A-Za-z0-9_-]{8}\.(js|css|webp|png|jpg|svg|woff2?)/g, '$1.HASH.$2')
      .replace(/\s*data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '')
      .replace(/\s+/g, ' '),
  };
}

/** One tag per line, so a difference shows where it is; with `loose`, without the whitespace between tags */
const lines = (main, loose) => (loose ? main.replace(/> </g, '><') : main).replace(/> ?</g, (m) => `${m.slice(0, -1)}\n<`);

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'skiddle.id parity check' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

/** The first differences between two texts, line by line, with a line of context around each */
function differences(a, b, max = 8) {
  const x = a.split('\n');
  const y = b.split('\n');
  const out = [];
  let i = 0;
  let j = 0;
  while ((i < x.length || j < y.length) && out.length < max) {
    if (x[i] === y[j]) {
      i++;
      j++;
      continue;
    }
    // Resync on the next line both have, looking a little way ahead
    let skip = null;
    for (let d = 1; d < 40 && !skip; d++) {
      for (let k = 0; k <= d; k++) {
        if (x[i + k] !== undefined && x[i + k] === y[j + d - k]) {
          skip = [k, d - k];
          break;
        }
      }
    }
    const [dx, dy] = skip ?? [x.length - i, y.length - j];
    out.push([`  @ line ${i + 1}`, x[i - 1] !== undefined ? `    ${x[i - 1]}` : '', ...x.slice(i, i + dx).map((l) => `  - ${l}`), ...y.slice(j, j + dy).map((l) => `  + ${l}`)].filter(Boolean).join('\n'));
    i += dx;
    j += dy;
  }
  return out;
}

let failed = 0;
for (const path of paths) {
  const [mine, theirs] = await Promise.all([fetchPage(new URL(path, base)), fetchPage(new URL(path, against))]);
  const a = partsOf(theirs);
  const b = partsOf(mine);
  const diffs = Object.keys(a).flatMap((part) => {
    const [x, y] = part === 'main' ? [lines(a.main, true), lines(b.main, true)] : [a[part], b[part]];
    return x === y ? [] : [`${part}:\n${differences(x, y).join('\n')}`];
  });
  if (diffs.length) failed++;
  // Whitespace between tags that one page has and the other doesn't
  const spaces = (main) => [...main.matchAll(/>( ?)</g)].map((m) => m[1]);
  const [sa, sb] = [spaces(a.main), spaces(b.main)];
  const spaced = sa.length === sb.length ? sa.flatMap((s, i) => (s === sb[i] ? [] : [i])) : [];
  const tags = lines(b.main, true).split('\n');
  const note = spaced.length ? `; whitespace between tags differs in ${spaced.length} places, before:\n${spaced.map((i) => `    ${tags[i + 1].slice(0, 90)}`).join('\n')}` : '';
  console.log(`${path}: ${diffs.length ? `differs from ${against} (- there, + here)\n${diffs.join('\n')}` : `same as ${against} (main: ${tags.length} tags${note})`}`);
}
console.log(failed ? `${failed} of ${paths.length} pages differ.` : `0 differences in ${paths.length} page${paths.length > 1 ? 's' : ''}.`);
process.exit(failed ? 1 : 0);
