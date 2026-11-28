// /changelog/'s releases (src/lib/releases.ts): which of GitHub's releases are listed and how, and
// what the page gets when GitHub refuses (a rate limit): the last list read, or null if there's none.
// No edge cache here (caches.default is undefined in Node), so only the in-memory side runs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { forget } from '../src/lib/edge-cache.ts';
import { RELEASES_URL, getReleases, releaseId, releasesFrom } from '../src/lib/releases.ts';
import { nestedProseHtml } from '../src/lib/now-html.ts';

const release = (tag, fields = {}) => ({
  tag_name: tag,
  name: tag,
  draft: false,
  prerelease: false,
  published_at: '2026-11-18T13:55:53Z',
  html_url: `${RELEASES_URL}/tag/${tag}`,
  body: `Notes for ${tag}`,
  ...fields,
});

const answer = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('the releases listed', () => {
  it('are the published ones with a version tag, newest first', () => {
    const listed = releasesFrom([
      release('v4.0', { published_at: '2026-11-18T13:55:53Z' }),
      release('v4.2', { draft: true, published_at: null }),
      release('backups', { name: 'Backups', prerelease: true, published_at: '2026-11-18T07:16:03Z' }),
      release('v4.1', { published_at: '2026-11-27T16:22:31Z' }),
      release('v4.1-rc.1', { prerelease: true }),
      release('nightly'),
      release('v1.2.1', { published_at: '2025-11-30T13:26:57Z' }),
    ]);
    assert.deepEqual(listed.map((r) => r.tag), ['v4.1', 'v4.0', 'v1.2.1']);
  });

  it('leave out the backups tag even when it isn’t a pre-release', () => {
    assert.deepEqual(releasesFrom([release('backups', { prerelease: false })]), []);
  });

  it('carry their name (the tag without one), date, link and notes', () => {
    const [named, unnamed] = releasesFrom([
      release('v3.3', { name: 'v3.3 - Massive Improvement ', published_at: '2026-11-13T06:10:45Z' }),
      release('v3.2', { name: '', published_at: '2026-11-12T15:50:40Z' }),
    ]);
    assert.deepEqual(named, { tag: 'v3.3', name: 'v3.3 - Massive Improvement', publishedAt: '2026-11-13T06:10:45Z', url: `${RELEASES_URL}/tag/v3.3`, notes: 'Notes for v3.3' });
    assert.equal(unnamed.name, 'v3.2');
  });

  it('leave out one whose link isn’t this repo’s release', () => {
    assert.deepEqual(releasesFrom([release('v1.0', { html_url: 'https://example.com/v1.0' }), release('v1.1', { html_url: 'javascript:alert(1)' })]), []);
  });

  it('refuse an answer that isn’t a list', () => {
    assert.throws(() => releasesFrom({ message: 'API rate limit exceeded' }));
  });

  it('have an id from their tag', () => {
    assert.equal(releaseId('v4.1'), 'v4-1');
    assert.equal(releaseId('v1.2.1'), 'v1-2-1');
  });
});

describe('a release’s notes', () => {
  const notes = (body) => releasesFrom([release('v4.1', { body })])[0].notes;
  const html = (body) => nestedProseHtml(notes(body), 3);

  it('drop Release Drafter’s “What’s changed” heading, and its headings sit under the release’s', () => {
    const out = html("## What's changed\n\n## 🚀 Added\n\n- feat: a thing\n\n### Smaller\n\n- more\n");
    assert.doesNotMatch(out, /changed/i);
    assert.match(out, /<h3>🚀 Added<\/h3>/);
    assert.match(out, /<h4>Smaller<\/h4>/);
    assert.doesNotMatch(out, /<h[12]/);
    assert.doesNotMatch(html("## What's Changed\n* bump\n"), /Changed/);
  });

  it('link a pull request, and leave other numbers alone', () => {
    const out = html('- feat(admin): a media library (#190)\n- fix: code scanning alert #3\n');
    assert.match(out, /<a href="https:\/\/github\.com\/Skiddle-ID\/skiddle\.id\/pull\/190" target="_blank" rel="noopener">#190<\/a>/);
    assert.match(out, /alert #3</);
  });

  it('move up when their highest heading is deeper, so none is skipped under the release’s', () => {
    const out = html('#### Added\n\n- a thing\n\n##### Smaller\n\n- more\n');
    assert.match(out, /<h3>Added<\/h3>/);
    assert.match(out, /<h4>Smaller<\/h4>/);
  });

  it('show raw HTML as text, drop comments and unsafe links', () => {
    const out = html('<!-- generated -->\n\n<script>alert(1)</script>\n\nSee [this](javascript:alert(1)).\n');
    assert.doesNotMatch(out, /<script|generated|javascript:/);
    assert.match(out, /&lt;script&gt;/);
    assert.match(out, /See this\./);
  });
});

// In order: the first read fails before anything was ever read
describe('reading the releases', () => {
  it('gives null when GitHub refuses and none were read before', async () => {
    assert.equal(await getReleases(answer(403, { message: 'API rate limit exceeded' })), null);
  });

  it('gives the list GitHub answers, and keeps it for the TTL', async () => {
    assert.deepEqual((await getReleases(answer(200, [release('v4.1')])))?.map((r) => r.tag), ['v4.1']);
    assert.deepEqual((await getReleases(answer(200, [release('v4.2')])))?.map((r) => r.tag), ['v4.1']);
  });

  it('gives the last list read when GitHub rate-limits or fails', async () => {
    for (const fetcher of [answer(429, {}), answer(500, {}), async () => { throw new Error('timeout'); }]) {
      await forget(['github/releases']);
      assert.deepEqual((await getReleases(fetcher))?.map((r) => r.tag), ['v4.1']);
    }
    // and GitHub isn't asked again until the TTL is up
    let asked = 0;
    await getReleases(async () => (asked++, new Response('[]')));
    assert.equal(asked, 0);
  });

  it('keeps the last list when GitHub answers with releases it can’t read, rather than an empty one', async () => {
    await forget(['github/releases']);
    const renamed = [{ tag: 'v4.2', is_draft: false }, release('backups')];
    assert.deepEqual((await getReleases(answer(200, renamed)))?.map((r) => r.tag), ['v4.1']);
  });

  it('sends the token when there is one, and none without', async () => {
    await forget(['github/releases']);
    const auth = [];
    const fetcher = async (_url, init) => (auth.push(init.headers.Authorization), new Response(JSON.stringify([release('v4.1')])));
    await getReleases(fetcher, 'github_pat_x');
    await forget(['github/releases']);
    await getReleases(fetcher);
    assert.deepEqual(auth, ['Bearer github_pat_x', undefined]);
  });

  it('reads every page', async () => {
    await forget(['github/releases']);
    const pages = [];
    const full = Array.from({ length: 100 }, (_, i) => release(`v1.${i}`, { published_at: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString() }));
    const fetcher = async (url) => {
      const page = Number(new URL(url).searchParams.get('page'));
      pages.push(page);
      return new Response(JSON.stringify(page === 1 ? full : [release('v4.1', { published_at: '2026-11-27T16:22:31Z' })]));
    };
    const listed = await getReleases(fetcher);
    assert.deepEqual(pages, [1, 2]);
    assert.equal(listed?.length, 101);
    assert.equal(listed?.[0].tag, 'v4.1');
  });
});
