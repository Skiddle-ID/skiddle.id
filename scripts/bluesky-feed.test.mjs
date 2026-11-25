// Each series' Bluesky feed (src/lib/bluesky-feed.mjs): which feed a URI names, how many posts a
// page holds, and a cursor that keeps its place when a new post is added on top.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeFeeds, feedSkeleton, generatorRecord } from '../src/lib/bluesky-feed.mjs';

const OWNER = 'did:plc:xaj6j6abvpgwps5v6k4t6clv';
const LAB_NOTES = `at://${OWNER}/app.bsky.feed.generator/lab-notes`;
const post = (n) => `at://${OWNER}/app.bsky.feed.post/3post${String(n).padStart(4, '0')}`;
const day = (n) => Date.UTC(2026, 0, n);

/** Lab Notes with `n` posts, one a day: post(n) is the newest */
const feeds = (n) => new Map([['lab-notes', Array.from({ length: n }, (_, i) => ({ post: post(i + 1), at: day(i + 1) }))]]);
const skeleton = (query, f = feeds(3)) => feedSkeleton(new URLSearchParams(query), f);
const posts = (res) => res.body.feed.map((item) => item.post);

describe('feedSkeleton, the feed', () => {
  it("serves a series' posts, newest first", () => {
    const res = skeleton({ feed: LAB_NOTES });
    assert.equal(res.status, 200);
    assert.deepEqual(posts(res), [post(3), post(2), post(1)]);
  });

  it('serves a series with no posts yet as an empty feed', () => {
    assert.deepEqual(skeleton({ feed: LAB_NOTES }, new Map([['lab-notes', []]])), { status: 200, body: { feed: [] } });
  });

  for (const [what, uri] of [
    ['a series that does not exist', `at://${OWNER}/app.bsky.feed.generator/nope`],
    ["another account's feed", 'at://did:plc:someoneelse/app.bsky.feed.generator/lab-notes'],
    ['another collection', `at://${OWNER}/id.skiddle.series/lab-notes`],
    ['a key with more after it', `${LAB_NOTES}/x`],
    ['garbage', 'lab-notes'],
  ]) {
    it(`answers UnknownFeed for ${what}`, () => {
      const res = skeleton({ feed: uri });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'UnknownFeed');
    });
  }

  it('answers InvalidRequest without a feed', () => {
    const res = skeleton({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'InvalidRequest');
  });
});

describe('feedSkeleton, limit', () => {
  it('holds 50 posts when no limit is given', () => {
    assert.equal(skeleton({ feed: LAB_NOTES }, feeds(120)).body.feed.length, 50);
  });

  for (const [limit, count] of [
    ['1', 1],
    ['7', 7],
    ['100', 100],
    ['500', 100],
    ['0', 1],
    ['-3', 1],
  ]) {
    it(`limit=${limit} gives ${count}`, () => {
      assert.equal(skeleton({ feed: LAB_NOTES, limit }, feeds(120)).body.feed.length, count);
    });
  }

  for (const limit of ['', 'ten', '1.5', '5abc']) {
    it(`answers InvalidRequest for limit=${JSON.stringify(limit)}`, () => {
      const res = skeleton({ feed: LAB_NOTES, limit });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'InvalidRequest');
    });
  }
});

describe('feedSkeleton, cursor', () => {
  it('pages through the whole feed once, then gives no cursor', () => {
    const f = feeds(5);
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = skeleton({ feed: LAB_NOTES, limit: '2', ...(cursor ? { cursor } : {}) }, f);
      assert.equal(res.status, 200);
      seen.push(...posts(res));
      cursor = res.body.cursor;
      pages++;
    } while (cursor);
    assert.equal(pages, 3);
    assert.deepEqual(seen, [post(5), post(4), post(3), post(2), post(1)]);
  });

  it('gives no cursor when the last page is exactly full', () => {
    const res = skeleton({ feed: LAB_NOTES, limit: '3' });
    assert.equal(res.body.feed.length, 3);
    assert.ok(!('cursor' in res.body));
  });

  it('keeps its place when a newer post is added on top', () => {
    const first = skeleton({ feed: LAB_NOTES, limit: '2' }, feeds(4));
    assert.deepEqual(posts(first), [post(4), post(3)]);
    const next = skeleton({ feed: LAB_NOTES, limit: '2', cursor: first.body.cursor }, feeds(5));
    assert.deepEqual(posts(next), [post(2), post(1)]);
  });

  it('tells apart posts published at the same moment', () => {
    const same = new Map([['lab-notes', [1, 2, 3].map((n) => ({ post: post(n), at: day(1) }))]]);
    const first = skeleton({ feed: LAB_NOTES, limit: '1' }, same);
    const rest = skeleton({ feed: LAB_NOTES, cursor: first.body.cursor }, same);
    assert.deepEqual([...posts(first), ...posts(rest)].sort(), [post(1), post(2), post(3)]);
  });

  it('answers InvalidRequest for a cursor it never gave', () => {
    const res = skeleton({ feed: LAB_NOTES, cursor: 'garbage' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'InvalidRequest');
  });
});

describe('describeFeeds', () => {
  it("lists each series' feed under the site's DID", () => {
    assert.deepEqual(describeFeeds(['lab-notes']), { did: 'did:web:skiddle.id', feeds: [{ uri: LAB_NOTES }] });
  });
});

describe('generatorRecord', () => {
  const at = '2026-11-25T00:00:00.000Z';

  it("points at the site's feed generator, with the series' name and description", () => {
    assert.deepEqual(generatorRecord({ name: 'Lab Notes', description: 'Weekly notes.' }, {}, at), {
      $type: 'app.bsky.feed.generator',
      did: 'did:web:skiddle.id',
      displayName: 'Lab Notes',
      description: 'Weekly notes.',
      createdAt: at,
    });
  });

  it('cuts the name to 24 characters and the description to 300, counting an emoji as one', () => {
    const record = generatorRecord({ name: '🧑‍💻'.repeat(30), description: 'x'.repeat(400) }, {}, at);
    assert.equal(record.displayName, '🧑‍💻'.repeat(24));
    assert.equal(record.description, 'x'.repeat(300));
  });

  it('describes a series without a description', () => {
    assert.equal(generatorRecord({ name: 'Lab Notes', description: ' ' }, {}, at).description, 'Posts in Lab Notes, a series on skiddle.id.');
  });

  it('keeps the creation date and an avatar from the record it updates', () => {
    const avatar = { $type: 'blob', ref: { $link: 'bafy' }, mimeType: 'image/png', size: 1 };
    const previous = { ...generatorRecord({ name: 'Old' }, {}, '2026-01-01T00:00:00.000Z'), avatar, descriptionFacets: [] };
    const record = generatorRecord({ name: 'Lab Notes' }, previous, at);
    assert.equal(record.createdAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(record.avatar, avatar);
    assert.equal(record.displayName, 'Lab Notes');
    assert.ok(!('descriptionFacets' in record));
  });
});
