/**
 * SVG renderer for the "latest Bluesky post" card served at /bluesky.svg, made for embedding (a
 * GitHub profile README, other sites). The post comes from ./bluesky-post.ts. It shows the post's
 * text, not its images or link cards: an SVG inside <img> can't load them, so it names them instead
 * ("[2 images]"). Shares its look with the other cards (./embed-card.ts).
 */
import { CHAR_EM, FONT, cardStyle, clean, colourVars, esc, fit, wrap, type CardAccent, type CardTheme } from './embed-card.ts';
import type { Attachment, BlueskyPost } from './bluesky-post.ts';

export interface BlueskyCardOptions {
  theme?: CardTheme;
  accent?: CardAccent;
  /** Unix seconds, for the "new" label on posts from the last day; defaults to now */
  now?: number;
}

const HANDLE = 'skiddle.blue';

// Layout (px), matching the latest post card
const W = 540;
const H = 130;
const PAD = 16;
const TEXT_W = W - PAD * 2;
const BODY_PX = 13;
const META_PX = 11;
const BODY_LINES = 2;
const NEW_HOURS = 24;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact' });
const counted = (n: number, one: string, many: string) => `${compact.format(n)} ${n === 1 ? one : many}`;

function label(a: Attachment): string {
  switch (a.kind) {
    case 'images':
      return a.count === 1 ? '[image]' : `[${a.count} images]`;
    case 'link':
      return a.domain ? `[link: ${fit(clean(a.domain), 24)}]` : '[link]';
    default:
      return `[${a.kind}]`;
  }
}

/** Renders the card. `post` null (no post, or the AppView unavailable) shows a link to the profile. */
export function renderBlueskyCard(post: BlueskyPost | null, options: BlueskyCardOptions = {}): string {
  const { theme, accent } = cardStyle(options);
  const now = options.now ?? Date.now() / 1000;

  const created = post ? new Date(post.createdAt) : null;
  const valid = created && !Number.isNaN(created.valueOf());
  const isNew = valid && now - created.valueOf() / 1000 < NEW_HOURS * 3600;
  const date = valid ? created.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';

  const text = post ? post.text.split('\n').map(clean).filter(Boolean).join('\n') : '';
  const marker = post ? post.attachments.map(label).join(' ') : '';
  const bodyCols = Math.floor(TEXT_W / (BODY_PX * CHAR_EM));
  const metaCols = Math.floor(TEXT_W / (META_PX * CHAR_EM));

  // A post with only an image or a link shows what it carries where the text would be
  const body = !post
    ? [{ text: 'No post to show right now', cls: 'fg' }, { text: `Read @${HANDLE} on Bluesky`, cls: 'mute' }]
    : text
      ? wrap(text, bodyCols, BODY_LINES).map((line) => ({ text: line, cls: 'fg' }))
      : [{ text: fit(marker, bodyCols), cls: 'mute' }];
  const counts = post
    ? [counted(post.replies, 'reply', 'replies'), counted(post.reposts, 'repost', 'reposts'), counted(post.likes, 'like', 'likes')].join(' · ')
    : '';
  const metaMax = metaCols - (counts ? counts.length + 2 : 0) - (isNew ? 6 : 0);
  const meta = fit(post ? [date, text ? marker : ''].filter(Boolean).join(' · ') : `bsky.app/profile/${HANDLE}`, metaMax);
  const summary = clean(text) || marker;
  const title = post ? `Latest post on Bluesky by @${HANDLE}: ${summary}${date ? ` (${date})` : ''}` : `Posts by @${HANDLE} on Bluesky`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bs-title">
<title id="bs-title">${esc(title)}</title>
<style>${colourVars(theme, accent)}
text{font-family:${FONT}}
.card{fill:var(--bg);stroke:var(--line)}
.fg{fill:var(--fg)}.mute{fill:var(--mute)}.acc{fill:var(--acc)}
.rule{stroke:var(--line);stroke-dasharray:3 4}
.p{font-size:12.5px}.b{font-size:${BODY_PX}px}.k{font-size:${META_PX}px;letter-spacing:.04em}.brand{font-size:11px}
.cur{animation:blink 1.06s steps(1,end) infinite}@keyframes blink{50%{fill-opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}}
</style>
<defs><clipPath id="bs-text"><rect x="${PAD}" y="44" width="${TEXT_W}" height="${H - 44}"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" class="card"/>
<text x="${PAD}" y="27" class="p"><tspan class="acc">skiddle@web</tspan><tspan class="mute">:~$</tspan><tspan class="fg"> bsky latest @${HANDLE}</tspan><tspan class="acc cur"> █</tspan></text>
<text x="${W - PAD}" y="27" text-anchor="end" class="brand mute">bsky.app</text>
<line x1="${PAD}" y1="41.5" x2="${W - PAD}" y2="41.5" class="rule"/>
<g clip-path="url(#bs-text)">
<text x="${PAD}" y="67" class="k">${isNew ? '<tspan class="acc">new · </tspan>' : ''}<tspan class="mute">${esc(meta)}</tspan></text>
${counts ? `<text x="${W - PAD}" y="67" text-anchor="end" class="k mute">${esc(counts)}</text>\n` : ''}${body
    .map((line, i) => `<text x="${PAD}" y="${89 + i * 19}" class="b ${line.cls}">${esc(line.text)}</text>`)
    .join('\n')}</g>
</svg>`;
}
