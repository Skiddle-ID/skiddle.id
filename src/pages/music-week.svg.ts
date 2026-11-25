/*
  /music-week.svg: this week's top artists and tracks from teal.fm's plays in Jeff's AT Protocol
  repo, made for embedding (GitHub profile README, other sites):

    <a href="https://skiddle.id/listening/">
      <img src="https://skiddle.id/music-week.svg" alt="This week's top music on teal.fm" width="540">
    </a>

  Optional query params, as for /music.svg:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  The numbers are /listening/'s (weekPlays() in src/lib/listening.ts, weekSummary() in
  src/lib/teal.mjs), cached for 10 minutes. If the plays can't be read, the card points to
  /listening/ instead of showing a broken image.
*/
import type { APIRoute } from 'astro';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { weekPlays } from '~/lib/listening';
import { renderMusicWeekCard, type WeekTop } from '~/lib/music-week-card';
import { cached } from '~/lib/pds';
import { weekSummary } from '~/lib/teal.mjs';

export const prerender = false;

const TOP = 3;
const TTL = 600;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let week: WeekTop | null = null;
  try {
    week = await cached('teal/week-top', TTL, async () => {
      const now = Date.now();
      return weekSummary(await weekPlays(now), now, TOP);
    });
  } catch (err) {
    console.error('music-week.svg: plays:', String(err));
  }
  // Embeds revalidate on every view (no-cache + ETag) and get a 304 until the numbers change
  return svgResponse(request, renderMusicWeekCard(week, { theme, accent }));
};
