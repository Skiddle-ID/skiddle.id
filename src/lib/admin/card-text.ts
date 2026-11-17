/**
 * What the share cards the admin app draws say (src/lib/admin/card.ts draws them). Kept apart from
 * the drawing, which loads about 3 MB, so the editors can tell whether a stored card is still right
 * (cardKey) without loading it.
 */
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
