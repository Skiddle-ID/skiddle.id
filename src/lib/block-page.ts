/**
 * A page made of blocks, for its route in src/pages/ (docs/v4/themes.md): one of the site's own
 * pages (blockPage), from its id.skiddle.page record or, without one, its built-in page
 * (src/lib/page-legacy.mjs) if it has one; or a page of Jeff's own at /<key>/ (ownBlockPage,
 * src/pages/[key].astro). The reads its blocks need are
 * started together and awaited (src/lib/page-data.ts): a read that fails fails the page, so a copy
 * cached earlier shows.
 *
 * ?preview=draft shows the page's draft (<key>~draft), read fresh, with Cache-Control: no-store and
 * X-Robots-Tag: noindex. Otherwise the route caches the page, tagged so /api/revalidate purges it.
 */
import type { AstroGlobal } from 'astro';
import { pageFromRecord, readsOf, type Page } from '~/lib/page-blocks.mjs';
import { getPage, getPageRecords } from '~/lib/page-content';
import { pageData, preload, type PageData, type PageDataOptions } from '~/lib/page-data';
import { isOwnKey, ownPageOf } from '~/lib/own-pages.mjs';

export interface BlockPage {
  page: Page;
  data: PageData;
  /** At ?preview=draft: whether there was a draft to show */
  preview?: 'draft' | 'published';
}

const isPreview = (astro: AstroGlobal) => astro.url.searchParams.get('preview') === 'draft';

/** The page with its reads done; a preview is never cached or indexed */
async function withData(astro: AstroGlobal, page: Page, preview: BlockPage['preview'], options: PageDataOptions): Promise<BlockPage> {
  const data = pageData(options);
  await preload(data, readsOf(page));
  if (preview) {
    astro.response.headers.set('Cache-Control', 'no-store');
    astro.response.headers.set('X-Robots-Tag', 'noindex');
  }
  return { page, data, preview };
}

/**
 * @param key The page's record key, its address: `about` for /about/
 * @param builtIn The page's record without one in the repo: home, Now, Services and Notes have one.
 *   Without it, a missing record fails the page, so a copy cached earlier shows.
 * @param options What the page's reads depend on besides the records (src/lib/page-data.ts)
 */
export async function blockPage(astro: AstroGlobal, key: string, builtIn?: () => unknown, options: PageDataOptions = {}): Promise<BlockPage> {
  const preview = isPreview(astro);
  const draft = preview ? await getPage(key, { draft: true }) : null;
  const page = draft ?? (await getPage(key)) ?? (builtIn && pageFromRecord(builtIn()));
  if (!page) throw new Error(`page ${key}: there's no page record`);
  return withData(astro, page, preview ? (draft ? 'draft' : 'published') : undefined, options);
}

/**
 * A page of Jeff's own (src/lib/own-pages.mjs): its record from the list of page records, or at
 * ?preview=draft its draft. Null when no such page can be at the address, or there's none there.
 * @param key The address, from the route: `speaking` for /speaking/
 */
export async function ownBlockPage(astro: AstroGlobal, key: string, options: PageDataOptions = {}): Promise<BlockPage | null> {
  if (!isOwnKey(key)) return null;
  const preview = isPreview(astro);
  const [draft, published] = await Promise.all([preview ? getPage(key, { draft: true }) : null, getPageRecords().then((records) => ownPageOf(records, key))]);
  const page = draft ?? published;
  return page && withData(astro, page, preview ? (draft ? 'draft' : 'published') : undefined, options);
}
