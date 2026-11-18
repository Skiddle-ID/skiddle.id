/**
 * What the covers Worker (index.mjs) answers, with Deezer passed in, so the tests can run it
 * (covers.test.mjs).
 *
 *   GET /deezer/search?q=…  Deezer's search results for q, trimmed to what the site's matcher uses:
 *                           { data: [{ title, artist: { name }, album: { cover_medium } }], placement }
 *   GET /where              where it ran, and the country Deezer sees: { placement, deezer: { country, open } }
 *
 * `placement` is Cloudflare's cf-placement header: "remote-SIN" when placement sent the request to
 * a data center near Singapore, "local-HKG" when it ran where it was called from.
 */

/** Deezer's search returns this many; the site's matcher looks at all of them */
export const SEARCH_LIMIT = 5;
const MAX_QUERY = 200;

/**
 * Deezer's search results, as strings only, with nothing the site doesn't use
 * @param {unknown} data The `data` array of Deezer's search response
 * @returns {{ title: string, artist: { name: string }, album: { cover_medium: string } }[]}
 */
export function trimResults(data) {
  const text = (/** @type {unknown} */ v) => (typeof v === 'string' ? v : '');
  return (Array.isArray(data) ? data : []).slice(0, SEARCH_LIMIT).map((r) => ({
    title: text(r?.title),
    artist: { name: text(r?.artist?.name) },
    album: { cover_medium: text(r?.album?.cover_medium) },
  }));
}

/**
 * @param {Request} request
 * @param {(url: string) => Promise<Response>} deezer Fetches a Deezer API address
 * @param {(line: string) => void} [log] Where it says what it did (the Worker's logs)
 * @returns {Promise<Response>}
 */
export async function handle(request, deezer, log = () => {}) {
  const url = new URL(request.url);
  const placement = request.headers.get('cf-placement') ?? '';
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  if (url.pathname === '/deezer/search') {
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
    if (!q) return json({ error: 'q is required' }, 400);
    const res = await deezer(`https://api.deezer.com/search?${new URLSearchParams({ q, limit: String(SEARCH_LIMIT) })}`);
    if (!res.ok) {
      log(`search "${q}": Deezer answered ${res.status} (${placement || 'no placement'})`);
      return json({ error: `Deezer answered ${res.status}`, placement }, 502);
    }
    const body = /** @type {{ data?: unknown, error?: unknown }} */ (await res.json());
    // Deezer answers its own errors (a quota, say) with 200 and { error }
    if (body?.error) {
      log(`search "${q}": Deezer answered ${JSON.stringify(body.error)} (${placement || 'no placement'})`);
      return json({ error: 'Deezer answered with an error', placement }, 502);
    }
    const data = trimResults(body?.data);
    log(`search "${q}": ${data.length} result${data.length === 1 ? '' : 's'} (${placement || 'no placement'})`);
    return json({ data, placement });
  }
  if (url.pathname === '/where') {
    const res = await deezer('https://api.deezer.com/infos');
    const info = /** @type {{ country_iso?: unknown, open?: unknown }} */ (res.ok ? await res.json() : {});
    return json({ placement, deezer: { country: typeof info.country_iso === 'string' ? info.country_iso : null, open: info.open === true } });
  }
  return json({ error: 'Not found' }, 404);
}

function json(/** @type {unknown} */ body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
