import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export const prerender = true;

/**
 * Full-content feed: each item carries the whole post as HTML (content:encoded), so it can be
 * read in a feed reader. Site-relative links and images are made absolute, and a footer links
 * back to the post and to its Bluesky thread.
 */
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
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: sorted.map((post) => {
      const link = `${site}posts/${post.id}/`;
      return {
        title: post.data.title ?? 'Untitled',
        link,
        pubDate: post.data.pubDate,
        description: post.data.description || post.body?.slice(0, 200).trimEnd() + '…',
        content: fullContent(post, link, site),
        categories: post.data.tags,
      };
    }),
    customData: `<language>en-us</language><atom:link href="${site}rss.xml" rel="self" type="application/rss+xml"/>`,
  });
};

function fullContent(post: CollectionEntry<'posts'>, link: string, site: string): string {
  // Markdown posts are rendered to HTML by the content loader; MDX posts aren't, so they get a summary
  const html = post.rendered?.html;
  const body = html
    ? absolutize(html, link, site)
    : `<p>${escapeHtml(post.data.description ?? '')}</p><p><a href="${link}">Read the full post on skiddle.id</a></p>`;

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
