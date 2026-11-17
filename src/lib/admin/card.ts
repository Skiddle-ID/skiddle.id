/**
 * Share cards drawn in the browser: a post's when the admin app publishes it, a series' when it's
 * saved, and either when the editor shows it. The same layout as the build's cards
 * (src/lib/share-card-layout.ts), turned into a PNG by resvg's WebAssembly build. It draws exactly
 * what the build draws (the same resvg version).
 *
 * Loaded only when needed (the editor imports it on demand): satori, resvg and the fonts are about
 * 3 MB. The admin page's CSP allows WebAssembly ('wasm-unsafe-eval', src/integrations/security-headers.ts).
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url';
import mono400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url';
import mono700 from '@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff?url';
import monoExt400 from '@fontsource/geist-mono/files/geist-mono-latin-ext-400-normal.woff?url';
import monoExt700 from '@fontsource/geist-mono/files/geist-mono-latin-ext-700-normal.woff?url';
import thai400 from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff?url';
import thai700 from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff?url';
import { CARD_WIDTH, shareCardSvg, type CardFont } from '~/lib/share-card-layout';
import { postCard, seriesCard, type CardPost, type CardSeries, type CardText } from './card-text';

export type { CardPost, CardSeries };

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

let ready: Promise<{ fonts: CardFont[]; logo: string }> | undefined;

/** Fonts, the logo and resvg, fetched once */
function load() {
  ready ??= (async () => {
    const bytes = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    };
    const [fonts, logo] = await Promise.all([
      Promise.all(FONTS.map(async (f) => ({ name: f.name, weight: f.weight, data: await bytes(f.url) }))),
      bytes('/android-chrome-192x192.png').then((png) => `data:image/png;base64,${btoa(Array.from(png, (b) => String.fromCharCode(b)).join(''))}`),
      initWasm(fetch(resvgWasm)),
    ]);
    return { fonts, logo };
  })();
  ready.catch(() => (ready = undefined));
  return ready;
}

/** A card as a 1200×630 PNG */
async function draw(card: CardText): Promise<Blob> {
  const { fonts, logo } = await load();
  const svg = await shareCardSvg({ ...card, logo }, fonts);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng();
  return new Blob([new Uint8Array(png)], { type: 'image/png' });
}

/** The post's share card, as the build would draw it */
export const drawPostCard = (post: CardPost) => draw(postCard(post));

/** The series' share card */
export const drawSeriesCard = (series: CardSeries) => draw(seriesCard(series));
