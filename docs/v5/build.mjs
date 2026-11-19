// Builds the v5 mockups: wraps each page in docs/v5/pages/ with the shared shell (status line,
// header, search, footer) and writes it to docs/v5/mockups/. No dependencies.
//   node docs/v5/build.mjs
//
// A page starts with a front matter block, then its <main> (and any <style> or <template id="notes">):
//   ---
//   title: Writing
//   nav: writing            (which menu item is current: writing, work, about, flying, uses)
//   description: …
//   progress: yes           (a reading-progress bar along the top)
//   ---
// <style> blocks are moved into <head>, like the styles of an Astro component.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(root, 'pages');
const outDir = join(root, 'mockups');

const ICONS = {
  github: '<path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>',
  bluesky: '<path fill="currentColor" d="M5.2 3.3C7.9 5.3 10.8 9.4 12 11.7c1.2-2.3 4.1-6.4 6.8-8.4 1.9-1.4 5.1-2.6 5.1 1 0 .7-.4 6.1-.7 7-.9 3.1-4.1 3.9-7 3.4 5 .9 6.3 3.7 3.5 6.5-5.2 5.4-7.5-1.3-8-3.1L12 18l-.4-.2c-.6 1.8-2.8 8.5-8 3.1-2.8-2.8-1.5-5.6 3.5-6.5-2.9.5-6.1-.3-7-3.4C.4 10.4 0 5 0 4.3c0-3.6 3.2-2.4 5.2-1Z"/>',
  rss: '<path fill="currentColor" d="M4 4.5a1 1 0 0 1 1-1C14.1 3.5 20.5 9.9 20.5 19a1 1 0 1 1-2 0c0-8-5.5-13.5-13.5-13.5a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1 9.5 9.5 0 0 1 9.5 9.5 1 1 0 1 1-2 0A7.5 7.5 0 0 0 5 11.5a1 1 0 0 1-1-1ZM6 20.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
  mail: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></g>',
  sun: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>',
  moon: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
  search: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>',
};
export const icon = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

const NAV = [
  ['writing', 'writing.html'],
  ['work', 'work.html'],
  ['flying', 'flying.html'],
  ['about', 'about.html'],
  ['uses', 'uses.html'],
];

// What the search box finds in the mockups (the real one searches posts, series and topics)
const SEARCH = [
  ['Lab Notes #2: The Whole Site Lives in My Repo Now', 'post.html', 'post'],
  ['Lab Notes #1: Where Am I in This Series?', 'post.html', 'post'],
  ['Never Quite Done', 'post.html', 'post'],
  ['Publishing My Blog to AT Protocol', 'post.html', 'post'],
  ['Fast and Accessible', 'post.html', 'post'],
  ['How It All Started #1', 'post.html', 'post'],
  ['Penutupan Akses Publik API Checknawala', 'post.html', 'post', 'id'],
  ['From Fear to Flight', 'series-flight.html', 'series'],
  ['Rebuilding skiddle.id', 'series.html', 'series'],
  ['Lab Notes', 'series.html', 'series'],
  ['ATProto & the open web', 'topics.html', 'topic'],
  ['Infra & delivery', 'topics.html', 'topic'],
  ['Services', 'services.html', 'page'],
  ['CV', 'cv.html', 'page'],
  ['Projects', 'projects.html', 'page'],
  ['Listening', 'listening.html', 'page'],
  ['Now', 'now.html', 'page'],
  ['Notes', 'notes.html', 'page'],
  ['Changelog', 'changelog.html', 'page'],
];

