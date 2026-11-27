/**
 * The site's metadata (lexicons/id/skiddle/site.json): the name, description and keywords every
 * page's head uses, who the site is by, his profiles, and per-page titles and descriptions; and the
 * frame: the menu, the footer's links and what the sidebar shows. The layout
 * (src/layouts/shell.astro) reads it on each request, cached; src/data/site-meta.ts fills in any
 * field the record leaves out. No dependencies, so the site and the admin app share it.
 */
import { ICON_NAMES } from './icons.mjs';

export const SITE_COLLECTION = 'id.skiddle.site';

/**
 * @typedef {import('./icons.mjs').IconName} IconName
 * @typedef {{ name: string, alternateName?: string, jobTitles: string[], worksFor?: string, location?: string, knowsAbout: string[] }} SiteAuthor
 * @typedef {{ path: string, title?: string, description?: string, keywords?: string[], noindex?: boolean }} PageMeta
 * @typedef {{ png32: string, png180: string, png192: string, png512: string }} SiteIcon The icon's sizes, as blob CIDs (served at /media/<cid>)
 * @typedef {{ label: string, href: string }} SiteLink A link in the frame: a page on the site (/posts/), or an https: or mailto: address
 * @typedef {SiteLink & { icon?: IconName }} MenuItem
 * @typedef {{ menu: MenuItem[], footerLinks: SiteLink[], hideMusic: boolean, hideThemeButtons: boolean }} SiteFrame
 * @typedef {{ name: string, description: string, keywords: string[], author: SiteAuthor, profiles: string[], pages: PageMeta[], icon?: SiteIcon } & SiteFrame} SiteMeta
 * @typedef {SiteLink & { hint: string, keywords: string }} CommandPage A page the command bar lists; `keywords` are only for matching
 */

const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** A list of non-empty strings, or undefined if there are none */
const strs = (/** @type {unknown} */ v) => {
  const list = Array.isArray(v) ? v.map(str).filter((s) => s !== undefined) : [];
  return list.length ? list : undefined;
};
const isHttp = (/** @type {string} */ s) => /^https?:\/\/\S+$/i.test(s);

/**
 * A link the frame can hold: a path on the site (one slash, so not //host), or an https: or
 * mailto: address. Anything else (javascript:, http:, a bare word) is dropped.
 */
export const isFrameHref = (/** @type {string} */ s) => /^(\/(?![/\\])\S*|https:\/\/\S+|mailto:\S+@\S+)$/i.test(s);

/** A link a page may show: one the frame may (isFrameHref), or a place on the page, like #hire */
export const isPageHref = (/** @type {string} */ s) => isFrameHref(s) || /^#[A-Za-z][\w-]*$/.test(s);
/** A link that leaves the site, which opens in a new tab */
export const isExternal = (/** @type {string} */ href) => /^https:/i.test(href);
const isIcon = (/** @type {unknown} */ s) => ICON_NAMES.some((n) => n === s);

/**
 * A list of links, each with a label and a link the frame can hold; or undefined when none is left
 * @param {unknown} v
 * @param {boolean} withIcon Whether an item can have an icon (the menu's can)
 */
function linksOf(v, withIcon) {
  /** @type {MenuItem[]} */
  const out = [];
  for (const item of Array.isArray(v) ? v : []) {
    const label = str(item?.label);
    const href = str(item?.href);
    if (!label || !href || !isFrameHref(href)) continue;
    out.push(withIcon && isIcon(item.icon) ? { label, href, icon: item.icon } : { label, href });
  }
  return out.length ? out : undefined;
}

/** A path as the site writes it: a leading slash, and a trailing one unless it names a file (/rss.xml) */
export function normalPath(/** @type {string} */ path) {
  const p = `/${path.trim().replace(/^\/+/, '').split(/[?#]/)[0]}`;
  return p === '/' || p.endsWith('/') || /\.[a-z0-9]+$/i.test(p) ? p : `${p}/`;
}

/**
 * The record's fields, each checked, and only those it has, so the site fills in the rest. Nothing
 * throws: a field of the wrong type is left out. Profiles must be http(s) addresses, and a page
 * needs a path. A menu item or footer link needs a label and a link the frame can hold
 * (isFrameHref), and an icon the site has; a menu or footer with none left is left out, so the
 * site shows its own.
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
  set('icon', iconOf(v?.icon));
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
  set('menu', linksOf(v?.menu, true));
  set('footerLinks', linksOf(v?.footerLinks, false));
  if (v?.hideMusic === true) out.hideMusic = true;
  if (v?.hideThemeButtons === true) out.hideThemeButtons = true;
  return /** @type {any} */ (out);
}

/** A blob reference's CID: { $type: 'blob', ref: { $link } } */
const cidOf = (/** @type {any} */ b) => (b && b.$type === 'blob' && typeof b.ref?.$link === 'string' ? b.ref.$link : undefined);

/**
 * The icon's sizes, or undefined unless it has all four PNGs
 * @param {any} icon
 * @returns {SiteIcon | undefined}
 */
function iconOf(icon) {
  if (!icon || typeof icon !== 'object') return undefined;
  const sizes = { png32: cidOf(icon.png32), png180: cidOf(icon.png180), png192: cidOf(icon.png192), png512: cidOf(icon.png512) };
  return Object.values(sizes).every(Boolean) ? /** @type {SiteIcon} */ (sizes) : undefined;
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

/**
 * What the record's menu and footer links get wrong, for the admin app: links the site would drop
 * @param {Record<string, unknown>} v The form's fields
 * @returns {string[]}
 */
export function frameProblems(v) {
  /** @type {string[]} */
  const out = [];
  for (const [key, name] of [['menu', 'Menu item'], ['footerLinks', 'Footer link']]) {
    const list = v[key];
    for (const [i, item] of (Array.isArray(list) ? list : []).entries()) {
      const href = str(item?.href);
      if (href && !isFrameHref(href)) out.push(`${name} ${i + 1}’s link needs to start with /, https:// or mailto:.`);
    }
  }
  return out;
}

/**
 * The pages the command bar lists: the site's own (src/data/frame.ts), each named as the menu names
 * it, then the menu's other links, so whatever the record's menu has, the search finds
 * @param {CommandPage[]} pages
 * @param {MenuItem[]} menu
 * @returns {CommandPage[]}
 */
export function commandPagesOf(pages, menu) {
  const labels = new Map(menu.map((m) => [m.href, m.label]));
  const own = pages.map((p) => {
    const label = labels.get(p.href) ?? p.label;
    return label === p.label ? p : { ...p, label, keywords: `${p.label} ${p.keywords}` };
  });
  const extra = [...labels].filter(([href]) => !pages.some((p) => p.href === href)).map(([href, label]) => ({ label, href, hint: '', keywords: '' }));
  return [...own, ...extra];
}
