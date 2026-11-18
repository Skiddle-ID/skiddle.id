/**
 * Share cards, in the Site section: checks every stored share card and saves the ones that changed.
 *
 * Stored cards are drawn once and kept in the records, so a change to the card design, or to
 * something a card shows that changed without a redraw, leaves them out of date. One example is a
 * series that isn't ongoing, whose card counts its parts, when another part is published. **Check**
 * redraws each card:
 *   - every published post's (site.standard.document)
 *   - every series' (id.skiddle.series)
 *   - every scheduled draft's (id.skiddle.draft with publishAt), which the scheduler publishes
 * It compares each new card with the stored one by CID (the hash of the bytes; drawing is
 * deterministic, so an unchanged card comes out byte for byte the same). Nothing is uploaded.
 * **Save** uploads the new cards and saves just their records' coverImage, with swapRecord, so
 * nothing else changes: a post's "updated" date stays. Bluesky posts keep the card they were
 * announced with. Save follows PUBLISHING_LIVE (src/lib/admin/launch.ts).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { DOCUMENT_COLLECTION, DRAFT_COLLECTION, POST_TYPE, SERIES_COLLECTION } from '~/lib/post-record.mjs';
import { DID, PUBLICATION_URI } from '~/lib/standard-site.mjs';
import { cardPostOf, cardSeriesOf, type CardPost, type CardSeries, type PostLike } from './card-text';
import { el, errorText, item, message, revalidate } from './dom';
import { NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { XrpcError, listRecords, putRecord, uploadBlob, type BlobRef, type RepoRecord } from './xrpc';

type CardRecord = PostLike & {
  site?: string;
  publishedAt?: string;
  content?: { $type?: string; markdown?: string; series?: { series?: string; part?: number } };
  name?: string;
  ongoing?: boolean;
  cadence?: string;
  planned?: { part: number }[];
  coverImage?: BlobRef;
  [key: string]: unknown;
};

interface Card {
  label: 'Post' | 'Series' | 'Scheduled';
  collection: string;
  rkey: string;
  /** The record's CID, for swapRecord */
  cid: string;
  value: CardRecord;
  title: string;
  /** Where it opens in the admin app */
  href: string;
  draw: { post: CardPost } | { series: CardSeries };
  png?: Blob;
  /** The new card's CID */
  next?: string;
  state: 'same' | 'changed' | 'missing' | 'failed' | 'saved' | 'conflict';
  error?: string;
}

let session: OAuthSession;
let cards: Card[] = [];
let busy = false;
const previews: string[] = [];

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const toSave = () => cards.filter((c) => c.state === 'changed' || c.state === 'missing');

export function setupRedraw(s: OAuthSession) {
  session = s;
  el('cardsNotLive').textContent = NOT_LIVE_YET;
  el('cardsCheck').addEventListener('click', check);
  el('cardsSave').addEventListener('click', save);
}

/**
 * A blob's CID as the PDS gives it: CIDv1, raw codec, SHA-256, base32 (as scripts/lib/blob.mjs,
 * which uses Node's crypto)
 */
