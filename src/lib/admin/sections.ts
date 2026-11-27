/**
 * The admin app's sections, one at a time under the section bar: Posts (drafts and published
 * posts), Series, Pages (the pages' content, src/lib/admin/pages.ts), Status, Timeline (the events,
 * src/lib/admin/timeline.ts) and Site (lexicons, share cards, records). Each has an address (#posts,
 * #series, #pages, #status, #timeline, #site), so a
 * reload or a home-screen shortcut opens the same one. The posts editor
 * (#draft/…, #post/…, src/lib/admin/editor.ts) and the series editor (#series/…, #new-series,
 * src/lib/admin/series.ts) replace the sections while they're open.
 */
import { el } from './dom';

export const SECTIONS = ['posts', 'series', 'pages', 'status', 'timeline', 'site'] as const;
export type Section = (typeof SECTIONS)[number];

/** The section an address asks for; Posts if it names none */
export function sectionFromHash(hash: string): Section {
  const name = hash.replace(/^#/, '');
  return (SECTIONS as readonly string[]).includes(name) ? (name as Section) : 'posts';
}

export function showSection(section: Section) {
  el('dashboard').dataset.section = section;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('#sectionNav a[data-section]')) {
    if (link.dataset.section === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
