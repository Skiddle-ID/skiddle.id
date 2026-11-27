// Pages made of blocks (src/lib/page-blocks.mjs): an id.skiddle.page record read leniently, the
// rows its blocks flow into, and the home page's old record turned into a page record that the
// lexicon accepts. Every kind of block in the lexicon has a reader and a component.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { BLOCKS, PAGE_COLLECTION, blockType, draftKey, isPageKey, linkAttributes, linkIcon, pageFromRecord, readsOf, rowsOf } from '../src/lib/page-blocks.mjs';
import { homePageFromLegacy } from '../src/lib/page-legacy.mjs';
import { homeFromRecord, projectUri } from '../src/lib/page-records.mjs';
import { introHtml, lineHtml, mutedLineHtml, proseHtml } from '../src/lib/now-html.ts';

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

  it('shows a Markdown link it wouldn’t follow as its text', () => {
    const html = introHtml('[run](javascript:alert(1)) [now](/now/) [hire](#hire)');
    assert.doesNotMatch(html, /javascript:/);
    assert.match(html, /run <a href="\/now\/" class="link">now<\/a> <a href="#hire" class="link">hire<\/a>/);
  });

  it('Markdown: a link off the site opens in a new tab; in .prose, links take the prose’s style', () => {
    assert.equal(lineHtml('A [now page](https://nownownow.com/about), [mine](/now/)'), 'A <a href="https://nownownow.com/about" class="link" target="_blank" rel="noopener">now page</a>, <a href="/now/" class="link">mine</a>');
    assert.equal(proseHtml('My [CV](/works/) and <b>this</b>'), '<p>My <a href="/works/">CV</a> and &lt;b&gt;this&lt;/b&gt;</p>\n');
    assert.equal(mutedLineHtml('Runs through **Skiddle Labs**.'), 'Runs through <span class="text-[var(--color-text)]">Skiddle Labs</span>.');
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
      { label: 'tab', href: '/\t/evil.example' },
      { label: 'plain web', href: 'http://example.com' },
      { label: 'bare mail', href: 'mailto:' },
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
      { title: 'T', description: 'D', width: 'wide', hideHeading: true, card: cid, blocks: [], updatedAt: at },
    );
    assert.deepEqual(pageFromRecord({ blocks: [], width: 'huge', hideHeading: 'yes', updatedAt: 'yesterday' }), { title: '', description: '', width: 'narrow', hideHeading: false, blocks: [], updatedAt: '' });
  });

  it('what a page reads, each once, leaving out unknown blocks', () => {
    const p = pageFromRecord(page(block('profile', { greeting: 'Hi' }), block('recentPosts'), block('recentPosts', { hideSeries: true }), { block: { $type: 'x' } }, block('markdown', { text: 'x' })));
    assert.deepEqual(readsOf(p), ['status', 'posts']);
  });
});

describe('the About page’s blocks, read', () => {
  const read = (kind, options) => pageFromRecord(page(block(kind, options))).blocks[0]?.block;

  it('facts: only the ones with a label and a value; none, no block', () => {
    const facts = [{ label: 'OS', value: 'macOS' }, { label: 'Shell' }, { value: 'x' }, 'Editor: Zed'];
    assert.deepEqual(read('facts', { heading: 'About me', facts }), { kind: 'facts', heading: 'About me', facts: [{ label: 'OS', value: 'macOS' }] });
    assert.equal(read('facts', { facts: [{ label: 'Shell' }] }), undefined);
  });

  it('a section’s heading id: its own if it’s one, else made from its title; none without a title', () => {
    const anchors = [{ title: 'Outside of work', anchor: 'outside' }, { title: 'Outside of work' }, { title: '2 Things', anchor: 'a b"' }, {}].map(
      (o) => pageFromRecord(page(block('section', { text: 'x', ...o }))).blocks[0].anchor,
    );
    assert.deepEqual(anchors, ['outside', 'outside-of-work', 's-2-things', undefined]);
    assert.equal(read('section', { title: 'Empty', text: ' ' }), undefined);
  });

  it('a block’s own id is unique on the page too', () => {
    const p = pageFromRecord(page(block('section', { title: 'A', anchor: 'how', text: 'x' }), block('principles', { title: 'How', principles: [{ title: 't', body: 'b' }] })));
    assert.deepEqual(p.blocks.map((b) => b.anchor), ['how', 'how-2']);
  });

  it('principles: only the ones with a title and a body, under a title', () => {
    assert.deepEqual(read('principles', { title: 'How I work', principles: [{ title: 'A', body: 'B' }, { title: 'C' }] }).principles, [{ title: 'A', body: 'B' }]);
    assert.equal(read('principles', { principles: [{ title: 'A', body: 'B' }] }), undefined);
  });

  it('so far: a milestone’s link only if the site would follow it, and its text only with a link', () => {
    const milestones = [
      { year: '2020', text: 'a', href: '/posts/a/', link: 'read it' },
      { year: '2021', text: 'b', href: 'javascript:alert(1)', link: 'run' },
      { year: '2022', text: 'c', link: 'no link' },
      { year: '2023' },
    ];
    assert.deepEqual(read('soFar', { title: 'So far', milestones, current: 'now' }), {
      kind: 'soFar',
      title: 'So far',
      milestones: [{ year: '2020', text: 'a', href: '/posts/a/', link: 'read it' }, { year: '2021', text: 'b' }, { year: '2022', text: 'c' }],
      current: 'now',
    });
  });

  it('contact: its links, each with the icon of where it goes', () => {
    const links = [{ label: 'Email', href: 'mailto:a@b.c', primary: true }, { label: 'Bluesky', href: 'https://bsky.app/profile/x', me: true }, { label: 'GitHub', href: 'https://github.com/x', me: true }, { label: 'RSS', href: '/rss.xml' }];
    const contact = read('contact', { title: 'Say hi', links });
    assert.deepEqual(contact.links.map((l) => linkIcon(l.href)), ['mail', 'bluesky', 'github', undefined]);
    assert.deepEqual(contact.links.map((l) => [l.me, l.primary]), [[false, true], [true, false], [true, false], [false, false]]);
  });
});

