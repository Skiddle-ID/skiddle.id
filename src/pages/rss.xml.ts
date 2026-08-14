import rss from '@astrojs/rss';
import type { APIContext } from "astro";
import { getCollection } from 'astro:content';

export const prerender = true;
export const GET = async (context: APIContext) => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sorted = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const requestUrl = new URL(context.request.url);
  const site = `${requestUrl.origin}/`;
  const handle = 'skiddle.blue';
  let displayName = 'Skiddle';
  try {
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`);
    if (res.ok) {
      const data = (await res.json()) as { displayName?: string };
      if (data?.displayName) displayName = data.displayName;
    }
  } catch {}
  return rss({
    title: `${displayName}'s Blog`,
    description: 'Personal blog and writings',
    site,
    items: sorted.map(post => ({
      id: `${site}posts/${post.slug}/`,
      title: post.data.title ?? 'Untitled',
      link: `${site}posts/${post.slug}/`,
      pubDate: post.data.pubDate,
      description: post.data.description || post.body.slice(0, 200).trimEnd() + '…',
    })),
    customData: `\n<language>en-us</language>`,
  });
};