async function blobCid(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let out = 'b';
  for (const byte of [0x01, 0x55, 0x12, 0x20, ...digest]) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

/** Every stored card there should be, from the records as they are now */
async function loadCards(): Promise<Card[]> {
  const [docs, series, drafts] = await Promise.all([
    listRecords<CardRecord>(session, DOCUMENT_COLLECTION),
    listRecords<CardRecord>(session, SERIES_COLLECTION),
    listRecords<CardRecord>(session, DRAFT_COLLECTION).catch(() => [] as RepoRecord<CardRecord>[]),
  ]);
  const posts = docs.filter((d) => d.value.site === PUBLICATION_URI && d.value.content?.$type === POST_TYPE && d.value.path);
  const card = (r: RepoRecord<CardRecord>, rest: Pick<Card, 'label' | 'collection' | 'title' | 'href' | 'draw'>): Card => ({
    ...rest,
    rkey: rkeyOf(r.uri),
    cid: r.cid,
    value: r.value,
    state: 'same',
  });
  return [
    ...posts
      .sort((a, b) => (b.value.publishedAt ?? '').localeCompare(a.value.publishedAt ?? ''))
      .map((r) =>
        card(r, {
          label: 'Post',
          collection: DOCUMENT_COLLECTION,
          title: r.value.title || r.value.path!,
          href: `#post/${rkeyOf(r.uri)}`,
          draw: { post: cardPostOf(r.value, r.value.publishedAt) },
        }),
      ),
    ...series
      .sort((a, b) => (a.value.name ?? '').localeCompare(b.value.name ?? ''))
      .map((r) => {
        const key = rkeyOf(r.uri);
        const uri = `at://${DID}/${SERIES_COLLECTION}/${key}`;
        const published = posts.filter((p) => p.value.content?.series?.series === uri && p.value.content.series.part).map((p) => p.value.content!.series!.part!);
        return card(r, { label: 'Series', collection: SERIES_COLLECTION, title: r.value.name || key, href: `#series/${key}`, draw: { series: cardSeriesOf(key, r.value, published) } });
      }),
    ...drafts
      .filter((r) => r.value.publishAt)
      .map((r) =>
        card(r, {
          label: 'Scheduled',
          collection: DRAFT_COLLECTION,
          title: r.value.title || 'Untitled',
          href: `#draft/${rkeyOf(r.uri)}`,
          draw: { post: cardPostOf(r.value) },
        }),
      ),
  ];
}

/** Redraws every card and compares it with the stored one. Writes nothing. */
async function check() {
  if (busy) return;
  busy = true;
  const button = el<HTMLButtonElement>('cardsCheck');
  button.disabled = true;
  el('cardsSave').hidden = true;
  el('cardsNotLive').hidden = true;
  message('cardsMessage', 'Loading the records…');
  try {
    cards = await loadCards();
    message('cardsMessage', 'Loading the card drawing…');
    const { drawPostCard, drawSeriesCard } = await import('./card');
    for (const [i, c] of cards.entries()) {
      message('cardsMessage', `Drawing ${i + 1} of ${cards.length}…`);
      try {
        c.png = 'post' in c.draw ? await drawPostCard(c.draw.post) : await drawSeriesCard(c.draw.series);
        c.next = await blobCid(c.png);
        const stored = c.value.coverImage?.ref?.$link;
        c.state = !stored ? 'missing' : stored === c.next ? 'same' : 'changed';
      } catch (err) {
        c.state = 'failed';
        c.error = errorText(err);
      }
    }
    render();
  } catch (err) {
    message('cardsMessage', `Couldn’t check the cards: ${errorText(err)}`, 'error');
  } finally {
    busy = false;
    button.disabled = false;
  }
}

/** Uploads each new card and saves its record's coverImage, one at a time */
async function save() {
  const list = toSave();
  if (busy || !PUBLISHING_LIVE || !list.length) return;
  const n = list.length;
  if (!confirm(`Save ${n} new share ${n === 1 ? 'card' : 'cards'}? Only the card changes: dates and everything else stay.`)) return;
  busy = true;
  const button = el<HTMLButtonElement>('cardsSave');
  button.disabled = true;
  el<HTMLButtonElement>('cardsCheck').disabled = true;
  let live = false;
  try {
    for (const [i, c] of list.entries()) {
      message('cardsMessage', `Saving ${i + 1} of ${n}: ${c.title}…`);
      try {
        const coverImage = await uploadBlob(session, c.png!);
        const value = { ...c.value, coverImage };
        const res = await putRecord(session, c.collection, c.rkey, value, c.cid);
        Object.assign(c, { cid: res.cid, value, state: 'saved' });
        if (c.label !== 'Scheduled') live = true;
      } catch (err) {
        if (err instanceof XrpcError && err.error === 'InvalidSwap') c.state = 'conflict';
        else Object.assign(c, { state: 'failed', error: errorText(err) });
      }
    }
    if (live) await revalidate();
  } finally {
    busy = false;
    el<HTMLButtonElement>('cardsCheck').disabled = false;
    render();
  }
}

const NOTES: Record<Card['state'], string> = {
  same: 'up to date',
  changed: 'changed',
  missing: 'no card yet',
  failed: 'couldn’t draw or save it',
  saved: 'saved',
  conflict: 'changed elsewhere while saving: check again',
};

function render() {
  for (const url of previews.splice(0)) URL.revokeObjectURL(url);
  const list = el('cardsList');
  list.textContent = '';
  const shown = cards.filter((c) => c.state !== 'same');
  for (const c of shown) {
    const li = item('', 'admin-card-row');
    const text = document.createElement('div');
    const link = document.createElement('a');
    link.href = c.href;
    link.textContent = c.title;
    const note = document.createElement('span');
    note.className = 'admin-muted';
    note.textContent = `${c.label} · ${NOTES[c.state]}${c.error ? `: ${c.error}` : ''}`;
    text.appendChild(link);
    text.appendChild(note);
    li.appendChild(text);
    if (c.png && (c.state === 'changed' || c.state === 'missing' || c.state === 'saved')) {
      const img = document.createElement('img');
      const url = URL.createObjectURL(c.png);
      previews.push(url);
      img.src = url;
      img.width = 160;
      img.height = 84;
      img.alt = `The new share card for “${c.title}”`;
      li.appendChild(img);
    }
    list.appendChild(li);
  }

  const same = cards.filter((c) => c.state === 'same').length;
  const pending = toSave().length;
  const failed = cards.filter((c) => c.state === 'failed' || c.state === 'conflict').length;
  const saved = cards.filter((c) => c.state === 'saved').length;
  const parts = [`${same} up to date`];
  if (pending) parts.push(`${pending} to save`);
  if (saved) parts.push(`${saved} saved`);
  if (failed) parts.push(`${failed} with a problem`);
  message('cardsMessage', `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} checked: ${parts.join(', ')}.`, failed ? 'error' : pending ? 'info' : 'ok');

  const button = el<HTMLButtonElement>('cardsSave');
  button.hidden = !pending;
  button.textContent = `Save ${pending} new ${pending === 1 ? 'card' : 'cards'}`;
  button.disabled = !PUBLISHING_LIVE;
  el('cardsNotLive').hidden = !pending || PUBLISHING_LIVE;
}
