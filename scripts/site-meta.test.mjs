import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { COMMAND_PAGES, FALLBACK_FOOTER_LINKS, FALLBACK_MENU } from '../src/data/frame.ts';
import { ICON_NAMES } from '../src/lib/icons.mjs';
import { commandPagesOf, frameProblems, isExternal, normalPath, pageMetaOf, siteMetaFromRecord, siteMetaOf } from '../src/lib/site-meta.mjs';

const fallback = {
  name: 'Skiddle',
  description: 'Built-in.',
  keywords: [],
  author: { name: 'Laurensius Jeffrey', jobTitles: ['Founder'], knowsAbout: [] },
  profiles: ['https://bsky.app/profile/skiddle.blue'],
  pages: [],
  menu: FALLBACK_MENU,
  footerLinks: FALLBACK_FOOTER_LINKS,
  hideMusic: false,
  hideThemeButtons: false,
  hideSeriesBox: false,
  hideComments: false,
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

  describe('the frame', () => {
    it('is today’s menu, footer and sidebar without the fields', () => {
      const site = siteMetaOf(fallback, { updatedAt: '2026-11-28T00:00:00Z' });
      assert.deepEqual(site.menu.map((m) => m.href), ['/posts/', '/notes/', '/timeline/', '/about/', '/works/', '/projects/', '/uses/', '/services/']);
      assert.deepEqual(site.footerLinks.map((l) => l.label), ['now', 'rss', 'work@skiddle.id', 'source']);
      assert.equal(site.hideMusic, false);
      assert.equal(site.hideThemeButtons, false);
    });

    it('takes the record’s menu and footer, in its order, with icons the site has', () => {
      const site = siteMetaOf(fallback, {
        menu: [{ label: 'about', href: '/about/' }, { label: ' talks ', href: '/speaking/', icon: 'mail' }, { label: 'code', href: 'https://github.com/arcestia', icon: 'rocket' }],
        footerLinks: [{ label: 'email', href: 'mailto:hi@skiddle.id' }],
      });
      assert.deepEqual(site.menu, [
        { label: 'about', href: '/about/' },
        { label: 'talks', href: '/speaking/', icon: 'mail' },
        { label: 'code', href: 'https://github.com/arcestia' },
      ]);
      assert.deepEqual(site.footerLinks, [{ label: 'email', href: 'mailto:hi@skiddle.id' }]);
    });

    it('drops links the site can’t hold, and falls back when none is left', () => {
      const bad = ['javascript:alert(1)', 'http://example.com', '//evil.example', '/\\evil.example', 'posts', 'https://', 'mailto:nobody', '/a b'];
      const menu = [...bad.map((href) => ({ label: 'x', href })), { label: '', href: '/now/' }, { label: 'now', href: '/now/' }];
      assert.deepEqual(siteMetaFromRecord({ menu }).menu, [{ label: 'now', href: '/now/' }]);
      assert.equal(siteMetaFromRecord({ menu: bad.map((href) => ({ label: 'x', href })) }).menu, undefined);
      assert.deepEqual(siteMetaOf(fallback, { footerLinks: [{ label: 'x', href: 'javascript:x' }] }).footerLinks, FALLBACK_FOOTER_LINKS);
      assert.deepEqual(frameProblems({ menu: [{ label: 'ok', href: '/ok/' }, { label: 'x', href: 'javascript:x' }], footerLinks: [{ label: 'y', href: 'ftp://y' }] }), [
        'Menu item 2’s link needs to start with /, https:// or mailto:.',
        'Footer link 1’s link needs to start with /, https:// or mailto:.',
      ]);
    });

    it('reads the switches only when they’re true', () => {
      assert.deepEqual(siteMetaFromRecord({ hideMusic: true, hideThemeButtons: true }), { hideMusic: true, hideThemeButtons: true });
      assert.deepEqual(siteMetaFromRecord({ hideMusic: 'yes', hideThemeButtons: 1 }), {});
      const site = siteMetaOf(fallback, { hideThemeButtons: true });
      assert.equal(site.hideMusic, false);
      assert.equal(site.hideThemeButtons, true);
    });

    it('shows the series box and the comments on posts, as today, unless the record hides them', () => {
      for (const record of [null, {}, { updatedAt: '2026-11-28T00:00:00Z' }, { hideSeriesBox: false, hideComments: false }]) {
        const site = siteMetaOf(fallback, record);
        assert.equal(site.hideSeriesBox, false);
        assert.equal(site.hideComments, false);
      }
      assert.deepEqual(siteMetaFromRecord({ hideSeriesBox: 'true', hideComments: 1 }), {});
      const site = siteMetaOf(fallback, { hideComments: true });
      assert.equal(site.hideSeriesBox, false);
      assert.equal(site.hideComments, true);
      assert.equal(siteMetaOf(fallback, { hideSeriesBox: true, hideComments: true }).hideSeriesBox, true);
    });

    it('lists the site’s pages in the command bar, named as the menu names them, then the menu’s others', () => {
      assert.deepEqual(commandPagesOf(COMMAND_PAGES, []), COMMAND_PAGES);
      const pages = commandPagesOf(COMMAND_PAGES, [{ label: 'writing', href: '/posts/' }, { label: 'talks', href: '/speaking/' }]);
      assert.equal(pages.length, COMMAND_PAGES.length + 1);
      assert.deepEqual(pages.find((p) => p.href === '/posts/'), { ...COMMAND_PAGES[1], label: 'writing', keywords: `posts ${COMMAND_PAGES[1].keywords}` });
      assert.deepEqual(pages.at(-1), { label: 'talks', href: '/speaking/', hint: '', keywords: '' });
    });

    it('offers the icons the site has, as the lexicon lists them', () => {
      const lexicon = JSON.parse(readFileSync(new URL('../lexicons/id/skiddle/site.json', import.meta.url), 'utf8'));
      assert.deepEqual(lexicon.defs.menuItem.properties.icon.knownValues, [...ICON_NAMES]);
    });
  });
  it('opens only https links to another host in a new tab', () => {
    assert.deepEqual(
      ['https://bsky.app/x', 'https://skiddle.id/posts/a/', 'https://skiddle.id', 'https://skiddle.id.evil.example/', '/posts/', 'mailto:a@b.c'].map(isExternal),
      [true, false, false, true, false, false],
    );
  });
});