describe('the Now page’s block, read', () => {
  it('needs its heading, and reads the Now record', () => {
    const p = pageFromRecord(page(block('nowFull', { heading: 'Now', text: 'A lead' }), block('nowFull', { text: 'no heading' })));
    assert.deepEqual(p.blocks.map((b) => b.block), [{ kind: 'nowFull', heading: 'Now', text: 'A lead' }]);
    assert.deepEqual(readsOf(p), ['now']);
  });
});

describe('the Uses page’s block, read', () => {
  const item = (name, more = {}) => ({ name, ...more });
  const sections = [
    { id: 'dev', title: 'Dev', blurb: 'b', groups: [{ title: 'Editors', items: [item('Zed', { href: 'https://zed.dev', note: 'n' }), item('vi', { href: 'javascript:x' }), { note: 'no name' }] }, { title: 'Empty', items: [] }] },
    { id: '1bad', title: 'Bad id', groups: [{ title: 'G', items: [item('x')] }] },
    { id: 'none', title: 'No groups', groups: [] },
  ];

  it('keeps sections with an id and a group of things, and a thing’s link only if it’s safe', () => {
    const b = pageFromRecord(page(block('uses', { heading: 'Uses', sections, outro: 'o' }))).blocks[0].block;
    assert.deepEqual(b, {
      kind: 'uses',
      heading: 'Uses',
      text: '',
      outro: 'o',
      sections: [{ id: 'dev', title: 'Dev', blurb: 'b', groups: [{ title: 'Editors', items: [item('Zed', { note: 'n', href: 'https://zed.dev' }), item('vi')] }] }],
    });
  });

  it('none of them, or no heading, no block', () => {
    assert.equal(pageFromRecord(page(block('uses', { heading: 'Uses', sections: sections.slice(1) }))).blocks.length, 0);
    assert.equal(pageFromRecord(page(block('uses', { sections }))).blocks.length, 0);
  });
});

describe('the CV’s blocks, read', () => {
  const read = (kind, options) => pageFromRecord(page(block(kind, options))).blocks[0]?.block;

  it('the header: an email and profiles only if they’re ones, and a start year from 1900 to 2100', () => {
    const header = (o) => read('cvHeader', { name: 'Jeff', title: 'Engineer', ...o });
    const b = header({ email: 'a@b.c', github: 'https://github.com/x', bluesky: 'javascript:x', since: 2016, highlights: [{ value: '10', label: 'years', href: '/posts/x/' }, { value: 'x' }] });
    assert.deepEqual([b.email, b.github, b.bluesky, b.since], ['a@b.c', 'https://github.com/x', '', 2016]);
    assert.deepEqual(b.highlights, [{ value: '10', label: 'years', href: '/posts/x/' }]);
    assert.deepEqual([header({ email: 'not an email' }).email, header({ github: 'http://github.com/x' }).github], ['', '']);
    assert.deepEqual([1899, 2016.5, '2016'].map((since) => header({ since }).since), [undefined, undefined, undefined]);
    assert.equal(read('cvHeader', { name: 'Jeff' }), undefined);
  });

  it('jobs: a role needs a title and a start; a company needs a role', () => {
    const jobs = [
      { company: 'A', description: 'd', positions: [{ role: 'R', start: '2020', employment: 'Contract', highlights: ['h', ''] }, { role: 'no start' }] },
      { company: 'B', positions: [{ start: '2019' }] },
    ];
    assert.deepEqual(read('jobs', { title: 'Experience', jobs }).jobs, [{ company: 'A', description: 'd', positions: [{ role: 'R', start: '2020', employment: 'Contract', highlights: ['h'] }] }]);
  });

  it('skills: groups with a title and skills', () => {
    assert.deepEqual(read('skills', { title: 'Skills', groups: [{ title: 'Langs', items: ['Go', 3] }, { title: 'None', items: [] }] }).groups, [{ title: 'Langs', items: ['Go'] }]);
  });

  it('the project grid: this repo’s projects by key, and other projects with links only to https:// addresses', () => {
    const b = read('projectGrid', {
      title: 'Selected projects',
      projects: [projectUri('a'), 'at://did:plc:other/id.skiddle.project/b'],
      others: [{ title: 'O', description: 'd', status: 'Ongoing', live: 'https://o.example', source: 'ftp://x' }, { title: 'no description' }],
    });
    assert.deepEqual([b.projects, b.others], [['a'], [{ title: 'O', description: 'd', status: 'Ongoing', live: 'https://o.example' }]]);
    assert.deepEqual(readsOf(pageFromRecord(page(block('projectGrid', { title: 'P', projects: [] })))), ['projects']);
  });

  it('education: schools with a degree and a school; certifications with when', () => {
    const b = read('education', { title: 'Education', schools: [{ degree: 'MSc', school: 'C', end: 'Present' }, { degree: 'x' }], certificationsTitle: 'Certs', certifications: [{ title: 'PPL', when: '2026' }, { title: 'no when' }] });
    assert.deepEqual([b.schools, b.certifications], [[{ degree: 'MSc', school: 'C', end: 'Present' }], [{ title: 'PPL', when: '2026' }]]);
    assert.equal(read('education', { title: 'Education', schools: [] }), undefined);
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
