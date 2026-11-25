// The newest post on Bluesky for /bluesky.svg (src/lib/bluesky-post.ts), from the AppView's
// getAuthorFeed: the account's own post, not a repost or a reply, with its counts and what it carries.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newestOwnPost } from '../src/lib/bluesky-post.ts';

const OWNER = 'did:plc:xaj6j6abvpgwps5v6k4t6clv';
const OTHER = 'did:plc:e5nncb3dr5thdkjir5cfaqfe';

/** A feed item as getAuthorFeed returns it */
const item = (text, { did = OWNER, record = {}, ...post } = {}, extra = {}) => ({
  post: {
    uri: `at://${did}/app.bsky.feed.post/3abc`,
    author: { did, handle: did === OWNER ? 'skiddle.blue' : 'xeiaso.net' },
    record: { $type: 'app.bsky.feed.post', text, createdAt: '2026-11-25T06:40:51.224Z', ...record },
    replyCount: 1,
    repostCount: 2,
    likeCount: 3,
    quoteCount: 4,
    indexedAt: '2026-11-25T06:40:52.044Z',
    ...post,
  },
  ...extra,
});
const newest = (...items) => newestOwnPost({ feed: items }, OWNER);
const attachments = (embed) => newest(item('post', { embed })).attachments;
const quoted = (type) => ({ $type: 'app.bsky.embed.record#view', record: { $type: type } });

describe('newestOwnPost', () => {
  it('is the first post in the feed, with its text, date and counts', () => {
    assert.deepEqual(newest(item('Lab Notes #3'), item('older')), {
      text: 'Lab Notes #3',
      createdAt: '2026-11-25T06:40:51.224Z',
      replies: 1,
      reposts: 2,
      likes: 3,
      attachments: [],
    });
  });

  it('skips reposts, even of its own posts', () => {
    const repost = { reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: { did: OWNER } } };
    assert.equal(newest(item('theirs', { did: OTHER }, repost), item('reposted mine', {}, repost), item('mine')).text, 'mine');
  });

  it('skips replies', () => {
    const reply = { reply: { root: { uri: 'at://x/app.bsky.feed.post/1' }, parent: { uri: 'at://x/app.bsky.feed.post/1' } } };
    assert.equal(newest(item('a reply', { record: reply }), item('a post')).text, 'a post');
  });

  it("skips another account's post", () => {
    assert.equal(newest(item('theirs', { did: OTHER }), item('mine')).text, 'mine');
  });

  it('is null for an empty feed, or anything that is not one', () => {
    assert.equal(newestOwnPost({ feed: [] }, OWNER), null);
    assert.equal(newestOwnPost({ error: 'InvalidRequest' }, OWNER), null);
    assert.equal(newestOwnPost(null, OWNER), null);
  });

  it('counts missing counts as 0', () => {
    const post = newest(item('new', { replyCount: undefined, repostCount: undefined, likeCount: undefined }));
    assert.deepEqual([post.replies, post.reposts, post.likes], [0, 0, 0]);
  });

  it('names images, video and links', () => {
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.images#view', images: [{}, {}] }), [{ kind: 'images', count: 2 }]);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.video#view' }), [{ kind: 'video' }]);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.external#view', external: { uri: 'https://www.skiddle.id/posts/lab-notes-3/' } }), [
      { kind: 'link', domain: 'skiddle.id' },
    ]);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.external#view', external: { uri: 'not a link' } }), [{ kind: 'link', domain: '' }]);
  });

  it('names a quote, and a feed, list or starter pack', () => {
    assert.deepEqual(attachments(quoted('app.bsky.embed.record#viewRecord')), [{ kind: 'quote' }]);
    assert.deepEqual(attachments(quoted('app.bsky.embed.record#viewNotFound')), [{ kind: 'quote' }]);
    assert.deepEqual(attachments(quoted('app.bsky.feed.defs#generatorView')), [{ kind: 'feed' }]);
    assert.deepEqual(attachments(quoted('app.bsky.graph.defs#listView')), [{ kind: 'list' }]);
    assert.deepEqual(attachments(quoted('app.bsky.graph.defs#starterPackViewBasic')), [{ kind: 'starter pack' }]);
  });

  it('names both parts of a quote with images', () => {
    const embed = {
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: quoted('app.bsky.embed.record#viewRecord'),
      media: { $type: 'app.bsky.embed.images#view', images: [{}] },
    };
    assert.deepEqual(attachments(embed), [{ kind: 'quote' }, { kind: 'images', count: 1 }]);
  });
});
