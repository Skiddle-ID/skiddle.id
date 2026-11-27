/**
 * The share cards' theme: which design they're drawn in (id.skiddle.theme, lexicons/id/skiddle/theme.json)
 * and the logo they show (the publication's icon, site.standard.publication). Read by the build for
 * the pages' cards (src/integrations/share-cards.ts) and by the admin app for posts' and series'
 * (src/lib/admin/card-style.ts). The designs themselves are in src/lib/share-card-layout.ts. No
 * dependencies, so it can be tested in Node.
 */

export const THEME_COLLECTION = 'id.skiddle.theme';

/** @typedef {'terminal' | 'terminal-light' | 'logo'} CardDesign */

/** The designs, in the order the admin app offers them */
export const CARD_DESIGNS = /** @type {const} */ ([
  { id: 'terminal', label: 'Terminal', description: 'A prompt and the title, in the site’s dark colours.' },
  { id: 'terminal-light', label: 'Terminal light', description: 'The same, in the site’s light colours.' },
  { id: 'logo', label: 'Logo', description: 'The logo large, beside the title.' },
]);

/** @type {CardDesign} */
export const DEFAULT_CARD_DESIGN = 'terminal';

/**
 * The design a theme record asks for, or the default for one it doesn't have or the site doesn't know
 * @param {unknown} theme The record's value
 * @returns {CardDesign}
 */
export function cardDesignOf(theme) {
  const d = /** @type {{ cardDesign?: unknown } | null} */ (theme)?.cardDesign;
  return CARD_DESIGNS.some((x) => x.id === d) ? /** @type {CardDesign} */ (d) : DEFAULT_CARD_DESIGN;
}

/** Images a card can draw (satori reads PNG and JPEG) */
const LOGO_TYPES = ['image/png', 'image/jpeg'];

/**
 * The publication's logo, as a blob CID, if it has one a card can draw
 * @param {unknown} publication The site.standard.publication record's value
 * @returns {string | undefined}
 */
export function cardLogoCid(publication) {
  const icon = /** @type {{ icon?: { ref?: { $link?: unknown }, mimeType?: unknown } } | null} */ (publication)?.icon;
  const cid = icon?.ref?.$link;
  return typeof cid === 'string' && LOGO_TYPES.includes(String(icon?.mimeType)) ? cid : undefined;
}
