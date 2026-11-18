/*
  /music.svg: a "now playing" card from teal.fm's records in Jeff's AT Protocol repo
  (src/lib/music.ts), made for embedding (GitHub profile README, other profile pages):

    <img src="https://skiddle.id/music.svg" alt="Now playing on teal.fm" width="540">

  Optional query params:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  /lastfm.svg, its old address from the Last.fm days, serves the same card. On any error it still
  returns 200 with a "nothing playing" card, so embeds never show a broken image.
*/
import type { APIRoute } from 'astro';
import { getAlbumArt, getRecentTrack, type Track } from '~/lib/music';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { renderCard } from '~/lib/music-card';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let track: Track | null = null;
  let art: string | undefined;
  try {
    track = await getRecentTrack();
    if (track?.trackUrl) art = await getAlbumArt(track.trackUrl);
  } catch (err) {
    // track stays null: the card shows "nothing playing"
    console.error('music.svg:', err);
  }

  const svg = renderCard(
    track && { name: track.name, artist: track.artist, album: track.album, isCurrent: track.isCurrent, playedAt: track.playedAt, art },
    { theme, accent },
  );

  // Embeds revalidate on every view (no-cache + ETag); the records are cached for 30s server-side
  return svgResponse(request, svg);
};
