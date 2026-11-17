/*
  /latest.svg: a card with the newest post, made for embedding (GitHub profile README, other sites):

    <a href="https://skiddle.id/posts/">
      <img src="https://skiddle.id/latest.svg" alt="Latest post on skiddle.id" width="540">
    </a>

  Optional query params, as for /lastfm.svg:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  The post is the newest one on the PDS, the same as /latest.json (src/lib/site-posts.ts), so the card
  changes as soon as a post is published. If posts can't be read, the card links to the writing
  instead of showing a broken image.
*/
import type { APIRoute } from 'astro';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { renderLatestCard, type LatestPost } from '~/lib/latest-card';
import { latestPost, sitePosts } from '~/lib/site-posts';

export const prerender = false;

export const GET: APIRoute = async ({ request, site }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let post: LatestPost | null = null;
  try {
    post = latestPost(await sitePosts(), site ?? url.origin);
  } catch (err) {
    console.error('latest.svg:', err);
  }
  return svgResponse(request, renderLatestCard(post, { theme, accent }));
};
