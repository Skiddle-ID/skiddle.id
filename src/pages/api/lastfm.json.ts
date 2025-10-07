/*
  Astro API Route: /api/lastfm.json
  Returns recent track information from Last.fm without exposing the API key.
  Environment variables (in Cloudflare Workers via locals.runtime.env):
    - LASTFM_USERNAME
    - LASTFM_API_KEY

  Optional query params:
    - user: override username
    - limit: number of tracks to fetch (default 1, max 5)
*/
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const env = (locals as any)?.runtime?.env as Env | undefined;
    const username = url.searchParams.get('user') || env?.LASTFM_USERNAME || '';
    const apiKey = env?.LASTFM_API_KEY || '';

    const limitParam = Number(url.searchParams.get('limit') || '1');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(5, limitParam)) : 1;

    if (!username || !apiKey) {
      return jsonResponse({ error: 'Missing LASTFM_USERNAME or LASTFM_API_KEY env' }, 400);
    }

    const endpoint = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
      username
    )}&api_key=${apiKey}&limit=${limit}&format=json`;

    const res = await fetch(endpoint, { headers: { 'User-Agent': 'Astro-LastFM-JSON' } });
    if (!res.ok) {
      return jsonResponse({ error: `Last.fm API error ${res.status}` }, 502);
    }

    const data: any = await res.json();
    const t = data?.recenttracks?.track?.[0];

    const payload = t
      ? {
          username,
          name: t?.name || 'Unknown Track',
          artist: t?.artist?.['#text'] || 'Unknown Artist',
          album: t?.album?.['#text'] || '',
          imageUrl: Array.isArray(t?.image) && t.image.length > 0 ? t.image[t.image.length - 1]?.['#text'] || '' : '',
          isCurrent: Boolean(t?.['@attr']?.nowplaying),
          trackUrl: t?.url || `https://www.last.fm/user/${username}`,
          artistUrl: `https://www.last.fm/music/${encodeURIComponent(t?.artist?.['#text'] || '')}`,
        }
      : null;

    return jsonResponse({ track: payload }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Unexpected error fetching Last.fm data' }, 500);
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Edge cache for 30s; allow stale for 60s to smooth spikes
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
