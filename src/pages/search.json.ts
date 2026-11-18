import type { APIRoute } from 'astro';
import { categoryLabel } from '~/lib/categories.mjs';
import { categoryUrl, groupSeries, postUrl, seriesStatus, seriesUrl } from '~/lib/posts';
import { plainText } from '~/lib/plain-text.mjs';
import { getCategories, withUsed } from '~/lib/site-categories';
import { POSTS_CACHE, sitePosts } from '~/lib/site-posts';

// The command bar's search data (src/components/command-bar.astro), only downloaded the first time
// someone opens the command bar: every post, every series and every category with posts, from the
// records on the PDS. Rendered on request and cached with the posts.
export const prerender = false;

export const GET: APIRoute = async ({ cache }) => {
  const [{ posts, seriesInfo }, list] = await Promise.all([sitePosts(), getCategories()]);
  cache.set(POSTS_CACHE);
  const categories = withUsed(list, posts);
  const index = {
    posts: posts.map((p) => ({
      title: p.data.title,
      url: postUrl(p),
      description: p.data.description ?? '',
      tags: p.data.tags,
      category: categoryLabel(categories, p.data.category),
      series: p.data.series ?? '',
      date: p.data.pubDate.toISOString(),
      text: plainText(p.body ?? ''),
    })),
    series: groupSeries(posts, seriesInfo).map((s) => ({
      name: s.name,
      url: seriesUrl(s.slug),
      description: s.description ?? '',
      status: seriesStatus(s),
    })),
    categories: categories
      .map((c) => ({ id: c.id, label: c.label, url: categoryUrl(c.id), description: c.description ?? '', posts: posts.filter((p) => p.data.category === c.id).length }))
      .filter((c) => c.posts > 0),
  };
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
