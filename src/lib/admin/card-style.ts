/**
 * The admin app's share cards' style: the theme's design, colours and headings' font
 * (id.skiddle.theme, src/lib/site-theme.mjs) and the publication's logo (src/lib/card-theme.mjs), read once and kept until the Theme or Publication editor saves
 * (resetCardStyle). Apart from src/lib/admin/card.ts, which loads about 3 MB, so the editors can
 * reset it without loading that. Without a logo, or if it can't be read, cards use the built-in icon.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { THEME_COLLECTION, cardDesignOf, cardLogoCid, type CardDesign } from '~/lib/card-theme.mjs';
import { cardColors, siteThemeOf, type FontId } from '~/lib/site-theme.mjs';
import type { CardColors } from '~/lib/share-card-layout';
import { PUBLICATION_RKEY } from '~/lib/standard-site.mjs';
import { getRecord } from './xrpc';

/** The built-in logo, for cards when the publication has none */
const BUILT_IN_LOGO = '/android-chrome-192x192.png';

export interface CardStyle {
  design: CardDesign;
  /** The logo, as a data: URI */
  logo: string;
  colors: CardColors;
  /** The headings' font */
  font: FontId;
}

let session: OAuthSession | undefined;
let style: Promise<CardStyle> | undefined;

/** Called once the app is signed in */
export function configureCardStyle(s: OAuthSession) {
  session = s;
  style = undefined;
}

/** The style to draw cards in */
export function cardStyle(): Promise<CardStyle> {
  style ??= (async () => {
    const [theme, publication] = session
      ? await Promise.all([
          getRecord(session, THEME_COLLECTION, 'self').catch(() => null),
          getRecord(session, 'site.standard.publication', PUBLICATION_RKEY).catch(() => null),
        ])
      : [null, null];
    const cid = cardLogoCid(publication?.value);
    const logo = (cid ? await dataUri(`/media/${cid}`).catch(() => undefined) : undefined) ?? (await dataUri(BUILT_IN_LOGO));
    const site = siteThemeOf(theme?.value);
    return { design: cardDesignOf(theme?.value), logo, colors: cardColors(site), font: site.fonts.heading };
  })();
  style.catch(() => (style = undefined));
  return style;
}

/** Reads the style again next time: after the theme or the publication's logo changes */
export function resetCardStyle() {
  style = undefined;
}

async function dataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  const bytes = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}
