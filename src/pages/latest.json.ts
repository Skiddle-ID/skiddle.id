/*
  /latest.json: the newest post, rendered on request from the posts on the PDS and cached. The
  /latest.svg card shows the same post, and anything else can use it too (a profile README script,
  a status page, …).
*/
import type { APIRoute } from 'astro';
import { POSTS_CACHE, latestPost, sitePosts } from '~/lib/site-posts';

export const prerender = false;

export const GET: APIRoute = async ({ site, cache }) => {
  const latest = latestPost(await sitePosts(), site ?? 'https://skiddle.id');
  cache.set(POSTS_CACHE);
  return new Response(JSON.stringify(latest, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
