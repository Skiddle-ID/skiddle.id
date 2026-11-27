/**
 * The pages' content (docs/v4/pages-on-atproto.md), read when a page is requested: projects, the CV
 * and its highlights, services, uses, About, Now and the home page, from their records in Jeff's AT Protocol repo
 * (src/lib/pds.ts caches them for a minute), in the shapes the pages use (src/lib/page-records.mjs).
 * The admin app edits them (src/lib/admin/page-editor.ts). Also the notes: his Bluesky posts tagged
 * #note, and the ones the id.skiddle.notes record picks (src/lib/notes.mjs), and the posts they quote,
 * from Bluesky's public AppView.
 *
 * If a record is missing or malformed, or the PDS can't be reached, this throws rather than show a
 * page with nothing on it: a page cached earlier still shows while it's stale (PAGES_CACHE). Now and
 * the home page are the exceptions for a missing record: they show src/data/now.ts and
 * src/data/home.ts instead.
 *
 * Pages that use this are rendered on request and tag their cache with PAGES_TAG, so
 * /api/revalidate can purge them after a save.
 */
import {
  ABOUT_COLLECTION,
  CV_COLLECTION,
  HOME_COLLECTION,
  NOW_COLLECTION,
  PROJECT_COLLECTION,
  SERVICES_COLLECTION,
  USES_COLLECTION,
  aboutFromRecord,
  cvFromRecord,
  homeOf,
  nowFromRecord,
  projectsFromRecords,
  servicesFromRecord,
  usesFromRecord,
} from '~/lib/page-records.mjs';
import { PAGE_COLLECTION, draftKey, pageFromRecord, type Page } from '~/lib/page-blocks.mjs';
import { NOTES_COLLECTION, POST_COLLECTION, notesFromRecords, pickedRkeys, quotedPostsOf, quotedUris, type Note, type QuotedPost } from '~/lib/notes.mjs';
import { cached, getRecord, listRecords, recordsPage, type RepoRecord } from '~/lib/pds';
import { EVENT_COLLECTION, eventsFromRecords, type TimelineEvent } from '~/lib/timeline.mjs';
import { SITE_COLLECTION, siteMetaOf, type SiteMeta } from '~/lib/site-meta.mjs';
import { THEME_COLLECTION } from '~/lib/card-theme.mjs';
import { DEFAULT_SITE_THEME, siteThemeOf, type SiteTheme } from '~/lib/site-theme.mjs';
import { FALLBACK_SITE } from '~/data/site-meta';
import type { About } from '~/types/about';
import { FALLBACK_HOME } from '~/data/home';
import type { Highlight } from '~/types/highlights';
import type { Home } from '~/types/home';
import type { Now } from '~/types/now';
import type { Project } from '~/types/projects';
import type { ServicesData } from '~/types/services';
import type { UsesSection } from '~/types/uses';
import type { WorksData } from '~/types/works';

/** Cache tag on every page built from the pages' records, purged when the repo changes */
export const PAGES_TAG = 'pages';

/** Route cache for those pages: fresh for a minute, then stale for up to a day while a new copy renders */
export const PAGES_CACHE = { maxAge: 60, swr: 86400, tags: [PAGES_TAG] };

/** The cached records' keys in src/lib/pds.ts, which /api/revalidate forgets */
export const PAGE_RECORD_KEYS = [
  `list/${PROJECT_COLLECTION}`,
  ...[CV_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, ABOUT_COLLECTION, NOW_COLLECTION, NOTES_COLLECTION, HOME_COLLECTION, SITE_COLLECTION, THEME_COLLECTION].map((c) => `record/${c}/self`),
  `list/${EVENT_COLLECTION}`,
  `record/${PAGE_COLLECTION}/home`,
];

/** A page's record (key `self`); throws if it isn't there */
async function record(collection: string): Promise<Record<string, unknown>> {
  const value = await getRecord<Record<string, unknown>>(collection, 'self');
  if (!value) throw new Error(`${collection}: there's no record`);
  return value;
}

/** Every project, in the order they were added; the pages sort them */
export async function getProjects(): Promise<{ projects: Project[] }> {
  return { projects: projectsFromRecords(await listRecords<Record<string, unknown>>(PROJECT_COLLECTION)) as Project[] };
}

/** The CV, and the highlights it shares with /services/ */
export async function getCv(): Promise<{ works: WorksData; highlights: Highlight[] }> {
  return cvFromRecord(await record(CV_COLLECTION)) as { works: WorksData; highlights: Highlight[] };
}

export async function getServices(): Promise<{ services: ServicesData }> {
  return { services: servicesFromRecord(await record(SERVICES_COLLECTION)) as ServicesData };
}

/** The uses page's sections, and when it was last updated ("September 2025") */
export async function getUses(): Promise<{ uses: UsesSection[]; usesUpdated: string }> {
  return usesFromRecord(await record(USES_COLLECTION)) as { uses: UsesSection[]; usesUpdated: string };
}

export async function getAbout(): Promise<{ about: About }> {
  return { about: aboutFromRecord(await record(ABOUT_COLLECTION)) as About };
}

