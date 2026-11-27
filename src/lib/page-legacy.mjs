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

/**
 * The Now page's record: its heading and what a now page is, which were in the page's code. The
 * list stays in the id.skiddle.now record, which the home page shows too.
 * @param {PageMeta} meta
 * @param {string} updatedAt
 */
export function nowPageFromLegacy(meta, updatedAt) {
  return pageRecord(
    meta,
    [
      blockRecord('nowFull', {
        heading: 'Now',
        text: "What I'm focused on these days. A [now page](https://nownownow.com/about) answers \"what are you up to?\" for anyone who hasn't caught up with me in a while.",
      }),
    ],
    updatedAt,
  );
}

/**
 * The Uses page's record, from its id.skiddle.uses record: its sections, with the heading, the lead
 * and the closing line that were in the page's code. It keeps the record's updatedAt, which the page
 * shows as when it was last updated.
 * @param {{ uses: import('../types/uses').UsesSection[], updatedAt: string }} uses
 * @param {PageMeta} meta
 */
export function usesPageFromLegacy({ uses, updatedAt }, meta) {
  return pageRecord(
    meta,
    [
      blockRecord('uses', {
        heading: 'Uses',
        text: 'The hardware, software and tools I use every day, from the dev box to the flight bag. Inspired by [uses.tech](https://uses.tech).',
        sections: uses.map((s) => defined({ ...s, groups: s.groups.map((g) => ({ title: g.title, items: g.items.map((i) => defined({ ...i })) })) })),
        outro: 'Want to know more about any of this? Ask me on [Bluesky](https://bsky.app/profile/skiddle.blue), or read [my homelab posts](/topics/tag/homelab/).',
      }),
    ],
    updatedAt,
    'wide',
  );
}

/**
 * The CV's record, from its id.skiddle.cv record: its head with the highlights under it, the jobs,
 * the skills, the projects, education and certifications, and the box at the end, with the headings
 * and the text that were in the page's code. A role that is still the role leaves out its end, and
 * the head counts the years from the first role's start (since).
 * @param {import('../types/works').WorksData} works
 * @param {import('../types/highlights').Highlight[]} highlights
 * @param {PageMeta} meta
 * @param {string} updatedAt
 */
export function cvPageFromLegacy(works, highlights, meta, updatedAt) {
  const { header } = works;
  const starts = works.experience.flatMap((e) => e.positions.map((p) => Number(p.start))).filter(Number.isFinite);
  return pageRecord(
    meta,
    [
      blockRecord(
        'cvHeader',
        defined({
          name: header.name,
          title: header.title,
          location: header.location || undefined,
          email: header.email || undefined,
          github: header.links.github,
          bluesky: header.links.bluesky,
          summary: works.summary,
          since: starts.length ? Math.min(...starts) : undefined,
          status: 'open to consulting · [services](/services/)',
          highlights: highlights.map(({ value, label }) => ({ value, label })),
        }),
      ),
      blockRecord('jobs', {
        title: 'Experience',
        jobs: works.experience.map((c) =>
          defined({ company: c.company, description: c.description, positions: c.positions.map((p) => defined({ ...p, end: p.end === 'Present' ? undefined : p.end })) }),
        ),
      }),
      blockRecord('skills', { title: 'Skills', groups: works.skills }),
      blockRecord('projectGrid', {
        title: 'Selected projects',
        projects: works.selectedProjects.map(projectUri),
        others: works.projects.map((p) => defined({ title: p.title, description: p.description, status: p.status, live: p.live, source: p.github })),
      }),
      blockRecord('education', {
        title: 'Education',
        schools: works.education.map((e) => defined({ ...e })),
        certificationsTitle: 'Certifications',
        certifications: works.certifications.map((c) => ({ title: c.title, when: c.yearOrStatus })),
      }),
      blockRecord('cvContact', {
        title: 'Want to work together?',
        text: 'Roles, consulting or a quick question: email is the fastest way to reach me.',
        links: [
          { label: 'work@skiddle.id', href: 'mailto:work@skiddle.id?subject=Hello%20from%20your%20CV', primary: true },
          { label: 'See services', href: '/services/' },
        ].map(linkRecord),
      }),
    ],
    updatedAt,
    'wide',
  );
}

