/**
 * The site's published releases on GitHub, for /changelog/, from the REST API
 * (https://docs.github.com/en/rest/releases/releases#list-releases), with the Worker's
 * GITHUB_TOKEN secret when it's set.
 *
 * Without a token, GitHub allows 60 requests an hour per IP, and Workers share their IPs: on
 * skiddle.id every read was refused (403). A token (one that can only read public repositories)
 * allows 5,000 an hour. The list is cached for an hour, and when a read fails, the last list
 * read is shown instead (cachedOrLast in src/lib/edge-cache.ts). Only a Worker that has never read
 * the list and can't read it now has none, and the page says so.
 *
 * Relative imports only, so the tests can use it (scripts/releases.test.mjs).
 */
import { cachedOrLast } from './edge-cache.ts';

const REPO = 'Skiddle-ID/skiddle.id';
/** The releases on GitHub, for a visitor to read there */
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
const API_URL = `https://api.github.com/repos/${REPO}/releases`;

/** How long the list stays cached, in seconds: GitHub's rate limit window */
const RELEASES_TTL = 3600;
/** How long the last list read is kept for a failed read to show, in seconds */
const KEEP_LAST = 30 * 86400;
const TIMEOUT_MS = 4000;
/** The most releases the API gives on one page */
const PER_PAGE = 100;
/** The most pages read, so a read stays well inside a request's 50 subrequests */
const MAX_PAGES = 10;
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
 * The releases worth listing in the API's answer, newest first: published (no drafts or
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

/** Every page of releases from the API */
async function readReleases(fetcher: typeof fetch, token: string): Promise<Release[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetcher(`${API_URL}?per_page=${PER_PAGE}&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'changelog-reader',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`GitHub releases page ${page}: ${res.status}${token ? '' : ' (no token)'}, ${res.headers.get('x-ratelimit-remaining') ?? '?'} requests left`);
    const batch: unknown = await res.json();
    if (!Array.isArray(batch)) throw new Error(`GitHub releases page ${page}: not a list`);
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  const releases = releasesFrom(all);
  // GitHub answered with releases but none could be read (its fields renamed, say): a failure, so
  // the last list read stays rather than being replaced with an empty one
  if (all.length && !releases.length) throw new Error(`GitHub releases: none of ${all.length} could be read`);
  return releases;
}

/** A release's id on /changelog/, for a link to it: v4.1 is #v4-1 */
export const releaseId = (tag: string) => tag.replace(/\./g, '-');

/** The releases, newest first, or null if they can't be read and none were read before */
export async function getReleases(fetcher: typeof fetch = fetch, token = ''): Promise<Release[] | null> {
  try {
    return await cachedOrLast(CACHE_KEY, RELEASES_TTL, KEEP_LAST, async () => {
      try {
        return await readReleases(fetcher, token);
      } catch (err) {
        console.error('changelog: reading the releases from GitHub failed:', String(err));
        throw err;
      }
    });
  } catch {
    return null;
  }
}
