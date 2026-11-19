/**
 * Shared pieces for the embeddable SVG cards the Worker serves (/music.svg, /latest.svg,
 * /status.svg): themes and accent colours, the font stack, text fitting and escaping, and the
 * HTTP response with an ETag.
 *
 * The cards are mostly shown through an <img> tag (a GitHub profile README, other sites). An SVG
 * inside <img> can't load anything external, so the text uses the system monospace fonts and
 * colours are the site's IBM Carbon tokens (src/style.css).
 *
 * This module has no runtime imports, so cards can be rendered and tested outside the Worker.
 */

export const THEMES = ['auto', 'dark', 'light'] as const;
export const ACCENTS = ['blue', 'teal', 'purple', 'pink', 'green'] as const;
export type CardTheme = (typeof THEMES)[number];
export type CardAccent = (typeof ACCENTS)[number];

export const PALETTE = {
  dark: {
    bg: '#161616', alt: '#1f1f1f', line: '#393939', fg: '#f2f4f8', mute: '#a8a8a8', ok: '#42be65', warn: '#f1c21b', err: '#fa4d56',
    accent: { blue: '#82cfff', teal: '#3ddbd9', purple: '#be95ff', pink: '#ff7eb6', green: '#42be65' },
  },
  light: {
    bg: '#ffffff', alt: '#f4f4f4', line: '#e0e0e0', fg: '#161616', mute: '#525252', ok: '#198038', warn: '#8e6a00', err: '#da1e28',
    accent: { blue: '#0f62fe', teal: '#007d79', purple: '#8a3ffc', pink: '#d02670', green: '#198038' },
  },
} as const;

export const FONT = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace";

// Monospace glyphs are ~0.6em wide; round up a little for Consolas/Menlo differences
export const CHAR_EM = 0.61;

/** Valid theme and accent, with the defaults (auto, blue) for anything else */
export function cardStyle(options: { theme?: string; accent?: string }): { theme: CardTheme; accent: CardAccent } {
  const theme = THEMES.includes(options.theme as CardTheme) ? (options.theme as CardTheme) : 'auto';
  const accent = ACCENTS.includes(options.accent as CardAccent) ? (options.accent as CardAccent) : 'blue';
  return { theme, accent };
}

/** CSS custom properties for the colours: --bg --alt --line --fg --mute --ok --warn --err --acc ("auto" follows the viewer) */
export function colourVars(theme: CardTheme, accent: CardAccent): string {
  const vars = (mode: 'dark' | 'light') => {
    const p = PALETTE[mode];
    return `--bg:${p.bg};--alt:${p.alt};--line:${p.line};--fg:${p.fg};--mute:${p.mute};--ok:${p.ok};--warn:${p.warn};--err:${p.err};--acc:${p.accent[accent]}`;
  };
  return theme === 'auto' ? `svg{${vars('dark')}}@media (prefers-color-scheme:light){svg{${vars('light')}}}` : `svg{${vars(theme)}}`;
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s: string): string[] => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s));

// Approximate width of one grapheme in monospace columns (~0.6em each), from browser measurements:
// Latin/Cyrillic 1; CJK, Hangul and emoji ~1.4-1.7 (counted as 2); Thai ~1.05, and the other
// scripts that fall back to proportional fonts vary by platform (counted as 1.2)
// The ranges are written as \u escapes, not the characters themselves: Unicode normalisation (NFC)
// turns U+F900, the first CJK compatibility ideograph, into U+8C48, which once stretched that range
// over Latin Extended, Javanese, Cherokee and private-use characters.
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F000}-\u{1FAFF}\u{20000}-\u{3FFFD}]|\p{Extended_Pictographic}/u;
const PROPORTIONAL = /[\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0EFF\u0F00-\u109F\u1780-\u17FF]/u;
const columns = (g: string) => (WIDE.test(g) ? 2 : PROPORTIONAL.test(g) ? 1.2 : 1);

/** Width of text in monospace columns */
export function textColumns(text: string): number {
  return graphemes(text).reduce((n, g) => n + columns(g), 0);
}

/** Shortens text to roughly `max` monospace columns, ending with an ellipsis */
export function fit(text: string, max: number): string {
  const parts = graphemes(text);
  if (parts.reduce((n, g) => n + columns(g), 0) <= max) return text;
  let out = '';
  let used = 0;
  for (const g of parts) {
    const c = columns(g);
    if (used + c > max - 1) break;
    out += g;
    used += c;
  }
  return `${out.trimEnd()}…`;
}

/** Collapses whitespace and drops characters that aren't allowed in XML */
export function clean(value: string | undefined): string {
  let s = String(value ?? '');
  if (typeof s.toWellFormed === 'function') s = s.toWellFormed();
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￾￿]/g, '').replace(/\s+/g, ' ').trim();
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A query parameter if it's one of the allowed values, otherwise the fallback */
export function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  const v = (value ?? '').toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * The HTTP response for a card: no-cache plus an ETag, so embeds (e.g. GitHub's image proxy)
 * revalidate on every view and get a 304 when nothing changed.
 */
export async function svgResponse(request: Request, svg: string): Promise<Response> {
  const etag = `"${await digest(svg)}"`;
  const headers = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-cache, max-age=0',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  };
  const ifNoneMatch = request.headers.get('If-None-Match') ?? '';
  if (ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(svg, { status: 200, headers });
}

async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}
