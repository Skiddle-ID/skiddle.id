// Pages made of blocks (src/lib/page-blocks.mjs): an id.skiddle.page record read leniently, the
// rows its blocks flow into, and the home page's old record turned into a page record that the
// lexicon accepts. Every kind of block in the lexicon has a reader and a component.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { BLOCKS, PAGE_COLLECTION, blockType, draftKey, homePageFromLegacy, isPageKey, linkAttributes, pageFromRecord, readsOf, rowsOf } from '../src/lib/page-blocks.mjs';
import { homeFromRecord, projectUri } from '../src/lib/page-records.mjs';

const ROOT = join(import.meta.dirname, '..');
const lexicon = JSON.parse(readFileSync(join(ROOT, 'lexicons/id/skiddle/page.json'), 'utf8'));
/** The live id.skiddle.home record, as it was on 2026-11-27 */
const homeRecord = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/home-record.json'), 'utf8'));
const at = '2026-11-28T00:00:00.000Z';

const block = (kind, options = {}, width) => ({ ...(width ? { width } : {}), block: { $type: blockType(kind), ...options } });
const page = (...blocks) => ({ $type: PAGE_COLLECTION, title: 'T', blocks, updatedAt: at });
const kinds = (p) => p.blocks.map((b) => b.block.kind);

describe('page records, read', () => {
  it('keeps a kind of block it doesn’t know as unknown, in its place', () => {
    const p = pageFromRecord(page(block('now'), { block: { $type: 'id.skiddle.page#poll', question: '?' } }, block('thisWeek')));
    assert.deepEqual(kinds(p), ['now', 'unknown', 'thisWeek']);
    assert.deepEqual(p.blocks[1].block, { kind: 'unknown', type: 'id.skiddle.page#poll' });
  });

  it('treats another lexicon’s block, or one with no $type, as unknown', () => {
    const p = pageFromRecord(page({ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'x' } }, { block: {} }, { width: 'half' }));
    assert.deepEqual(kinds(p), ['unknown', 'unknown', 'unknown']);
  });

  it('a width it doesn’t know is full', () => {
    const p = pageFromRecord(page(block('now', {}, 'quarter'), block('now', {}, 'half'), block('now', {}, 3), block('now')));
    assert.deepEqual(p.blocks.map((b) => b.width), ['full', 'half', 'full', 'full']);
  });

  it('leaves out a known block without what it needs, and keeps the rest', () => {
    const p = pageFromRecord(page(block('profile', { tagline: 'no greeting' }), block('markdown', { text: '  ' }), block('links', { links: [{ label: 'x', href: 'javascript:alert(1)' }] }), block('now')));
    assert.deepEqual(kinds(p), ['now']);
  });

  it('keeps only links it’s safe to follow', () => {
    const links = [
      { label: 'path', href: '/rss.xml' },
      { label: 'anchor', href: '#work' },
      { label: 'web', href: 'https://example.com', me: true },
      { label: 'mail', href: 'mailto:a@b.c', primary: true },
      { label: 'protocol-relative', href: '//evil.example' },
      { label: 'backslash', href: '/\\evil.example' },
      { label: 'script', href: 'javascript:alert(1)' },
      { label: 'not an anchor', href: '#work" onclick="x' },
    ];
    const [{ block: b }] = pageFromRecord(page(block('links', { links }))).blocks;
    assert.deepEqual(
      b.links.map((l) => [l.label, l.me, l.primary]),
      [
        ['path', false, false],
        ['anchor', false, false],
        ['web', true, false],
        ['mail', false, true],
      ],
    );
  });

  it('a link off the site opens in a new tab, and Jeff’s own profiles are rel="me"', () => {
    const link = (href, me = false) => linkAttributes({ label: 'x', href, me, primary: false });
    assert.deepEqual(link('https://bsky.app/profile/skiddle.blue', true), { target: '_blank', rel: 'me noopener' });
    assert.deepEqual(link('https://example.com'), { target: '_blank', rel: 'noopener' });
    assert.deepEqual(link('/rss.xml'), {});
    assert.deepEqual(link('mailto:a@b.c', true), { rel: 'me' });
  });

  it('reads projects by their record keys, and only this repo’s', () => {
    const [{ block: b }] = pageFromRecord(page(block('projects', { projects: [projectUri('b'), 'at://did:plc:other/id.skiddle.project/x', projectUri('a'), 7] }))).blocks;
    assert.deepEqual(b.projects, ['b', 'a']);
  });

  it('recent posts: 4 unless the limit is a whole number from 1 to 50', () => {
    const limits = [undefined, 2, 0, 51, 2.5, '3'].map((limit) => pageFromRecord(page(block('recentPosts', limit === undefined ? {} : { limit }))).blocks[0].block.limit);
    assert.deepEqual(limits, [4, 2, 4, 4, 4, 4]);
  });

  it('gives each heading an id once: a second block of a kind gets -2', () => {
    const p = pageFromRecord(page(block('now'), block('markdown', { text: 'x' }), block('now'), block('callToAction', { title: 'Hi' }), block('now')));
    assert.deepEqual(p.blocks.map((b) => b.anchor), ['now', undefined, 'now-2', 'hire', 'now-3']);
  });

  it('isn’t a page without a list of blocks', () => {
    for (const value of [null, 'page', [], { title: 'T' }, { title: 'T', blocks: {} }]) assert.equal(pageFromRecord(value), null);
  });

  it('a page’s own settings, with the defaults when they’re left out', () => {
    const cid = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';
    assert.deepEqual(
      pageFromRecord({ ...page(), description: 'D', width: 'wide', hideHeading: true, card: { $type: 'blob', ref: { $link: cid }, mimeType: 'image/png', size: 1 } }),
      { title: 'T', description: 'D', width: 'wide', hideHeading: true, card: cid, blocks: [] },
    );
    assert.deepEqual(pageFromRecord({ blocks: [], width: 'huge', hideHeading: 'yes' }), { title: '', description: '', width: 'narrow', hideHeading: false, blocks: [] });
  });

  it('what a page reads, each once, leaving out unknown blocks', () => {
    const p = pageFromRecord(page(block('profile', { greeting: 'Hi' }), block('recentPosts'), block('recentPosts', { hideSeries: true }), { block: { $type: 'x' } }, block('markdown', { text: 'x' })));
    assert.deepEqual(readsOf(p), ['status', 'posts']);
  });
});

