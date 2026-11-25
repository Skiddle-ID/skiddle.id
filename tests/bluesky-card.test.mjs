// The latest Bluesky post card (src/pages/bluesky.svg.ts): an SVG image that names the account,
// with a post or, if Bluesky can't be read, a link to the profile.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { BASE } from './lib/preview.mjs';

describe('/bluesky.svg', () => {
  it('is a valid SVG naming @skiddle.blue', async () => {
    const res = await fetch(`${BASE}/bluesky.svg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^image\/svg\+xml/);
    const svg = await res.text();
    assert.doesNotThrow(() => new Resvg(svg));
    assert.match(svg, /skiddle\.blue/);
  });

  it('takes a theme', async () => {
    const svg = await (await fetch(`${BASE}/bluesky.svg?theme=light`)).text();
    assert.match(svg, /--bg:#ffffff/);
  });
});
