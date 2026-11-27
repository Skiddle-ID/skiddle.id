/**
 * Pages made of blocks (docs/v4/themes.md, lexicons/id/skiddle/page.json): an id.skiddle.page
 * record read into the shape the page renders. The pages' old records turned into page records are
 * in src/lib/page-legacy.mjs.
 *
 * BLOCKS is the one table of the kinds of block: how each is read from a record, what each reads
 * from the site's data (src/lib/page-data.ts loads that once per request, however many blocks use
 * it) and the id its heading gets. Each kind has a component of the same name in
 * src/components/blocks/ (BLOCK_COMPONENTS in blocks.astro), and a def in the lexicon.
 *
 * Reading is lenient: a block of a kind the site doesn't know is kept as `unknown` (the page leaves
 * it out; the admin app keeps it as it is), a width the site doesn't know is full, and a known block
 * without what it needs (a profile without its greeting) is left out. Plain JavaScript, so the
 * tests run it in Node (scripts/page-blocks.test.mjs).
 */
import { projectUri } from './page-records.mjs';
import { isPageHref } from './site-meta.mjs';

export const PAGE_COLLECTION = 'id.skiddle.page';

/** The record key of a page's draft: `home~draft` */
export const draftKey = (/** @type {string} */ key) => `${key}~draft`;

/** The keys of the site's own pages made of blocks, each with a route in src/pages/: `about` is /about/ */
export const SITE_PAGES = /** @type {const} */ (['home', 'about', 'now', 'uses']);

/** A page's own key, not a draft's: lists of pages leave out keys with a `~` */
export const isPageKey = (/** @type {string} */ key) => !key.includes('~');

/** The $type of a kind of block in a record: `id.skiddle.page#markdown` */
export const blockType = (/** @type {string} */ kind) => `${PAGE_COLLECTION}#${kind}`;

/**
 * @typedef {'status' | 'now' | 'projects' | 'posts' | 'services' | 'week'} Source What a block reads
 * from the site's data (src/lib/page-data.ts)
 * @typedef {'full' | 'half' | 'third'} BlockWidth
 * @typedef {{ label: string, href: string, me: boolean, primary: boolean }} Link
 *
 * @typedef {{ kind: 'profile', greeting: string, tagline: string, hideStatus: boolean }} ProfileBlock
 * @typedef {{ kind: 'markdown', text: string }} MarkdownBlock
 * @typedef {{ kind: 'links', label: string, buttons: boolean, links: Link[] }} LinksBlock
 * @typedef {{ kind: 'now' }} NowBlock
 * @typedef {{ kind: 'thisWeek' }} ThisWeekBlock
 * @typedef {{ kind: 'projects', projects: string[] }} ProjectsBlock The projects' record keys, in order
 * @typedef {{ kind: 'recentPosts', limit: number, hideSeries: boolean }} RecentPostsBlock
 * @typedef {{ kind: 'testimonials' }} TestimonialsBlock
 * @typedef {{ kind: 'callToAction', title: string, text: string, links: Link[] }} CallToActionBlock
 * @typedef {{ label: string, value: string }} Fact
 * @typedef {{ title: string, body: string }} Point
 * @typedef {{ year: string, text: string, href?: string, link?: string }} Milestone
 * @typedef {{ kind: 'facts', heading: string, facts: Fact[] }} FactsBlock
 * @typedef {{ kind: 'section', title: string, text: string, anchor?: string }} SectionBlock
 * @typedef {{ kind: 'principles', title: string, principles: Point[] }} PrinciplesBlock
 * @typedef {{ kind: 'soFar', title: string, milestones: Milestone[], current: string }} SoFarBlock
 * @typedef {{ kind: 'contact', title: string, text: string, links: Link[] }} ContactBlock
 * @typedef {{ kind: 'nowFull', heading: string, text: string }} NowFullBlock
 * @typedef {{ name: string, note?: string, href?: string }} UsesItem
 * @typedef {{ id: string, title: string, blurb?: string, groups: { title: string, items: UsesItem[] }[] }} UsesSection
 * @typedef {{ kind: 'uses', heading: string, text: string, sections: UsesSection[], outro: string }} UsesBlock
 * @typedef {ProfileBlock | MarkdownBlock | LinksBlock | NowBlock | ThisWeekBlock | ProjectsBlock | RecentPostsBlock | TestimonialsBlock | CallToActionBlock
 *   | FactsBlock | SectionBlock | PrinciplesBlock | SoFarBlock | ContactBlock | NowFullBlock | UsesBlock} KnownBlock
 * @typedef {KnownBlock['kind']} BlockKind
 * @typedef {{ kind: 'unknown', type: string }} UnknownBlock A kind of block this site doesn't know
 *
 * @typedef {object} PlacedBlock
 * @property {BlockWidth} width
 * @property {KnownBlock | UnknownBlock} block
 * @property {string} [anchor] The id of the block's heading (or of the block), unique on the page
 * @typedef {PlacedBlock & { block: KnownBlock }} KnownPlacedBlock
 *
 * @typedef {object} Page
 * @property {string} title
 * @property {string} description
 * @property {'narrow' | 'wide'} width
 * @property {boolean} hideHeading
 * @property {string} [card] The share card's CID
 * @property {PlacedBlock[]} blocks
 * @property {string} updatedAt When the page was last saved, as the record says ('' if it doesn't)
 */

