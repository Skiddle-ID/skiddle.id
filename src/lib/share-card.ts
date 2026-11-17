/**
 * Share cards (Open Graph / Twitter images, 1200×630 PNG) and the 88×31 button, rendered at build
 * time by src/integrations/share-cards.ts. The layout is src/lib/share-card-layout.ts (shared with
 * the admin app, which draws a post's card when it publishes it); resvg's Node build turns the SVG
 * into a PNG here. Social sites don't show SVG previews, hence PNG.
 */
import { Resvg } from '@resvg/resvg-js';
import { BUTTON_WIDTH, CARD_WIDTH, buttonSvg, shareCardSvg, type CardFont, type ShareCard } from './share-card-layout';

export { BUTTON_HEIGHT, BUTTON_WIDTH, CARD_HEIGHT, CARD_WIDTH, type CardFont, type ShareCard } from './share-card-layout';

export async function renderShareCard(card: ShareCard, fonts: CardFont[]): Promise<Buffer> {
  return new Resvg(await shareCardSvg(card, fonts), { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng();
}

/** The 88×31 button; `scale` 2 renders it at 176×62 for high-density screens */
export async function renderButton(fonts: CardFont[], scale = 1): Promise<Buffer> {
  return new Resvg(await buttonSvg(fonts), { fitTo: { mode: 'width', value: BUTTON_WIDTH * scale } }).render().asPng();
}
