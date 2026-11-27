/**
 * The site's metadata (lexicons/id/skiddle/site.json): the name, description and keywords every
 * page's head uses, who the site is by, his profiles, and per-page titles and descriptions. The
 * layout (src/layouts/shell.astro) reads it on each request, cached; src/data/site-meta.ts fills in
 * any field the record leaves out. No dependencies, so the site and the admin app share it.
 */

export const SITE_COLLECTION = 'id.skiddle.site';

/**
 * @typedef {{ name: string, alternateName?: string, jobTitles: string[], worksFor?: string, location?: string, knowsAbout: string[] }} SiteAuthor
 * @typedef {{ path: string, title?: string, description?: string, keywords?: string[], noindex?: boolean }} PageMeta
 * @typedef {{ name: string, description: string, keywords: string[], author: SiteAuthor, profiles: string[], pages: PageMeta[] }} SiteMeta
 */

const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** A list of non-empty strings, or undefined if there are none */
const strs = (/** @type {unknown} */ v) => {
  const list = Array.isArray(v) ? v.map(str).filter((s) => s !== undefined) : [];
  return list.length ? list : undefined;
};
const isHttp = (/** @type {string} */ s) => /^https?:\/\/\S+$/i.test(s);

/** A path as the site writes it: a leading slash, and a trailing one unless it names a file (/rss.xml) */
export function normalPath(/** @type {string} */ path) {
  const p = `/${path.trim().replace(/^\/+/, '').split(/[?#]/)[0]}`;
  return p === '/' || p.endsWith('/') || /\.[a-z0-9]+$/i.test(p) ? p : `${p}/`;
}

/**
 * The record's fields, each checked, and only those it has, so the site fills in the rest. Nothing
 * throws: a field of the wrong type is left out. Profiles must be http(s) addresses, and a page
 * needs a path.
 * @param {Record<string, any>} v
 * @returns {Partial<Omit<SiteMeta, 'author'>> & { author?: Partial<SiteAuthor> }}
 */
export function siteMetaFromRecord(v) {
  /** @type {Record<string, unknown>} */
  const out = {};
  const set = (/** @type {string} */ k, /** @type {unknown} */ x) => {
    if (x !== undefined) out[k] = x;
  };
  set('name', str(v?.name));
  set('description', str(v?.description));
  set('keywords', strs(v?.keywords));
  if (v?.author && typeof v.author === 'object') {
    const a = v.author;
    /** @type {Record<string, unknown>} */
    const author = {};
    for (const [k, x] of [['name', str(a.name)], ['alternateName', str(a.alternateName)], ['jobTitles', strs(a.jobTitles)], ['worksFor', str(a.worksFor)], ['location', str(a.location)], ['knowsAbout', strs(a.knowsAbout)]]) {
      if (x !== undefined) author[/** @type {string} */ (k)] = x;
    }
    if (Object.keys(author).length) out.author = author;
  }
  set('profiles', strs(v?.profiles)?.filter(isHttp));
  const pages = (Array.isArray(v?.pages) ? v.pages : [])
    .filter((p) => p && typeof p === 'object' && str(p.path))
    .map((p) => {
      /** @type {PageMeta} */
      const page = { path: normalPath(p.path) };
      if (str(p.title)) page.title = str(p.title);
      if (str(p.description)) page.description = str(p.description);
      if (strs(p.keywords)) page.keywords = strs(p.keywords);
      if (p.noindex === true) page.noindex = true;
      return page;
    });
  if (pages.length) out.pages = pages;
  if (Array.isArray(out.profiles) && !out.profiles.length) delete out.profiles;
  return /** @type {any} */ (out);
}

/**
 * The record over the built-in values, field by field (the author's too)
 * @param {SiteMeta} fallback
 * @param {Record<string, any> | null | undefined} record
 * @returns {SiteMeta}
 */
export function siteMetaOf(fallback, record) {
  const mine = record ? siteMetaFromRecord(record) : {};
  return { ...fallback, ...mine, author: { ...fallback.author, ...mine.author } };
}

/**
 * What a page's head says: its own title, description and keywords, unless the record has an entry
 * for its path, which wins field by field; the site's description when it has none; its keywords,
 * then the site's, without repeats
 * @param {SiteMeta} site
 * @param {string} path
 * @param {{ title?: string, description?: string, keywords?: string[] }} page What the page says itself
 */
export function pageMetaOf(site, path, page) {
  const entry = site.pages.find((p) => p.path === normalPath(path));
  const keywords = [...(entry?.keywords ?? page.keywords ?? []), ...site.keywords];
  return {
    title: entry?.title ?? page.title ?? site.name,
    description: entry?.description ?? page.description ?? site.description,
    keywords: [...new Map(keywords.map((k) => [k.toLowerCase(), k])).values()],
    noindex: entry?.noindex === true,
  };
}
