import type { APIContext } from 'astro';
import { postsFeed } from '~/lib/feed';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

export const prerender = false;

/** Items in the feed, newest first: enough for any feed reader, and a cap on the work per request */
const MAX_ITEMS = 20;

/**
 * Every post, in full (src/lib/feed.ts). Rendered on request from the posts on the PDS and
 * cached; drafts are left out.
 */
export const GET = async (context: APIContext) => {
  context.cache.set(POSTS_CACHE);
  const posts = (await sitePosts()).posts.slice(0, MAX_ITEMS);
  const handle = 'skiddle.blue';
  let displayName = 'Skiddle';
  try {
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`);
    if (res.ok) {
      const data = (await res.json()) as { displayName?: string };
      if (data?.displayName) displayName = data.displayName;
    }
  } catch {}

  return postsFeed(context, { title: `${displayName}'s Blog`, description: 'Personal blog and writings', self: '/rss.xml', posts });
};
