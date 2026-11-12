/*
  /api/lastfm.json: the track playing now (or the last one scrobbled) for
  the sidebar's "Now Playing" card, without exposing the API key.

  Always uses the configured account (LASTFM_USERNAME). The response is
  cached server-side for 30 seconds (see src/lib/lastfm.ts).
*/
import type { APIRoute } from 'astro';
import { getRecentTrack } from '~/lib/lastfm';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const track = await getRecentTrack(new URL(request.url).origin);
    return jsonResponse({ track }, 200);
  } catch (err) {
    console.error('lastfm.json:', err);
    return jsonResponse({ error: 'Last.fm is unavailable right now' }, 502);
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
