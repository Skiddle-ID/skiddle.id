/**
 * The site's published releases on GitHub, for /changelog/, from releases.json on the backups
 * release: .github/workflows/changelog-data.yml writes it, in the REST API's shape
 * (https://docs.github.com/en/rest/releases/releases#list-releases), whenever a release changes.
 *
 * Not the API itself: without a token, its limit of 60 requests an hour per IP is shared with every
 * other Worker, and on skiddle.id every read was refused (403). The Skiddle-ID organization only
 * allows tokens that expire within a year, so one would break the page every year. A release's
 * file downloads with no token and no such limit.
 *
 * The list is cached for 10 minutes, and when a read fails, the last list read is shown instead
 * (cachedOrLast in src/lib/edge-cache.ts). Only a Worker that has never read the list and can't
 * read it now has none, and the page says so.
 *
 * Relative imports only, so the tests can use it (scripts/releases.test.mjs).
 */
import { cachedOrLast } from './edge-cache.ts';

const REPO = 'Skiddle-ID/skiddle.id';
/** The releases on GitHub, for a visitor to read there */
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
/** Where .github/workflows/changelog-data.yml publishes the releases */
export const DATA_URL = `${RELEASES_URL}/download/backups/releases.json`;

/** How long the list stays cached, in seconds */
const RELEASES_TTL = 600;
/** How long the last list read is kept for a failed read to show, in seconds */
const KEEP_LAST = 30 * 86400;
const TIMEOUT_MS = 4000;
const CACHE_KEY = 'github/releases';

/** A version tag: v4.1, v1.2.1. The `backups` release, which holds backup files, has no such tag. */
const VERSION_TAG = /^v\d+(\.\d+)*$/;

export interface Release {
  tag: string;
  /** Its name, or its tag if it has none */
  name: string;
  /** ISO date it was published */
  publishedAt: string;
  /** The release on GitHub */
  url: string;
  /**
   * Its notes, in Markdown, as they're shown: without Release Drafter's "What's changed" heading,
   * which every release has, and with "(#205)" linked to its pull request
   */
  notes: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

const WHATS_CHANGED = /^#{1,6}[ \t]+what['’]?s changed[ \t#]*$/gim;
const notesOf = (body: string) => body.replace(WHATS_CHANGED, '').replace(/\(#(\d+)\)/g, `([#$1](https://github.com/${REPO}/pull/$1))`);

/**
 * The releases worth listing in releases.json, newest first: published (no drafts or
 * pre-releases), with a version tag, a date and a link on GitHub
 */
export function releasesFrom(json: unknown): Release[] {
  if (!Array.isArray(json)) throw new Error('GitHub releases: not a list');
  const out: Release[] = [];
  for (const r of json as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || r.draft !== false || r.prerelease !== false) continue;
    const tag = text(r.tag_name);
    const publishedAt = text(r.published_at);
    const url = text(r.html_url);
    if (!VERSION_TAG.test(tag) || Number.isNaN(Date.parse(publishedAt)) || !url.startsWith(`${RELEASES_URL}/`)) continue;
    out.push({ tag, name: text(r.name).trim() || tag, publishedAt, url, notes: notesOf(text(r.body)) });
  }
  return out.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** The releases in releases.json */
async function readReleases(fetcher: typeof fetch): Promise<Release[]> {
  const res = await fetcher(DATA_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`releases.json: ${res.status}`);
  const all: unknown = await res.json();
  const releases = releasesFrom(all);
  // releases.json has releases but none could be read (its fields renamed, say): a failure, so the
  // last list read stays rather than being replaced with an empty one
  if ((all as unknown[]).length && !releases.length) throw new Error(`releases.json: none of ${(all as unknown[]).length} releases could be read`);
  return releases;
}

/** A release's id on /changelog/, for a link to it: v4.1 is #v4-1 */
export const releaseId = (tag: string) => tag.replace(/\./g, '-');

/** The releases, newest first, or null if they can't be read and none were read before */
export async function getReleases(fetcher: typeof fetch = fetch): Promise<Release[] | null> {
  try {
    return await cachedOrLast(CACHE_KEY, RELEASES_TTL, KEEP_LAST, async () => {
      try {
        return await readReleases(fetcher);
      } catch (err) {
        console.error('changelog: reading the releases from GitHub failed:', String(err));
        throw err;
      }
    });
  } catch {
    return null;
  }
}
