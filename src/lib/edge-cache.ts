/**
 * The cache behind src/lib/pds.ts and the pages' own reads: a value is cached in two places
 *   - in memory, per Worker isolate, so one page render that needs a key twice loads it once
 *   - Cloudflare's edge cache (caches.default), shared by the isolates in a data centre, for values
 *     kept EDGE_MIN_TTL or longer. It does nothing on *.workers.dev (staging and previews), only on
 *     skiddle.id.
 *
 * A load that's still running is shared by every request that asks for its key. But a load belongs
 * to the request that started it: if that request is cut off (the visitor left), its fetch is
 * cancelled and the load may never settle. So a waiting request gives up on it after PENDING_MS and
 * loads the key itself, and a running load older than that is never handed out at all. Only a
 * finished value is kept for the whole TTL.
 */

/**
 * How long a request waits on a load another request started, in ms: past a single fetch's own
 * timeout (4 s for the PDS). A slow load that chains fetches and runs longer isn't an error: the
 * waiting request just loads the key a second time.
 */
export const PENDING_MS = 8000;
/**
 * The shortest TTL, in seconds, worth keeping at the edge: a value kept for less (a record, a minute)
 * stays in memory only. An edge read and write are two of the 50 subrequests a request may make on
 * the free plan, and a page rendered with every record expired would otherwise make more than 50
 * (the home page made 54: 22 fetches, 16 edge reads, 16 edge writes).
 */
export const EDGE_MIN_TTL = 300;
/** Edge cache keys live under this made-up origin; nothing is ever fetched from it */
const CACHE_ORIGIN = 'https://pds-cache.skiddle.id';

const edgeCache = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
const edgeKey = (key: string) => new Request(`${CACHE_ORIGIN}/${encodeURIComponent(key)}`);

/** Finished values, kept until `until` */
const values = new Map<string, { until: number; value: unknown }>();
/** Loads still running, from `since` */
const running = new Map<string, { since: number; value: Promise<unknown> }>();

const GAVE_UP = Symbol('gave up');

/** `load()`'s result, cached in memory and at the edge for `ttl` seconds under `key`; a ttl of 0 loads it every time */
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  if (ttl <= 0) return load();
  const now = Date.now();
  const hit = values.get(key);
  if (hit && hit.until > now) return hit.value as T;

  const other = running.get(key);
  if (other && now - other.since < PENDING_MS) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gaveUp = new Promise<typeof GAVE_UP>((resolve) => (timer = setTimeout(resolve, PENDING_MS - (now - other.since), GAVE_UP)));
    try {
      // A failure is passed on, as if this request had loaded it
      const result = await Promise.race([other.value, gaveUp]);
      if (result !== GAVE_UP) return result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  const since = Date.now();
  const value = (async () => {
    const cache = ttl >= EDGE_MIN_TTL ? edgeCache() : undefined;
    const stored = await cache?.match(edgeKey(key)).catch(() => undefined);
    if (stored) return (await stored.json()) as T;
    const fresh = await load();
    await cache
      ?.put(edgeKey(key), new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` } }))
      .catch(() => {});
    return fresh;
  })();
  running.set(key, { since, value });
  const mine = () => running.get(key)?.value === value;
  value.then(
    (result) => {
      if (!mine()) return; // forgotten, or replaced by a newer load, in the meantime
      running.delete(key);
      values.set(key, { until: since + ttl * 1000, value: result });
    },
    // A failed load isn't kept, so the next request tries again
    () => {
      if (mine()) running.delete(key);
    },
  );
  return value;
}

/** The last value each cachedOrLast() key loaded, in this isolate */
const lastValues = new Map<string, unknown>();

/**
 * cached(), for a source that can fail for a while (a rate limit): each value loaded is also kept as
 * the key's last good value, for `keep` seconds, in memory and at the edge. A load that fails gives
 * that instead, cached for the TTL like a fresh one, so the source isn't asked again until then.
 * With no last good value, the failure is passed on and nothing is cached.
 */
export function cachedOrLast<T>(key: string, ttl: number, keep: number, load: () => Promise<T>): Promise<T> {
  const last = `${key}/last`;
  return cached(key, ttl, async () => {
    try {
      const fresh = await load();
      lastValues.set(last, fresh);
      await edgeCache()
        ?.put(edgeKey(last), new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${keep}` } }))
        .catch(() => {});
      return fresh;
    } catch (err) {
      const kept = lastValues.has(last) ? lastValues.get(last) : await edgeCache()?.match(edgeKey(last)).then((res) => res?.json()).catch(() => undefined);
      if (kept === undefined) throw err;
      return kept as T;
    }
  });
}

/** Forgets cached values, e.g. after a save, so the next read loads them again */
export async function forget(keys: string[]): Promise<void> {
  const cache = edgeCache();
  await Promise.all(
    keys.map((key) => {
      values.delete(key);
      running.delete(key);
      return cache?.delete(edgeKey(key)).catch(() => false);
    }),
  );
}
