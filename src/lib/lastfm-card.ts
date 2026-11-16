/**
 * SVG renderer for the Last.fm "now playing" card served at /lastfm.svg.
 *
 * Album art comes in as a data: URI, because an SVG inside <img> can't load
 * anything external. Themes, colours and text helpers are shared with the
 * other cards in ./embed-card.ts.
 */

import { CHAR_EM, FONT, cardStyle, clean, colourVars, esc, fit } from './embed-card';

export { ACCENTS, THEMES, fit, type CardAccent, type CardTheme } from './embed-card';
import type { CardAccent, CardTheme } from './embed-card';

export interface CardTrack {
  name: string;
  artist: string;
  album?: string;
  isCurrent: boolean;
  /** Unix seconds when the track was scrobbled (absent while it's playing) */
  playedAt?: number;
  /** Album art as a data:image/...;base64 URI */
  art?: string;
}

export interface CardOptions {
  theme?: CardTheme;
  accent?: CardAccent;
  /** Unix seconds used for "5 min ago"; defaults to the current time */
  now?: number;
}

// Layout (px)
const W = 540;
const H = 130;
const PAD = 16;
const ART = 60;
const ART_Y = 54;
const TEXT_X = PAD + ART + 14;
const TEXT_W = W - PAD - TEXT_X;
const TITLE_PX = 15;
const SUB_PX = 12.5;

/** Renders the card. `track` null means nothing to show (no scrobbles yet, or Last.fm unavailable). */
export function renderCard(track: CardTrack | null, options: CardOptions = {}): string {
  const { theme, accent } = cardStyle(options);
  const now = options.now ?? Date.now() / 1000;

  const name = clean(track?.name);
  const artist = clean(track?.artist);
  const album = clean(track?.album);
  const showAlbum = album && album.toLowerCase() !== name.toLowerCase();
  const art = track?.art && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(track.art) ? track.art : '';

  const when = track && !track.isCurrent && track.playedAt ? ago(track.playedAt, now) : '';
  const title = !track
    ? 'Nothing playing right now'
    : fit(name || 'Unknown track', Math.floor(TEXT_W / (TITLE_PX * CHAR_EM)));
  const sub = !track
    ? 'Check back soon'
    : fit([artist || 'Unknown artist', showAlbum ? album : ''].filter(Boolean).join(' · '), Math.floor(TEXT_W / (SUB_PX * CHAR_EM)));
  const label = !track
    ? 'Last.fm: nothing playing right now'
    : `${track.isCurrent ? 'Now playing' : 'Last played'} on Last.fm: ${name} by ${artist}${when ? ` (${when})` : ''}`;

  const colours = colourVars(theme, accent);

  const statusY = 67;
  let status: string;
  if (track?.isCurrent) {
    const bars = [0, 1, 2]
      .map((i) => `<rect class="bar b${i}" x="${TEXT_X + i * 5}" y="${statusY - 10}" width="3" height="10" rx="1"/>`)
      .join('');
    status = `<g class="ok">${bars}</g><text x="${TEXT_X + 20}" y="${statusY}" class="k ok">now playing</text>`;
  } else {
    status = `<text x="${TEXT_X}" y="${statusY}" class="k mute">${esc(!track ? 'offline' : when ? `last played · ${when}` : 'last played')}</text>`;
  }

  const cover = art
    ? `<image xlink:href="${art}" x="${PAD}" y="${ART_Y}" width="${ART}" height="${ART}" preserveAspectRatio="xMidYMid slice" clip-path="url(#lfm-art)"/>` +
      `<rect x="${PAD + 0.5}" y="${ART_Y + 0.5}" width="${ART - 1}" height="${ART - 1}" rx="4" class="frame"/>`
    : `<rect x="${PAD + 0.5}" y="${ART_Y + 0.5}" width="${ART - 1}" height="${ART - 1}" rx="4" class="alt"/>` +
      `<text x="${PAD + ART / 2}" y="${ART_Y + ART / 2 + 8}" text-anchor="middle" class="mute" font-size="22">♪</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lfm-title">
<title id="lfm-title">${esc(label)}</title>
<style>${colours}
text{font-family:${FONT}}
.card{fill:var(--bg);stroke:var(--line)}.alt{fill:var(--alt);stroke:var(--line)}.frame{fill:none;stroke:var(--line)}
.fg{fill:var(--fg)}.mute{fill:var(--mute)}.acc{fill:var(--acc)}.ok{fill:var(--ok)}
.rule{stroke:var(--line);stroke-dasharray:3 4}
.p{font-size:12.5px}.t{font-size:${TITLE_PX}px;font-weight:700}.s{font-size:${SUB_PX}px}.k{font-size:11px;letter-spacing:.04em}.brand{font-size:11px}
.cur{animation:blink 1.06s steps(1,end) infinite}@keyframes blink{50%{fill-opacity:0}}
.bar{transform-box:fill-box;transform-origin:50% 100%;animation:eq .9s ease-in-out infinite}.b1{animation-delay:-.3s}.b2{animation-delay:-.6s}
@keyframes eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.cur,.bar{animation:none}}
</style>
<defs><clipPath id="lfm-art"><rect x="${PAD}" y="${ART_Y}" width="${ART}" height="${ART}" rx="4"/></clipPath><clipPath id="lfm-text"><rect x="${TEXT_X}" y="44" width="${TEXT_W}" height="${H - 44}"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" class="card"/>
<text x="${PAD}" y="27" class="p"><tspan class="acc">skiddle@web</tspan><tspan class="mute">:~$</tspan><tspan class="fg"> now-playing</tspan><tspan class="acc cur"> █</tspan></text>
<text x="${W - PAD}" y="27" text-anchor="end" class="brand mute">last.fm</text>
<line x1="${PAD}" y1="41.5" x2="${W - PAD}" y2="41.5" class="rule"/>
${cover}
<g clip-path="url(#lfm-text)">${status}
<text x="${TEXT_X}" y="89" class="t fg">${esc(title)}</text>
<text x="${TEXT_X}" y="108" class="s mute">${esc(sub)}</text></g>
</svg>`;
}

/** "just now", "5 min ago", "2 hours ago", "yesterday", "12 days ago" or a date */
export function ago(playedAt: number, now: number): string {
  const s = Math.max(0, Math.round(now - playedAt));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(playedAt * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
