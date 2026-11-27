/**
 * The admin app's sections, one at a time beside the sidebar: Overview (src/lib/admin/overview.ts),
 * then Content (Posts, Series, Pages, Timeline, Media) and Site (Status, Site and SEO, Lexicons and cards).
 * Each has an address (#overview, #posts, #series, #pages, #timeline, #media, #status, #site), so a reload
 * or a home-screen shortcut opens the same one; Site and SEO is the #page/site editor. The editors
 * (#draft/…, #post/…, #series/…, #page/…, #project/…, #event/…) take the sections' place while
 * they're open, and the sidebar marks the section they belong to.
 *
 * On a phone the sidebar is a bar along the bottom with Overview, Posts, Timeline and Status, and
 * More opens every section as a sheet. The bar hides while an editor is open, which has its own
 * back button.
 */
import { el } from './dom';

export const SECTIONS = ['overview', 'posts', 'series', 'pages', 'status', 'timeline', 'media', 'site'] as const;
export type Section = (typeof SECTIONS)[number];

/** The section an address asks for; Overview if it names none */
export function sectionFromHash(hash: string): Section {
  const name = hash.replace(/^#/, '');
  return (SECTIONS as readonly string[]).includes(name) ? (name as Section) : 'overview';
}

/** The sidebar item an address belongs to: its section, or the section of the editor it opens */
function navItemOf(hash: string): string {
  if (/^#(draft|post)\//.test(hash) || hash === '#page/categories') return 'posts';
  if (/^#(series\/|new-series$)/.test(hash)) return 'series';
  if (hash === '#page/site') return 'seo';
  if (/^#(page\/|project\/|new-project$)/.test(hash)) return 'pages';
  if (/^#(event\/|new-event$)/.test(hash)) return 'timeline';
  return sectionFromHash(hash);
}

/** Marks the sidebar item for an address, and closes the phone's More sheet */
export function markNav(hash: string) {
  const current = navItemOf(hash);
  for (const link of document.querySelectorAll<HTMLAnchorElement>('#sectionNav a[data-section]')) {
    if (link.dataset.section === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  closeMore();
}

export function showSection(section: Section) {
  el('dashboard').dataset.section = section;
  markNav(`#${section}`);
}

function closeMore() {
  const nav = el('sectionNav');
  delete nav.dataset.open;
  el('sideMore').setAttribute('aria-expanded', 'false');
  el('sideMore').textContent = 'More';
}

/** The phone's More button: opens and closes every section as a sheet */
export function setupSections() {
  el('sideMore').addEventListener('click', () => {
    const nav = el('sectionNav');
    if (nav.dataset.open !== undefined) return closeMore();
    nav.dataset.open = '';
    el('sideMore').setAttribute('aria-expanded', 'true');
    el('sideMore').textContent = 'Close';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMore();
  });
}