/** What Jeff is doing now, or null if there's no record yet */
export async function getNow(): Promise<Now | null> {
  const value = await getRecord<Record<string, unknown>>(NOW_COLLECTION, 'self');
  return value ? (nowFromRecord(value) as Now) : null;
}

/**
 * The home page's own text: the id.skiddle.home record's fields, and src/data/home.ts for any it
 * leaves out (all of them until there's a record). Like Now, a missing record isn't an error.
 */
export async function getHome(): Promise<Home> {
  return homeOf(await getRecord<Record<string, unknown>>(HOME_COLLECTION, 'self'), FALLBACK_HOME);
}

/**
 * A page made of blocks (src/lib/page-blocks.mjs), from its id.skiddle.page record, or null while
 * there's none (or it isn't a page). With `draft`, its draft (`home~draft`), read fresh each time,
 * for ?preview=draft.
 */
export async function getPage(key: string, { draft = false } = {}): Promise<Page | null> {
  return pageFromRecord(await getRecord<unknown>(PAGE_COLLECTION, draft ? draftKey(key) : key, draft ? { ttl: 0 } : {}));
}

/**
 * The site's metadata for every page's head (src/lib/site-meta.mjs): the id.skiddle.site record over
 * src/data/site-meta.ts. Unlike the pages' records, a failed read doesn't fail the page: it gets the
 * built-in values, and the error is logged.
 */
export async function getSiteMeta(): Promise<SiteMeta> {
  try {
    return siteMetaOf(FALLBACK_SITE, await getRecord<Record<string, unknown>>(SITE_COLLECTION, 'self'));
  } catch (err) {
    console.error('site meta:', err);
    return FALLBACK_SITE;
  }
}

/**
 * The site's look for visitors who haven't picked their own (id.skiddle.theme, src/lib/site-theme.mjs).
 * Like the metadata, a failed read gets the defaults (follow the device, blue), not an error.
 */
export async function getSiteTheme(): Promise<SiteTheme> {
  try {
    return siteThemeOf(await getRecord<Record<string, unknown>>(THEME_COLLECTION, 'self'));
  } catch (err) {
    console.error('site theme:', err);
    return DEFAULT_SITE_THEME;
  }
}

/** The timeline's events (src/lib/timeline.mjs), in order, upcoming ones rough */
export async function getEvents(): Promise<TimelineEvent[]> {
  return eventsFromRecords(await listRecords<Record<string, unknown>>(EVENT_COLLECTION));
}

/** At most this many pages of 100 posts are read for the notes, newest first */
const POST_PAGES = 5;

/** Jeff's newest posts, as many as POST_PAGES pages hold */
async function newestPosts(): Promise<RepoRecord[]> {
  const posts: RepoRecord[] = [];
  let cursor = '';
  for (let page = 0; page < POST_PAGES; page++) {
    const { records, cursor: next } = await recordsPage<Record<string, unknown>>(POST_COLLECTION, 100, cursor);
    posts.push(...records);
    if (!next || records.length < 100) break;
    cursor = next;
  }
  return posts;
}

/** The notes, newest first: posts tagged #note, and the posts the id.skiddle.notes record picks */
export async function getNotes(): Promise<Note[]> {
  try {
    const [posts, picks] = await Promise.all([newestPosts(), getRecord(NOTES_COLLECTION, 'self')]);
    return notesFromRecords(posts, pickedRkeys(picks));
  } catch (err) {
    console.error('notes: reading the posts failed:', err);
    throw err;
  }
}

const GET_POSTS = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts';
/** app.bsky.feed.getPosts reads at most this many posts at once */
const GET_POSTS_MAX = 25;
/** Quoted posts are cached for 5 minutes: a card shows no counts, and an edit or deletion is rare */
const QUOTES_TTL = 300;

/**
 * The posts these notes quote, by at:// address, from Bluesky's public AppView (no key). A post it
 * doesn't return (deleted, blocked), or a read that fails, is left out, and the page links to it.
 */
export async function getQuotedPosts(notes: Note[]): Promise<Map<string, QuotedPost>> {
  const uris = quotedUris(notes);
  const batches = Array.from({ length: Math.ceil(uris.length / GET_POSTS_MAX) }, (_, i) => uris.slice(i * GET_POSTS_MAX, (i + 1) * GET_POSTS_MAX));
  const found = await Promise.all(
    batches.map(async (batch) => {
      try {
        return await cached(`bsky/posts/${batch.join(' ')}`, QUOTES_TTL, async () => {
          const res = await fetch(`${GET_POSTS}?${new URLSearchParams(batch.map((uri) => ['uris', uri]))}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) throw new Error(`getPosts ${res.status}`);
          return quotedPostsOf(await res.json());
        });
      } catch (err) {
        console.error(`notes: reading ${batch.length} quoted posts from public.api.bsky.app failed:`, String(err));
        return [];
      }
    }),
  );
  return new Map(found.flat().map((post) => [post.uri, post]));
}