function parse(file) {
  const src = readFileSync(join(pagesDir, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(
    m[1]
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  let body = src.slice(m[0].length);
  const styles = [];
  body = body.replace(/<style>([\s\S]*?)<\/style>\n?/g, (_, css) => {
    styles.push(css.trim());
    return '';
  });
  return { meta, body: body.trim(), styles };
}

function page(name, { meta, body, styles }) {
  const nav = NAV.map(
    ([label, href]) =>
      `<li><a href="${href}"${meta.nav === label ? ' aria-current="page"' : ''}>${label}</a></li>`,
  ).join('');
  const search = SEARCH.map(
    ([label, href, kind, lang]) =>
      `<li><a href="${href}"${lang ? ` lang="${lang}"` : ''}><span class="cmd-kind">${kind}</span><span class="cmd-label">${label}</span></a></li>`,
  ).join('');
  const title = meta.title === 'Home' ? 'Skiddle · skiddle.id v5 mockup' : `${meta.title} · skiddle.id v5 mockup`;
  return `<!doctype html>
<html lang="en" data-page="${name}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${meta.description ?? ''}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<script>
  /* Before first paint: the theme someone picked here, else the device's setting (no flash) */
  (function () {
    var d = document.documentElement, t = null, a = null;
    try { t = localStorage.getItem('v5.theme'); a = localStorage.getItem('v5.accent'); } catch (e) {}
    if (t === 'light' || t === 'dark') d.dataset.theme = t;
    if (a) d.dataset.accent = a;
  })();
</script>
<link rel="preload" href="fonts/geist-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/geist-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="v5.css">
<link rel="stylesheet" href="mock.css">
<link rel="icon" href="data:,">
${styles.length ? `<style>\n${styles.join('\n\n')}\n</style>\n` : ''}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${meta.progress === 'yes' ? '<div class="progress" aria-hidden="true"></div>\n' : ''}<aside class="ann" aria-label="Status line">
  <div class="wrap ann-row">
    <p class="ann-clock"><time data-clock="bkk">--:--</time> <span class="muted">Bangkok</span> <span class="ann-sep" aria-hidden="true">/</span> <time data-clock="utc">--:--</time><span class="muted">Z</span></p>
    <p class="ann-status"><a href="now.html"><span class="dot dot-ok" aria-hidden="true"></span><span class="sr-only">Status: </span>Available<span class="muted"> · Finally, v4.0 of my site released.</span></a></p>
    <p class="ann-play"><a href="listening.html"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">Now playing: </span>From the Start <span class="muted">· Laufey</span></a></p>
  </div>
</aside>
<header class="deck">
  <div class="wrap deck-row">
    <a class="brand" href="home.html"><span class="brand-user">skiddle</span><span class="muted">@</span>web<span class="muted">:~$</span><span class="cursor" aria-hidden="true"></span><span class="sr-only"> (home)</span></a>
    <nav class="route" aria-label="Main"><ul>${nav}</ul></nav>
    <div class="deck-tools">
      <button class="tool" type="button" data-search-open aria-haspopup="dialog">${icon('search', 16)}<span class="tool-label">Search</span><kbd data-shortcut>Ctrl K</kbd></button>
      <button class="tool tool-icon" type="button" data-theme-toggle aria-label="Switch to light theme"><span class="i-sun">${icon('sun', 16)}</span><span class="i-moon">${icon('moon', 16)}</span></button>
    </div>
  </div>
</header>

${body}

<footer class="foot">
  <div class="wrap">
    <section class="foot-totals" aria-labelledby="totals-h">
      <h2 id="totals-h" class="foot-label">Totals carried forward</h2>
      <dl class="totals">
        <div><dt>Posts</dt><dd>15</dd></div>
        <div><dt>Series</dt><dd>4</dd></div>
        <div><dt>Projects</dt><dd>6</dd></div>
        <div><dt>Plays, 7 days</dt><dd>107</dd></div>
        <div><dt>Writing since</dt><dd>2015</dd></div>
      </dl>
    </section>
    <div class="foot-grid">
      <nav aria-labelledby="f-writing"><h2 id="f-writing" class="foot-h">Writing</h2><ul><li><a href="writing.html">All posts</a></li><li><a href="series.html">Series</a></li><li><a href="topics.html">Topics</a></li><li><a href="notes.html">Notes</a></li></ul></nav>
      <nav aria-labelledby="f-me"><h2 id="f-me" class="foot-h">Me</h2><ul><li><a href="about.html">About</a></li><li><a href="now.html">Now</a></li><li><a href="listening.html">Listening</a></li><li><a href="flying.html">Flying</a></li><li><a href="uses.html">Uses</a></li></ul></nav>
      <nav aria-labelledby="f-work"><h2 id="f-work" class="foot-h">Work</h2><ul><li><a href="services.html">Services</a></li><li><a href="projects.html">Projects</a></li><li><a href="cv.html">CV</a></li><li><a href="changelog.html">Changelog</a></li></ul></nav>
      <nav aria-labelledby="f-else"><h2 id="f-else" class="foot-h">Elsewhere</h2><ul class="foot-icons"><li><a href="https://bsky.app/profile/skiddle.blue" rel="me">${icon('bluesky', 14)}Bluesky</a></li><li><a href="https://github.com/arcestia" rel="me">${icon('github', 14)}GitHub</a></li><li><a href="#rss">${icon('rss', 14)}RSS</a></li><li><a href="mailto:work@skiddle.id">${icon('mail', 14)}Email</a></li></ul></nav>
    </div>
    <p class="foot-record">Every page here is read from records in my <abbr title="AT Protocol">ATProto</abbr> repo, <code>did:plc:xaj6j6abvpgwps5v6k4t6clv</code>.</p>
    <p class="foot-legal">© 2026 Laurensius Jeffrey · Skiddle Labs Pte. Ltd. · Code MIT · Writing all rights reserved, no AI training · <a href="changelog.html">v5.0</a></p>
  </div>
</footer>

<dialog class="cmd" aria-labelledby="cmd-title">
  <form method="dialog" class="cmd-box" role="search">
    <h2 id="cmd-title" class="sr-only">Search</h2>
    <label class="cmd-prompt" for="cmd-q"><span class="muted">skiddle@web:~$</span> find</label>
    <input id="cmd-q" class="cmd-input" type="search" autocomplete="off" spellcheck="false" placeholder="posts, series, topics, pages" aria-describedby="cmd-count">
    <p id="cmd-count" class="cmd-count" aria-live="polite">${SEARCH.length} results</p>
    <ul class="cmd-list">${search}</ul>
    <p class="cmd-help"><kbd>Esc</kbd> to close</p>
  </form>
</dialog>
<script src="v5.js" defer></script>
<script src="mock.js" defer></script>
</body>
</html>
`;
}

const files = readdirSync(pagesDir).filter((f) => f.endsWith('.html'));
let built = 0;
for (const f of files) {
  try {
    writeFileSync(join(outDir, f), page(f.replace(/\.html$/, ''), parse(f)));
    built++;
  } catch (e) {
    console.error(`skipped ${f}: ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`built ${built} of ${files.length} pages into docs/v5/mockups/`);
