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
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { renderCard } from '~/lib/lastfm-card';

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
    // track stays null: the card shows "nothing playing"
    console.error('lastfm.svg:', err);
  }

  const svg = renderCard(
    track && { name: track.name, artist: track.artist, album: track.album, isCurrent: track.isCurrent, playedAt: track.playedAt, art },
    { theme, accent },
  );

  // Embeds revalidate on every view (no-cache + ETag); Last.fm data is cached for 30s server-side
  return svgResponse(request, svg);
};
