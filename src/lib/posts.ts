import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** All published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export const postUrl = (p: Post) => `/posts/${p.id}/`;

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
