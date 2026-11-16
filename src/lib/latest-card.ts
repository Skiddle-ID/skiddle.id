/**
 * SVG renderer for the "latest post" card served at /latest.svg, made for embedding (a GitHub
 * profile README, other sites). The post comes from /latest.json, built with the site, so the
 * card changes with every new post. Shares its look with the Last.fm card (./embed-card.ts).
 */
import { CHAR_EM, FONT, cardStyle, clean, colourVars, esc, fit, type CardAccent, type CardTheme } from './embed-card';

export interface LatestPost {
  title: string;
  description?: string;
  url: string;
  /** ISO date it was published */
  date: string;
  minutes: number;
  /** The series it belongs to and its part number */
  series?: { name: string; part: number };
  /** Language code, e.g. "en" or "id" */
  lang?: string;
}

export interface LatestCardOptions {
  theme?: CardTheme;
  accent?: CardAccent;
  /** Unix seconds, for the "new" label on posts from the last 7 days; defaults to now */
  now?: number;
}

// Layout (px), matching the Last.fm card
const W = 540;
const H = 130;
const PAD = 16;
const TEXT_W = W - PAD * 2;
const TITLE_PX = 15;
const SUB_PX = 12.5;
const META_PX = 11;
const NEW_DAYS = 7;

/** Renders the card. `post` null (no posts, or /latest.json unavailable) shows a link to the writing. */
export function renderLatestCard(post: LatestPost | null, options: LatestCardOptions = {}): string {
  const { theme, accent } = cardStyle(options);
  const now = options.now ?? Date.now() / 1000;

  const published = post ? new Date(post.date) : null;
  const valid = published && !Number.isNaN(published.valueOf());
  const isNew = valid && now - published.valueOf() / 1000 < NEW_DAYS * 86_400;
  const date = valid ? published.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';

  const title = post ? fit(clean(post.title) || 'Untitled', Math.floor(TEXT_W / (TITLE_PX * CHAR_EM))) : 'Writing on skiddle.id';
  const sub = post
    ? fit(clean(post.description), Math.floor(TEXT_W / (SUB_PX * CHAR_EM)))
    : 'Infra, open protocols, homelab and life';
  const metaParts = post
    ? [
        date,
        post.minutes ? `${post.minutes} min read` : '',
        post.series ? `${clean(post.series.name)} #${post.series.part}` : '',
        post.lang && post.lang !== 'en' ? clean(post.lang).toUpperCase() : '',
      ].filter(Boolean)
    : ['skiddle.id/posts'];
  const metaMax = Math.floor(TEXT_W / (META_PX * CHAR_EM)) - (isNew ? 6 : 0);
  const meta = fit(metaParts.join(' · '), metaMax);
  const label = post ? `Latest post on skiddle.id: ${clean(post.title)}${date ? ` (${date})` : ''}` : 'Writing on skiddle.id';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lp-title">
<title id="lp-title">${esc(label)}</title>
<style>${colourVars(theme, accent)}
text{font-family:${FONT}}
.card{fill:var(--bg);stroke:var(--line)}
.fg{fill:var(--fg)}.mute{fill:var(--mute)}.acc{fill:var(--acc)}
.rule{stroke:var(--line);stroke-dasharray:3 4}
.p{font-size:12.5px}.t{font-size:${TITLE_PX}px;font-weight:700}.s{font-size:${SUB_PX}px}.k{font-size:${META_PX}px;letter-spacing:.04em}.brand{font-size:11px}
.cur{animation:blink 1.06s steps(1,end) infinite}@keyframes blink{50%{fill-opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}}
</style>
<defs><clipPath id="lp-text"><rect x="${PAD}" y="44" width="${TEXT_W}" height="${H - 44}"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" class="card"/>
<text x="${PAD}" y="27" class="p"><tspan class="acc">skiddle@web</tspan><tspan class="mute">:~$</tspan><tspan class="fg"> cat posts/latest.md</tspan><tspan class="acc cur"> █</tspan></text>
<text x="${W - PAD}" y="27" text-anchor="end" class="brand mute">skiddle.id</text>
<line x1="${PAD}" y1="41.5" x2="${W - PAD}" y2="41.5" class="rule"/>
<g clip-path="url(#lp-text)">
<text x="${PAD}" y="67" class="k">${isNew ? '<tspan class="acc">new · </tspan>' : ''}<tspan class="mute">${esc(meta)}</tspan></text>
<text x="${PAD}" y="89" class="t fg">${esc(title)}</text>
<text x="${PAD}" y="108" class="s mute">${esc(sub)}</text></g>
</svg>`;
}
