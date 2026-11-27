// Pages of Jeff's own (src/lib/own-pages.mjs): the addresses one can have, that no route or file of
// the site's can be taken by one, which records are published pages (what /<key>/ serves and the
// sitemap and search list), and that a new page's record is one the lexicon accepts.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { PAGE_COLLECTION, SITE_PAGES, blockType, draftKey } from '../src/lib/page-blocks.mjs';
import { OWN_KEY_MAX, RESERVED_KEYS, isOwnKey, ownKeyFrom, ownKeyProblem, ownPageOf, ownPagePath, ownPagesOf } from '../src/lib/own-pages.mjs';

const ROOT = join(import.meta.dirname, '..');
const lexicon = JSON.parse(readFileSync(join(ROOT, 'lexicons/id/skiddle/page.json'), 'utf8'));
const at = '2026-11-28T00:00:00.000Z';
const cid = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';

const block = (kind, options = {}, width) => ({ ...(width ? { width } : {}), block: { $type: blockType(kind), ...options } });
const record = (key, value) => ({ uri: `at://did:plc:xaj6j6abvpgwps5v6k4t6clv/${PAGE_COLLECTION}/${key}`, value });
const page = (title, ...blocks) => ({ $type: PAGE_COLLECTION, title, blocks, updatedAt: at });

/** What's at the top of a folder, as addresses: about.astro is about, rss.xml.ts is rss.xml */
const topLevel = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true })
    .map((e) => (e.isDirectory() ? e.name : e.name.replace(/\.(astro|ts|md|mdx)$/, '')))
    .filter((name) => !name.startsWith('['));

describe('an address of a page of Jeff’s own', () => {
  it('is lowercase letters, digits and single hyphens', () => {
    for (const key of ['speaking', 'talks-2026', '2026', 'a', 'x'.repeat(OWN_KEY_MAX)]) assert.equal(ownKeyProblem(key), null, key);
    for (const key of ['', 'Speaking', 'talks--2026', '-talks', 'talks-', 'talks_2026', 'talks.html', 'über', 'two words', 'x'.repeat(OWN_KEY_MAX + 1)]) {
      assert.notEqual(ownKeyProblem(key), null, key);
    }
  });

  it('is never a draft’s key', () => {
    assert.equal(isOwnKey(draftKey('speaking')), false);
  });

  it('isn’t one the site uses itself, nor a site page’s key', () => {
    for (const key of [...SITE_PAGES, 'api', 'media', 'xrpc', 'og', 'cdn-cgi']) assert.match(ownKeyProblem(key) ?? '', /site’s own addresses/, key);
  });

  it('isn’t taken by a page or a draft in the repo', () => {
    assert.match(ownKeyProblem('talks', ['about', 'talks']) ?? '', /already/);
    assert.match(ownKeyProblem('talks', [draftKey('talks')]) ?? '', /already/);
    assert.equal(ownKeyProblem('talks', ['talks-2026', 'talk', draftKey('talks-2026')]), null);
  });

  it('is made from a title, for New page', () => {
    assert.equal(ownKeyFrom('Talks & workshops'), 'talks-workshops');
    assert.equal(ownKeyFrom('  Crème brûlée, 2026! '), 'creme-brulee-2026');
    const long = ownKeyFrom('A very long title for a page that goes on and on past the limit');
    assert.ok(long.length <= OWN_KEY_MAX && isOwnKey(long), long);
    assert.equal(ownKeyFrom('?!'), '');
  });

  it('is at /<key>/', () => {
    assert.equal(ownPagePath('speaking'), '/speaking/');
  });
});

