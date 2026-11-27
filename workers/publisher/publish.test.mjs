/**
 * The scheduler's logic (publish.mjs) against an in-memory stand-in for the PDS and the site:
 * `npm run test:unit`, also run in CI.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCUMENT_COLLECTION, DRAFT_COLLECTION, POST_TYPE } from '../../src/lib/post-record.mjs';
import { DID, PUBLICATION_URI, documentRkey } from '../../src/lib/standard-site.mjs';
import { MAX_PER_RUN, publishDue } from './publish.mjs';

const CARD = { $type: 'blob', ref: { $link: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku' }, mimeType: 'image/png', size: 50000 };
const NOW = new Date('2026-11-20T02:03:00.000Z');

/** A due draft: published at `publishAt` (default: a minute before NOW) */
function draft(slug, fields = {}) {
  return {
    $type: DRAFT_COLLECTION,
    title: `Title of ${slug}`,
    description: `About ${slug}`,
    path: `/posts/${slug}/`,
    tags: ['test'],
    content: { $type: POST_TYPE, markdown: `Hello from **${slug}**.`, category: 'infra' },
    publishAt: '2026-11-20T02:02:00.000Z',
    coverImage: CARD,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T11:00:00.000Z',
    ...fields,
  };
}

/** An in-memory repo, with a log of writes, and a site that records what was asked of it */
function standIn(records = {}, { liveAfter = 0 } = {}) {
  const repo = new Map(); // "collection/rkey" -> { cid, value }
  let n = 0;
  const cid = () => `bafycid${++n}`;
  const put = (collection, rkey, value) => {
    const c = cid();
    repo.set(`${collection}/${rkey}`, { cid: c, value: structuredClone(value) });
    return { uri: `at://${DID}/${collection}/${rkey}`, cid: c };
  };
  for (const [key, value] of Object.entries(records)) {
    const [collection, rkey] = key.split(/\/(?=[^/]+$)/);
    put(collection, rkey, value);
  }
  const writes = [];
  const swap = (key, swapRecord) => {
    if (swapRecord !== undefined && repo.get(key)?.cid !== swapRecord) throw Object.assign(new Error('InvalidSwap'), { error: 'InvalidSwap' });
  };
  const signIns = [];
  const pds = {
    async list(collection) {
      return [...repo]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .map(([key, r]) => ({ uri: `at://${DID}/${key}`, cid: r.cid, value: structuredClone(r.value) }));
    },
    async get(collection, rkey) {
      const r = repo.get(`${collection}/${rkey}`);
      return r ? { uri: `at://${DID}/${collection}/${rkey}`, cid: r.cid, value: structuredClone(r.value) } : null;
    },
    async signIn() {
      signIns.push(true);
      return {
        async create(collection, rkey, record) {
          if (repo.has(`${collection}/${rkey}`)) throw new Error('Record already exists');
          writes.push(['create', collection, rkey]);
          return put(collection, rkey, record);
        },
        async put(collection, rkey, record, swapRecord) {
          swap(`${collection}/${rkey}`, swapRecord);
          writes.push(['put', collection, rkey]);
          return put(collection, rkey, record);
        },
        async remove(collection, rkey, swapRecord) {
          swap(`${collection}/${rkey}`, swapRecord);
          writes.push(['delete', collection, rkey]);
          repo.delete(`${collection}/${rkey}`);
        },
      };
    },
  };
  const asked = [];
  let checks = 0;
  const site = {
    async revalidate() {
      asked.push('revalidate');
    },
    async waitLive(path) {
      asked.push(`live ${path}`);
      if (++checks <= liveAfter) throw new Error(`${path} isn't up`);
    },
  };
  return { repo, writes, signIns, pds, site, asked };
}

const run = (s, options = {}) => publishDue({ pds: s.pds, site: s.site, now: NOW, log: () => {}, ...options });
const rkeyFor = (slug, at = '2026-11-20T02:02:00.000Z') => documentRkey({ slug, pubDate: new Date(at) });

test('nothing due: no sign-in, no writes', async () => {
  const s = standIn({ [`${DRAFT_COLLECTION}/a1`]: draft('later', { publishAt: '2026-11-20T03:00:00.000Z' }), [`${DRAFT_COLLECTION}/a2`]: draft('unscheduled', { publishAt: undefined }) });
  assert.deepEqual(await run(s), []);
  assert.equal(s.signIns.length, 0);
  assert.equal(s.repo.size, 2);
});

