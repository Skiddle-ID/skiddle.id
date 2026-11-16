// Every link, image, stylesheet, script and share card on every page that points at this site
// answers with a success (redirects followed). Links to other sites aren't checked here, so a
// slow third-party site can't fail a PR.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE, eachLimit, pagePaths } from './lib/preview.mjs';

const OWN_HOSTS = new Set([new URL(BASE).host, 'skiddle.id', 'www.skiddle.id']);

/** Same-site URLs referenced by a page, as paths without the #fragment */
function references(html, pageUrl) {
  const found = new Set();
  const add = (value) => {
    if (!value || /^(mailto|tel|javascript|data|at):/i.test(value)) return;
    let url;
    try {
      url = new URL(value.replace(/&amp;/g, '&'), pageUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol) || !OWN_HOSTS.has(url.host)) return;
    found.add(url.pathname + url.search);
  };
  for (const m of html.matchAll(/<(?:a|link)\b[^>]*?\shref="([^"]*)"/gi)) add(m[1]);
  for (const m of html.matchAll(/<(?:img|script|source|iframe)\b[^>]*?\ssrc="([^"]*)"/gi)) add(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/gi)) for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]*)"/gi)) add(m[1]);
  return found;
}

describe('links', () => {
  it('every same-site link and file works', async () => {
    const pages = await pagePaths();
    const targets = new Map(); // path -> a page that uses it
    for (const path of pages) {
      const res = await fetch(BASE + path);
      if (!path.startsWith('/this-page-does-not-exist')) assert.ok(res.ok, `${path} answered ${res.status}`);
      for (const ref of references(await res.text(), BASE + path)) {
        // The 404 page's own address (its canonical link) is meant to be missing
        if (ref.startsWith('/this-page-does-not-exist')) continue;
        if (!targets.has(ref)) targets.set(ref, path);
      }
    }
    const broken = [];
    await eachLimit([...targets.keys()], 8, async (ref) => {
      const res = await fetch(BASE + ref, { redirect: 'follow' }).catch((e) => ({ ok: false, status: e.message }));
      if (!res.ok) broken.push(`${ref} (${res.status}), linked from ${targets.get(ref)}`);
    });
    console.log(`  checked ${targets.size} same-site URLs on ${pages.length} pages`);
    assert.deepEqual(broken.sort(), [], 'broken links');
  });
});
