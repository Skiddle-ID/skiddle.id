/**
 * Pages of Jeff's own (docs/v4/themes.md, "Pages of Jeff's own"): id.skiddle.page records under an
 * address he picks in the admin app, served at /<key>/ by src/pages/[key].astro. An address is
 * lowercase letters, digits and single hyphens, up to OWN_KEY_MAX characters, and none the site
 * uses itself (RESERVED_KEYS). A key with a `~` is a draft's, never an address. Plain JavaScript, so
 * the site, the admin app and the tests (scripts/own-pages.test.mjs) share it.
 */
import { SITE_PAGES, pageFromRecord } from './page-blocks.mjs';

/** The longest address a page of Jeff's own can have, in characters */
export const OWN_KEY_MAX = 50;

const OWN_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The addresses the site uses itself, which no page of Jeff's own can take: every top-level route
 * in src/pages/ and everything at the top of public/ (scripts/own-pages.test.mjs checks both), what
 * the build adds there (/_astro/ isn't an address, /og/ is), Cloudflare's /cdn-cgi/, and the site's
 * own pages' keys (home is /, not /home/).
 */
export const RESERVED_KEYS = new Set([
  '404',
  'about',
  'admin',
  'api',
  'avatars',
  'cdn-cgi',
  'index',
  'listening',
  'media',
  'notes',
  'now',
  'og',
  'posts',
  'projects',
  'series',
  'services',
  'status',
  'timeline',
  'topics',
  'uses',
  'works',
  'xrpc',
  ...SITE_PAGES,
]);

/**
 * Why a page of Jeff's own can't be at this address, or null if it can
 * @param {string} key The address, as its record key: `speaking` for /speaking/
 * @param {Iterable<string>} [taken] The keys of the page records in the repo; a draft's
 *   (`talks~draft`) takes its page's address
 * @returns {string | null}
 */
export function ownKeyProblem(key, taken = []) {
  if (!key) return 'Give it an address.';
  if (key.length > OWN_KEY_MAX) return `An address is up to ${OWN_KEY_MAX} characters.`;
  if (!OWN_KEY.test(key)) return 'An address is lowercase letters, digits and single hyphens, like speaking or talks-2026.';
  if (RESERVED_KEYS.has(key)) return `/${key}/ is one of the site’s own addresses.`;
  for (const t of taken) if (t === key || t.startsWith(`${key}~`)) return `There’s a page at /${key}/ already.`;
  return null;
}

/** Whether a page of Jeff's own can be at this address */
export const isOwnKey = (/** @type {string} */ key) => ownKeyProblem(key) === null;

/** Where a page of Jeff's own is on the site */
export const ownPagePath = (/** @type {string} */ key) => `/${key}/`;

/**
 * An address made from a title, for the admin app's New page: "Talks & workshops" is
 * talks-workshops. It may still be taken or reserved (ownKeyProblem).
 */
export const ownKeyFrom = (/** @type {string} */ title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, OWN_KEY_MAX)
    .replace(/^-+|-+$/g, '');

/**
 * @typedef {import('./page-blocks.mjs').Page} Page
 * @typedef {{ uri: string, value: unknown }} PageRecord An id.skiddle.page record, as the repo lists it
 * @typedef {{ key: string, path: string, page: Page }} OwnPage
 */

const keyOf = (/** @type {string} */ uri) => uri.slice(uri.lastIndexOf('/') + 1);
/** The record as a page of Jeff's own, if its key is an address one can have and it reads as a page */
const ownPage = (/** @type {PageRecord} */ record, /** @type {string} */ key) => (isOwnKey(key) ? pageFromRecord(record.value) : null);

/**
 * The published page of Jeff's own at /<key>/, from the page records, or null if there's none
 * @param {PageRecord[]} records
 * @param {string} key
 * @returns {Page | null}
 */
export function ownPageOf(records, key) {
  const record = records.find((r) => keyOf(r.uri) === key);
  return record ? ownPage(record, key) : null;
}

/**
 * Every published page of Jeff's own in the page records, by address: what the sitemap, the search
 * and the command bar list. The same pages src/pages/[key].astro serves, so drafts, the site's own
 * pages and records under a reserved key are left out.
 * @param {PageRecord[]} records
 * @returns {OwnPage[]}
 */
export function ownPagesOf(records) {
  return records
    .flatMap((r) => {
      const key = keyOf(r.uri);
      const page = ownPage(r, key);
      return page ? [{ key, path: ownPagePath(key), page }] : [];
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
