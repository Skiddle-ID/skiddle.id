/**
 * The notes on /notes/: Jeff's Bluesky posts (app.bsky.feed.post records in his own repo) tagged
 * #note, plus the older ones he picks in the admin app, listed by links in the id.skiddle.notes
 * record (lexicons/id/skiddle/notes.json). src/lib/page-content.ts reads the records.
 *
 * A note's text is rendered from the record with its facets (links, mentions and tags), which
 * index the text's UTF-8 bytes. A facet that overlaps another or doesn't fall on a character's
 * edges is left out, and the text is escaped.
 */
import { DID } from './standard-site.mjs';

export const POST_COLLECTION = 'app.bsky.feed.post';
export const NOTES_COLLECTION = 'id.skiddle.notes';
export const HANDLE = 'skiddle.blue';
export const NOTE_TAG = 'note';
export const NOTES_PER_PAGE = 20;

const OWNER = new Set([DID, HANDLE]);
const RKEY = /^[A-Za-z0-9._:~-]{1,512}$/;
const CDN = 'https://cdn.bsky.app/img';

/**
 * @typedef {{ thumb: string, fullsize: string, alt: string, width?: number, height?: number }} NoteImage
 * @typedef {{ kind: 'images', images: NoteImage[] }
 *   | { kind: 'link', url: string, title: string, domain: string }
 *   | { kind: 'video', url: string }
 *   | { kind: 'quote', uri: string, url: string }
 *   | { kind: 'record', label: string, url: string }} Attachment
 * @typedef {{ rkey: string, createdAt: string, url: string, html: string, attachments: Attachment[] }} Note
 */

/** @param {unknown} v */
const isObject = (v) => typeof v === 'object' && v !== null;
/** @param {unknown} v */
const str = (v) => (typeof v === 'string' ? v : '');
/** @param {string} s */
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** @param {string} rkey */
export const postUrl = (rkey) => `https://bsky.app/profile/${HANDLE}/post/${rkey}`;

