/**
 * skiddle.id posts and series as AT Protocol records, in the shapes of the lexicons in
 * lexicons/id/skiddle/: a post's `id.skiddle.post` content (it goes in its site.standard.document's
 * `content`) and the `id.skiddle.series` records. See docs/v4/posts-on-atproto.md.
 *
 * Used by the admin app and by the scheduler that publishes scheduled drafts (workers/publisher).
 * Plain JavaScript with no dependencies, so the scheduler's Worker stays small.
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
