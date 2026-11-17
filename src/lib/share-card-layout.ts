/**
 * The layout of share cards (Open Graph / Twitter images, 1200×630) and the 88×31 button, in the
 * site's terminal style: satori lays out the text with the site's own font (Geist Mono) and returns
 * an SVG. Turning that into a PNG is up to the caller, so the same layout runs at build time
 * (src/lib/share-card.ts, with resvg's Node build) and in the admin app when it publishes a post
 * (src/lib/admin/card.ts, with resvg's WebAssembly build). No Node-only code here.
 */
import satori from 'satori';

export interface CardFont {
  name: string;
  data: ArrayBuffer | Uint8Array;
  weight: 400 | 700;
}

export interface ShareCard {
  /** Command shown after the prompt, e.g. "cat posts/my-post.md" */
  command: string;
  title: string;
  description?: string;
  /** Footer details after the author, e.g. ["Nov 23, 2025", "3 min read"] */
  meta?: string[];
  /** data: URI of the logo shown in the footer */
  logo?: string;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// The site's dark theme (IBM Carbon tokens in src/style.css)
const C = { bg: '#161616', line: '#393939', fg: '#f2f4f8', mute: '#a8a8a8', accent: '#82cfff' };

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

// Satori sizes boxes without their padding/borders, so the content area is sized explicitly
const PAD_X = 64;
const PAD_TOP = 54;
const PAD_BOTTOM = 50;
const BAR = 8;
const INNER_W = CARD_WIDTH - PAD_X * 2;
const INNER_H = CARD_HEIGHT - BAR - PAD_TOP - PAD_BOTTOM;

/** The share card as an SVG, 1200×630 */
export async function shareCardSvg(card: ShareCard, fonts: CardFont[]): Promise<string> {
  const titleSize = card.title.length > 54 ? 54 : 64;

  const prompt = h('div', { display: 'flex', alignItems: 'center', width: INNER_W, fontSize: 26, whiteSpace: 'nowrap' }, [
    h('span', { color: C.accent }, 'skiddle@web'),
    h('span', { color: C.mute }, ':~$'),
    h('span', { color: C.fg, marginLeft: 16, maxWidth: INNER_W - 280, overflow: 'hidden', textOverflow: 'ellipsis' }, card.command),
    h('div', { width: 15, height: 30, marginLeft: 12, backgroundColor: C.accent }),
  ]);

  const title = h(
    'div',
    { display: 'block', width: INNER_W, marginTop: 52, fontSize: titleSize, fontWeight: 700, lineHeight: 1.18, color: C.fg, lineClamp: 3 },
    card.title,
  );

  const description = card.description
    ? h('div', { display: 'block', width: INNER_W, marginTop: 24, fontSize: 28, lineHeight: 1.45, color: C.mute, lineClamp: 2 }, card.description)
    : null;

  const footerLeft = h('div', { display: 'flex', alignItems: 'center' }, [
    card.logo ? h('img', { width: 44, height: 44, borderRadius: 10, marginRight: 18 }, undefined, { src: card.logo, width: 44, height: 44 }) : null,
    h('span', { color: C.fg }, 'Jeff (Skiddle)'),
    ...(card.meta ?? []).filter(Boolean).map((m) => h('span', { color: C.mute, marginLeft: 14 }, `· ${m}`)),
  ]);

  const footer = h(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: INNER_W, marginTop: 'auto', paddingTop: 26, borderTop: `2px solid ${C.line}`, fontSize: 24 },
    [footerLeft, h('span', { color: C.accent }, 'skiddle.id')],
  );

  const content = h(
    'div',
    { display: 'flex', flexDirection: 'column', width: INNER_W, height: INNER_H, marginTop: PAD_TOP, marginLeft: PAD_X },
    [prompt, title, description, footer].filter(Boolean),
  );

  const root = h(
    'div',
    { display: 'flex', flexDirection: 'column', width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: C.bg, fontFamily: 'Geist Mono, Geist Mono Ext, Noto Sans Thai' },
    [h('div', { width: CARD_WIDTH, height: BAR, backgroundColor: C.accent }), content],
  );

  return satori(root as Parameters<typeof satori>[0], { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: satoriFonts(fonts) });
}

const satoriFonts = (fonts: CardFont[]) =>
  fonts.map((f) => ({ name: f.name, data: f.data instanceof Uint8Array ? f.data.slice().buffer : f.data, weight: f.weight, style: 'normal' as const }));

export const BUTTON_WIDTH = 88;
export const BUTTON_HEIGHT = 31;

/**
 * The site's 88×31 button as an SVG, the classic small web badge other sites use to link here:
 * "skiddle.id" and the cursor in the accent colour, on the dark theme with a 1px border.
 */
export async function buttonSvg(fonts: CardFont[]): Promise<string> {
  const inner = h(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: BUTTON_WIDTH - 2, height: BUTTON_HEIGHT - 2, marginTop: 1, marginLeft: 1, backgroundColor: C.bg, fontSize: 11, fontWeight: 700, color: C.accent },
    [h('span', {}, 'skiddle.id'), h('div', { width: 6, height: 12, marginLeft: 3, backgroundColor: C.accent })],
  );
  const root = h('div', { display: 'flex', width: BUTTON_WIDTH, height: BUTTON_HEIGHT, backgroundColor: C.line, fontFamily: 'Geist Mono' }, [inner]);
  return satori(root as Parameters<typeof satori>[0], { width: BUTTON_WIDTH, height: BUTTON_HEIGHT, fonts: satoriFonts(fonts) });
}
