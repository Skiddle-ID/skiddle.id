/**
 * Reading Jeff's AT Protocol repo from the Worker: the status (src/lib/at-status.ts), posts and
 * series (src/lib/pds-posts.ts), the pages' content (src/lib/page-content.ts), music from teal.fm
 * (src/lib/music.ts), and images (/media/<cid>).
 *
 * The PDS is found from the DID on each read, cached for an hour, so a move to another PDS just
 * works. Records are cached briefly in two places:
 *   - in memory, per Worker isolate, so one page render that needs a collection twice fetches it once
 *   - Cloudflare's edge cache (caches.default), shared by the isolates in a data centre. It does
 *     nothing on *.workers.dev (staging and previews), only on skiddle.id.
 */
import { DID } from '~/lib/standard-site.mjs';

type Fetch = typeof fetch;

/** How long records stay cached, in seconds */
export const RECORD_TTL = 60;
const PDS_TTL = 3600;
const TIMEOUT_MS = 4000;
/** Edge cache keys live under this made-up origin; nothing is ever fetched from it */
const CACHE_ORIGIN = 'https://pds-cache.skiddle.id';

export interface RepoRecord<T = Record<string, unknown>> {
  uri: string;
  cid: string;
  value: T;
}

const edgeCache = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
const memory = new Map<string, { until: number; value: Promise<unknown> }>();

/** `load()`'s result, cached in memory and at the edge for `ttl` seconds under `key` */
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.until > now) return hit.value as Promise<T>;
  const value = (async () => {
    const cache = edgeCache();
    const request = new Request(`${CACHE_ORIGIN}/${encodeURIComponent(key)}`);
    const stored = await cache?.match(request).catch(() => undefined);
    if (stored) return (await stored.json()) as T;
    const fresh = await load();
    await cache
      ?.put(request, new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` } }))
      .catch(() => {});
    return fresh;
  })();
  memory.set(key, { until: now + ttl * 1000, value });
  // A failed load isn't kept, so the next request tries again
  value.catch(() => memory.delete(key));
  return value;
}

/** Forgets cached records, e.g. after a save, so the next read fetches them again */
export async function forget(keys: string[]): Promise<void> {
  const cache = edgeCache();
  await Promise.all(
    keys.map((key) => {
      memory.delete(key);
      return cache?.delete(new Request(`${CACHE_ORIGIN}/${encodeURIComponent(key)}`)).catch(() => false);
    }),
  );
}

/** The PDS address from the DID document (did:plc via plc.directory, did:web via /.well-known/did.json) */
export function pdsUrl(fetcher: Fetch = fetch): Promise<string> {
  return cached('pds', PDS_TTL, async () => {
    const url = DID.startsWith('did:web:') ? `https://${DID.slice('did:web:'.length)}/.well-known/did.json` : `https://plc.directory/${DID}`;
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`DID document ${res.status}`);
    const doc = (await res.json()) as { service?: { id: string; serviceEndpoint?: string }[] };
    const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${DID}#atproto_pds`)?.serviceEndpoint;
    if (!pds) throw new Error(`No PDS in the DID document for ${DID}`);
    return pds.replace(/\/+$/, '');
  });
}

/** One record's value, or null if there's no such record */
export function getRecord<T>(collection: string, rkey: string, { ttl = RECORD_TTL, fetcher = fetch }: { ttl?: number; fetcher?: Fetch } = {}): Promise<T | null> {
  return cached(`record/${collection}/${rkey}`, ttl, async () => {
    const pds = await pdsUrl(fetcher);
    const res = await fetcher(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${collection}&rkey=${rkey}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 400 || res.status === 404) return null; // RecordNotFound
    if (!res.ok) throw new Error(`getRecord ${collection}/${rkey}: ${res.status}`);
    return (((await res.json()) as { value?: T }).value ?? null) as T | null;
  });
}

/** Every record in a collection */
export function listRecords<T>(collection: string, { ttl = RECORD_TTL, fetcher = fetch }: { ttl?: number; fetcher?: Fetch } = {}): Promise<RepoRecord<T>[]> {
  return cached(`list/${collection}`, ttl, async () => {
    const pds = await pdsUrl(fetcher);
    const out: RepoRecord<T>[] = [];
    let cursor = '';
    do {
      const res = await fetcher(
        `${pds}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${collection}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!res.ok) throw new Error(`listRecords ${collection}: ${res.status}`);
      const data = (await res.json()) as { records?: RepoRecord<T>[]; cursor?: string };
      out.push(...(data.records ?? []));
      cursor = data.records?.length ? (data.cursor ?? '') : '';
    } while (cursor);
    return out;
  });
}

/** The newest records in a collection, one page of them: for a collection too big to list in full, like teal.fm's plays */
export function latestRecords<T>(collection: string, limit: number, { ttl = RECORD_TTL, fetcher = fetch }: { ttl?: number; fetcher?: Fetch } = {}): Promise<RepoRecord<T>[]> {
  return cached(`latest/${collection}/${limit}`, ttl, async () => {
    const pds = await pdsUrl(fetcher);
    const res = await fetcher(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${collection}&limit=${limit}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`listRecords ${collection}: ${res.status}`);
    return ((await res.json()) as { records?: RepoRecord<T>[] }).records ?? [];
  });
}

/** One page of a collection's records, newest first, from `cursor` ('' for the newest), and the cursor of the next page */
export function recordsPage<T>(
  collection: string,
  limit: number,
  cursor: string,
  { ttl = RECORD_TTL, fetcher = fetch }: { ttl?: number; fetcher?: Fetch } = {},
): Promise<{ records: RepoRecord<T>[]; cursor?: string }> {
  return cached(`page/${collection}/${limit}/${cursor}`, ttl, async () => {
    const pds = await pdsUrl(fetcher);
    const res = await fetcher(
      `${pds}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${collection}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`listRecords ${collection}: ${res.status}`);
    const data = (await res.json()) as { records?: RepoRecord<T>[]; cursor?: string };
    return { records: data.records ?? [], ...(data.cursor && data.records?.length ? { cursor: data.cursor } : {}) };
  });
}

/** Where to download one of the repo's blobs (an image) */
export async function blobUrl(cid: string, fetcher: Fetch = fetch): Promise<string> {
  return `${await pdsUrl(fetcher)}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${cid}`;
}
