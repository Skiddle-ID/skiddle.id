/**
 * The site's look for visitors who haven't picked their own (id.skiddle.theme, lexicons/id/skiddle/theme.json):
 * its mode (follow the device, or always dark or light) and its accent colour, one of the five the
 * site has (src/style.css). A visitor's own choice (the sidebar's buttons, kept in their browser)
 * still wins. The share cards' design is in the same record (src/lib/card-theme.mjs). No
 * dependencies, so it can be tested in Node.
 */

/** @typedef {'device' | 'dark' | 'light'} SiteMode */
/** @typedef {'blue' | 'teal' | 'purple' | 'pink' | 'green'} Accent */
/** @typedef {{ mode: SiteMode, accent: Accent }} SiteTheme */

/** @type {SiteMode[]} */
export const MODES = ['device', 'dark', 'light'];
/** The accents, in the order the sidebar's button goes through them */
/** @type {Accent[]} */
export const ACCENTS = ['blue', 'teal', 'purple', 'pink', 'green'];

/** @type {SiteTheme} */
export const DEFAULT_SITE_THEME = { mode: 'device', accent: 'blue' };

/**
 * The look a theme record asks for, field by field, with the defaults for what it doesn't have or
 * the site doesn't know
 * @param {unknown} theme The record's value
 * @returns {SiteTheme}
 */
export function siteThemeOf(theme) {
  const t = /** @type {{ mode?: unknown, accent?: unknown } | null} */ (theme);
  return {
    mode: MODES.includes(/** @type {SiteMode} */ (t?.mode)) ? /** @type {SiteMode} */ (t?.mode) : DEFAULT_SITE_THEME.mode,
    accent: ACCENTS.includes(/** @type {Accent} */ (t?.accent)) ? /** @type {Accent} */ (t?.accent) : DEFAULT_SITE_THEME.accent,
  };
}
