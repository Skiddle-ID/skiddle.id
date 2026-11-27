/**
 * What a page's blocks read from the site's data (src/lib/page-blocks.mjs: each kind of block says
 * which of these it reads), loaded at most once per request however many blocks read it. The page
 * starts every read its blocks need together (preload), then each block asks for its own.
 *
 * A read that fails fails the page, as the pages' reads always have, so a page cached earlier
 * still shows while it's stale (PAGES_CACHE): only This week is left out when it can't be read.
 */
import { getStatus, type LiveStatus } from '~/lib/at-status';
import { getEvents, getNow, getProjects, getServices } from '~/lib/page-content';
import type { Source } from '~/lib/page-blocks.mjs';
import { sitePosts, type SitePosts } from '~/lib/site-posts';
import { getActivity } from '~/lib/timeline-feed';
import { todayIn, weekSummary } from '~/lib/timeline.mjs';
import type { Now } from '~/types/now';
import type { Project } from '~/types/projects';
import type { ServicesData } from '~/types/services';

export interface PageData {
  status: () => Promise<LiveStatus>;
  now: () => Promise<Now | null>;
  projects: () => Promise<Project[]>;
  posts: () => Promise<SitePosts>;
  services: () => Promise<ServicesData>;
  /** This week on the timeline, or null if it's empty or can't be read */
  week: () => Promise<ReturnType<typeof weekSummary>>;
}

/** The first call's promise, every time */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  return () => (value ??= load());
}

/** A request's reads, none started yet */
export function pageData(): PageData {
  return {
    status: once(() => getStatus()),
    now: once(getNow),
    projects: once(async () => (await getProjects()).projects),
    posts: once(sitePosts),
    services: once(async () => (await getServices()).services),
    week: once(() =>
      Promise.all([getEvents(), getActivity()]).then(
        ([events, activity]) => weekSummary(events, activity, todayIn()),
        (err) => (console.error('page: reading This week failed:', err), null),
      ),
    ),
  } satisfies Record<Source, () => Promise<unknown>>;
}

/** Starts the reads together, and waits for them: a failed one fails the page */
export async function preload(data: PageData, sources: Source[]): Promise<void> {
  await Promise.all(sources.map((s) => data[s]()));
}
