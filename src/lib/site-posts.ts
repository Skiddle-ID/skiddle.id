/**
 * The posts and series every page uses, read when the page is requested: from Jeff's AT Protocol
 * repo (the pdsPosts and pdsSeries live collections, src/lib/pds-posts.ts), plus, until the v4
 * launch, posts in git that aren't on the PDS yet (drafts on previews, or a post merged minutes
 * before the AT Protocol sync ran). See docs/v4/posts-on-atproto.md.
 *
 * Pages that use this are rendered on request and tag their cache with POSTS_TAG, so a save can
 * purge them all (/api/revalidate).
 */
import { getLiveCollection } from 'astro:content';
import { seriesInfo as gitSeriesInfo, type SeriesInfo } from '~/data/series';
import type { LatestPost } from '~/lib/latest-card';
import { renderPost } from '~/lib/post-html.mjs';
import { cached } from '~/lib/pds';
import { POSTS_TAG, type PdsPostData } from '~/lib/pds-posts';
import { getPosts, groupSeries, postUrl, readingMinutes, type Post } from '~/lib/posts';

export { POSTS_TAG };

/** Route cache for pages built from posts: fresh for a minute, then stale for up to a day while a new copy renders */
export const POSTS_CACHE = { maxAge: 60, swr: 86400, tags: [POSTS_TAG] };

export interface SitePosts {
  /** Every post, newest first */
  posts: Post[];
  /** What each series adds (planned parts, ongoing, cadence), by name */
  seriesInfo: Record<string, SeriesInfo>;
}

/** The fields a post from the PDS has on top of the git collection's */
export const pdsData = (p: Post): PdsPostData | undefined => ('recordKey' in p.data ? (p.data as PdsPostData) : undefined);

/**
 * @param options.drafts Include drafts from git, as previews do (default). The feed and the
 *   sitemap leave them out.
 */
export async function sitePosts({ drafts = true }: { drafts?: boolean } = {}): Promise<SitePosts> {
  const [list, series, git] = await Promise.all([getLiveCollection('pdsPosts'), getLiveCollection('pdsSeries'), getPosts()]);
  if (list.error) console.error('posts from the PDS:', list.error);
  if (series.error) console.error('series from the PDS:', series.error);
  const pds: Post[] = (list.entries ?? []).map((e) => ({ id: e.id, body: e.data.markdown, data: e.data }));
  const onPds = new Set(pds.map((p) => p.id));
  const fromGit = git.filter((p) => !onPds.has(p.id) && (drafts || !p.data.draft));
  const posts = [...pds, ...fromGit].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const seriesInfo = { ...gitSeriesInfo, ...Object.fromEntries((series.entries ?? []).map((s) => [s.data.name, s.data])) };
  return { posts, seriesInfo };
}

/**
 * A post from the PDS as HTML, cached per isolate by its record's CID (the hash of its content),
 * so a page that shows many posts in full, like the feed, renders each one once
 */
export function pdsPostHtml(data: PdsPostData): Promise<string> {
  return cached(`html/${data.recordCid}`, 3600, async () => renderPost(data.markdown, { images: data.images }).html);
}

/** The newest post, for /latest.json and the /latest.svg card */
export function latestPost({ posts, seriesInfo }: SitePosts, site: URL | string): LatestPost | null {
  const post = posts[0];
  if (!post) return null;
  const series = post.data.series ? groupSeries(posts, seriesInfo).find((s) => s.name === post.data.series) : undefined;
  const part = series ? series.entries.findIndex((e) => e.post?.id === post.id) + 1 : 0;
  return {
    title: post.data.title,
    description: post.data.description,
    url: new URL(postUrl(post), site).toString(),
    date: post.data.pubDate.toISOString(),
    minutes: readingMinutes(post),
    series: series && part > 0 ? { name: series.name, part } : undefined,
    lang: post.data.lang,
  };
}
