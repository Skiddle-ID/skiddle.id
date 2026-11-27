/**
 * What the share cards the admin app draws say (src/lib/admin/card.ts draws them). Kept apart from
 * the drawing, which loads about 3 MB, so the editors can tell whether a stored card is still right
 * (cardKey) without loading it.
 */
import { slugOf } from '~/lib/post-record.mjs';
import type { ShareCard } from '~/lib/share-card-layout';

export interface CardPost {
  slug: string;
  title: string;
  description?: string;
  /** When it's (or will be) published: the date on the card */
  publishedAt: Date;
  /** For "N min read" */
  markdown: string;
}

export interface CardSeries {
  /** The record key, which a series page would use: /series/<key>/ */
  key: string;
  name: string;
  description?: string;
  ongoing: boolean;
  cadence?: string;
  /** Published and planned parts together */
  parts: number;
}

export type CardText = Omit<ShareCard, 'logo'>;

/** The parts of a draft or a published post that its card shows */
export interface PostLike {
  path?: string;
  title?: string;
  description?: string;
  /** A draft's scheduled time */
  publishAt?: string;
  content?: { markdown?: string };
}

/**
 * What a post's card shows: published at `publishedAt` (a published post's date), else at the
 * draft's scheduled time, else now (as if it were published now)
 */
export function cardPostOf(d: PostLike, publishedAt?: string): CardPost {
  return {
    slug: slugOf(d.path) ?? 'untitled',
    title: d.title || 'Untitled',
    description: d.description,
    publishedAt: new Date(publishedAt ?? d.publishAt ?? new Date().toISOString()),
    markdown: d.content?.markdown ?? '',
  };
}

/**
 * What a series' card shows, from its record (or the series editor's form)
 * @param key Its record key
 * @param published The part numbers of its published posts
 */
export function cardSeriesOf(
  key: string,
  s: { name?: string; description?: string; ongoing?: boolean; cadence?: string; planned?: { part: number }[] },
  published: number[],
): CardSeries {
  const planned = (s.planned ?? []).map((p) => p.part).filter((n) => Number.isInteger(n) && n >= 1);
  return {
    key: key || 'untitled',
    name: s.name?.trim() || 'Untitled',
    description: s.description?.trim() || undefined,
    ongoing: !!s.ongoing,
    cadence: s.cadence?.trim() || undefined,
    parts: new Set([...published, ...planned]).size,
  };
}

/** The parts of a page made of blocks (id.skiddle.page) that its card shows */
export interface CardPage {
  /** Its record key, which is its address: home for / */
  key: string;
  title: string;
  description?: string;
}

/** A page's card: "whoami" for the home page, "cd ~/<key>" for the others, then its title and description */
export function pageCard(page: CardPage): CardText {
  return { command: page.key === 'home' ? 'whoami' : `cd ~/${page.key}`, title: page.title, description: page.description, meta: [''] };
}

/** A post's card, as the build draws it */
export function postCard(post: CardPost): CardText {
  // As the post page computes them (src/lib/posts.ts): words / 220, and the date in UTC
  const minutes = Math.max(1, Math.round(post.markdown.split(/\s+/).filter(Boolean).length / 220));
  const date = post.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const description = post.description || `${post.markdown.slice(0, 160).trimEnd()}…`;
  return { command: `cat posts/${post.slug}.md`, title: post.title, description, meta: [date, `${minutes} min read`] };
}

/**
 * A series' card, in the style of the list pages' cards: "cd ~/series/<key>", its name and
 * description, and how many parts it has, or how often new ones come out if it's ongoing (a count
 * would go stale with every new part)
 */
export function seriesCard(series: CardSeries): CardText {
  const meta = series.ongoing ? (series.cadence ? `new ${series.cadence}` : 'ongoing') : `${series.parts} ${series.parts === 1 ? 'part' : 'parts'}`;
  return { command: `cd ~/series/${series.key}`, title: series.name, description: series.description, meta: [meta] };
}

/** Equal for two cards that would look the same */
export const cardKey = (card: CardText) => JSON.stringify([card.command, card.title, card.description ?? '', card.meta ?? []]);