test('a due draft becomes a post, is announced, and the draft is deleted', async () => {
  const s = standIn({ [`${DRAFT_COLLECTION}/d1`]: draft('hello'), [`site.standard.publication/${PUBLICATION_URI.split('/').pop()}`]: { name: 'Skiddle' } });
  const results = await run(s);
  assert.deepEqual(results.map((r) => r.status), ['published']);
  const rkey = rkeyFor('hello');
  const doc = s.repo.get(`${DOCUMENT_COLLECTION}/${rkey}`).value;
  assert.equal(doc.$type, DOCUMENT_COLLECTION);
  assert.equal(doc.site, PUBLICATION_URI);
  assert.equal(doc.path, '/posts/hello/');
  assert.equal(doc.title, 'Title of hello');
  assert.equal(doc.description, 'About hello');
  assert.equal(doc.publishedAt, '2026-11-20T02:02:00.000Z');
  assert.deepEqual(doc.tags, ['test']);
  assert.equal(doc.textContent, 'Hello from hello.');
  assert.equal(doc.content.markdown, 'Hello from **hello**.');
  assert.deepEqual(doc.coverImage, CARD);
  assert.equal(doc.publishAt, undefined);
  // The announcement: same key as the post, the card as its link card
  const post = s.repo.get(`app.bsky.feed.post/${rkey}`).value;
  assert.equal(post.text, 'Title of hello\n\nskiddle.id/posts/hello');
  assert.equal(post.embed.external.uri, 'https://skiddle.id/posts/hello/');
  assert.deepEqual(post.embed.external.thumb, CARD);
  // Names the post's record (as it was when announced) and the publication's, for Bluesky's Standard.site card
  assert.deepEqual(post.embed.external.associatedRefs, [
    { $type: 'com.atproto.repo.strongRef', uri: `at://${DID}/${DOCUMENT_COLLECTION}/${rkey}`, cid: post.embed.external.associatedRefs[0].cid },
    { $type: 'com.atproto.repo.strongRef', uri: PUBLICATION_URI, cid: s.repo.get(`site.standard.publication/${PUBLICATION_URI.split('/').pop()}`).cid },
  ]);
  // The post's record changed after (its comments were turned on), so the ref is to the version announced
  assert.notEqual(post.embed.external.associatedRefs[0].cid, s.repo.get(`${DOCUMENT_COLLECTION}/${rkey}`).cid);
  assert.equal(post.createdAt, NOW.toISOString());
  assert.deepEqual(doc.bskyPostRef, { uri: `at://${DID}/app.bsky.feed.post/${rkey}`, cid: s.repo.get(`app.bsky.feed.post/${rkey}`).cid });
  assert.equal(s.repo.has(`${DRAFT_COLLECTION}/d1`), false);
  assert.deepEqual(s.asked, ['revalidate', 'live /posts/hello/', 'revalidate']);
  assert.equal(s.signIns.length, 1);
});

test('oldest first, at most MAX_PER_RUN a run', async () => {
  const records = {};
  for (let i = 1; i <= MAX_PER_RUN + 1; i++) records[`${DRAFT_COLLECTION}/d${i}`] = draft(`post-${i}`, { publishAt: `2026-11-20T0${MAX_PER_RUN + 1 - i}:00:00.000Z` });
  const s = standIn(records);
  const results = await run(s);
  assert.deepEqual(
    results.map((r) => r.title),
    Array.from({ length: MAX_PER_RUN }, (_, i) => `Title of post-${MAX_PER_RUN + 1 - i}`),
  );
  assert.equal(s.repo.has(`${DRAFT_COLLECTION}/d1`), true);
  assert.deepEqual((await run(s)).map((r) => r.title), ['Title of post-1']);
});

test('a page that doesn’t come up: posted but not announced; the next run finishes without posting twice', async () => {
  const s = standIn({ [`${DRAFT_COLLECTION}/d1`]: draft('slow') }, { liveAfter: 1 });
  assert.deepEqual((await run(s)).map((r) => r.status), ['failed']);
  const rkey = rkeyFor('slow');
  assert.equal(s.repo.get(`${DOCUMENT_COLLECTION}/${rkey}`).value.bskyPostRef, undefined);
  assert.equal(s.repo.has(`app.bsky.feed.post/${rkey}`), false);
  assert.equal(s.repo.has(`${DRAFT_COLLECTION}/d1`), true);
  assert.deepEqual((await run(s)).map((r) => r.status), ['published']);
  assert.equal(s.writes.filter(([op, c]) => op === 'create' && c === DOCUMENT_COLLECTION).length, 1);
  assert.equal(s.writes.filter(([op, c]) => op === 'create' && c === 'app.bsky.feed.post').length, 1);
});

