/**
 * The site's own pages made of blocks (SITE_PAGES): what each is called in the admin app, and, for
 * those that can show without a page record, their built-in id.skiddle.page record
 * (src/lib/page-legacy.mjs) and what they show then. The block editor opens a site page with
 * neither a record nor a draft from its built-in record, or with no blocks.
 */
import { CONTENT_PAGES } from '~/data/list-pages';
import { FALLBACK_HOME } from '~/data/home';
import type { SITE_PAGES } from '~/lib/page-blocks.mjs';
import { homePageFromLegacy, notesPageFromLegacy, nowPageFromLegacy, servicesPageFromLegacy } from '~/lib/page-legacy.mjs';

type Value = Record<string, unknown>;
export type SitePage = (typeof SITE_PAGES)[number];

interface SitePageDef {
  /** The page's name in the admin app */
  title: string;
  /** Without a page record: what the page shows, and its built-in record */
  builtIn?: { shows: string; page: (at: string) => Value };
}

export const SITE_PAGE_DEFS: Record<SitePage, SitePageDef> = {
  home: { title: 'Home', builtIn: { shows: 'its built-in text', page: (at) => homePageFromLegacy(FALLBACK_HOME, at) } },
  about: { title: 'About' },
  now: { title: 'Now', builtIn: { shows: 'its heading over the Now list', page: (at) => nowPageFromLegacy(CONTENT_PAGES.now, at) } },
  uses: { title: 'Uses' },
  works: { title: 'The CV' },
  services: { title: 'Services', builtIn: { shows: 'its built-in text over the services and testimonials', page: (at) => servicesPageFromLegacy(CONTENT_PAGES.services, at) } },
  notes: { title: 'Notes', builtIn: { shows: 'its heading over the notes', page: (at) => notesPageFromLegacy(CONTENT_PAGES.notes, at) } },
};

export const isSitePage = (key: string): key is SitePage => Object.hasOwn(SITE_PAGE_DEFS, key);
