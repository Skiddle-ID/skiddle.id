import type { PlannedPart, SeriesInfo } from '~/types/series';
import { seriesSlug } from './post-record.mjs';

/** A post's fields, from its record (src/lib/pds-posts.ts) */
export interface PostData {
  title: string;
  description?: string;
  pubDate: Date;
  updatedDate?: Date;
  publishAt?: Date;
  /** Its category's id (src/lib/categories.mjs): one of the categories in Jeff's repo */
  category: string;
  lang: string;
  tags: string[];
  cover?: string;
  featured: boolean;
  draft: boolean;
  series?: string;
  order?: number;
  rkey?: string;
  bluesky?: string;
}

/** A post, from its record in Jeff's AT Protocol repo (src/lib/pds-posts.ts) */
export interface Post {
  /** The slug: /posts/<id>/ */
  id: string;
  /** The Markdown */
  body?: string;
  data: PostData;
}

export const postUrl = (p: Post) => `/posts/${p.id}/`;

export interface Series {
  name: string;
  /** Its record's key: the page is /series/<slug>/ (seriesUrl) and its place on /series/ is #<slug> */
  slug: string;
  /** Published parts in reading order (`order`, then date) */
  parts: Post[];
  /** Planned parts that aren't published yet (the series' record), in order */
  planned: PlannedPart[];
  /** Published and planned parts together, in reading order */
  entries: SeriesEntry[];
  /** No last part (e.g. a weekly series): shown as "new every week" instead of "part 3 of 3" */
  ongoing: boolean;
  /** How often new parts come out, e.g. 'every week' */
  cadence?: string;
  /** What the series is about */
  description?: string;
  /** Its share card (from the record) */
  coverImage?: { cid: string; mimeType: string };
}

/** One part of a series: a published post, or a planned part that's still to come */
export type SeriesEntry = { post: Post; order: number; title: string } | { post?: undefined; order: number; title: string };

/** URL-safe id for a series name: "Rebuilding skiddle.id" → "rebuilding-skiddle-id". Also its record key */
export { seriesSlug };

/** A series' own page, by its record's key (Series.slug) */
export const seriesUrl = (slug: string) => `/series/${slug}/`;

/**
 * Group posts into series, newest series (by its latest part) first
 * @param info What each series adds (planned parts, ongoing, cadence), by name: the
 *   id.skiddle.series records
 */
export function groupSeries(posts: Post[], info: Record<string, SeriesInfo>): Series[] {
  const byName = new Map<string, Post[]>();
  for (const p of posts) {
    if (p.data.series) byName.set(p.data.series, [...(byName.get(p.data.series) ?? []), p]);
  }
  const latest = (s: Series) => Math.max(...s.parts.map((p) => p.data.pubDate.valueOf()));
  return [...byName]
    .map(([name, posts]): Series => {
      const parts = posts.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
      // A published post takes the place of the planned part with the same `order`
      const taken = new Set(parts.map((p, i) => p.data.order ?? i + 1));
      const extra = info[name] ?? {};
      const planned = (extra.planned ?? []).filter((pl) => !taken.has(pl.order)).sort((a, b) => a.order - b.order);
      const entries: SeriesEntry[] = [
        ...parts.map((post, i) => ({ post, order: post.data.order ?? i + 1, title: post.data.title })),
        ...planned.map((pl) => ({ order: pl.order, title: pl.title })),
      ].sort((a, b) => a.order - b.order);
      return {
        name,
        // The record's key; a renamed series keeps it, so its address stays the same
        slug: extra.key ?? seriesSlug(name),
        parts,
        planned,
        entries,
        ongoing: extra.ongoing ?? false,
        cadence: extra.cadence,
        description: extra.description,
        coverImage: extra.coverImage,
      };
    })
    .sort((a, b) => latest(b) - latest(a));
}

/** Series longer than this show only the parts around the current post in its series box */
export const SERIES_LIST_LIMIT = 7;

/** Short status for series lists: "6 parts", "1 of 6 parts · next: Ground School", "3 parts · new every week" */
export function seriesStatus(s: Series): string {
  const n = s.parts.length;
  const parts = `${n} ${n === 1 ? 'part' : 'parts'}`;
  if (s.planned.length) return `${n} of ${s.entries.length} parts · next: ${s.planned[0].title}`;
  if (s.ongoing) return `${parts} · ${s.cadence ? `new ${s.cadence}` : 'ongoing'}`;
  return parts;
}

export function readingMinutes(p: Post): number {
  const words = (p.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** A category's own page */
export const categoryUrl = (id: string) => `/topics/${id}/`;
