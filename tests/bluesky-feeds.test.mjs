// Each series' Bluesky feed (src/lib/bluesky-feed.mjs): the site is the feed generator
// did:web:skiddle.id, and serves Lab Notes' announcement posts; a feed that isn't a series' is unknown.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE } from './lib/preview.mjs';

const OWNER = 'did:plc:xaj6j6abvpgwps5v6k4t6clv';
const skeleton = (key) => `${BASE}/xrpc/app.bsky.feed.getFeedSkeleton?feed=${encodeURIComponent(`at://${OWNER}/app.bsky.feed.generator/${key}`)}`;

const json = async (url) => {
  const res = await fetch(url);
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  return { status: res.status, body: await res.json() };
};

describe('Bluesky feeds', () => {
  it('/.well-known/did.json names the feed generator', async () => {
    const { status, body } = await json(`${BASE}/.well-known/did.json`);
    assert.equal(status, 200);
    assert.equal(body.id, 'did:web:skiddle.id');
    assert.deepEqual(body.service, [{ id: '#bsky_fg', type: 'BskyFeedGenerator', serviceEndpoint: 'https://skiddle.id' }]);
  });

  it('describeFeedGenerator answers for did:web:skiddle.id', async () => {
    const { status, body } = await json(`${BASE}/xrpc/app.bsky.feed.describeFeedGenerator`);
    assert.equal(status, 200);
    assert.equal(body.did, 'did:web:skiddle.id');
    assert.ok(Array.isArray(body.feeds));
  });

  it("Lab Notes' feed holds its announcement posts", async () => {
    const { status, body } = await json(skeleton('lab-notes'));
    assert.equal(status, 200);
    assert.ok(body.feed.length >= 1);
    for (const item of body.feed) assert.match(item.post, /^at:\/\/[^/]+\/app\.bsky\.feed\.post\/[^/]+$/);
  });

  it('a feed that is no series is UnknownFeed', async () => {
    const { status, body } = await json(skeleton('does-not-exist'));
    assert.equal(status, 400);
    assert.equal(body.error, 'UnknownFeed');
  });
});
