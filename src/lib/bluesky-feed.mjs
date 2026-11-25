/**
 * A Bluesky custom feed for each series: people pin it in Bluesky and see the posts that announce
 * the series' parts. The site's Worker is the feed generator, did:web:skiddle.id
 * (/.well-known/did.json), and answers Bluesky's calls under /xrpc/. A series' feed is listed
 * once Jeff publishes an `app.bsky.feed.generator` record whose key is the series' key, from the
 * admin app's series editor. See https://docs.bsky.app/docs/starter-templates/custom-feeds.
 *
 * Plain JavaScript so `node --test` can test it (scripts/bluesky-feed.test.mjs).
 */
import { trimChars } from './status-states.mjs';
import { DID, SITE_URL } from './standard-site.mjs';

export const FEED_DID = 'did:web:skiddle.id';
export const GENERATOR_COLLECTION = 'app.bsky.feed.generator';

/** /.well-known/did.json: where Bluesky finds the feed generator */
export const DID_DOCUMENT = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: FEED_DID,
  service: [{ id: '#bsky_fg', type: 'BskyFeedGenerator', serviceEndpoint: SITE_URL }],
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_NAME = 24;
const MAX_DESCRIPTION = 300;

/** The AT URI of a series' feed: its generator record */
export const feedUri = (/** @type {string} */ key) => `at://${DID}/${GENERATOR_COLLECTION}/${key}`;

/** A series' feed in the Bluesky app */
export const blueskyFeedUrl = (/** @type {string} */ key) => `https://bsky.app/profile/${DID}/feed/${key}`;

/**
 * app.bsky.feed.describeFeedGenerator
 * @param {string[]} keys The series with a generator record
 */
export const describeFeeds = (keys) => ({ did: FEED_DID, feeds: keys.map((key) => ({ uri: feedUri(key) })) });

/**
 * @typedef {{ post: string, at: number }} FeedItem A series' post: its Bluesky post's AT URI, and when it was published (ms)
 * @typedef {{ status: 200, body: { feed: { post: string }[], cursor?: string } }} Skeleton
 * @typedef {{ status: 400, body: { error: 'UnknownFeed' | 'InvalidRequest', message: string } }} XrpcError
 */

/** @returns {XrpcError} */
const fail = (/** @type {'UnknownFeed' | 'InvalidRequest'} */ error, /** @type {string} */ message) => ({ status: 400, body: { error, message } });

/** Newest first; posts published at the same moment in a fixed order, so a cursor always finds its place */
const newestFirst = (/** @type {FeedItem} */ a, /** @type {FeedItem} */ b) => b.at - a.at || (a.post < b.post ? 1 : a.post > b.post ? -1 : 0);

/**
 * The cursor after an item: where it sits in the feed, so posts added on top don't move it
 * @param {FeedItem} item
 */
const cursorOf = (item) => `${item.at}::${item.post}`;

/**
 * app.bsky.feed.getFeedSkeleton: one page of a series' feed
 * @param {URLSearchParams} params `feed` (a feed's AT URI), `limit` (1 to 100, 50 if absent; a
 *   number outside that is brought into it), `cursor` (from the page before)
 * @param {Map<string, FeedItem[]>} feeds Each series' items, by its key
 * @returns {Skeleton | XrpcError}
 */
export function feedSkeleton(params, feeds) {
  const uri = params.get('feed');
  if (!uri) return fail('InvalidRequest', 'feed is required');
  const prefix = `at://${DID}/${GENERATOR_COLLECTION}/`;
  const key = uri.startsWith(prefix) ? uri.slice(prefix.length) : '';
  const items = feeds.get(key);
  if (!items) return fail('UnknownFeed', `No such feed: ${uri}`);

  const rawLimit = params.get('limit');
  if (rawLimit !== null && !/^-?\d+$/.test(rawLimit)) return fail('InvalidRequest', 'limit must be a whole number');
  const limit = rawLimit === null ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, Number(rawLimit)));

  const rawCursor = params.get('cursor');
  const cursor = rawCursor ? /^(\d+)::(at:\/\/\S+)$/.exec(rawCursor) : undefined;
  if (rawCursor && !cursor) return fail('InvalidRequest', 'cursor is not one this feed gave');

  const sorted = [...items].sort(newestFirst);
  const rest = cursor ? sorted.filter((item) => newestFirst(item, { at: Number(cursor[1]), post: cursor[2] }) > 0) : sorted;
  const page = rest.slice(0, limit);
  return {
    status: 200,
    body: { feed: page.map((item) => ({ post: item.post })), ...(rest.length > limit ? { cursor: cursorOf(page[page.length - 1]) } : {}) },
  };
}

/**
 * An `app.bsky.feed.generator` record for a series' feed, as the admin app publishes it: the
 * series' name and description, cut to what Bluesky allows. Fields the editor doesn't set (an
 * avatar added elsewhere) are kept from the record as it was, and so is its creation date.
 * @param {{ name: string, description?: string }} series
 * @param {Record<string, unknown>} [previous] The record as it was, if the feed was published before
 * @param {string} [at] Now, as an ISO date
 * @returns {Record<string, unknown>}
 */
export function generatorRecord(series, previous = {}, at = new Date().toISOString()) {
  const name = series.name.trim();
  const description = series.description?.trim() || `Posts in ${name}, a series on skiddle.id.`;
  /** @type {Record<string, unknown>} */
  const record = { ...previous, $type: GENERATOR_COLLECTION, did: FEED_DID, displayName: trimChars(name, MAX_NAME), description: trimChars(description, MAX_DESCRIPTION) };
  // Facets point into the old description's bytes
  delete record.descriptionFacets;
  record.createdAt = typeof previous.createdAt === 'string' ? previous.createdAt : at;
  return record;
}