/** @typedef {Record<string, any>} Raw */

const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v : undefined);
const objects = (/** @type {unknown} */ v) => /** @type {Raw[]} */ (Array.isArray(v) ? v.filter((o) => o && typeof o === 'object' && !Array.isArray(o)) : []);

/** A link's address, if it's one the site would follow (isPageHref) */
const hrefOf = (/** @type {unknown} */ v) => (typeof v === 'string' && isPageHref(v) ? v : undefined);
/** An id for an element: a letter, then letters, digits, - or _ */
const isId = (/** @type {unknown} */ v) => typeof v === 'string' && /^[A-Za-z][\w-]{0,63}$/.test(v);
/** An id made from a heading: "Outside of work" is outside-of-work */
const slugOf = (/** @type {string} */ s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(?=[0-9])/, 's-').slice(0, 64);
/** The items of a list of { title, body } that have both */
const pointsOf = (/** @type {unknown} */ v) =>
  objects(v).flatMap((p) => {
    const [title, body] = [str(p.title), str(p.body)];
    return title && body ? [{ title, body }] : [];
  });

/** @returns {Link[]} */
const linksOf = (/** @type {unknown} */ v) =>
  objects(v)
    .map((l) => ({ label: str(l.label) ?? '', href: str(l.href) ?? '', me: l.me === true, primary: l.primary === true }))
    .filter((l) => l.label && isPageHref(l.href));

/**
 * How a link opens: one off the site in a new tab, and rel="me" on Jeff's own profiles
 * @param {Link} l
 * @returns {{ target?: '_blank', rel?: string }}
 */
export function linkAttributes(l) {
  if (/^https?:/i.test(l.href)) return { target: '_blank', rel: l.me ? 'me noopener' : 'noopener' };
  return l.me ? { rel: 'me' } : {};
}

/**
 * The icon a button gets for where it goes: email, Bluesky or GitHub, or none
 * @param {string} href
 * @returns {'mail' | 'bluesky' | 'github' | undefined}
 */
