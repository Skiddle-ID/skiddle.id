/*
  /bluesky.svg: a card with the newest post on Bluesky by @skiddle.blue, made for embedding (GitHub
  profile README, other sites):

    <a href="https://bsky.app/profile/skiddle.blue">
      <img src="https://skiddle.id/bluesky.svg" alt="Latest post on Bluesky" width="540">
    </a>

  Optional query params, as for /music.svg:
    - theme:  auto (default, follows the viewer's light/dark setting) | dark | light
    - accent: blue (default) | teal | purple | pink | green

  The post is read from Bluesky's public AppView (no key) and cached for 60 seconds
  (src/lib/pds.ts). Reposts and replies are skipped (src/lib/bluesky-post.ts). If the AppView can't
  be read, the card points to the profile instead of showing a broken image.
*/
import type { APIRoute } from 'astro';
import { renderBlueskyCard } from '~/lib/bluesky-card';
import { newestOwnPost, type BlueskyPost } from '~/lib/bluesky-post';
import { ACCENTS, THEMES, pick, svgResponse, type CardAccent, type CardTheme } from '~/lib/embed-card';
import { cached } from '~/lib/pds';
import { DID } from '~/lib/standard-site.mjs';

export const prerender = false;

const FEED = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${new URLSearchParams({ actor: DID, filter: 'posts_no_replies', limit: '10' })}`;

function newestPost(): Promise<BlueskyPost | null> {
  return cached('bsky/newest-post', 60, async () => {
    const res = await fetch(FEED, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`getAuthorFeed ${res.status}`);
    return newestOwnPost(await res.json(), DID);
  });
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const theme = pick<CardTheme>(url.searchParams.get('theme'), THEMES, 'auto');
  const accent = pick<CardAccent>(url.searchParams.get('accent'), ACCENTS, 'blue');

  let post: BlueskyPost | null = null;
  try {
    post = await newestPost();
  } catch (err) {
    console.error('bluesky.svg: public.api.bsky.app:', String(err));
  }
  return svgResponse(request, renderBlueskyCard(post, { theme, accent }));
};
