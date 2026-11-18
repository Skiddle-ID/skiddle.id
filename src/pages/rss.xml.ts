import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import type { Post } from '~/lib/posts';
import { POSTS_CACHE, pdsData, pdsPostHtml, sitePosts } from '~/lib/site-posts';

export const prerender = false;

/** Items in the feed, newest first: enough for any feed reader, and a cap on the work per request */
const MAX_ITEMS = 20;

/**
 * Full-content feed: each item carries the whole post as HTML (content:encoded), so it can be
 * read in a feed reader. Site-relative links and images are made absolute, and a footer links
 * back to the post and to its Bluesky thread. Rendered on request from the posts on the PDS
 * (each post's HTML is cached by its record's CID) and cached; drafts are left out.
 */
export const GET = async (context: APIContext) => {
  context.cache.set(POSTS_CACHE);
  const sorted = (await sitePosts()).posts.slice(0, MAX_ITEMS);
  const html = await Promise.all(sorted.map(postHtml));
  // The canonical address, not the request's: the feed's links must point at skiddle.id wherever it's served from
  const site = (context.site ?? new URL(context.request.url).origin).toString().replace(/\/?$/, '/');
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
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: sorted.map((post, i) => {
      const link = `${site}posts/${post.id}/`;
      return {
        title: post.data.title ?? 'Untitled',
        link,
        pubDate: post.data.pubDate,
        description: post.data.description || post.body?.slice(0, 200).trimEnd() + '…',
        content: fullContent(post, html[i], link, site),
        categories: post.data.tags,
      };
    }),
    // The writing is all rights reserved (LICENSE-CONTENT.md): say so in the feed too
    customData: `<language>en-us</language><copyright>© ${new Date().getFullYear()} Laurensius Jeffrey. All rights reserved. No republishing or AI training without permission.</copyright><atom:link href="${site}rss.xml" rel="self" type="application/rss+xml"/>`,
  });
};

/** A post's HTML, rendered from its record */
const postHtml = (post: Post): Promise<string> => pdsPostHtml(pdsData(post));

function fullContent(post: Post, html: string, link: string, site: string): string {
  const body = absolutize(html, link, site);

  const thread = post.data.bluesky && /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(post.data.bluesky);
  const footer =
    `<hr /><p><a href="${link}">Read on skiddle.id</a>` +
    (thread ? ` · <a href="https://bsky.app/profile/${thread[1]}/post/${thread[2]}">Reply on Bluesky</a>` : '') +
    `</p>`;

  // @astrojs/rss entity-escapes this into <content:encoded>
  return `${body}${footer}`;
}

/** Site-relative href/src → absolute URLs; in-page anchors → the post URL + anchor */
function absolutize(html: string, link: string, site: string): string {
  return html
    .replace(/\s(href|src)="\/(?!\/)/g, ` $1="${site}`)
    .replace(/\shref="#/g, ` href="${link}#`);
}
