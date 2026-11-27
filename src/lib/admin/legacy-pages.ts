/**
 * The site's own pages made of blocks (SITE_PAGES), as the admin app moves them over
 * (docs/v4/themes.md, "Moving over"): what each is called, its old editor, and its id.skiddle.page
 * record made from its old record and the text that was in its code (src/lib/page-legacy.mjs),
 * which the page shows until it has a page record. The block editor opens it when a page has
 * neither a record nor a draft, and each old editor's Move to blocks saves it as the draft.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { CONTENT_PAGES } from '~/data/list-pages';
import { FALLBACK_HOME } from '~/data/home';
import type { SITE_PAGES } from '~/lib/page-blocks.mjs';
import { aboutPageFromLegacy, cvPageFromLegacy, homePageFromLegacy, notesPageFromLegacy, nowPageFromLegacy, servicesPageFromLegacy, usesPageFromLegacy } from '~/lib/page-legacy.mjs';
import { ABOUT_COLLECTION, CV_COLLECTION, HOME_COLLECTION, USES_COLLECTION, aboutFromRecord, cvFromRecord, homeOf, usesFromRecord } from '~/lib/page-records.mjs';
import { getRecord } from './xrpc';

type Value = Record<string, unknown>;
export type SitePage = (typeof SITE_PAGES)[number];

interface LegacyPage {
  /** The page's name in the admin app */
  title: string;
  /** Its old editor (src/lib/admin/page-editor.ts) */
  editor: string;
  /** What the page shows until it has a page record */
  shows: string;
  /** The old record its page record is made from, if any (key `self`) */
  source?: string;
  /** Whether it can't be made without that record */
  needsSource?: boolean;
  /** Its page record, from that record */
  convert: (source: Value | undefined, at: string) => Value;
}

export const LEGACY_PAGES: Record<SitePage, LegacyPage> = {
  home: { title: 'Home', editor: 'page/home', shows: 'its Home record', source: HOME_COLLECTION, convert: (v, at) => homePageFromLegacy(homeOf(v, FALLBACK_HOME), at) },
  about: {
    title: 'About',
    editor: 'page/about',
    shows: 'its About record',
    source: ABOUT_COLLECTION,
    needsSource: true,
    convert: (v, at) => aboutPageFromLegacy(aboutFromRecord(v ?? {}), CONTENT_PAGES.about, at),
  },
  now: { title: 'Now', editor: 'page/now', shows: 'its heading over the Now list', convert: (_, at) => nowPageFromLegacy(CONTENT_PAGES.now, at) },
  uses: {
    title: 'Uses',
    editor: 'page/uses',
    shows: 'its Uses record',
    source: USES_COLLECTION,
    needsSource: true,
    convert: (v) => usesPageFromLegacy(usesFromRecord(v ?? {}), CONTENT_PAGES.uses),
  },
  works: {
    title: 'The CV',
    editor: 'page/cv',
    shows: 'its CV record',
    source: CV_COLLECTION,
    needsSource: true,
    convert: (v, at) => {
      const { works, highlights } = cvFromRecord(v ?? {});
      return cvPageFromLegacy(works, highlights, CONTENT_PAGES.works, at);
    },
  },
  services: {
    title: 'Services',
    editor: 'page/services',
    shows: 'its text, the CV’s highlights and the Services record',
    source: CV_COLLECTION,
    needsSource: true,
    convert: (v, at) => servicesPageFromLegacy(cvFromRecord(v ?? {}).highlights, CONTENT_PAGES.services, at),
  },
  notes: { title: 'Notes', editor: 'page/notes', shows: 'its heading over the notes', convert: (_, at) => notesPageFromLegacy(CONTENT_PAGES.notes, at) },
};

export const isSitePage = (key: string): key is SitePage => Object.hasOwn(LEGACY_PAGES, key);

/** The site page an old editor moves to blocks, if it's one */
export const sitePageOfEditor = (route: string) => (Object.keys(LEGACY_PAGES) as SitePage[]).find((key) => LEGACY_PAGES[key].editor === route);

/**
 * A site page's record as it shows today, from its old record
 * @param saved The old record as the open editor saved it, when it's the one the page is made from
 */
export async function legacyPage(session: OAuthSession, key: SitePage, saved?: Value): Promise<Value> {
  const page = LEGACY_PAGES[key];
  const source = page.source ? (saved ?? (await getRecord<Value>(session, page.source, 'self'))?.value) : undefined;
  if (page.needsSource && !source) throw new Error(`there’s no ${page.source} record to make it from`);
  return page.convert(source, new Date().toISOString());
}
