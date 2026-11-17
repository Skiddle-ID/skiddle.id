/**
 * skiddle.id posts and series as AT Protocol records, in the shapes of the lexicons in
 * lexicons/id/skiddle/: a post's `id.skiddle.post` content (it goes in its site.standard.document's
 * `content`) and the `id.skiddle.series` records. See docs/v4/posts-on-atproto.md.
 *
 * Used by scripts/check-lexicons.mjs and the AT Protocol sync, by the admin app, and by the
 * scheduler that publishes scheduled drafts (workers/publisher). Plain JavaScript with no
 * dependencies, because the sync runs without `npm ci`.
 */
import { plainText } from './plain-text.mjs';
import { DID, PUBLICATION_URI } from './standard-site.mjs';

export const POST_TYPE = 'id.skiddle.post';
export const SERIES_COLLECTION = 'id.skiddle.series';
export const DRAFT_COLLECTION = 'id.skiddle.draft';
export const DOCUMENT_COLLECTION = 'site.standard.document';

/** A post's slug from its address: "/posts/lab-notes-2/" → "lab-notes-2" */
export const slugOf = (/** @type {string | undefined} */ path) => /^\/posts\/([^/]+)\/$/.exec(path ?? '')?.[1];

/**
 * The site.standard.document a draft becomes when it's published, by the admin app's Publish or
 * by the scheduler: the draft's title, description, address, tags and post, the post as plain
 * text, and its share card. `bskyPostRef` is added once the Bluesky post exists.
 * @param {{ title: string, description?: string, path?: string, tags?: string[], content: { markdown: string } }} draft
 * @param {{ publishedAt: string, coverImage: unknown }} published
 * @returns {Record<string, unknown>}
 */
export function documentFromDraft(draft, { publishedAt, coverImage }) {
  return {
    $type: DOCUMENT_COLLECTION,
    site: PUBLICATION_URI,
    path: draft.path,
    title: draft.title,
    ...(draft.description ? { description: draft.description } : {}),
    publishedAt,
    ...(draft.tags?.length ? { tags: draft.tags } : {}),
    textContent: plainText(draft.content.markdown),
    content: draft.content,
    coverImage,
  };
}

/** URL-safe id for a series name, also its record key: "Rebuilding skiddle.id" → "rebuilding-skiddle-id" */
export const seriesSlug = (/** @type {string} */ name) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The AT URI of a series' record */
export const seriesUri = (/** @type {string} */ name) => `at://${DID}/${SERIES_COLLECTION}/${seriesSlug(name)}`;

/**
 * @typedef {object} LocalImage
 * @property {string} name How the Markdown refers to it: ![alt](image:NAME)
 * @property {string} path As written in the post, e.g. ../../assets/posts/our-flight.jpg
 * @property {string} alt
 * @property {string} [title] The Markdown image title ("…" after the path), used as the caption
 */

const IMAGE = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"([^"]*)")?\s*\)/g;

/**
 * The images a post's Markdown shows from files next to it (relative paths), and the Markdown with
 * each written as `image:NAME` instead. Images from other sites, site paths (/…) and anything inside
 * code are left alone.
 * @param {string} markdown
 * @returns {{ markdown: string, images: LocalImage[] }}
 */
