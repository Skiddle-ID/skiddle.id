/**
 * The post categories the site shows, read when a page is requested from the id.skiddle.categories
 * record in Jeff's AT Protocol repo (src/lib/pds.ts caches it for a minute), in their order. The
 * admin app edits it (Posts → Categories).
 *
 * Unlike the pages' content, a missing or unreadable record isn't an error: every post page needs
 * its category's label, so the site falls back to the categories it started with
 * (DEFAULT_CATEGORIES in src/lib/categories.mjs).
 */
import { CATEGORIES_COLLECTION, DEFAULT_CATEGORIES, categoriesFromRecord, type Category } from '~/lib/categories.mjs';
import { getRecord } from '~/lib/pds';
import type { Post } from '~/lib/posts';

export type { Category };

/** The cached record's key in src/lib/pds.ts, which /api/revalidate forgets */
export const CATEGORIES_RECORD_KEY = `record/${CATEGORIES_COLLECTION}/self`;

/** The categories, in order */
export async function getCategories(): Promise<Category[]> {
  try {
    const value = await getRecord<unknown>(CATEGORIES_COLLECTION, 'self');
    const list = value ? categoriesFromRecord(value) : [];
    if (list.length) return list;
  } catch (err) {
    console.error('categories from the PDS:', err);
  }
  return DEFAULT_CATEGORIES;
}

/**
 * The categories, plus any a post uses that the list doesn't have (after them, labelled by their
 * id), so a post is never left out of /topics/
 */
export function withUsed(categories: Category[], posts: Post[]): Category[] {
  const known = new Set(categories.map((c) => c.id));
  const extra = [...new Set(posts.map((p) => p.data.category))].filter((id) => !known.has(id)).sort();
  return [...categories, ...extra.map((id) => ({ id, label: id }))];
}