/** What the Services page's emails start with, so people know what to say */
const SERVICES_BRIEF = ['Hi Jeff,', '', 'What I need help with:', '', 'Goal / what "done" looks like:', '', 'Timeline:', '', 'Current setup and constraints:', ''].join('\n');

/**
 * An email to Jeff's work address with a subject, and SERVICES_BRIEF as its start
 * @param {string} subject
 */
const briefMail = (subject) => `mailto:work@skiddle.id?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(SERVICES_BRIEF)}`;

/**
 * The Services page's record: what was in the page's code, and the CV's highlights as its track
 * record. The services and testimonials stay in the id.skiddle.services record, which the home page
 * reads too.
 * @param {import('../types/highlights').Highlight[]} highlights The id.skiddle.cv record's
 * @param {PageMeta} meta
 * @param {string} updatedAt
 */
export function servicesPageFromLegacy(highlights, meta, updatedAt) {
  const email = { label: 'Email work@skiddle.id', href: briefMail('Service inquiry from skiddle.id'), primary: true };
  return pageRecord(
    meta,
    [
      blockRecord('servicesIntro', {
        heading: 'Services',
        tagline: "Infrastructure that's secure, automated and boring in the best way, so you can get back to your product.",
        lines: [
          "I help small teams and individuals with servers, pipelines, monitoring and self-hosting. If you don't see exactly what you need, ask anyway and we'll figure it out.",
          'Client work runs through **Skiddle Labs Pte. Ltd.**, my own company.',
        ],
        status: 'Open to consulting · based in Bangkok (UTC+7)',
        links: [email, { label: 'See what I do', href: '#services' }, { label: 'View my CV', href: '/works/' }].map(linkRecord),
      }),
      blockRecord('highlights', { label: 'Track record', highlights: highlights.map((h) => defined({ ...h })) }),
      blockRecord('services', { title: 'What I can help with', email: 'work@skiddle.id', brief: SERVICES_BRIEF }),
      blockRecord('steps', {
        title: 'How it works',
        steps: [
          { title: 'Tell me about it', body: 'Email what you need, your goal, timeline and constraints. The template below helps.' },
          { title: 'Get a plan', body: 'I reply with next steps and a lightweight plan, so you know what you’re getting before we start.' },
          { title: 'Build it', body: 'I set it up, keep you posted, and stick to what we agreed.' },
          { title: 'Hand over', body: 'You get notes on what was set up and how to run it, so you’re not dependent on me.' },
        ],
      }),
      blockRecord('reviews', { title: 'What people say' }),
      blockRecord('brief', {
        title: 'Tell me about your project',
        text: "A few lines is plenty. The email button opens with a short template so you don't have to think about what to include:",
        points: ['what you need help with', 'what "done" looks like', 'your timeline', 'your current setup and any constraints'],
        links: [email, { label: 'Or say hi on Bluesky', href: 'https://bsky.app/profile/skiddle.blue' }].map(linkRecord),
      }),
    ],
    updatedAt,
    'wide',
  );
}

/**
 * The Notes page's record: its heading and lead, which were in the page's code, over the notes,
 * which stay where the timeline reads them too (Jeff's posts tagged #note, and id.skiddle.notes).
 * @param {PageMeta} meta
 * @param {string} updatedAt
 */
export function notesPageFromLegacy(meta, updatedAt) {
  return pageRecord(
    meta,
    [blockRecord('blueskyPosts', { heading: 'Notes', text: 'Short posts from [my Bluesky](https://bsky.app/profile/skiddle.blue), the ones I tag #note.' })],
    updatedAt,
  );
}