export function localImages(markdown) {
  /** @type {LocalImage[]} */
  const images = [];
  const byPath = new Map();
  const names = new Set();
  const rewrite = (/** @type {string} */ text) =>
    text.replace(IMAGE, (whole, alt, rawPath, title) => {
      const path = rawPath.replace(/^<|>$/g, '');
      if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(path)) return whole;
      let image = byPath.get(path);
      if (!image) {
        const base = seriesSlug(path.split('/').pop().replace(/\.[^.]+$/, '')) || 'image';
        let name = base;
        for (let n = 2; names.has(name); n++) name = `${base}-${n}`;
        names.add(name);
        image = { name, path, alt, ...(title ? { title } : {}) };
        byPath.set(path, image);
        images.push(image);
      }
      return `![${alt}](image:${image.name}${title ? ` "${title}"` : ''})`;
    });
  // Leave fenced code blocks and inline code as they are
  const out = markdown
    .split(/(^```[\s\S]*?^```[^\n]*$|^~~~[\s\S]*?^~~~[^\n]*$)/m)
    .map((part, i) => (i % 2 ? part : part.split(/(`[^`\n]*`)/).map((p, j) => (j % 2 ? p : rewrite(p))).join('')))
    .join('');
  return { markdown: out, images };
}

/**
 * Width and height of a PNG, JPEG, GIF or WebP image, from its header
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | undefined}
 */
export function imageSize(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at, length) => String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 24 && v.getUint32(0) === 0x89504e47) return { width: v.getUint32(16), height: v.getUint32(20) };
  if (bytes.length >= 10 && ascii(0, 4) === 'GIF8') return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8X') return { width: 1 + (v.getUint32(24, true) & 0xffffff), height: 1 + (v.getUint32(27, true) & 0xffffff) };
    if (kind === 'VP8 ') return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
    if (kind === 'VP8L') {
      const b = v.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return undefined;
  }
  if (bytes.length >= 4 && v.getUint16(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return undefined;
      const marker = bytes[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      // Start of frame (SOF0–SOF15, except DHT, JPG and DAC): height, then width
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
      }
      // Markers without a length
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  return undefined;
}

/**
 * @typedef {object} PostImage An image of `id.skiddle.post`
 * @property {string} name
 * @property {unknown} image The uploaded blob ({ $type: 'blob', ref, mimeType, size })
 * @property {string} alt
 * @property {string} [caption]
 * @property {number} [width]
 * @property {number} [height]
 */

/**
 * A post's `id.skiddle.post` content
 * @param {{ category?: unknown, lang?: unknown, series?: unknown, order?: unknown, featured?: unknown }} fm The post's frontmatter
 * @param {string} markdown The body, with its images written as image:NAME (see localImages)
 * @param {PostImage[]} [images]
 */
export function postContent(fm, markdown, images = []) {
  /** @type {Record<string, unknown>} */
  const content = { $type: POST_TYPE, markdown: markdown.replace(/^\s*\n/, '') };
  if (images.length) content.images = images;
  if (typeof fm.category === 'string' && fm.category) content.category = fm.category;
  if (typeof fm.lang === 'string' && fm.lang && fm.lang !== 'en') content.lang = fm.lang;
  if (typeof fm.series === 'string' && fm.series) {
    const part = Number(fm.order);
    if (!Number.isInteger(part) || part < 1) throw new Error(`series "${fm.series}" needs an order of 1 or more, got ${fm.order}`);
    content.series = { series: seriesUri(fm.series), part };
  }
  if (fm.featured === true) content.featured = true;
  return content;
}

/**
 * @typedef {object} SeriesInfo What src/data/series.ts adds to a series
 * @property {{ order: number, title: string }[]} [planned]
 * @property {boolean} [ongoing]
 * @property {string} [cadence]
 */

/**
 * An `id.skiddle.series` record as the admin app's series editor saves it: empty fields left out,
 * planned parts in order, a cadence only for an ongoing series. Fields the editor doesn't show are
 * kept from the record as it was (`previous`), and so is its creation date.
 * @param {object} input What the editor's form holds
 * @param {string} input.name
 * @param {string} [input.description]
 * @param {boolean} [input.ongoing]
 * @param {string} [input.cadence]
 * @param {{ part: number, title: string }[]} [input.planned]
 * @param {unknown} [input.coverImage] The series' share card, as a blob reference
 * @param {Record<string, unknown>} [previous] The record as it was (an existing series)
 * @param {string} [at] Now, as an ISO date
 * @returns {Record<string, unknown>}
 */
export function seriesRecord(input, previous = {}, at = new Date().toISOString()) {
  /** @type {Record<string, unknown>} */
  const record = { ...previous, $type: SERIES_COLLECTION, name: input.name.trim() };
  for (const key of ['description', 'ongoing', 'cadence', 'planned', 'coverImage']) delete record[key];
  const description = input.description?.trim();
  if (description) record.description = description;
  if (input.ongoing) {
    record.ongoing = true;
    const cadence = input.cadence?.trim();
    if (cadence) record.cadence = cadence;
  }
  const planned = (input.planned ?? []).map((p) => ({ part: p.part, title: p.title.trim() })).sort((a, b) => a.part - b.part);
  if (planned.length) record.planned = planned;
  if (input.coverImage) record.coverImage = input.coverImage;
  record.createdAt = typeof previous.createdAt === 'string' ? previous.createdAt : at;
  record.updatedAt = at;
  return record;
}

/**
 * The `id.skiddle.series` records for the series that posts belong to or that src/data/series.ts
 * describes, keyed by record key (the series' slug). `createdAt` is the first part's date, so the
 * records don't change from one run to the next.
 * @param {{ series?: string, pubDate: Date }[]} posts
 * @param {Record<string, SeriesInfo>} info
 * @returns {Map<string, Record<string, unknown>>}
 */
export function seriesRecords(posts, info) {
  const names = new Set([...posts.map((p) => p.series).filter((s) => typeof s === 'string' && s), ...Object.keys(info)]);
  const records = new Map();
  for (const name of names) {
    const dates = posts.filter((p) => p.series === name).map((p) => p.pubDate.valueOf()).filter((d) => !Number.isNaN(d));
    const extra = info[name] ?? {};
    /** @type {Record<string, unknown>} */
    const record = { $type: SERIES_COLLECTION, name };
    if (extra.ongoing) record.ongoing = true;
    if (extra.cadence) record.cadence = extra.cadence;
    if (extra.planned?.length) record.planned = extra.planned.map((p) => ({ part: p.order, title: p.title }));
    record.createdAt = new Date(dates.length ? Math.min(...dates) : 0).toISOString();
    records.set(seriesSlug(name), record);
  }
  return records;
}
