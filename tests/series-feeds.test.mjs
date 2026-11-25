// Each series' own RSS feed (src/pages/series/[slug]/rss.xml.ts): Lab Notes has one, linked from
// its page, and a series that doesn't exist has none.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE } from './lib/preview.mjs';

const FEED = '/series/lab-notes/rss.xml';

describe('series feeds', () => {
  it(`${FEED} is an RSS feed of the series' posts`, async () => {
    const res = await fetch(BASE + FEED);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /xml/);
    const xml = await res.text();
    assert.match(xml, /^<\?xml[^>]*\?><rss version="2\.0"/);
    assert.match(xml, /<item>/);
    assert.match(xml, /<atom:link href="https:\/\/skiddle\.id\/series\/lab-notes\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
  });

  it('/series/lab-notes/ links its feed in the head', async () => {
    const html = await (await fetch(`${BASE}/series/lab-notes/`)).text();
    assert.match(html, /<link rel="alternate" type="application\/rss\+xml" title="Lab Notes · Skiddle" href="\/series\/lab-notes\/rss\.xml">/);
  });

  it('a series that does not exist has no feed', async () => {
    const res = await fetch(`${BASE}/series/does-not-exist/rss.xml`);
    assert.equal(res.status, 404);
  });
});