export function linkIcon(href) {
  if (/^mailto:/i.test(href)) return 'mail';
  const host = /^https:\/\/([^/?#]+)/i.exec(href)?.[1].toLowerCase();
  return host === 'bsky.app' ? 'bluesky' : host === 'github.com' ? 'github' : undefined;
}

const PROJECT_PREFIX = projectUri('');

/**
 * @template {BlockKind} K
 * @typedef {object} BlockSpec
 * @property {Source[]} reads What it reads from the site's data
 * @property {string} [anchor] The id its heading gets, unless the block sets its own; a second
 *   block with the same id gets `<anchor>-2`
 * @property {(v: Raw) => Extract<KnownBlock, { kind: K }> | null} parse A record's block, or null if it lacks what it needs
 */

/** @type {{ [K in BlockKind]: BlockSpec<K> }} */
export const BLOCKS = {
  profile: {
    reads: ['status'],
    anchor: 'intro',
    parse: (v) => {
      const greeting = str(v.greeting);
      return greeting ? { kind: 'profile', greeting, tagline: str(v.tagline) ?? '', hideStatus: v.hideStatus === true } : null;
    },
  },
  markdown: {
    reads: [],
    parse: (v) => {
      const text = str(v.text);
      return text ? { kind: 'markdown', text } : null;
    },
  },
  links: {
    reads: [],
    parse: (v) => {
      const links = linksOf(v.links);
      return links.length ? { kind: 'links', label: str(v.label) ?? '', buttons: v.buttons === true, links } : null;
    },
  },
  now: { reads: ['now'], anchor: 'now', parse: () => ({ kind: 'now' }) },
  thisWeek: { reads: ['week'], anchor: 'this-week', parse: () => ({ kind: 'thisWeek' }) },
  projects: {
    reads: ['projects'],
    anchor: 'work',
    parse: (v) => ({
      kind: 'projects',
      projects: (Array.isArray(v.projects) ? v.projects : [])
        .filter((uri) => typeof uri === 'string' && uri.startsWith(PROJECT_PREFIX) && uri.length > PROJECT_PREFIX.length)
        .map((uri) => uri.slice(PROJECT_PREFIX.length)),
    }),
  },
  recentPosts: {
    reads: ['posts'],
    anchor: 'writing',
    parse: (v) => ({
      kind: 'recentPosts',
      limit: Number.isInteger(v.limit) && v.limit >= 1 && v.limit <= 50 ? v.limit : 4,
      hideSeries: v.hideSeries === true,
    }),
  },
  testimonials: { reads: ['services'], parse: () => ({ kind: 'testimonials' }) },
  callToAction: {
    reads: [],
    anchor: 'hire',
    parse: (v) => {
      const title = str(v.title);
      return title ? { kind: 'callToAction', title, text: str(v.text) ?? '', links: linksOf(v.links) } : null;
    },
  },
  facts: {
    reads: [],
    parse: (v) => {
      const facts = objects(v.facts).flatMap((f) => {
        const [label, value] = [str(f.label), str(f.value)];
        return label && value ? [{ label, value }] : [];
      });
      return facts.length ? { kind: 'facts', heading: str(v.heading) ?? '', facts } : null;
    },
  },
  section: {
    reads: [],
    parse: (v) => {
      const [text, title] = [str(v.text), str(v.title) ?? ''];
      if (!text) return null;
      const anchor = isId(v.anchor) ? v.anchor : title && slugOf(title);
      return { kind: 'section', title, text, ...(anchor ? { anchor } : {}) };
    },
  },
  principles: {
    reads: [],
    anchor: 'how',
    parse: (v) => {
      const [title, principles] = [str(v.title), pointsOf(v.principles)];
      return title && principles.length ? { kind: 'principles', title, principles } : null;
    },
  },
  soFar: {
    reads: [],
    anchor: 'timeline',
    parse: (v) => {
      const title = str(v.title);
      const milestones = objects(v.milestones).flatMap((m) => {
        const [year, text, href, link] = [str(m.year), str(m.text), hrefOf(m.href), str(m.link)];
        return year && text ? [{ year, text, ...(href ? { href } : {}), ...(href && link ? { link } : {}) }] : [];
      });
      return title && milestones.length ? { kind: 'soFar', title, milestones, current: str(v.current) ?? '' } : null;
    },
  },
  contact: {
    reads: [],
    anchor: 'hi',
    parse: (v) => {
      const title = str(v.title);
      return title ? { kind: 'contact', title, text: str(v.text) ?? '', links: linksOf(v.links) } : null;
    },
  },
  nowFull: {
    reads: ['now'],
    parse: (v) => {
      const heading = str(v.heading);
      return heading ? { kind: 'nowFull', heading, text: str(v.text) ?? '' } : null;
    },
  },
  uses: {
    reads: [],
    parse: (v) => {
      const heading = str(v.heading);
      const sections = objects(v.sections).flatMap((s) => {
        const [id, title] = [isId(s.id) ? s.id : undefined, str(s.title)];
        const groups = objects(s.groups).flatMap((g) => {
          const items = objects(g.items).flatMap((i) => {
            const [name, note, href] = [str(i.name), str(i.note), hrefOf(i.href)];
            return name ? [{ name, ...(note ? { note } : {}), ...(href ? { href } : {}) }] : [];
          });
          const groupTitle = str(g.title);
          return groupTitle && items.length ? [{ title: groupTitle, items }] : [];
        });
        const blurb = str(s.blurb);
        return id && title && groups.length ? [{ id, title, ...(blurb ? { blurb } : {}), groups }] : [];
      });
      return heading && sections.length ? { kind: 'uses', heading, text: str(v.text) ?? '', sections, outro: str(v.outro) ?? '' } : null;
    },
  },
};

const WIDTHS = /** @type {const} */ (['full', 'half', 'third']);

/** A block's kind from its $type, if the site knows it */
function kindOf(/** @type {unknown} */ type) {
  if (typeof type !== 'string' || !type.startsWith(`${PAGE_COLLECTION}#`)) return undefined;
  const kind = type.slice(PAGE_COLLECTION.length + 1);
  return Object.hasOwn(BLOCKS, kind) ? /** @type {BlockKind} */ (kind) : undefined;
}

/**
 * One of the record's blocks, or null if it's a known kind without what it needs
 * @param {Raw} item An item of the record's `blocks` (#block)
 * @returns {PlacedBlock | null}
 */
function placedBlockOf(item) {
  const width = WIDTHS.find((w) => w === item.width) ?? 'full';
  const raw = item.block && typeof item.block === 'object' ? /** @type {Raw} */ (item.block) : {};
  const kind = kindOf(raw.$type);
  if (!kind) return { width, block: { kind: 'unknown', type: typeof raw.$type === 'string' ? raw.$type : '' } };
  const block = BLOCKS[kind].parse(raw);
  if (!block) console.warn(`page: a ${kind} block lacks what it needs, so it's left out`);
  return block ? { width, block } : null;
}

/** Each known block's anchor, unique on the page: the second of a kind gets `<anchor>-2` */
function withAnchors(/** @type {PlacedBlock[]} */ blocks) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  return blocks.map((b) => {
    const base = b.block.kind === 'unknown' ? undefined : ('anchor' in b.block && b.block.anchor) || BLOCKS[b.block.kind].anchor;
    if (!base) return b;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...b, anchor: n === 1 ? base : `${base}-${n}` };
  });
}

