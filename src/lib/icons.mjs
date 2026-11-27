/**
 * The site's icons, by name: src/components/icon.astro draws them, and a menu item in the
 * id.skiddle.site record can show one (src/lib/site-meta.mjs). The lexicon lists the same names as
 * its known values; scripts/site-meta.test.mjs checks they match.
 */
export const ICON_NAMES = /** @type {const} */ (['github', 'bluesky', 'at', 'rss', 'sun', 'moon', 'search', 'music', 'menu', 'mail', 'instagram', 'copy', 'palette', 'print']);

/** @typedef {typeof ICON_NAMES[number]} IconName */
