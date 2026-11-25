/**
 * Posts and series from Jeff's AT Protocol repo, for Astro's live collections (src/live.config.ts):
 * pages read them when they're requested, so publishing or editing a post needs no build.
 * See docs/v4/posts-on-atproto.md.
 *
 *   - a post: a `site.standard.document` of the skiddle.id publication whose `content` is an
 *     `id.skiddle.post` (written by the AT Protocol sync from git until the switch, then by the
 *     admin app). Its id is the slug from its path, /posts/<slug>/.
 *   - a series: an `id.skiddle.series` record; its id is the record key (the series' slug). An
 *     `app.bsky.feed.generator` record with the same key gives it a Bluesky feed
 *     (src/lib/bluesky-feed.mjs).
 *
 * Entries have the same `data` fields as the git collection (src/content.config.ts), so the
 * components in src/components work with both. A collection only lists posts; one entry also has
 * its Markdown rendered (src/lib/post-html.mjs), so a page renders just the post it shows.
 */
import type { LiveLoader } from 'astro/loaders';
import { FEED_DID, GENERATOR_COLLECTION } from '~/lib/bluesky-feed.mjs';
import { FALLBACK_CATEGORY, isCategoryId } from '~/lib/categories.mjs';
import { POST_TYPE, SERIES_COLLECTION } from '~/lib/post-record.mjs';
import { renderPost, type Heading, type PostImage } from '~/lib/post-html.mjs';
import { listRecords } from '~/lib/pds';
import type { PostData } from '~/lib/posts';
import { PUBLICATION_URI } from '~/lib/standard-site.mjs';
import type { SeriesInfo } from '~/types/series';

const DOCUMENT = 'site.standard.document';
/** Cache tag on every page built from posts, purged when the repo changes */
export const POSTS_TAG = 'posts';

export interface PdsPostData extends PostData {
  /** The post's Markdown, with images as image:NAME */
  markdown: string;
  images: PostImage[];
  /** The document's record key */
  recordKey: string;
  /** The document's CID: changes whenever the record does */
  recordCid: string;
  /** The share card (Standard.site's coverImage) */
  coverImage?: { cid: string; mimeType: string };
  /** Headings of the rendered post (single entries only) */
  headings?: Heading[];
}

export interface PdsSeriesData extends SeriesInfo {
  name: string;
}

interface DocumentRecord {
  site?: string;
  path?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  updatedAt?: string;
  tags?: string[];
  coverImage?: { ref?: { $link?: string }; mimeType?: string };
  bskyPostRef?: { uri?: string };
  content?: {
    $type?: string;
    markdown?: string;
    images?: PostImage[];
    category?: string;
    lang?: string;
    series?: { series?: string; part?: number };
    featured?: boolean;
  };
}

interface SeriesRecord {
  name?: string;
  description?: string;
  ongoing?: boolean;
  cadence?: string;
  feed?: boolean;
  planned?: { part: number; title: string }[];
  coverImage?: { ref?: { $link?: string }; mimeType?: string };
}

interface GeneratorRecord {
  did?: string;
}

interface Entry<T> {
  id: string;
  data: T;
  cacheHint?: { tags?: string[]; lastModified?: Date };
}

const date = (s: unknown) => {
  const d = typeof s === 'string' ? new Date(s) : undefined;
  return d && !Number.isNaN(d.valueOf()) ? d : undefined;
};

