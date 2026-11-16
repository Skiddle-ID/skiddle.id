/*
  /latest.svg: a card with the newest post, made for embedding (GitHub profile README, other sites):

    <a href="https://skiddle.id/posts/">
      <img src="https://skiddle.id/latest.svg" alt="Latest post on skiddle.id" width="540">
    </a>

  Optional query params, as for /lastfm.svg:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  The post comes from /latest.json, built with the site, so the card changes with each deploy. If it
  can't be read, the card links to the writing instead of showing a broken image.
*/
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { renderLatestCard, type LatestPost } from '~/lib/latest-card';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let post: LatestPost | null = null;
  try {
    const res = await env.ASSETS.fetch(new URL('/latest.json', url));
    if (res.ok) post = (await res.json()) as LatestPost | null;
  } catch (err) {
    console.error('latest.svg:', err);
  }
  return svgResponse(request, renderLatestCard(post, { theme, accent }));
};
