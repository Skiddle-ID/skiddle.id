import type { APIRoute } from 'astro';
import { postUrl } from '~/lib/posts';
import { plainText } from '~/lib/plain-text.mjs';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

// The command bar's search data (src/components/command-bar.astro), only downloaded the first time
// someone opens the command bar. Rendered on request from the posts on the PDS and cached; drafts
// from git are included on previews only, like the post lists.
export const prerender = false;

export const GET: APIRoute = async ({ cache }) => {
  const { posts } = await sitePosts();
  cache.set(POSTS_CACHE);
  const index = posts.map((p) => ({
    title: p.data.title,
    url: postUrl(p),
    description: p.data.description ?? '',
    tags: p.data.tags,
    category: p.data.category,
    series: p.data.series ?? '',
    date: p.data.pubDate.toISOString(),
    text: plainText(p.body ?? ''),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