/** Every series, and every post (newest first), from the repo */
async function loadAll(): Promise<{ posts: Entry<PdsPostData>[]; series: Entry<PdsSeriesData>[] }> {
  const [docs, seriesRecords, generators] = await Promise.all([
    listRecords<DocumentRecord>(DOCUMENT),
    listRecords<SeriesRecord>(SERIES_COLLECTION),
    // Optional: if they can't be read, the site still shows, just without its Bluesky feeds
    listRecords<GeneratorRecord>(GENERATOR_COLLECTION).catch((err) => {
      console.error(`listRecords ${GENERATOR_COLLECTION}:`, err);
      return [];
    }),
  ]);
  const feedKeys = new Set(generators.filter((r) => r.value.did === FEED_DID).map((r) => r.uri.split('/').pop()!));
  const series: Entry<PdsSeriesData>[] = seriesRecords
    .filter((r) => typeof r.value.name === 'string')
    .map((r) => ({
      id: r.uri.split('/').pop()!,
      data: {
        name: r.value.name!,
        key: r.uri.split('/').pop()!,
        description: r.value.description,
        ongoing: r.value.ongoing ?? false,
        cadence: r.value.cadence,
        // On unless the record turns it off (records saved before the field existed have none)
        feed: r.value.feed !== false,
        blueskyFeed: feedKeys.has(r.uri.split('/').pop()!),
        planned: (r.value.planned ?? []).map((p) => ({ order: p.part, title: p.title })),
        ...(r.value.coverImage?.ref?.$link ? { coverImage: { cid: r.value.coverImage.ref.$link, mimeType: r.value.coverImage.mimeType ?? 'image/png' } } : {}),
      },
      cacheHint: { tags: [POSTS_TAG] },
    }));
  const seriesName = new Map(seriesRecords.filter((r) => r.value.name).map((r) => [r.uri, r.value.name!]));

  const posts: Entry<PdsPostData>[] = [];
  for (const { uri, cid: recordCid, value: v } of docs) {
    const slug = /^\/posts\/([^/]+)\/$/.exec(v.path ?? '')?.[1];
    const c = v.content;
    const pubDate = date(v.publishedAt);
    if (v.site !== PUBLICATION_URI || c?.$type !== POST_TYPE || typeof c.markdown !== 'string' || !slug || !v.title || !pubDate) continue;
    const updatedDate = date(v.updatedAt);
    const cid = v.coverImage?.ref?.$link;
    posts.push({
      id: slug,
      data: {
        title: v.title,
        description: v.description,
        pubDate,
        updatedDate,
        // Any category id; the categories record (src/lib/site-categories.ts) gives its label
        category: isCategoryId(c.category) ? c.category! : FALLBACK_CATEGORY,
        lang: c.lang || 'en',
        tags: v.tags ?? [],
        featured: c.featured ?? false,
        draft: false,
        series: c.series?.series ? seriesName.get(c.series.series) : undefined,
        order: c.series?.part,
        bluesky: v.bskyPostRef?.uri,
        markdown: c.markdown,
        images: c.images ?? [],
        recordKey: uri.split('/').pop()!,
        recordCid,
        coverImage: cid ? { cid, mimeType: v.coverImage?.mimeType ?? 'image/png' } : undefined,
      },
      cacheHint: { tags: [POSTS_TAG], lastModified: updatedDate ?? pubDate },
    });
  }
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return { posts, series };
}

const asError = (err: unknown) => (err instanceof Error ? err : new Error(String(err)));

export function postsLoader(): LiveLoader<PdsPostData, { id: string }> {
  return {
    name: 'skiddle-pds-posts',
    async loadCollection() {
      try {
        return { entries: (await loadAll()).posts, cacheHint: { tags: [POSTS_TAG] } };
      } catch (err) {
        return { error: asError(err) };
      }
    },
    async loadEntry({ filter }) {
      try {
        const entry = (await loadAll()).posts.find((p) => p.id === filter.id);
        if (!entry) return undefined;
        const { html, headings } = renderPost(entry.data.markdown, { images: entry.data.images });
        return { ...entry, data: { ...entry.data, headings }, rendered: { html } };
      } catch (err) {
        return { error: asError(err) };
      }
    },
  };
}

export function seriesLoader(): LiveLoader<PdsSeriesData, { id: string }> {
  return {
    name: 'skiddle-pds-series',
    async loadCollection() {
      try {
        return { entries: (await loadAll()).series, cacheHint: { tags: [POSTS_TAG] } };
      } catch (err) {
        return { error: asError(err) };
      }
    },
    async loadEntry({ filter }) {
      try {
        return (await loadAll()).series.find((s) => s.id === filter.id);
      } catch (err) {
        return { error: asError(err) };
      }
    },
  };
}