describe('the site’s own addresses', () => {
  it('include every top-level route in src/pages/, so no page can take one', () => {
    const routes = topLevel('src/pages');
    assert.ok(routes.includes('posts') && routes.includes('rss.xml') && routes.includes('index'), routes.join(' '));
    for (const name of routes) {
      assert.notEqual(ownKeyProblem(name), null, `src/pages/${name}`);
      if (/^[a-z0-9-]+$/.test(name)) assert.ok(RESERVED_KEYS.has(name), `RESERVED_KEYS lacks ${name}, a route in src/pages/`);
    }
  });

  it('include everything at the top of public/', () => {
    for (const name of topLevel('public')) {
      assert.notEqual(ownKeyProblem(name), null, `public/${name}`);
      if (/^[a-z0-9-]+$/.test(name)) assert.ok(RESERVED_KEYS.has(name), `RESERVED_KEYS lacks ${name}, in public/`);
    }
  });

  it('src/pages/ has one dynamic top-level route, the pages of Jeff’s own', () => {
    const dynamic = readdirSync(join(ROOT, 'src/pages')).filter((name) => name.startsWith('['));
    assert.deepEqual(dynamic, ['[key].astro']);
  });
});

describe('the published pages of Jeff’s own', () => {
  const records = [
    record('speaking', page('Speaking', block('markdown', { text: 'Talks.' }))),
    record(draftKey('speaking'), page('Speaking, again', block('markdown', { text: 'More talks.' }))),
    record(draftKey('talks'), page('Talks', block('markdown', { text: 'Not published yet.' }))),
    record('a-page', page('', block('now'))),
    record('about', page('About', block('markdown', { text: 'The site’s own.' }))),
    record('home', page('Home', block('now'))),
    record('api', page('API', block('markdown', { text: 'A reserved address.' }))),
    record('Bad_Key', page('Bad', block('now'))),
    record('no-blocks', { $type: PAGE_COLLECTION, title: 'Not a page', updatedAt: at }),
  ];

  it('are the records at an address a page can have that read as a page, by address', () => {
    assert.deepEqual(
      ownPagesOf(records).map((p) => [p.key, p.path, p.page.title]),
      [
        ['a-page', '/a-page/', ''],
        ['speaking', '/speaking/', 'Speaking'],
      ],
    );
  });

  it('leave out drafts, the site’s own pages and reserved addresses', () => {
    const keys = ownPagesOf(records).map((p) => p.key);
    for (const key of ['talks', draftKey('talks'), draftKey('speaking'), 'about', 'home', 'api', 'Bad_Key', 'no-blocks']) assert.ok(!keys.includes(key), key);
  });

  it('one at its address: the published version, never a draft; none where there’s no page', () => {
    assert.equal(ownPageOf(records, 'speaking')?.title, 'Speaking');
    for (const key of ['talks', 'about', 'api', 'missing', draftKey('speaking')]) assert.equal(ownPageOf(records, key), null, key);
  });

  it('have their dates and share cards, for the sitemap and og:image', () => {
    const [p] = ownPagesOf([record('speaking', { ...page('Speaking', block('now')), card: { $type: 'blob', ref: { $link: cid }, mimeType: 'image/png', size: 1 } })]);
    assert.equal(p.page.updatedAt, at);
    assert.equal(p.page.card, cid);
  });
});

describe('a new page’s record', () => {
  it('is a valid id.skiddle.page record, published or as a draft', () => {
    const lex = new Lexicons([structuredClone(lexicon)]);
    const value = {
      ...page(
        'Speaking',
        block('markdown', { text: 'Talks and workshops.' }),
        block('recentPosts', { limit: 3 }, 'half'),
        block('now', {}, 'half'),
        block('links', { buttons: true, links: [{ label: 'Book me', href: 'mailto:work@skiddle.id', primary: true }] }),
        block('callToAction', { title: 'Hire me', text: 'For a talk.', links: [{ label: 'Services', href: '/services/' }] }),
      ),
      description: 'Where I speak.',
    };
    lex.assertValidRecord(PAGE_COLLECTION, jsonToLex(value));
    lex.assertValidRecord(PAGE_COLLECTION, jsonToLex({ ...value, card: { $type: 'blob', ref: { $link: cid }, mimeType: 'image/png', size: 48213 } }));
  });
});

