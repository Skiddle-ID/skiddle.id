/**
 * The site's design (id.skiddle.theme, lexicons/id/skiddle/theme.json, docs/v4/themes.md): its mode
 * and default accent for visitors who haven't picked their own, its colours for dark and light, its
 * fonts, text size and line heights, its corners and spacing, and the terminal touches it shows.
 * Every field is optional and read field by field: one the record leaves out, or that the site
 * doesn't know, keeps today's value (src/style.css), so an empty record is today's site.
 *
 * The page gets the design as CSS custom properties (themeCss), set in a <style> in its head by
 * src/layouts/shell.astro. Every value in that CSS comes from a number the record holds or a table
 * here, never from the record's text, so no record can put its own CSS into a page. The share
 * cards' design is in the same record (src/lib/card-theme.mjs). No dependencies, so it can be
 * tested in Node.
 */

/** @typedef {'device' | 'dark' | 'light'} SiteMode */
/** @typedef {'blue' | 'teal' | 'purple' | 'pink' | 'green'} Accent */
/** @typedef {'dark' | 'light'} Scheme */
/** @typedef {'bg' | 'bgAlt' | 'border' | 'text' | 'muted' | Accent} ColorName */
/** A colour as the page uses it: `#rrggbb`, made here from three numbers */
/** @typedef {string} Hex */
/** @typedef {Record<ColorName, Hex>} Palette */
/** @typedef {'geist-mono' | 'geist' | 'ibm-plex-sans' | 'ibm-plex-mono' | 'inter' | 'jetbrains-mono' | 'source-serif-4'} FontId */
/** @typedef {'heading' | 'text' | 'post' | 'code'} FontSlot */
/** @typedef {'small' | 'normal' | 'large' | 'larger'} TextSize */
/** @typedef {'tight' | 'normal' | 'loose'} LineHeight */
/** @typedef {'none' | 'small' | 'round'} Radius */
/** @typedef {'compact' | 'normal' | 'roomy'} Spacing */
/**
 * @typedef {{
 *   mode: SiteMode,
 *   accent: Accent,
 *   colors: Record<Scheme, Palette>,
 *   fonts: Record<FontSlot, FontId>,
 *   textSize: TextSize,
 *   textLineHeight: LineHeight,
 *   postLineHeight: LineHeight,
 *   radius: Radius,
 *   spacing: Spacing,
 *   noPrompt: boolean,
 *   noCursor: boolean,
 *   noHeadingMarks: boolean,
 * }} SiteTheme
 */

/** @type {SiteMode[]} */
export const MODES = ['device', 'dark', 'light'];
/** The accents, in the order the sidebar's button goes through them */
/** @type {Accent[]} */
export const ACCENTS = ['blue', 'teal', 'purple', 'pink', 'green'];
/** @type {Scheme[]} */
export const SCHEMES = ['dark', 'light'];

