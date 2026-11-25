/**
 * Full-content RSS feeds: the site's (/rss.xml) and each series' (/series/<key>/rss.xml). Each
 * item carries the whole post as HTML (content:encoded), so it can be read in a feed reader.
 * Site-relative links and images are made absolute, and a footer links back to the post and to
 * its Bluesky thread. Each post's HTML is rendered from its record and cached by the record's CID.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import type { Post } from '~/lib/posts';
import { pdsData, pdsPostHtml } from '~/lib/site-posts';

export interface Feed {
  title: string;
  description: string;
  /** The feed's own path, e.g. /rss.xml: its rel="self" link */
  self: string;
  /** The posts in it, newest first */
  posts: Post[];
}

/** The canonical address, not the request's: a feed's links must point at skiddle.id wherever it's served from */
export const feedSite = (context: APIContext): string =>
  (context.site ?? new URL(context.request.url).origin).toString().replace(/\/?$/, '/');

export async function postsFeed(context: APIContext, { title, description, self, posts }: Feed): Promise<Response> {
  const html = await Promise.all(posts.map((post) => pdsPostHtml(pdsData(post))));
  const site = feedSite(context);
  return rss({
    title,
    description,
    site,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: posts.map((post, i) => {
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
    customData: `<language>en-us</language><copyright>© ${new Date().getFullYear()} Laurensius Jeffrey. All rights reserved. No republishing or AI training without permission.</copyright><atom:link href="${new URL(self, site)}" rel="self" type="application/rss+xml"/>`,
  });
}

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
