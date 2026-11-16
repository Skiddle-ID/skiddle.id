/*
  /latest.json: the newest post, built with the site. /latest.svg draws its card from this, and
  anything else can use it too (a profile README script, a status page, …).
*/
import type { APIRoute } from 'astro';
import { getPosts, groupSeries, postUrl, readingMinutes } from '~/lib/posts';
import type { LatestPost } from '~/lib/latest-card';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const post = posts[0];
  if (!post) return Response.json(null);
  const series = post.data.series ? groupSeries(posts).find((s) => s.name === post.data.series) : undefined;
  const part = series ? series.entries.findIndex((e) => e.post?.id === post.id) + 1 : 0;
  const latest: LatestPost = {
    title: post.data.title,
    description: post.data.description,
    url: new URL(postUrl(post), site).toString(),
    date: post.data.pubDate.toISOString(),
    minutes: readingMinutes(post),
    series: series && part > 0 ? { name: series.name, part } : undefined,
    lang: post.data.lang,
  };
  return new Response(JSON.stringify(latest, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
