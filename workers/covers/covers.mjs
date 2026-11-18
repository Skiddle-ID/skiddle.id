/**
 * What the covers Worker (index.mjs) answers, with Deezer passed in, so the tests can run it
 * (covers.test.mjs).
 *
 *   GET /deezer/search?q=…  Deezer's search results for q, trimmed to what the site's matcher uses:
 *                           { data: [{ title, artist: { name }, album: { cover_medium } }], where }
 *   GET /where              where it runs: { colo, country, open }
 *
 * `where` is the Cloudflare data center it runs in (placement should make that one near Singapore,
 * e.g. "SIN"), and the country Deezer sees from there and whether Deezer is open in it. Cloudflare's
 * cf-placement header would say this, but it isn't set on calls through a service binding.
 */

/** Deezer's search returns this many; the site's matcher looks at all of them */
export const SEARCH_LIMIT = 5;
const MAX_QUERY = 200;

/** @typedef {{ colo: string, country: string, open: boolean }} Where */

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
 * Where it runs, from Cloudflare's /cdn-cgi/trace (its `colo=` line) and Deezer's /infos
 * @param {string} trace
 * @param {unknown} infos
 * @returns {Where}
 */
export function whereFrom(trace, infos) {
  const i = /** @type {{ country_iso?: unknown, open?: unknown } | null} */ (infos);
  return {
    colo: /^colo=([A-Z0-9]+)$/m.exec(trace)?.[1] ?? '',
    country: typeof i?.country_iso === 'string' ? i.country_iso : '',
    open: i?.open === true,
  };
}

/** "SIN, Deezer SG (open)", for the logs */
const describe = (/** @type {Where} */ w) => `${w.colo || '?'}, Deezer ${w.country || '?'} (${w.open ? 'open' : 'not open'})`;

/**
 * @param {Request} request
 * @param {object} io
 * @param {(url: string) => Promise<Response>} io.deezer Fetches a Deezer API address
 * @param {() => Promise<Where>} io.where Where it runs
 * @param {(line: string) => void} [io.log] Where it says what it did (the Worker's logs)
 * @returns {Promise<Response>}
 */
export async function handle(request, { deezer, where, log = () => {} }) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  if (url.pathname === '/deezer/search') {
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
    if (!q) return json({ error: 'q is required' }, 400);
    const [res, at] = await Promise.all([deezer(`https://api.deezer.com/search?${new URLSearchParams({ q, limit: String(SEARCH_LIMIT) })}`), where()]);
    if (!res.ok) {
      log(`search "${q}": Deezer answered ${res.status} (${describe(at)})`);
      return json({ error: `Deezer answered ${res.status}`, where: at }, 502);
    }
    const body = /** @type {{ data?: unknown, error?: unknown }} */ (await res.json());
    // Deezer answers its own errors (a quota, say) with 200 and { error }
    if (body?.error) {
      log(`search "${q}": Deezer answered ${JSON.stringify(body.error)} (${describe(at)})`);
      return json({ error: 'Deezer answered with an error', where: at }, 502);
    }
    const data = trimResults(body?.data);
    log(`search "${q}": ${data.length} result${data.length === 1 ? '' : 's'} (${describe(at)})`);
    return json({ data, where: at });
  }
  if (url.pathname === '/where') return json(await where());
  return json({ error: 'Not found' }, 404);
}

function json(/** @type {unknown} */ body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
