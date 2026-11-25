import type { APIContext } from 'astro';
import { feedSkeleton } from '~/lib/bluesky-feed.mjs';
import { groupSeries } from '~/lib/posts';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

export const prerender = false;

/**
 * app.bsky.feed.getFeedSkeleton: a page of a series' Bluesky feed, the Bluesky posts that announce
 * its parts (src/lib/bluesky-feed.mjs). The feed is public, so the Authorization header Bluesky
 * sends is ignored. Rendered from the posts on the PDS and cached like /rss.xml.
 */
export const GET = async (context: APIContext) => {
  const { posts, seriesInfo } = await sitePosts();
  const feeds = new Map(
    groupSeries(posts, seriesInfo).map((s) => [s.slug, s.parts.flatMap((p) => (p.data.bluesky ? [{ post: p.data.bluesky, at: p.data.pubDate.valueOf() }] : []))]),
  );
  const res = feedSkeleton(context.url.searchParams, feeds);
  if (res.status === 200) context.cache.set(POSTS_CACHE);
  return new Response(JSON.stringify(res.body), {
    status: res.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(res.status === 200 ? {} : { 'Cache-Control': 'no-store' }) },
  });
};
