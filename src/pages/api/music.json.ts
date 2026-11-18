/*
  /api/music.json: the track playing now (or the last one played) for the sidebar's "now playing",
  from teal.fm's records in Jeff's AT Protocol repo (src/lib/music.ts), cached for 30 seconds.
  /api/lastfm.json, its old address, serves the same.
*/
import type { APIRoute } from 'astro';
import { getRecentTrack } from '~/lib/music';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return jsonResponse({ track: await getRecentTrack() }, 200);
  } catch (err) {
    console.error('music.json:', err);
    return jsonResponse({ error: 'Music is unavailable right now' }, 502);
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
