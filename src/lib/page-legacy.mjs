/**
 * Each page's id.skiddle.page record made from what it showed before it had one (docs/v4/themes.md,
 * "Moving over"): its old record, in the shape the page read it (src/lib/page-records.mjs), and the
 * text that was in the page's code, in the blocks it was laid out in. A page renders this until it
 * has a page record, so every deploy runs its blocks, and the admin app's Move to blocks saves it as
 * the page's draft. scripts/page-blocks.test.mjs and scripts/check-lexicons.mjs check that the
 * lexicon accepts each one.
 *
 * What another page also shows stays in its record, and the block reads it from there: the Now list
 * (the home page), the services and testimonials (the home page), the notes (the timeline).
 */
import { PAGE_COLLECTION, blockType } from './page-blocks.mjs';
import { projectUri } from './page-records.mjs';

/** @typedef {Record<string, any>} Raw */
/** @typedef {{ title: string, description: string }} PageMeta The page's title and description (CONTENT_PAGES in src/data/list-pages.ts) */

/**
 * A link in a record's shape: me and primary only when they're true
 * @param {{ label: string, href: string, me?: boolean, primary?: boolean }} l
 */
const linkRecord = (l) => ({ label: l.label, href: l.href, ...(l.me ? { me: true } : {}), ...(l.primary ? { primary: true } : {}) });

/**
 * A full-width block in a record's shape
 * @param {string} kind
 * @param {Raw} [options]
 */
const blockRecord = (kind, options = {}) => ({ block: { $type: blockType(kind), ...options } });

/** The record without its undefined fields */
const defined = (/** @type {Raw} */ o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/**
 * A page record with its heading hidden: each of these pages has a block whose heading is the page's
 * @param {PageMeta} meta
 * @param {Raw[]} blocks
 * @param {string} updatedAt
 * @param {'narrow' | 'wide'} [width]
 */
const pageRecord = (meta, blocks, updatedAt, width) => ({
  $type: PAGE_COLLECTION,
  title: meta.title,
  description: meta.description,
  ...(width === 'wide' ? { width } : {}),
  hideHeading: true,
  blocks,
  updatedAt,
});

/**
 * The home page's record: its own text (the id.skiddle.home record over src/data/home.ts: homeOf in
 * src/lib/page-records.mjs) in the blocks it was laid out in, with the links and buttons that were
 * in the page's code.
 * @param {import('../types/home').Home} home
 * @param {string} updatedAt
 */
export function homePageFromLegacy(home, updatedAt) {
  return {
    $type: PAGE_COLLECTION,
    title: home.title,
    description: home.description,
    hideHeading: true,
    blocks: [
      blockRecord('profile', { greeting: home.greeting, tagline: home.tagline }),
      blockRecord('markdown', { text: home.intro }),
      blockRecord('links', {
        label: 'Quick links',
        buttons: true,
        links: [
          { label: 'Selected work', href: '#work' },
          { label: 'Read the blog', href: '/posts/' },
          { label: 'Work with me →', href: '/services/', primary: true },
        ].map(linkRecord),
      }),
      blockRecord('now'),
      blockRecord('thisWeek'),
      blockRecord('projects', { projects: home.selectedProjects.map(projectUri) }),
      blockRecord('recentPosts'),
      blockRecord('testimonials'),
      blockRecord('callToAction', {
        title: home.hire.title,
        text: home.hire.blurb,
        links: [
          { label: 'Email work@skiddle.id', href: 'mailto:work@skiddle.id?subject=Hello%20from%20skiddle.id', primary: true },
          { label: 'See services', href: '/services/' },
          { label: 'View my CV', href: '/works/' },
        ].map(linkRecord),
      }),
      blockRecord('links', { label: 'Elsewhere', links: home.elsewhere.map(linkRecord) }),
    ],
    updatedAt,
  };
}

/**
 * The About page's record, from its id.skiddle.about record: every link but email is one of Jeff's
 * profiles (rel="me"), and the first link is the primary one
 * @param {import('../types/about').About} about
 * @param {PageMeta} meta
 * @param {string} updatedAt
 */
export function aboutPageFromLegacy(about, meta, updatedAt) {
  return pageRecord(
    meta,
    [
      blockRecord('facts', { heading: 'About me', facts: about.profile }),
      blockRecord('section', { text: about.intro }),
      blockRecord('principles', { title: 'How I work', principles: about.principles }),
      blockRecord('soFar', { title: 'So far', milestones: about.timeline.map((t) => defined({ year: t.year, text: t.text, href: t.href, link: t.link })), ...(about.current ? { current: about.current } : {}) }),
      ...(about.outside ? [blockRecord('section', { title: 'Outside of work', anchor: 'outside', text: about.outside })] : []),
      blockRecord('contact', {
        title: 'Say hi',
        ...(about.contact.blurb ? { text: about.contact.blurb } : {}),
        links: about.contact.links.map((l, i) => linkRecord({ label: l.label, href: l.url, me: !l.url.startsWith('mailto:'), primary: i === 0 })),
      }),
    ],
    updatedAt,
  );
}