describe('rows', () => {
  const rows = (...widths) => rowsOf(pageFromRecord(page(...widths.map((w) => block('now', {}, w)))).blocks).map((r) => r.map((b) => b.width));

  it('a full block is a row of its own; halves and thirds share rows while they fit', () => {
    assert.deepEqual(rows('full', 'half', 'half', 'third', 'third', 'third', 'full'), [['full'], ['half', 'half'], ['third', 'third', 'third'], ['full']]);
  });

  it('starts a new row when the next block doesn’t fit, or is full', () => {
    assert.deepEqual(rows('half', 'third', 'third', 'half', 'full', 'third'), [['half', 'third'], ['third', 'half'], ['full'], ['third']]);
  });

  it('leaves out unknown blocks, so they leave no gap', () => {
    const p = pageFromRecord(page(block('now', {}, 'half'), { width: 'half', block: { $type: 'x' } }, block('now', {}, 'half')));
    assert.deepEqual(rowsOf(p.blocks).map((r) => r.length), [2]);
  });
});

describe('drafts', () => {
  it('a draft is the page’s key with ~draft, which lists of pages leave out', () => {
    assert.equal(draftKey('home'), 'home~draft');
    assert.deepEqual(['home', draftKey('home'), 'about', 'about~old'].filter(isPageKey), ['home', 'about']);
  });
});

describe('the home page from its old record', () => {
  const converted = homePageFromLegacy(homeFromRecord(homeRecord), at);

  it('lays out what the page showed, in its order', () => {
    const p = pageFromRecord(converted);
    assert.deepEqual(kinds(p), ['profile', 'markdown', 'links', 'now', 'thisWeek', 'projects', 'recentPosts', 'testimonials', 'callToAction', 'links']);
    assert.ok(p.blocks.every((b) => b.width === 'full'));
    assert.equal(p.hideHeading, true);
    assert.equal(p.title, homeRecord.title);
    assert.equal(p.description, homeRecord.description);
    const [profile, intro, quick, , , projects, recent, , hire, elsewhere] = p.blocks.map((b) => b.block);
    assert.deepEqual(profile, { kind: 'profile', greeting: homeRecord.greeting, tagline: homeRecord.tagline, hideStatus: false });
    assert.equal(intro.text, homeRecord.intro);
    assert.deepEqual(quick.links.map((l) => l.href), ['#work', '/posts/', '/services/']);
    assert.deepEqual(projects.projects, ['checkdomain', 'shortlink', 'blocklist']);
    assert.deepEqual(recent, { kind: 'recentPosts', limit: 4, hideSeries: false });
    assert.equal(hire.title, homeRecord.hire.title);
    assert.equal(hire.text, homeRecord.hire.blurb);
    assert.deepEqual(
      elsewhere.links.map((l) => [l.label, l.href, l.me]),
      homeRecord.elsewhere.map((l) => [l.label, l.href, l.me === true]),
    );
    assert.deepEqual(p.blocks.map((b) => b.anchor), ['intro', undefined, undefined, 'now', 'this-week', 'work', 'writing', undefined, 'hire', undefined]);
  });

  it('is a valid id.skiddle.page record', () => {
    const lex = new Lexicons([structuredClone(lexicon)]);
    lex.assertValidRecord(PAGE_COLLECTION, jsonToLex(converted));
  });
});

describe('the block registry', () => {
  const defs = lexicon.defs.block.properties.block.refs.map((ref) => ref.slice(1));

  it('every kind of block in the lexicon has a reader and a component, and nothing else does', () => {
    assert.deepEqual(Object.keys(BLOCKS).sort(), [...defs].sort());
    const registry = /const BLOCK_COMPONENTS = \{([^}]*)\}/.exec(readFileSync(join(ROOT, 'src/components/blocks/blocks.astro'), 'utf8'))?.[1] ?? '';
    assert.deepEqual(registry.split(',').map((k) => k.trim()).sort(), [...defs].sort(), 'BLOCK_COMPONENTS in src/components/blocks/blocks.astro');
    for (const kind of defs) {
      assert.ok(existsSync(join(ROOT, `src/components/blocks/${kind}.astro`)), `src/components/blocks/${kind}.astro`);
      assert.equal(lexicon.defs[kind].type, 'object', `#${kind} is an object`);
    }
  });

  it('the union of blocks is open, so a new kind doesn’t break the lexicon', () => {
    assert.notEqual(lexicon.defs.block.properties.block.closed, true);
  });
});
