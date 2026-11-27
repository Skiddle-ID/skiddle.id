/**
 * A page made of blocks, for its route in src/pages/ (docs/v4/themes.md): its id.skiddle.page record,
 * or until there is one, the page made from what it showed before (`legacy`, src/lib/page-legacy.mjs),
 * so every page renders through its blocks. The reads its blocks need are started together and
 * awaited (src/lib/page-data.ts): a read that fails fails the page, so a copy cached earlier shows.
 *
 * ?preview=draft shows the page's draft (<key>~draft), read fresh, with Cache-Control: no-store and
 * X-Robots-Tag: noindex. Otherwise the route caches the page, tagged so /api/revalidate purges it.
 */
import type { AstroGlobal } from 'astro';
import { pageFromRecord, readsOf, type Page } from '~/lib/page-blocks.mjs';
import { getPage } from '~/lib/page-content';
import { pageData, preload, type PageData, type PageDataOptions } from '~/lib/page-data';

export interface BlockPage {
  page: Page;
  data: PageData;
  /** At ?preview=draft: whether there was a draft to show */
  preview?: 'draft' | 'published';
}

/**
 * @param key The page's record key, its address: `about` for /about/
 * @param legacy The page's record made from its old record and the text that was in its code
 * @param options What the page's reads depend on besides the records (src/lib/page-data.ts)
 */
export async function blockPage(astro: AstroGlobal, key: string, legacy: () => Promise<unknown>, options: PageDataOptions = {}): Promise<BlockPage> {
  const preview = astro.url.searchParams.get('preview') === 'draft';
  const draft = preview ? await getPage(key, { draft: true }) : null;
  const page = draft ?? (await getPage(key)) ?? pageFromRecord(await legacy());
  if (!page) throw new Error(`page ${key}: its old record made no page`);
  const data = pageData(options);
  await preload(data, readsOf(page));
  if (preview) {
    astro.response.headers.set('Cache-Control', 'no-store');
    astro.response.headers.set('X-Robots-Tag', 'noindex');
  }
  return { page, data, preview: preview ? (draft ? 'draft' : 'published') : undefined };
}