/**
 * A page from its id.skiddle.page record, or null if the record isn't one (no list of blocks)
 * @param {unknown} value The record
 * @returns {Page | null}
 */
export function pageFromRecord(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(/** @type {Raw} */ (value).blocks)) return null;
  const v = /** @type {Raw} */ (value);
  const cid = v.card?.ref?.$link;
  return {
    title: str(v.title) ?? '',
    description: str(v.description) ?? '',
    width: v.width === 'wide' ? 'wide' : 'narrow',
    hideHeading: v.hideHeading === true,
    ...(typeof cid === 'string' ? { card: cid } : {}),
    blocks: withAnchors(objects(v.blocks).flatMap((item) => placedBlockOf(item) ?? [])),
    updatedAt: typeof v.updatedAt === 'string' && !Number.isNaN(Date.parse(v.updatedAt)) ? v.updatedAt : '',
  };
}

/** How much of a row each width takes, in sixths */
const SPAN = { full: 6, half: 3, third: 2 };

/**
 * The page's known blocks in rows: a full block alone, the others side by side while they fit
 * @param {PlacedBlock[]} blocks
 * @returns {KnownPlacedBlock[][]}
 */
export function rowsOf(blocks) {
  /** @type {KnownPlacedBlock[][]} */
  const rows = [];
  let used = 6;
  for (const b of blocks) {
    if (b.block.kind === 'unknown') continue;
    if (used + SPAN[b.width] > 6) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(/** @type {KnownPlacedBlock} */ (b));
    used += SPAN[b.width];
  }
  return rows;
}

/**
 * What the page's blocks read from the site's data, each once
 * @param {Page} page
 * @returns {Source[]}
 */
export function readsOf(page) {
  return [...new Set(page.blocks.flatMap((b) => (b.block.kind === 'unknown' ? [] : BLOCKS[b.block.kind].reads)))];
}
