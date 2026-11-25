import type { APIContext } from 'astro';
import { describeFeeds } from '~/lib/bluesky-feed.mjs';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

export const prerender = false;

/** app.bsky.feed.describeFeedGenerator: the series' Bluesky feeds Jeff has published (src/lib/bluesky-feed.mjs) */
export const GET = async (context: APIContext) => {
  const { seriesInfo } = await sitePosts();
  context.cache.set(POSTS_CACHE);
  const keys = Object.values(seriesInfo).flatMap((s) => (s.blueskyFeed && s.key ? [s.key] : []));
  return new Response(JSON.stringify(describeFeeds(keys)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