/** The colours a theme can set, each with its label in the editor */
/** @type {{ id: ColorName, label: string }[]} */
export const COLORS = [
  { id: 'bg', label: 'Background' },
  { id: 'bgAlt', label: 'Alternate background' },
  { id: 'border', label: 'Border' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted text' },
  ...ACCENTS.map((id) => ({ id, label: `Accent: ${id}` })),
];

/** Today's colours (IBM Carbon), as src/style.css has them */
/** @type {Record<Scheme, Palette>} */
export const DEFAULT_COLORS = {
  dark: { bg: '#161616', bgAlt: '#1f1f1f', border: '#393939', text: '#f2f4f8', muted: '#a8a8a8', blue: '#82cfff', teal: '#3ddbd9', purple: '#be95ff', pink: '#ff7eb6', green: '#42be65' },
  light: { bg: '#ffffff', bgAlt: '#f4f4f4', border: '#e0e0e0', text: '#161616', muted: '#525252', blue: '#0f62fe', teal: '#007d79', purple: '#8a3ffc', pink: '#d02670', green: '#198038' },
};

/**
 * The fonts the site bundles (@fontsource, latin, 400 and 600, and src/style.css's @font-face for
 * each): its id is its package's name. A browser downloads a font only when the page uses it.
 */
/** @type {{ id: FontId, label: string, family: string, stack: string }[]} */
export const FONTS = [
  { id: 'geist-mono', label: 'Geist Mono', family: 'Geist Mono', stack: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: 'geist', label: 'Geist', family: 'Geist', stack: "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', family: 'IBM Plex Sans', stack: "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', family: 'IBM Plex Mono', stack: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: 'inter', label: 'Inter', family: 'Inter', stack: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: 'source-serif-4', label: 'Source Serif 4', family: 'Source Serif 4', stack: "'Source Serif 4', ui-serif, Georgia, Cambria, serif" },
];

/** Where each font slot shows, for the editor */
/** @type {{ id: FontSlot, label: string }[]} */
export const FONT_SLOTS = [
  { id: 'heading', label: 'Headings and menus' },
  { id: 'text', label: 'Text' },
  { id: 'post', label: 'Post text' },
  { id: 'code', label: 'Code' },
];

/** The text size: a step scales the root font size, so every size and the spacing follow */
/** @type {{ id: TextSize, label: string, scale: number }[]} */
export const TEXT_SIZES = [
  { id: 'small', label: 'Small', scale: 14 / 15 },
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'large', label: 'Large', scale: 16 / 15 },
  { id: 'larger', label: 'Larger', scale: 17 / 15 },
];

/** Line heights: for the site's text (the body, and pages' Markdown) and for posts */
/** @type {{ id: LineHeight, label: string, text: string, prose: string, post: string }[]} */
export const LINE_HEIGHTS = [
  { id: 'tight', label: 'Tight', text: '160%', prose: '1.65', post: '1.55' },
  { id: 'normal', label: 'Normal', text: '180%', prose: '1.85', post: '1.7' },
  { id: 'loose', label: 'Loose', text: '200%', prose: '2.05', post: '1.85' },
];

/** Corners: Tailwind's radius scale, which the site's rounded corners use ('small' is Tailwind's own) */
/** @type {{ id: Radius, label: string, sizes: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', string> }[]} */
export const RADII = [
  { id: 'none', label: 'None', sizes: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' } },
  { id: 'small', label: 'Small', sizes: { xs: '0.125rem', sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' } },
  { id: 'round', label: 'Round', sizes: { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' } },
];

/** Spacing: Tailwind's --spacing, the unit of every padding, margin and gap */
/** @type {{ id: Spacing, label: string, unit: string }[]} */
export const SPACINGS = [
  { id: 'compact', label: 'Compact', unit: '0.2rem' },
  { id: 'normal', label: 'Normal', unit: '0.25rem' },
  { id: 'roomy', label: 'Roomy', unit: '0.3rem' },
];

/** The terminal touches, each a switch whose `false` (or no field) is today's look */
export const DECORATIONS = /** @type {const} */ ([
  { id: 'noPrompt', attr: 'data-no-prompt', label: 'Hide the prompts', help: 'The “skiddle@web:~$” lines above some sections and in the search.' },
  { id: 'noCursor', attr: 'data-no-cursor', label: 'Hide the cursor', help: 'The blinking block after the site’s name.' },
  { id: 'noHeadingMarks', attr: 'data-no-heading-marks', label: 'Hide the heading marks', help: 'The “#” and “##” before headings.' },
]);

/** @type {SiteTheme} */
export const DEFAULT_SITE_THEME = {
  mode: 'device',
  accent: 'blue',
  colors: DEFAULT_COLORS,
  fonts: { heading: 'geist-mono', text: 'geist-mono', post: 'geist', code: 'geist-mono' },
  textSize: 'normal',
  textLineHeight: 'normal',
  postLineHeight: 'normal',
  radius: 'small',
  spacing: 'normal',
  noPrompt: false,
  noCursor: false,
  noHeadingMarks: false,
};

/** @param {unknown} v */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * @template {string} T
 * @param {readonly { id: T }[] | readonly T[]} table
 * @param {unknown} v
 * @param {T} fallback
 * @returns {T}
 */
function pick(table, v, fallback) {
  const ids = table.map((x) => (typeof x === 'string' ? x : x.id));
  return ids.includes(/** @type {T} */ (v)) ? /** @type {T} */ (v) : fallback;
}

/** @param {unknown} n */
const isChannel = (n) => Number.isInteger(n) && /** @type {number} */ (n) >= 0 && /** @type {number} */ (n) <= 255;

/**
 * A record's colour (`{ r, g, b }`, whole numbers from 0 to 255) as `#rrggbb`, if it is one
 * @param {unknown} c
 * @returns {Hex | undefined}
 */
export function hexOf(c) {
  if (!isObject(c)) return undefined;
  const { r, g, b } = /** @type {{ r?: unknown, g?: unknown, b?: unknown }} */ (c);
  if (!isChannel(r) || !isChannel(g) || !isChannel(b)) return undefined;
  return `#${[r, g, b].map((n) => /** @type {number} */ (n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * `#rrggbb` as the record's `{ r, g, b }`
 * @param {Hex} hex
 */
export function rgbOf(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * The design a theme record asks for, field by field, with today's value for what it doesn't have
 * or the site doesn't know
 * @param {unknown} theme The record's value
 * @returns {SiteTheme}
 */
export function siteThemeOf(theme) {
  const t = isObject(theme) ? /** @type {Record<string, unknown>} */ (theme) : {};
  const colors = isObject(t.colors) ? /** @type {Record<string, unknown>} */ (t.colors) : {};
  const fonts = isObject(t.fonts) ? /** @type {Record<string, unknown>} */ (t.fonts) : {};
  const D = DEFAULT_SITE_THEME;
  /** @param {Scheme} scheme */
  const palette = (scheme) => {
    const set = isObject(colors[scheme]) ? /** @type {Record<string, unknown>} */ (colors[scheme]) : {};
    return /** @type {Palette} */ (Object.fromEntries(COLORS.map(({ id }) => [id, hexOf(set[id]) ?? DEFAULT_COLORS[scheme][id]])));
  };
  return {
    mode: pick(MODES, t.mode, D.mode),
    accent: pick(ACCENTS, t.accent, D.accent),
    colors: { dark: palette('dark'), light: palette('light') },
    fonts: /** @type {Record<FontSlot, FontId>} */ (Object.fromEntries(FONT_SLOTS.map(({ id }) => [id, pick(FONTS, fonts[id], D.fonts[id])]))),
    textSize: pick(TEXT_SIZES, t.textSize, D.textSize),
    textLineHeight: pick(LINE_HEIGHTS, t.textLineHeight, D.textLineHeight),
    postLineHeight: pick(LINE_HEIGHTS, t.postLineHeight, D.postLineHeight),
    radius: pick(RADII, t.radius, D.radius),
    spacing: pick(SPACINGS, t.spacing, D.spacing),
    noPrompt: t.noPrompt === true,
    noCursor: t.noCursor === true,
    noHeadingMarks: t.noHeadingMarks === true,
  };
}

/**
 * A table's row for an id the theme already holds (siteThemeOf only keeps ids its table has)
 * @template {{ id: string }} R
 * @param {readonly R[]} table
 * @param {string} id
 * @returns {R}
 */
export const rowOf = (table, id) => /** @type {R} */ (table.find((r) => r.id === id));

/**
 * A font in the catalogue
 * @param {FontId} id
 */
export const fontOf = (id) => rowOf(FONTS, id);

/**
 * The CSS custom properties for the page's head: only those the theme changes from today's look,
 * so an unchanged theme gives '' and the page is exactly today's. src/style.css reads the
 * `--theme-*` ones, each with today's value as its fallback; `--radius-*` and `--spacing` are
 * Tailwind's own.
 * @param {SiteTheme} theme
 * @returns {string}
 */
export function themeCss(theme) {
  const D = DEFAULT_SITE_THEME;
  /** @type {[string, string][]} */
  const vars = [];
  for (const scheme of SCHEMES) {
    for (const { id } of COLORS) {
      if (theme.colors[scheme][id] !== D.colors[scheme][id]) vars.push([`--theme-${scheme}-${id}`, theme.colors[scheme][id]]);
    }
  }
  for (const { id } of FONT_SLOTS) {
    if (theme.fonts[id] !== D.fonts[id]) vars.push([`--theme-font-${id}`, fontOf(theme.fonts[id]).stack]);
  }
  if (theme.textSize !== D.textSize) vars.push(['--theme-text-scale', String(Number(rowOf(TEXT_SIZES, theme.textSize).scale.toFixed(4)))]);
  if (theme.textLineHeight !== D.textLineHeight) {
    const { text, prose } = rowOf(LINE_HEIGHTS, theme.textLineHeight);
    vars.push(['--theme-leading-text', text], ['--theme-leading-prose', prose]);
  }
  if (theme.postLineHeight !== D.postLineHeight) vars.push(['--theme-leading-post', rowOf(LINE_HEIGHTS, theme.postLineHeight).post]);
  if (theme.radius !== D.radius) for (const [size, value] of Object.entries(rowOf(RADII, theme.radius).sizes)) vars.push([`--radius-${size}`, value]);
  if (theme.spacing !== D.spacing) vars.push(['--spacing', rowOf(SPACINGS, theme.spacing).unit]);
  return vars.length ? `:root{${vars.map(([k, v]) => `${k}:${v}`).join(';')}}` : '';
}

/**
 * The attributes <html> gets for the decorations the theme turns off (src/style.css hides them)
 * @param {SiteTheme} theme
 * @returns {Record<string, ''>}
 */
export function decorationAttributes(theme) {
  return Object.fromEntries(DECORATIONS.filter((d) => theme[d.id]).map((d) => [d.attr, '']));
}

/**
 * The fonts a page preloads, in order: the text's and the headings', and on a post its text's
 * @param {SiteTheme} theme
 * @param {boolean} article
 * @returns {FontId[]}
 */
export function fontsToPreload(theme, article) {
  return [...new Set([theme.fonts.text, theme.fonts.heading, ...(article ? [theme.fonts.post] : [])])];
}

/**
 * A colour's relative luminance (WCAG 2.2)
 * @param {Hex} hex
 */
function luminance(hex) {
  const { r, g, b } = rgbOf(hex);
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * The contrast ratio of two colours, from 1 to 21 (WCAG 2.2)
 * @param {Hex} a
 * @param {Hex} b
 */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA's minimum contrast for normal text */
export const AA_NORMAL = 4.5;

/**
 * The text colours that fall under WCAG AA against the backgrounds they're used on, in both modes.
 * Every one of them is used for body-size text (muted text for dates, the accents for links), so
 * each needs the normal-text ratio, 4.5:1, not the 3:1 that large text alone may have.
 * @param {SiteTheme} theme
 * @returns {{ scheme: Scheme, fg: ColorName, bg: ColorName, ratio: number, needs: number }[]}
 */
export function contrastProblems(theme) {
  const out = [];
  for (const scheme of SCHEMES) {
    const p = theme.colors[scheme];
    for (const fg of /** @type {ColorName[]} */ (['text', 'muted', ...ACCENTS])) {
      for (const bg of /** @type {ColorName[]} */ (['bg', 'bgAlt'])) {
        const ratio = contrastRatio(p[fg], p[bg]);
        if (ratio < AA_NORMAL) out.push({ scheme, fg, bg, ratio, needs: AA_NORMAL });
      }
    }
  }
  return out;
}

/**
 * The share cards' colours, for a design in the site's dark or light colours: the theme's
 * background, border, text and muted text, and its default accent
 * @param {SiteTheme} theme
 * @returns {Record<Scheme, { bg: Hex, line: Hex, fg: Hex, mute: Hex, accent: Hex }>}
 */
export function cardColors(theme) {
  /** @param {Palette} p */
  const of = (p) => ({ bg: p.bg, line: p.border, fg: p.text, mute: p.muted, accent: p[theme.accent] });
  return { dark: of(theme.colors.dark), light: of(theme.colors.light) };
}
