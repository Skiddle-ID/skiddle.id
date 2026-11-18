/**
 * The pages' content (docs/v4/pages-on-atproto.md), read when a page is requested: projects, the CV
 * and its highlights, services, uses and About, from their records in Jeff's AT Protocol repo
 * (src/lib/pds.ts caches them for a minute). They come back in the same shapes as the data files
 * (src/lib/page-records.mjs), so the pages' templates don't change.
 *
 * Until the switch, each falls back to its data file in src/data/ when there's no record yet (the
 * import hasn't run), the record is malformed, or the PDS can't be reached. At the switch the data
 * files leave git: then a cached page still shows while the PDS is down (PAGES_CACHE).
 *
 * Pages that use this are rendered on request, tag their cache with PAGES_TAG so /api/revalidate
 * can purge them after a save, and say where their content came from in X-Content-Source.
 */
import fallbackAbout, { type About } from '~/data/about';
import fallbackHighlights, { type Highlight } from '~/data/highlights';
import fallbackProjects from '~/data/projects';
import fallbackServices from '~/data/services';
import fallbackUses, { usesUpdated as fallbackUsesUpdated, type UsesSection } from '~/data/uses';
import fallbackWorks from '~/data/works';
import {
  ABOUT_COLLECTION,
  CV_COLLECTION,
  PROJECT_COLLECTION,
  SERVICES_COLLECTION,
  USES_COLLECTION,
  aboutFromRecord,
  cvFromRecord,
  projectsFromRecords,
  servicesFromRecord,
  usesFromRecord,
} from '~/lib/page-records.mjs';
import { getRecord, listRecords } from '~/lib/pds';
import type { Project } from '~/types/projects';
import type { ServicesData } from '~/types/services';
import type { WorksData } from '~/types/works';

/** Cache tag on every page built from the pages' records, purged when the repo changes */
export const PAGES_TAG = 'pages';

/** Route cache for those pages: fresh for a minute, then stale for up to a day while a new copy renders */
export const PAGES_CACHE = { maxAge: 60, swr: 86400, tags: [PAGES_TAG] };

/** The cached records' keys in src/lib/pds.ts, which /api/revalidate forgets */
export const PAGE_RECORD_KEYS = [
  `list/${PROJECT_COLLECTION}`,
  ...[CV_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, ABOUT_COLLECTION].map((c) => `record/${c}/self`),
];

/** Where a page's content came from: Jeff's repo, or the data files in git */
export type Source = 'pds' | 'git';

/** `read()`'s result, or `fallback` if it has none or fails */
async function withFallback<T>(what: string, read: () => Promise<T | null>, fallback: T): Promise<T & { source: Source }> {
  try {
    const value = await read();
    if (value) return { ...value, source: 'pds' };
  } catch (err) {
    console.error(`${what} from the PDS:`, err);
  }
  return { ...fallback, source: 'git' };
}

const record = (collection: string) => getRecord<Record<string, unknown>>(collection, 'self');

/** Every project, in the order they were added; the pages sort them */
export const getProjects = () =>
  withFallback(
    'projects',
    async () => {
      const records = await listRecords<Record<string, unknown>>(PROJECT_COLLECTION);
      return records.length ? { projects: projectsFromRecords(records) as Project[] } : null;
    },
    { projects: fallbackProjects },
  );

/** The CV, and the highlights it shares with /services/ */
export const getCv = () =>
  withFallback(
    'the CV',
    async () => {
      const value = await record(CV_COLLECTION);
      return value ? (cvFromRecord(value) as { works: WorksData; highlights: Highlight[] }) : null;
    },
    { works: fallbackWorks, highlights: fallbackHighlights },
  );

export const getServices = () =>
  withFallback(
    'services',
    async () => {
      const value = await record(SERVICES_COLLECTION);
      return value ? { services: servicesFromRecord(value) as ServicesData } : null;
    },
    { services: fallbackServices },
  );

/** The uses page's sections, and when it was last updated ("September 2025") */
export const getUses = () =>
  withFallback(
    'uses',
    async () => {
      const value = await record(USES_COLLECTION);
      return value ? (usesFromRecord(value) as { uses: UsesSection[]; usesUpdated: string }) : null;
    },
    { uses: fallbackUses, usesUpdated: fallbackUsesUpdated },
  );

export const getAbout = () =>
  withFallback(
    'About',
    async () => {
      const value = await record(ABOUT_COLLECTION);
      return value ? { about: aboutFromRecord(value) as About } : null;
    },
    { about: fallbackAbout },
  );

/** X-Content-Source for a page built from these: "pds", "git", or both if it mixes them */
export const contentSource = (...sources: Source[]) => [...new Set(sources)].sort().join(', ');
