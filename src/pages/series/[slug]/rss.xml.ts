import type { APIContext } from 'astro';
import { postsFeed } from '~/lib/feed';
import { groupSeries, seriesFeedUrl } from '~/lib/posts';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

export const prerender = false;

/** Items in the feed, newest first: every part of any series so far, and a cap on the work per request */
const MAX_ITEMS = 50;

/**
 * /series/<key>/rss.xml: one series' posts, in full (src/lib/feed.ts), unless its record turns
 * the feed off. Rendered on request from the posts on the PDS and cached like /rss.xml.
 */
export const GET = async (context: APIContext) => {
  const { posts, seriesInfo } = await sitePosts();
  const series = groupSeries(posts, seriesInfo).find((s) => s.slug === context.params.slug);
  if (!series?.feed) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  context.cache.set(POSTS_CACHE);
  return postsFeed(context, {
    title: `${series.name} · Skiddle`,
    description: series.description || `Posts in ${series.name}, a series on skiddle.id.`,
    self: seriesFeedUrl(series.slug),
    posts: [...series.parts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()).slice(0, MAX_ITEMS),
  });
};
