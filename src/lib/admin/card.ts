/**
 * Share cards drawn in the browser: a post's when the admin app publishes it, a series' when it's
 * saved, a page's when the block editor publishes it, and a post's or a series' when its editor
 * shows it. The same layout as the build's cards
 * (src/lib/share-card-layout.ts), turned into a PNG by resvg's WebAssembly build. It draws exactly
 * what the build draws (the same resvg version).
 *
 * Loaded only when needed (the editor imports it on demand): satori, resvg and the fonts are about
 * 3 MB. The admin page's CSP allows WebAssembly ('wasm-unsafe-eval', src/integrations/security-headers.ts).
 * The design and the logo are the theme's and the publication's (src/lib/admin/card-style.ts).
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url';
import mono400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url';
import mono700 from '@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff?url';
import monoExt400 from '@fontsource/geist-mono/files/geist-mono-latin-ext-400-normal.woff?url';
import monoExt700 from '@fontsource/geist-mono/files/geist-mono-latin-ext-700-normal.woff?url';
import thai400 from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff?url';
import thai700 from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff?url';
import cardGeist400 from '@fontsource/geist/files/geist-latin-400-normal.woff?url';
import cardGeist700 from '@fontsource/geist/files/geist-latin-700-normal.woff?url';
import cardIbmPlexSans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import cardIbmPlexSans700 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff?url';
import cardIbmPlexMono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff?url';
import cardIbmPlexMono700 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff?url';
import cardInter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import cardInter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import cardJetbrainsMono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url';
import cardJetbrainsMono700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url';
import cardSourceSerifFour400 from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url';
import cardSourceSerifFour700 from '@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url';
import type { CardDesign } from '~/lib/card-theme.mjs';
import { fontOf, type FontId } from '~/lib/site-theme.mjs';
import { CARD_WIDTH, shareCardSvg, type CardFont } from '~/lib/share-card-layout';
import { cardStyle } from './card-style';
import { pageCard, postCard, seriesCard, type CardPage, type CardPost, type CardSeries, type CardText } from './card-text';

export type { CardPage, CardPost, CardSeries };

// The same fonts as the build (src/integrations/share-cards.ts); satori reads WOFF, not WOFF2
const FONTS: { name: string; weight: 400 | 700; url: string }[] = [
  { name: 'Geist Mono', weight: 400, url: mono400 },
  { name: 'Geist Mono', weight: 700, url: mono700 },
  // Separate family names: satori only falls back between differently named fonts
  { name: 'Geist Mono Ext', weight: 400, url: monoExt400 },
  { name: 'Geist Mono Ext', weight: 700, url: monoExt700 },
  { name: 'Noto Sans Thai', weight: 400, url: thai400 },
  { name: 'Noto Sans Thai', weight: 700, url: thai700 },
];

/** The theme's other headings' fonts, fetched when the theme uses one: Geist Mono is always in FONTS */
const HEADING_FONTS: Record<Exclude<FontId, 'geist-mono'>, [string, string]> = {
  'geist': [cardGeist400, cardGeist700],
  'ibm-plex-sans': [cardIbmPlexSans400, cardIbmPlexSans700],
  'ibm-plex-mono': [cardIbmPlexMono400, cardIbmPlexMono700],
  'inter': [cardInter400, cardInter700],
  'jetbrains-mono': [cardJetbrainsMono400, cardJetbrainsMono700],
  'source-serif-4': [cardSourceSerifFour400, cardSourceSerifFour700],
};

let ready: Promise<CardFont[]> | undefined;
const headings = new Map<FontId, Promise<CardFont[]>>();

const bytes = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
};

/** Fonts and resvg, fetched once */
function load() {
  ready ??= (async () => {
    const [fonts] = await Promise.all([Promise.all(FONTS.map(async (f) => ({ name: f.name, weight: f.weight, data: await bytes(f.url) }))), initWasm(fetch(resvgWasm))]);
    return fonts;
  })();
  ready.catch(() => (ready = undefined));
  return ready;
}

/** The headings' font, fetched once; none for Geist Mono, which load() has */
function headingFont(id: FontId): Promise<CardFont[]> {
  if (id === 'geist-mono') return Promise.resolve([]);
  let fonts = headings.get(id);
  if (!fonts) {
    const name = fontOf(id).family;
    const [w400, w700] = HEADING_FONTS[id];
    fonts = Promise.all([bytes(w400), bytes(w700)]).then(([a, b]) => [
      { name, weight: 400 as const, data: a },
      { name, weight: 700 as const, data: b },
    ]);
    fonts.catch(() => headings.delete(id));
    headings.set(id, fonts);
  }
  return fonts;
}

/** A card as a 1200×630 PNG, in the theme's design unless another is asked for */
async function draw(card: CardText, design?: CardDesign): Promise<Blob> {
  const [fonts, style] = await Promise.all([load(), cardStyle()]);
  const heading = await headingFont(style.font);
  const svg = await shareCardSvg({ ...card, logo: style.logo, design: design ?? style.design, colors: style.colors, font: fontOf(style.font).family }, [...heading, ...fonts]);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng();
  return new Blob([new Uint8Array(png)], { type: 'image/png' });
}

/** The post's share card, as the build would draw it */
export const drawPostCard = (post: CardPost) => draw(postCard(post));

/** The series' share card */
export const drawSeriesCard = (series: CardSeries) => draw(seriesCard(series));

/** A page's share card, drawn when the block editor publishes it (src/lib/admin/block-editor.ts) */
export const drawPageCard = (page: CardPage) => draw(pageCard(page));

/** A sample post's card in a design, for the Theme editor's previews */
export const drawSampleCard = (design: CardDesign) =>
  draw(
    postCard({
      slug: 'a-post',
      title: 'A post’s title, as its share card shows it',
      description: 'Its description, up to a couple of lines, under the title.',
      publishedAt: new Date(),
      markdown: 'word '.repeat(900),
    }),
    design,
  );
