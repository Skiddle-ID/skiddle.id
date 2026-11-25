/**
 * The newest post of an account on Bluesky, for /bluesky.svg, from the public AppView's
 * app.bsky.feed.getAuthorFeed (https://docs.bsky.app/docs/api/app-bsky-feed-get-author-feed).
 * The feed holds the account's reposts too. The card skips them, and replies, so it shows a post the
 * account wrote on its own.
 *
 * No imports, so the tests can use it (scripts/bluesky-post.test.mjs).
 */

/** What a post carries besides its text. The card names it ("[2 images]") instead of drawing it. */
export type Attachment =
  | { kind: 'images'; count: number }
  | { kind: 'link'; domain: string }
  | { kind: 'video' | 'quote' | 'feed' | 'list' | 'starter pack' };

export interface BlueskyPost {
  text: string;
  /** ISO date it was written */
  createdAt: string;
  replies: number;
  reposts: number;
  likes: number;
  attachments: Attachment[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const count = (value: unknown) => (typeof value === 'number' && value > 0 ? Math.floor(value) : 0);

/** The first post in a getAuthorFeed response that `did` wrote, isn't a repost and isn't a reply; null if there's none */
export function newestOwnPost(body: unknown, did: string): BlueskyPost | null {
  const feed = isObject(body) && Array.isArray(body.feed) ? body.feed : [];
  for (const item of feed) {
    if (!isObject(item) || item.reason !== undefined || !isObject(item.post)) continue;
    const { author, record, embed, indexedAt } = item.post;
    if (!isObject(author) || author.did !== did || !isObject(record) || record.reply !== undefined) continue;
    return {
      text: typeof record.text === 'string' ? record.text : '',
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : String(indexedAt ?? ''),
      replies: count(item.post.replyCount),
      reposts: count(item.post.repostCount),
      likes: count(item.post.likeCount),
      attachments: attachmentsOf(embed),
    };
  }
  return null;
}

/** The attachments in a post's embed view (app.bsky.embed.*#view) */
function attachmentsOf(embed: unknown): Attachment[] {
  if (!isObject(embed)) return [];
  switch (embed.$type) {
    case 'app.bsky.embed.images#view':
      return [{ kind: 'images', count: Array.isArray(embed.images) ? embed.images.length : 1 }];
    case 'app.bsky.embed.video#view':
      return [{ kind: 'video' }];
    case 'app.bsky.embed.external#view':
      return [{ kind: 'link', domain: domainOf(isObject(embed.external) ? embed.external.uri : undefined) }];
    case 'app.bsky.embed.record#view':
      return [recordKind(embed.record)];
    case 'app.bsky.embed.recordWithMedia#view':
      return [recordKind(isObject(embed.record) ? embed.record.record : undefined), ...attachmentsOf(embed.media)];
    default:
      return [];
  }
}

/** An embedded record: another post (a quote, also when it's been deleted or blocked), a feed, a list or a starter pack */
function recordKind(record: unknown): Attachment {
  switch (isObject(record) ? record.$type : undefined) {
    case 'app.bsky.feed.defs#generatorView':
      return { kind: 'feed' };
    case 'app.bsky.graph.defs#listView':
      return { kind: 'list' };
    case 'app.bsky.graph.defs#starterPackViewBasic':
      return { kind: 'starter pack' };
    default:
      return { kind: 'quote' };
  }
}

function domainOf(uri: unknown): string {
  try {
    return new URL(String(uri)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
