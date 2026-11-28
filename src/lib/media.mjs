/**
 * The media library (the admin app's Media section, src/lib/admin/media.ts): which of the repo's
 * files ("blobs") the site's records use, and which are uploads of their own (id.skiddle.media,
 * lexicons/id/skiddle/media.json). A PDS removes a blob no record uses, so an upload is kept by its
 * record, and deleting the record lets the file go. A post or page can also show one by its link,
 * ![alt](/media/<cid>), in its text: that doesn't keep the file, so the library lists those uses too,
 * and Replace (relinked) can move them to a new file. No dependencies, so it can be tested in Node.
 */

export const MEDIA_COLLECTION = 'id.skiddle.media';

/** The site's collections whose records can hold files, read to see what uses each one */
export const SITE_BLOB_COLLECTIONS = [
  MEDIA_COLLECTION,
  'id.skiddle.draft',
  'site.standard.document',
  'id.skiddle.series',
  'site.standard.publication',
  'app.bsky.feed.generator',
  'id.skiddle.project',
  'id.skiddle.site',
  'id.skiddle.page',
];

/** The site's collections whose text can link to a file (/media/<cid>), and the admin app can write */
export const LINK_COLLECTIONS = [
  'id.skiddle.draft',
  'site.standard.document',
  'id.skiddle.series',
  'id.skiddle.project',
  'id.skiddle.page',
  'id.skiddle.now',
  'id.skiddle.notes',
  'id.skiddle.services',
  'id.skiddle.event',
];

/** The collections Media reads: those holding files, and those whose text links to them */
export const MEDIA_READ_COLLECTIONS = [...new Set([...SITE_BLOB_COLLECTIONS, ...LINK_COLLECTIONS])];

/** A record with key self that has its own editor: its label and the editor's name (#page/<name>) */
const PAGE_OF = {
  'id.skiddle.now': { label: 'the Now list', editor: 'now' },
  'id.skiddle.notes': { label: 'note picks', editor: 'notes' },
  'id.skiddle.services': { label: 'services and testimonials', editor: 'services' },
  'id.skiddle.site': { label: 'page: site', editor: 'site' },
};

/** A page made of blocks: id.skiddle.page, keyed by its address, its draft by <address>~draft */
const BLOCK_PAGE = 'id.skiddle.page';

/**
 * @typedef {{ cid: string, mimeType?: string, size?: number }} BlobInfo
 * @typedef {{ collection: string, rkey: string, label: string, link?: boolean }} BlobUse A record that uses a file: holding it, or (link) only linking to it in its text, which doesn't keep it
 * @typedef {BlobInfo & { uses: BlobUse[], group: 'library' | 'site' | 'elsewhere', name?: string, alt?: string, mediaRkey?: string, mediaCid?: string }} MediaItem
 */

/**
 * Every blob a record names, wherever it sits in the record: { $type: 'blob', ref: { $link }, … },
 * or the older { cid, mimeType }
 * @param {unknown} value
 * @returns {BlobInfo[]}
 */
