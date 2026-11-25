// The top-of-the-week music card (src/pages/music-week.svg.ts): an SVG image with this week's plays
// or, if they can't be read, a link to /listening/.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { BASE } from './lib/preview.mjs';

describe('/music-week.svg', () => {
  it('is a valid SVG about this week', async () => {
    const res = await fetch(`${BASE}/music-week.svg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^image\/svg\+xml/);
    const svg = await res.text();
    assert.doesNotThrow(() => new Resvg(svg));
    assert.match(svg, /this week/);
  });

  it('takes a theme', async () => {
    const svg = await (await fetch(`${BASE}/music-week.svg?theme=light`)).text();
    assert.match(svg, /--bg:#ffffff/);
  });
});
