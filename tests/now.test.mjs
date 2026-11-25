// /now/ (src/pages/now.astro): the Now list, from the id.skiddle.now record or the built-in list,
// and the home page's link to it.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE } from './lib/preview.mjs';

describe('now', () => {
  it('/now/ shows the Now list', async () => {
    const res = await fetch(`${BASE}/now/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<h1[^>]*>Now<\/h1>/);
    // An item: the list's dash, then its text
    assert.match(html, /<li[^>]*><span aria-hidden="true"[^>]*>-<\/span><span>[^<]+/);
  });

  it('the home page links to /now/', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert.match(html, /<a href="\/now\/"/);
  });
});