export function blobRefsIn(value) {
  /** @type {BlobInfo[]} */
  const out = [];
  const walk = (/** @type {unknown} */ v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = /** @type {Record<string, any>} */ (v);
    if (o.$type === 'blob' && typeof o.ref?.$link === 'string') {
      out.push({ cid: o.ref.$link, ...(typeof o.mimeType === 'string' ? { mimeType: o.mimeType } : {}), ...(typeof o.size === 'number' ? { size: o.size } : {}) });
      return;
    }
    if (typeof o.cid === 'string' && typeof o.mimeType === 'string' && Object.keys(o).length <= 2) {
      out.push({ cid: o.cid, mimeType: o.mimeType });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(value);
  return out;
}

/** A file's link in text: /media/<cid>, alone or in a full address */
const LINK = /\/media\/(b[a-z2-7]{20,})/g;

/**
 * The files a record's text links to (/media/<cid>), each once
 * @param {unknown} value
 * @returns {string[]}
 */
export function mediaLinksIn(value) {
  /** @type {Set<string>} */
  const out = new Set();
  const walk = (/** @type {unknown} */ v) => {
    if (typeof v === 'string') for (const m of v.matchAll(LINK)) out.add(m[1]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...out];
}

/**
 * A record with its text's links to one file moved to another: /media/<from> becomes /media/<to>,
 * in every string, at any depth. The rest is as it was
 * @template T
 * @param {T} value
 * @param {string} from
 * @param {string} to
 * @returns {T}
 */
export function relinked(value, from, to) {
  const old = `/media/${from}`;
  const swap = (/** @type {unknown} */ v) => {
    if (typeof v === 'string') return v.split(old).join(`/media/${to}`);
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return /** @type {T} */ (swap(value));
}

/** What a record is called, for "used by" */
function labelOf(/** @type {string} */ collection, /** @type {Record<string, any>} */ v, /** @type {string} */ rkey) {
  const own = /** @type {Record<string, { label: string }>} */ (PAGE_OF)[collection];
  if (own) return own.label;
  if (collection === BLOCK_PAGE) return rkey.endsWith('~draft') ? `page draft: ${rkey.slice(0, -'~draft'.length)}` : `page: ${rkey}`;
  const name = v?.title || v?.name || v?.displayName;
  const kind = { 'id.skiddle.draft': 'draft', 'site.standard.document': 'post', 'id.skiddle.series': 'series', 'site.standard.publication': 'publication', 'app.bsky.feed.generator': 'Bluesky feed', 'id.skiddle.project': 'project', 'id.skiddle.event': 'event', [MEDIA_COLLECTION]: 'library' }[collection] ?? collection;
  return `${kind}: ${typeof name === 'string' && name ? name : rkey}`;
}

/**
 * Every blob in the repo, with what uses it: the library's (an id.skiddle.media record keeps it),
 * the site's (another of the site's records holds it), or elsewhere (another app's, or nothing the
 * site reads). A record whose text links to a file (/media/<cid>) is one of its uses too, marked
 * link, since that doesn't keep the file. Newest library uploads first, then the site's, then the rest, as the repo lists them.
 * @param {string[]} cids The repo's blobs (com.atproto.sync.listBlobs)
 * @param {{ collection: string, uri: string, value: Record<string, any> }[]} records The site's records (MEDIA_READ_COLLECTIONS)
 * @returns {MediaItem[]}
 */
export function mediaItems(cids, records) {
  /** @type {Map<string, MediaItem>} */
  const byCid = new Map(cids.map((cid) => [cid, { cid, uses: [], group: 'elsewhere' }]));
  const library = [...records]
    .filter((r) => r.collection === MEDIA_COLLECTION)
    .sort((a, b) => String(b.value.createdAt ?? '').localeCompare(String(a.value.createdAt ?? '')));
  const others = records.filter((r) => r.collection !== MEDIA_COLLECTION);
  for (const r of [...library, ...others]) {
    const rkey = r.uri.split('/').pop() ?? '';
    for (const blob of blobRefsIn(r.value)) {
      const it = byCid.get(blob.cid) ?? { cid: blob.cid, uses: [], group: 'elsewhere' };
      byCid.set(blob.cid, it);
      if (blob.mimeType && !it.mimeType) it.mimeType = blob.mimeType;
      if (blob.size && !it.size) it.size = blob.size;
      if (!it.uses.some((u) => u.collection === r.collection && u.rkey === rkey)) it.uses.push({ collection: r.collection, rkey, label: labelOf(r.collection, r.value, rkey) });
      if (r.collection === MEDIA_COLLECTION && it.mediaRkey === undefined) {
        it.group = 'library';
        it.mediaRkey = rkey;
        if (typeof r.value.name === 'string') it.name = r.value.name;
        if (typeof r.value.alt === 'string') it.alt = r.value.alt;
      } else if (it.group === 'elsewhere') it.group = 'site';
    }
  }
  for (const r of [...library, ...others]) {
    const rkey = r.uri.split('/').pop() ?? '';
    for (const cid of mediaLinksIn(r.value)) {
      const it = byCid.get(cid);
      if (it && !it.uses.some((u) => u.collection === r.collection && u.rkey === rkey)) it.uses.push({ collection: r.collection, rkey, label: labelOf(r.collection, r.value, rkey), link: true });
    }
  }
  const order = { library: 0, site: 1, elsewhere: 2 };
  const libraryOrder = new Map(library.map((r, i) => [r.uri.split('/').pop(), i]));
  return [...byCid.values()].sort((a, b) => order[a.group] - order[b.group] || (libraryOrder.get(a.mediaRkey) ?? 0) - (libraryOrder.get(b.mediaRkey) ?? 0));
}

/** Where a record opens in the admin app, if it has an editor there */
export function editorHref(/** @type {BlobUse} */ use) {
  const own = /** @type {Record<string, { editor: string }>} */ (PAGE_OF)[use.collection];
  if (own) return `#page/${own.editor}`;
  if (use.collection === BLOCK_PAGE) return `#blocks/${use.rkey.replace(/~draft$/, '')}`;
  if (use.collection === 'id.skiddle.event') return `#event/${use.rkey}`;
  return (
    { 'site.standard.publication': '#page/publication', 'id.skiddle.draft': `#draft/${use.rkey}`, 'site.standard.document': `#post/${use.rkey}`, 'id.skiddle.series': `#series/${use.rkey}`, 'id.skiddle.project': `#project/${use.rkey}` }[use.collection] ?? undefined
  );
}

/** An image as Markdown for a post: ![alt](/media/<cid>), with the alt text's brackets escaped */
export function mediaMarkdown(/** @type {string} */ cid, alt = '') {
  return `![${alt.replace(/([\\[\]])/g, '\\$1').replace(/\s+/g, ' ').trim()}](/media/${cid})`;
}

/** A size in bytes, as people read it: 182 KB, 1.4 MB */
export function sizeLabel(/** @type {number | undefined} */ bytes) {
  if (!bytes) return '';
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1e6) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}
