/*
  /status.svg: "● open to consulting · Bangkok 14:32", made for a GitHub profile README, an email
  signature or a link in a bio:

    <a href="https://skiddle.id/services/">
      <img src="https://skiddle.id/status.svg" alt="Open to consulting" height="28">
    </a>

  Optional query params: theme (auto | dark | light) and accent (blue | teal | purple | pink | green).
  The status is in src/data/status.ts; the time is the local time when the badge loads (an image
  proxy, like GitHub's, may show it a little late).
*/
import type { APIRoute } from 'astro';
import { status } from '~/data/status';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { renderStatusBadge } from '~/lib/status-badge';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');
  return svgResponse(request, renderStatusBadge(status, { theme, accent }));
};
