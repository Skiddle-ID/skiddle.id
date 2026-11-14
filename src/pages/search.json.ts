import type { APIRoute } from 'astro';
import { getPosts, postUrl } from '~/lib/posts';
import { plainText } from '~/lib/plain-text.mjs';

// The command bar's search data (src/components/command-bar.astro). Built with the site and
// only downloaded the first time someone opens the command bar. Drafts are left out.
export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getPosts();
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
