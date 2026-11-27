/**
 * Publishes scheduled drafts: every `id.skiddle.draft` whose `publishAt` has passed becomes a post
 * on skiddle.id, the way the admin app's Publish does it (src/lib/admin/editor.ts), oldest first:
 *
 *   1. write its site.standard.document (documentFromDraft), dated `publishAt`, with the share card
 *      the admin app drew and stored on the draft when it was scheduled (drawing one here would
 *      take far more than the free plan's 10 ms of CPU)
 *   2. ask the site to refresh (/api/revalidate) and wait until the post's page is up
 *   3. announce it on Bluesky, and add the announcement to the document (`bskyPostRef`), which
 *      turns comments on
 *   4. delete the draft
 *
 * Every step can be retried. The document's record key comes from the slug and `publishAt`
 * (documentRkey), and the Bluesky post gets the same key, so a run that stops part-way is finished
 * by the next one without publishing or announcing twice. A draft is only deleted if it's still
 * what was published; one edited after its post went up is kept, and unscheduled.
 *
 * The PDS and the site are passed in, so tests can use stand-ins (publish.test.mjs). The Worker
 * around it is index.mjs.
 */
import { announcementRecord } from '../../src/lib/announcement.mjs';
import { DOCUMENT_COLLECTION, DRAFT_COLLECTION, documentFromDraft, slugOf } from '../../src/lib/post-record.mjs';
import { PUBLICATION_URI, SITE_URL, documentRkey } from '../../src/lib/standard-site.mjs';

const BSKY_POST = 'app.bsky.feed.post';
/** At most this many posts per run (each takes a dozen requests; a Worker run may make 50). Drafts that are skipped don't count */
export const MAX_PER_RUN = 2;

/**
 * @typedef {{ uri: string, cid: string, value: Record<string, any> }} RepoRecord
 * @typedef {object} Writer Writes to the repo, signed in
 * @property {(collection: string, rkey: string, record: object) => Promise<{ uri: string, cid: string }>} create Fails if the key is taken
 * @property {(collection: string, rkey: string, record: object, swapRecord: string) => Promise<{ uri: string, cid: string }>} put
 * @property {(collection: string, rkey: string, swapRecord: string) => Promise<void>} remove
 * @typedef {object} Pds
 * @property {(collection: string) => Promise<RepoRecord[]>} list Every record in a collection (public)
 * @property {(collection: string, rkey: string) => Promise<RepoRecord | null>} get (public)
 * @property {() => Promise<Writer>} signIn Called once, and only when something is due
 * @typedef {object} Site
 * @property {() => Promise<void>} revalidate Asks the site to refresh its cached pages
 * @property {(path: string) => Promise<void>} waitLive Resolves once the page answers; throws if it doesn't come up
 * @typedef {{ draft: string, title: string, status: 'published' | 'skipped' | 'unscheduled' | 'failed' | 'would publish', note?: string }} Result
 */

const rkeyOf = (/** @type {string} */ uri) => uri.split('/').pop() ?? '';

/** JSON with sorted keys, to compare records */
const canonical = (/** @type {unknown} */ v) =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** What a draft and the post it became must have in common for the draft to be "what was published" */
const published = (/** @type {Record<string, any>} */ r) =>
  canonical({ title: r.title, description: r.description || undefined, path: r.path, tags: r.tags?.length ? r.tags : undefined, content: r.content });

/** Why a draft can't be published by the scheduler, if it can't */
function problem(/** @type {Record<string, any>} */ d) {
  if (!d.title) return 'it has no title';
  if (!slugOf(d.path)) return 'it has no address';
  if (typeof d.content?.markdown !== 'string') return 'it has no post';
  if (!d.coverImage) return 'it has no share card (schedule it again in the admin app)';
  return undefined;
}

/**
 * @param {object} options
 * @param {Pds} options.pds
 * @param {Site} options.site
 * @param {Date} [options.now]
 * @param {boolean} [options.dryRun] Say what would be published; change nothing
 * @param {(line: string) => void} [options.log]
 * @returns {Promise<Result[]>}
 */
