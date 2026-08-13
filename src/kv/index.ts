import type { WhtwndBlogEntryView } from "src/types";
import { env } from "cloudflare:workers";

export const getCachedPosts = async (_context?: App.Locals) => {
  const res = await env.CACHE.get('post:all', 'json');
  if (!res) {
    return null;
  }
  return res as WhtwndBlogEntryView[];
};

export const setCachedPosts = async (_context: App.Locals, posts: WhtwndBlogEntryView[]) => {
  await env.CACHE.put(
    'post:all',
    JSON.stringify(posts),
    { expirationTtl: 60 },
  );
};

export const getCachedPost = async (_context: App.Locals, rkey: string) => {
  const res = await env.CACHE.get(`post:${rkey}`, 'json');
  if (!res) {
    return null;
  }
  return res as WhtwndBlogEntryView;
};

export const setCachedPost = async (_context: App.Locals, post: WhtwndBlogEntryView) => {
  await env.CACHE.put(
    `post:${post.rkey}`,
    JSON.stringify(post),
    { expirationTtl: 60 * 10 },
  );
};