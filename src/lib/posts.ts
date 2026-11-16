import { getCollection, type CollectionEntry } from 'astro:content';
import { plannedParts, type PlannedPart } from '~/data/series';

export type Post = CollectionEntry<'posts'>;

/** All published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export const postUrl = (p: Post) => `/posts/${p.id}/`;

export interface Series {
  name: string;
  slug: string;
  /** Published parts in reading order (`order`, then date) */
  parts: Post[];
  /** Planned parts that aren't published yet (src/data/series.ts), in order */
  planned: PlannedPart[];
  /** Published and planned parts together, in reading order */
  entries: SeriesEntry[];
}

/** One part of a series: a published post, or a planned part that's still to come */
export type SeriesEntry = { post: Post; order: number; title: string } | { post?: undefined; order: number; title: string };

/** URL-safe id for a series name: "Rebuilding skiddle.id" → "rebuilding-skiddle-id" */
export const seriesSlug = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const seriesUrl = (name: string) => `/series/#${seriesSlug(name)}`;

/** Group posts into series, newest series (by its latest part) first */
export function groupSeries(posts: Post[]): Series[] {
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
      const planned = (plannedParts[name] ?? []).filter((pl) => !taken.has(pl.order)).sort((a, b) => a.order - b.order);
      const entries: SeriesEntry[] = [
        ...parts.map((post, i) => ({ post, order: post.data.order ?? i + 1, title: post.data.title })),
        ...planned.map((pl) => ({ order: pl.order, title: pl.title })),
      ].sort((a, b) => a.order - b.order);
      return { name, slug: seriesSlug(name), parts, planned, entries };
    })
    .sort((a, b) => latest(b) - latest(a));
}

export function readingMinutes(p: Post): number {
  const words = (p.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export const categoryLabels: Record<Post['data']['category'], string> = {
  infra: 'Infra & delivery',
  atproto: 'ATProto & the open web',
  homelab: 'Homelab',
  life: 'Life',
};
