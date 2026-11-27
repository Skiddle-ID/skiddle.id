import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalPath, pageMetaOf, siteMetaFromRecord, siteMetaOf } from '../src/lib/site-meta.mjs';

const fallback = {
  name: 'Skiddle',
  description: 'Built-in.',
  keywords: [],
  author: { name: 'Laurensius Jeffrey', jobTitles: ['Founder'], knowsAbout: [] },
  profiles: ['https://bsky.app/profile/skiddle.blue'],
  pages: [],
};

describe('site meta', () => {
  it('keeps only what the record has, each field checked', () => {
    assert.deepEqual(siteMetaFromRecord({ updatedAt: '2026-11-27T00:00:00Z' }), {});
    assert.deepEqual(
      siteMetaFromRecord({
        name: ' Skiddle ',
        description: '',
        keywords: ['atproto', '', 3],
        author: { location: 'Bangkok', jobTitles: [] },
        profiles: ['https://github.com/arcestia', 'javascript:x', 'github.com/x'],
        pages: [{ path: 'uses', title: 'Uses', noindex: 'yes' }, { title: 'no path' }],
      }),
      {
        name: 'Skiddle',
        keywords: ['atproto'],
        author: { location: 'Bangkok' },
        profiles: ['https://github.com/arcestia'],
        pages: [{ path: '/uses/', title: 'Uses' }],
      },
    );
  });

  it('lays the record over the built-in values, the author field by field', () => {
    const site = siteMetaOf(fallback, { description: 'Mine.', author: { location: 'Bangkok' } });
    assert.equal(site.name, 'Skiddle');
    assert.equal(site.description, 'Mine.');
    assert.deepEqual(site.author, { name: 'Laurensius Jeffrey', jobTitles: ['Founder'], knowsAbout: [], location: 'Bangkok' });
    assert.deepEqual(siteMetaOf(fallback, null), fallback);
  });

  it('gives a page its own meta, an entry for its path over it, and the site’s keywords after', () => {
    const site = siteMetaOf(fallback, { keywords: ['ATProto', 'homelab'], pages: [{ path: '/uses/', description: 'My gear.', noindex: true }] });
    assert.deepEqual(pageMetaOf(site, '/uses/', { title: 'Uses — Skiddle', description: 'Theirs.' }), {
      title: 'Uses — Skiddle',
      description: 'My gear.',
      keywords: ['ATProto', 'homelab'],
      noindex: true,
    });
    assert.deepEqual(pageMetaOf(site, '/posts/x/', { title: 'X', keywords: ['atproto', 'flying'] }), {
      title: 'X',
      description: 'Built-in.',
      keywords: ['ATProto', 'flying', 'homelab'],
      noindex: false,
    });
  });

  it('takes the icon only with all four sizes', () => {
    const blob = (cid) => ({ $type: 'blob', ref: { $link: cid }, mimeType: 'image/png', size: 100 });
    const icon = { source: blob('s'), png32: blob('a'), png180: blob('b'), png192: blob('c'), png512: blob('d') };
    assert.deepEqual(siteMetaFromRecord({ icon }).icon, { png32: 'a', png180: 'b', png192: 'c', png512: 'd' });
    assert.equal(siteMetaFromRecord({ icon: { ...icon, png512: undefined } }).icon, undefined);
    assert.equal(siteMetaOf(fallback, {}).icon, undefined);
  });

  it('writes paths the way the site does', () => {
    assert.equal(normalPath('uses'), '/uses/');
    assert.equal(normalPath('/'), '/');
    assert.equal(normalPath('/rss.xml'), '/rss.xml');
    assert.equal(normalPath('/posts/x?ref=1'), '/posts/x/');
  });
});