export async function publishDue({ pds, site, now = new Date(), dryRun = false, log = console.log }) {
  const due = (await pds.list(DRAFT_COLLECTION))
    .filter((d) => typeof d.value.publishAt === 'string' && Date.parse(d.value.publishAt) <= now.valueOf())
    .sort((a, b) => Date.parse(a.value.publishAt) - Date.parse(b.value.publishAt));
  if (!due.length) return [];

  const documents = await pds.list(DOCUMENT_COLLECTION);
  /** @type {Writer | undefined} */
  let writer;
  const signedIn = async () => (writer ??= await pds.signIn());
  /** @type {Result[]} */
  const results = [];
  let attempts = 0;
  let later = 0;

  for (const draftRecord of due) {
    const draft = draftRecord.value;
    const draftRkey = rkeyOf(draftRecord.uri);
    const title = String(draft.title || draftRkey);
    const result = (/** @type {Result['status']} */ status, /** @type {string} */ note = '') => {
      log(`${title} (draft ${draftRkey}): ${status}${note ? `: ${note}` : ''}`);
      results.push({ draft: draftRkey, title, status, ...(note ? { note } : {}) });
    };
    try {
      const why = problem(draft);
      if (why) {
        result('skipped', why);
        continue;
      }
      const publishedAt = new Date(draft.publishAt).toISOString();
      const rkey = /** @type {string} */ (documentRkey({ slug: /** @type {string} */ (slugOf(draft.path)), pubDate: new Date(publishedAt) }));
      let doc = documents.find((d) => rkeyOf(d.uri) === rkey) ?? null;
      const taken = documents.find((d) => d.value.site === PUBLICATION_URI && d.value.path === draft.path && rkeyOf(d.uri) !== rkey);
      if (taken) {
        result('skipped', `${draft.path} is already a published post (“${taken.value.title}”)`);
        continue;
      }
      if (doc && doc.value.path !== draft.path) {
        result('skipped', `the record key ${rkey} belongs to another post`);
        continue;
      }
      if (attempts === MAX_PER_RUN) {
        later++;
        continue;
      }
      attempts++;
      if (dryRun) {
        result('would publish', `${SITE_URL}${draft.path}, dated ${publishedAt}${doc ? ' (finishing a run that stopped part-way)' : ''}`);
        continue;
      }
      const w = await signedIn();

      // 1. The post
      if (!doc) {
        const record = documentFromDraft(/** @type {any} */ (draft), { publishedAt, coverImage: draft.coverImage });
        const res = await w.create(DOCUMENT_COLLECTION, rkey, record);
        doc = { uri: res.uri, cid: res.cid, value: record };
        documents.push(doc);
        await site.revalidate();
      }

      // 2–3. Once its page is up, the announcement, under the document's key, so a retry finds it
      // instead of posting again
      if (!doc.value.bskyPostRef) {
        await site.waitLive(draft.path);
        let post = await pds.get(BSKY_POST, rkey);
        if (!post) {
          const publication = await pds.get('site.standard.publication', PUBLICATION_URI.split('/').pop() ?? '').catch(() => null);
          const record = announcementRecord({
            title: draft.title,
            description: draft.description,
            lang: draft.content.lang ?? 'en',
            url: `${SITE_URL}${draft.path}`,
            thumb: draft.coverImage,
            // Bluesky's Standard.site card: the post's record and the publication's
            refs: [{ uri: doc.uri, cid: doc.cid }, ...(publication ? [{ uri: publication.uri, cid: publication.cid }] : [])],
            createdAt: now.toISOString(),
          });
          const res = await w.create(BSKY_POST, rkey, record);
          post = { uri: res.uri, cid: res.cid, value: record };
        }
        const record = { ...doc.value, bskyPostRef: { uri: post.uri, cid: post.cid } };
        const res = await w.put(DOCUMENT_COLLECTION, rkey, record, doc.cid);
        doc = { uri: res.uri, cid: res.cid, value: record };
        await site.revalidate();
      }

      // 4. The draft: deleted if it's what was published, otherwise kept and unscheduled
      if (published(draft) === published(doc.value)) {
        await w.remove(DRAFT_COLLECTION, draftRkey, draftRecord.cid);
        result('published', `${SITE_URL}${draft.path}`);
      } else {
        const { publishAt: _at, coverImage: _card, ...kept } = draft;
        await w.put(DRAFT_COLLECTION, draftRkey, kept, draftRecord.cid);
        result('unscheduled', `it was edited after ${SITE_URL}${draft.path} went up, so it's kept as a draft`);
      }
    } catch (err) {
      // The next run picks it up again where it stopped
      result('failed', err instanceof Error ? err.message : String(err));
    }
  }
  if (later) log(`${later} more ${later === 1 ? 'is' : 'are'} due, for the next run`);
  return results;
}