test('announced but stopped before linking it: the next run reuses the Bluesky post', async () => {
  const rkey = rkeyFor('half');
  const d = draft('half');
  const s = standIn({
    [`${DRAFT_COLLECTION}/d1`]: d,
    [`${DOCUMENT_COLLECTION}/${rkey}`]: { $type: DOCUMENT_COLLECTION, site: PUBLICATION_URI, path: d.path, title: d.title, description: d.description, tags: d.tags, content: d.content, publishedAt: d.publishAt, coverImage: CARD, textContent: 'x' },
    [`app.bsky.feed.post/${rkey}`]: { $type: 'app.bsky.feed.post', text: 'already posted', createdAt: NOW.toISOString() },
  });
  assert.deepEqual((await run(s)).map((r) => r.status), ['published']);
  assert.equal(s.writes.some(([op, c]) => op === 'create' && c === 'app.bsky.feed.post'), false);
  assert.equal(s.repo.get(`${DOCUMENT_COLLECTION}/${rkey}`).value.bskyPostRef.uri, `at://${DID}/app.bsky.feed.post/${rkey}`);
});

test('a draft edited after its post went up is kept, unscheduled', async () => {
  const rkey = rkeyFor('edited');
  const original = draft('edited');
  const s = standIn({
    [`${DRAFT_COLLECTION}/d1`]: { ...original, content: { ...original.content, markdown: 'Changed afterwards.' } },
    [`${DOCUMENT_COLLECTION}/${rkey}`]: { $type: DOCUMENT_COLLECTION, site: PUBLICATION_URI, path: original.path, title: original.title, description: original.description, tags: original.tags, content: original.content, publishedAt: original.publishAt, coverImage: CARD, textContent: 'x', bskyPostRef: { uri: 'at://x/app.bsky.feed.post/y', cid: 'c' } },
  });
  assert.deepEqual((await run(s)).map((r) => r.status), ['unscheduled']);
  const kept = s.repo.get(`${DRAFT_COLLECTION}/d1`).value;
  assert.equal(kept.content.markdown, 'Changed afterwards.');
  assert.equal(kept.publishAt, undefined);
  assert.equal(kept.coverImage, undefined);
  assert.equal(kept.title, original.title);
});

test('a draft changed while it was being published isn’t deleted; the next run unschedules it', async () => {
  const s = standIn({ [`${DRAFT_COLLECTION}/d1`]: draft('racing') });
  const signIn = s.pds.signIn;
  s.pds.signIn = async () => {
    const w = await signIn();
    return {
      ...w,
      async create(collection, rkey, record) {
        const res = await w.create(collection, rkey, record);
        // Meanwhile the draft is saved on another device
        if (collection === 'app.bsky.feed.post') {
          const d = draft('racing');
          await w.put(DRAFT_COLLECTION, 'd1', { ...d, content: { ...d.content, markdown: 'Edited meanwhile.' } });
        }
        return res;
      },
    };
  };
  const first = await run(s);
  assert.deepEqual(first.map((r) => r.status), ['failed']);
  assert.match(first[0].note, /InvalidSwap/);
  assert.equal(s.repo.get(`${DRAFT_COLLECTION}/d1`).value.content.markdown, 'Edited meanwhile.');
  assert.deepEqual((await run(s)).map((r) => r.status), ['unscheduled']);
  assert.equal(s.repo.get(`${DRAFT_COLLECTION}/d1`).value.content.markdown, 'Edited meanwhile.');
  assert.equal(s.writes.filter(([op, c]) => op === 'create' && c === 'app.bsky.feed.post').length, 1);
});

test('skipped: no share card, no address, an address another post has; they don’t hold up the rest', async () => {
  const records = {
    [`${DRAFT_COLLECTION}/d1`]: draft('no-card', { coverImage: undefined }),
    [`${DRAFT_COLLECTION}/d2`]: draft('no-path', { path: undefined, publishAt: '2026-11-20T02:01:00.000Z' }),
    [`${DOCUMENT_COLLECTION}/3aaaaaaaaaaaa`]: { $type: DOCUMENT_COLLECTION, site: PUBLICATION_URI, path: '/posts/taken/', title: 'Already here' },
    [`${DRAFT_COLLECTION}/d3`]: draft('taken', { publishAt: '2026-11-20T02:00:00.000Z' }),
    [`${DRAFT_COLLECTION}/d4`]: draft('fine', { publishAt: '2026-11-20T02:02:30.000Z' }),
  };
  const s = standIn(records);
  const results = await run(s);
  assert.deepEqual(
    results.map((r) => [r.title, r.status]),
    [
      ['Title of taken', 'skipped'],
      ['Title of no-path', 'skipped'],
      ['Title of no-card', 'skipped'],
      ['Title of fine', 'published'],
    ],
  );
  assert.match(results[0].note, /already a published post/);
  assert.match(results[2].note, /no share card/);
  assert.equal(s.repo.has(`${DRAFT_COLLECTION}/d1`), true);
});

test('a dry run writes nothing', async () => {
  const s = standIn({ [`${DRAFT_COLLECTION}/d1`]: draft('dry') });
  assert.deepEqual((await run(s, { dryRun: true })).map((r) => r.status), ['would publish']);
  assert.equal(s.signIns.length, 0);
  assert.deepEqual(s.writes, []);
});
