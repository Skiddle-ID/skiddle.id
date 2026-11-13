/*
  /lastfm.svg: "now playing" card for Last.fm, made for embedding
  (GitHub profile README, other profile pages):

    <a href="https://www.last.fm/user/arcestia">
      <img src="https://skiddle.id/lastfm.svg" alt="Last.fm: now playing" width="540">
    </a>

  Optional query params:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  Always shows the configured account (LASTFM_USERNAME). On any error it
  still returns 200 with a "nothing playing" card, so embeds never show a
  broken image.
*/
import type { APIRoute } from 'astro';
import { getAlbumArt, getRecentTrack, type LastfmTrack } from '~/lib/lastfm';
import { ACCENTS, THEMES, renderCard, type CardAccent, type CardTheme } from '~/lib/lastfm-card';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let track: LastfmTrack | null = null;
  let art: string | undefined;
  try {
    track = await getRecentTrack(url.origin);
    if (track?.imageUrl) art = await getAlbumArt(url.origin, track.imageUrl);
  } catch (err) {
    console.error('lastfm.svg:', err);
    track = null;
  }

  const svg = renderCard(
    track && { name: track.name, artist: track.artist, album: track.album, isCurrent: track.isCurrent, playedAt: track.playedAt, art },
    { theme, accent },
  );

  const etag = `"${await digest(svg)}"`;
  const headers = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    // Embeds (e.g. GitHub's image proxy) revalidate on every view; Last.fm data is cached for 30s server-side
    'Cache-Control': 'no-cache, max-age=0',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  };
  const ifNoneMatch = request.headers.get('If-None-Match') ?? '';
  if (ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(svg, { status: 200, headers });
};

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  const v = (value ?? '').toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}
