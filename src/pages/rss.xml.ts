import rss from '@astrojs/rss';
import type { APIContext } from "astro";
import { getPosts } from '~/atproto/getPosts';

export const prerender = false;

export const GET = async (context: APIContext) => {
  const posts = await getPosts(context.locals, undefined);

  const postsFiltered = posts.filter((p) => !p.content?.startsWith('NOT_LIVE'));
  const postsShortened = postsFiltered.map((p) => {
    if (p.content?.length! > 200) {
      p.content = p.content?.slice(0, 200).trimEnd() + '...';
    }
    return p;
  });

  // Resolve metadata
  const requestUrl = new URL(context.request.url);
  const site = `${requestUrl.origin}/`;

  // Pull display name from Bluesky (fallback to 'Skiddle')
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
    items: postsShortened.map((post) => ({
      id: `${site}posts/${post.rkey}/`,
      title: post.title ?? 'Untitled',
      link: `${site}posts/${post.rkey}/`,
      pubDate: new Date(post.createdAt),
      description: post.content ?? undefined,
    })),
    // Note: @astrojs/rss does not allow adding xmlns declarations on the root element,
    // so we omit the atom:link to avoid a namespace error in validators.
    customData: `\n<language>en-us</language>`,
  });
};