/** @param {string} s */
function httpUrl(s) {
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The record key of one of Jeff's posts, from its bsky.app link or its at:// address; undefined for
 * another account's post or anything else
 * @param {string} link
 */
export function postRkey(link) {
  const s = link.trim();
  let m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/?#]+)$/.exec(s);
  if (!m) {
    const url = httpUrl(s);
    if (url?.hostname !== 'bsky.app') return undefined;
    m = /^\/profile\/([^/]+)\/post\/([^/]+)\/?$/.exec(url.pathname);
  }
  if (!m) return undefined;
  let who, rkey;
  try {
    [who, rkey] = [decodeURIComponent(m[1]).toLowerCase(), decodeURIComponent(m[2])];
  } catch {
    return undefined;
  }
  return OWNER.has(who) && RKEY.test(rkey) && rkey !== '.' && rkey !== '..' ? rkey : undefined;
}

/**
 * The record keys of the posts the id.skiddle.notes record picks
 * @param {unknown} record The record's value, or null if there's none
 * @returns {Set<string>}
 */
export function pickedRkeys(record) {
  const posts = isObject(record) && Array.isArray(record.posts) ? record.posts : [];
  return new Set(posts.filter((p) => typeof p === 'string').map(postRkey).filter((k) => k !== undefined));
}

/**
 * Whether a post is tagged #note: a tag in its text (a facet) or in its `tags`
 * @param {Record<string, unknown>} post
 */
export function isTagged(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const facetTags = (Array.isArray(post.facets) ? post.facets : []).flatMap((f) => (isObject(f) && Array.isArray(f.features) ? f.features : []).map(tagOf));
  return [...tags, ...facetTags].some((t) => typeof t === 'string' && t.toLowerCase() === NOTE_TAG);
}

/** @param {unknown} feature */
const tagOf = (feature) => (isObject(feature) && feature.$type === 'app.bsky.richtext.facet#tag' ? feature.tag : undefined);

/**
 * The notes among Jeff's posts, newest first: those tagged #note that aren't replies, and those
 * picked (replies too)
 * @param {{ uri: string, value: unknown }[]} records His app.bsky.feed.post records
 * @param {Set<string>} picked Record keys of picked posts (pickedRkeys)
 * @returns {Note[]}
 */
export function notesFromRecords(records, picked) {
  /** @type {Note[]} */
  const notes = [];
  for (const { uri, value } of records) {
    const rkey = uri.split('/').pop() ?? '';
    if (!isObject(value)) continue;
    if (!picked.has(rkey) && (value.reply !== undefined || !isTagged(value))) continue;
    notes.push({
      rkey,
      createdAt: str(value.createdAt),
      url: postUrl(rkey),
      html: richTextHtml(str(value.text), value.facets),
      attachments: attachmentsOf(value.embed, postUrl(rkey)),
    });
  }
  const time = (/** @type {Note} */ n) => Date.parse(n.createdAt) || 0;
  return notes.sort((a, b) => time(b) - time(a) || b.rkey.localeCompare(a.rkey));
}

/**
 * One page of notes (1 is the newest) and how many pages there are; null past the last page.
 * Page 1 always exists, with no notes if there are none.
 * @param {Note[]} notes
 * @param {number} page
 */
export function notesPage(notes, page, size = NOTES_PER_PAGE) {
  const pages = Math.max(1, Math.ceil(notes.length / size));
  if (!Number.isInteger(page) || page < 1 || page > pages) return null;
  return { notes: notes.slice((page - 1) * size, page * size), page, pages };
}

/**
 * The page a ?page= value asks for: 1 when there's none, undefined when it isn't a page number
 * @param {string | null} raw
 */
export const pageNumber = (raw) => (raw === null ? 1 : /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : undefined);

/**
 * A post's text as HTML: escaped, with its facets as links. Links go to http(s) addresses only,
 * mentions to the profile on Bluesky, tags to the hashtag on Bluesky; #note itself is muted text.
 * @param {string} text
 * @param {unknown} facets The record's app.bsky.richtext.facet list
 */
export function richTextHtml(text, facets) {
  const bytes = new TextEncoder().encode(text);
  const decoder = new TextDecoder();
  const edge = (/** @type {number} */ i) => i === bytes.length || (bytes[i] & 0xc0) !== 0x80;
  const spans = (Array.isArray(facets) ? facets : [])
    .map((f) => {
      const start = f?.index?.byteStart;
      const end = f?.index?.byteEnd;
      const feature = (Array.isArray(f?.features) ? f.features : []).find((x) => isObject(x) && typeof x.$type === 'string');
      return { start, end, feature };
    })
    .filter(({ start, end, feature }) => feature && Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end && end <= bytes.length && edge(start) && edge(end))
    .sort((a, b) => a.start - b.start);
  let html = '';
  let at = 0;
  for (const { start, end, feature } of spans) {
    if (start < at) continue;
    html += escape(decoder.decode(bytes.slice(at, start)));
    html += facetHtml(feature, decoder.decode(bytes.slice(start, end)));
    at = end;
  }
  return html + escape(decoder.decode(bytes.slice(at)));
}

/**
 * @param {Record<string, unknown>} feature
 * @param {string} text
 */
function facetHtml(feature, text) {
  const a = (/** @type {string} */ href) => `<a href="${escape(href)}" class="link">${escape(text)}</a>`;
  switch (feature.$type) {
    case 'app.bsky.richtext.facet#link': {
      const url = httpUrl(str(feature.uri));
      return url ? a(url.href) : escape(text);
    }
    case 'app.bsky.richtext.facet#mention': {
      const did = str(feature.did);
      return /^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(did) ? a(`https://bsky.app/profile/${did}`) : escape(text);
    }
    case 'app.bsky.richtext.facet#tag': {
      const tag = str(feature.tag);
      if (tag.toLowerCase() === NOTE_TAG) return `<span class="text-[var(--color-muted)]">${escape(text)}</span>`;
      return tag ? a(`https://bsky.app/hashtag/${encodeURIComponent(tag)}`) : escape(text);
    }
    default:
      return escape(text);
  }
}

/**
 * What a post carries besides its text, from its embed (app.bsky.embed.*): images as thumbnails
 * on Bluesky's CDN, a link card, a video (shown as a link to the post), a quoted post (its at://
 * address, to read from the AppView, and its link), or another record (a feed, a list, a starter
 * pack), linked on Bluesky without reading it. A quote with media has the media first.
 * @param {unknown} embed
 * @param {string} url The post on Bluesky
 * @returns {Attachment[]}
 */
function attachmentsOf(embed, url) {
  if (!isObject(embed)) return [];
  switch (embed.$type) {
    case 'app.bsky.embed.images': {
      const images = (Array.isArray(embed.images) ? embed.images : []).map(imageOf).filter((i) => i !== undefined);
      return images.length ? [{ kind: 'images', images }] : [];
    }
    case 'app.bsky.embed.video':
      return [{ kind: 'video', url }];
    case 'app.bsky.embed.external': {
      const ext = isObject(embed.external) ? embed.external : {};
      const link = httpUrl(str(ext.uri));
      return link ? [{ kind: 'link', url: link.href, title: str(ext.title) || link.href, domain: link.hostname.replace(/^www\./, '') }] : [];
    }
    case 'app.bsky.embed.record':
      return recordOf(embed.record);
    case 'app.bsky.embed.recordWithMedia':
      return [...attachmentsOf(embed.media, url), ...recordOf(isObject(embed.record) ? embed.record.record : undefined)];
    default:
      return [];
  }
}

/** @param {unknown} image */
function imageOf(image) {
  if (!isObject(image) || !isObject(image.image)) return undefined;
  const blob = image.image;
  const cid = isObject(blob.ref) ? str(blob.ref.$link) : str(blob.cid);
  if (!/^[a-z0-9]+$/i.test(cid)) return undefined;
  const ratio = isObject(image.aspectRatio) ? image.aspectRatio : {};
  const size = Number.isInteger(ratio.width) && Number.isInteger(ratio.height) && Number(ratio.width) > 0 && Number(ratio.height) > 0;
  return {
    thumb: `${CDN}/feed_thumbnail/plain/${DID}/${cid}@jpeg`,
    fullsize: `${CDN}/feed_fullsize/plain/${DID}/${cid}@jpeg`,
    alt: str(image.alt),
    ...(size ? { width: Number(ratio.width), height: Number(ratio.height) } : {}),
  };
}

/** What another record's at:// address is, and where it is on Bluesky */
const RECORD_KINDS = {
  'app.bsky.feed.generator': { label: 'feed', path: 'feed' },
  'app.bsky.graph.list': { label: 'list', path: 'lists' },
  'app.bsky.graph.starterpack': { label: 'starter pack', path: 'starter-pack' },
};

/**
 * @param {unknown} ref A strongRef: { uri, cid }
 * @returns {Attachment[]}
 */
function recordOf(ref) {
  const m = /^at:\/\/(did:[a-z]+:[A-Za-z0-9._:%-]+)\/([a-z0-9.]+)\/([A-Za-z0-9._:~-]+)$/i.exec(isObject(ref) ? str(ref.uri) : '');
  if (m?.[2] === POST_COLLECTION) return [{ kind: 'quote', uri: m[0], url: `https://bsky.app/profile/${m[1]}/post/${m[3]}` }];
  const kind = m && RECORD_KINDS[/** @type {keyof typeof RECORD_KINDS} */ (m[2])];
  if (!m || !kind) return [];
  const url = kind.path === 'starter-pack' ? `https://bsky.app/starter-pack/${m[1]}/${m[3]}` : `https://bsky.app/profile/${m[1]}/${kind.path}/${m[3]}`;
  return [{ kind: 'record', label: kind.label, url }];
}
