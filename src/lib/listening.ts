/**
 * The listening history for /listening/, from teal.fm's plays in Jeff's AT Protocol repo
 * (src/lib/teal.mjs), read through src/lib/pds.ts.
 *
 * Plays are paged, newest first, through the current collection and then the alpha one, so the
 * page can reach all of them without reading thousands of records on one request (a Worker on the
 * free plan gets 50 subrequests). The alpha collection doesn't change any more, so its pages are
 * cached for a day; the current one's for a minute.
 */
import { olderToken, PLAY_COLLECTIONS, trackOf, type PlayView, type Track } from '~/lib/teal.mjs';
import { recordsPage } from '~/lib/pds';

/** Plays on a page of the history */
export const PAGE_SIZE = 50;
/** At most this many pages of 100 are read for "this week" */
const WEEK_PAGES = 10;

const ttlOf = (collection: number) => (collection === 0 ? 60 : 86400);

/**
 * A page of plays, newest first, from `start` (the newest play if absent), and where the next
 * (older) page starts: an /listening/?older= token, or undefined at the very first play
 */
export async function playsPage(start: { collection: number; cursor: string } = { collection: 0, cursor: '' }): Promise<{ plays: Track[]; older?: string }> {
  const { plays, older } = await readPage(start);
  // Records come in the order they were written, and piper sometimes writes a play late (one that
  // came through Last.fm, say), so a page is sorted by when each track was played
  plays.sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
  return { plays, older };
}

async function readPage(start: { collection: number; cursor: string }): Promise<{ plays: Track[]; older?: string }> {
  const plays: Track[] = [];
  let { collection, cursor } = start;
  // Fill the page, carrying on into the next collection when one runs out
  while (collection < PLAY_COLLECTIONS.length) {
    const page = await recordsPage<PlayView>(PLAY_COLLECTIONS[collection], PAGE_SIZE - plays.length, cursor, { ttl: ttlOf(collection) });
    for (const r of page.records) {
      const t = trackOf(r.value, false);
      if (t) plays.push(t);
    }
    if (page.cursor) {
      cursor = page.cursor;
      if (plays.length >= PAGE_SIZE) return { plays, older: olderToken(collection, cursor) };
      continue;
    }
    collection += 1;
    cursor = '';
    if (plays.length >= PAGE_SIZE) return { plays, older: collection < PLAY_COLLECTIONS.length ? olderToken(collection, '') : undefined };
  }
  return { plays };
}

/** The plays of the last 7 days (as far as WEEK_PAGES pages of 100 reach), newest first */
export async function weekPlays(now = Date.now()): Promise<Track[]> {
  const since = now / 1000 - 7 * 24 * 60 * 60;
  const plays: Track[] = [];
  for (const [collection, name] of PLAY_COLLECTIONS.entries()) {
    let cursor = '';
    let pastTheWeek = false;
    for (let page = 0; page < WEEK_PAGES && !pastTheWeek; page++) {
      const { records, cursor: next } = await recordsPage<PlayView>(name, 100, cursor, { ttl: ttlOf(collection) });
      const tracks = records.map((r) => trackOf(r.value, false)).filter((t): t is Track => t !== null);
      plays.push(...tracks.filter((t) => (t.playedAt ?? 0) >= since));
      // Newest first: once a page reaches back past the week, everything after it is older
      pastTheWeek = tracks.some((t) => (t.playedAt ?? Infinity) < since);
      if (!next) break;
      cursor = next;
    }
    // Only if the whole collection is from this week does the next (older) one matter
    if (pastTheWeek) break;
  }
  return plays;
}
