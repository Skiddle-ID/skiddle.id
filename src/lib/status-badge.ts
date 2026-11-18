/**
 * SVG renderer for the status badge served at /status.svg: "● open to consulting · Bangkok 14:32",
 * made for a GitHub profile README, an email signature or a link in a bio. The status comes from
 * src/lib/at-status.ts; the dot's colour is its state (src/lib/status-states.mjs), or the status's
 * emoji takes the dot's place. The time is the local time where Jeff is, when the badge is loaded.
 */
import { CHAR_EM, FONT, cardStyle, clean, colourVars, esc, textColumns, type CardAccent, type CardTheme } from './embed-card';
import type { Status } from '~/data/status';
import { STATE_INFO } from '~/lib/status-states.mjs';

export interface StatusBadgeOptions {
  theme?: CardTheme;
  accent?: CardAccent;
  /** The moment to show the time for; defaults to now */
  now?: Date;
}

const H = 28;
const FONT_PX = 12;
const DOT_X = 14;
const TEXT_X = 26;
/** With an emoji in the dot's place: it's wider, so the text starts a little later */
const EMOJI_X = 15;
const EMOJI_TEXT_X = 30;
const EMOJI_PX = 14;
const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const PAD_R = 12;

export function renderStatusBadge(status: Status, options: StatusBadgeOptions = {}): string {
  const { theme, accent } = cardStyle(options);
  const now = options.now ?? new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: status.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);

  const label = clean(status.label);
  const city = clean(status.city);
  const where = ` · ${city} `;
  const emoji = status.emoji;
  const textX = emoji ? EMOJI_TEXT_X : TEXT_X;
  const W = Math.ceil(textX + textColumns(label + where + time) * FONT_PX * CHAR_EM + PAD_R);
  const { label: stateLabel, tone } = STATE_INFO[status.state];
  const available = status.state === 'available';
  // No second full stop after a status that ends in one
  const summary = `${stateLabel}: ${label}${/[.!?…]$/.test(label) ? '' : '.'} ${city}, ${time} local time`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="st-title">
<title id="st-title">${esc(summary)}</title>
<style>${colourVars(theme, accent)}
text{font-family:${FONT};font-size:${FONT_PX}px}
.card{fill:var(--bg);stroke:var(--line)}.fg{fill:var(--fg)}.mute{fill:var(--mute)}.acc{fill:var(--acc)}.ok{fill:var(--ok)}.warn{fill:var(--warn)}.err{fill:var(--err)}
.ring{fill:none;stroke:var(--ok);transform-box:fill-box;transform-origin:center;animation:ping 2.4s ease-out infinite}
@keyframes ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.ring{animation:none;opacity:0}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" class="card"/>
${
  emoji
    ? `<text x="${EMOJI_X}" y="${H / 2 + 5}" text-anchor="middle" style="font-family:${EMOJI_FONT};font-size:${EMOJI_PX}px" aria-hidden="true">${esc(emoji)}</text>`
    : `${available ? `<circle cx="${DOT_X}" cy="${H / 2}" r="4" class="ring"/>` : ''}<circle cx="${DOT_X}" cy="${H / 2}" r="4" class="${tone}"/>`
}
<text x="${textX}" y="${H / 2 + 4}"><tspan class="fg">${esc(label)}</tspan><tspan class="mute">${esc(where)}</tspan><tspan class="acc">${esc(time)}</tspan></text>
</svg>`;
}
