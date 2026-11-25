/**
 * SVG renderer for the "top of the week" music card served at /music-week.svg, made for embedding
 * (a GitHub profile README, other sites). The numbers come from weekSummary() in ./teal.mjs, the
 * same ones /listening/ shows: plays in the last 7 days, then the top artists and tracks side by
 * side, each with its play count. Text only, no album art. Shares its look with the other cards
 * (./embed-card.ts).
 */
import { CHAR_EM, FONT, cardStyle, clean, colourVars, esc, fit, fitMiddle, textColumns, type CardAccent, type CardTheme } from './embed-card.ts';
import type { weekSummary } from './teal.mjs';

export type WeekTop = ReturnType<typeof weekSummary>;

export interface MusicWeekCardOptions {
  theme?: CardTheme;
  accent?: CardAccent;
}

// Layout (px)
const W = 540;
const H = 168;
const PAD = 16;
const GAP = 24;
const ROW_PX = 12.5;
const ROWS_Y = 113;
const ROW_H = 19;
const ARTISTS = { x: PAD, w: 196 };
const TRACKS = { x: PAD + ARTISTS.w + GAP, w: W - PAD * 2 - ARTISTS.w - GAP };
const SEP = ' · ';

const cols = (px: number) => Math.floor(px / (ROW_PX * CHAR_EM));
const plays = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'play' : 'plays'}`;

/** Columns an artist keeps when a whole title takes the rest of the room */
const MIN_ARTIST = 6;

/**
 * A track's title and artist in `max` columns. The title comes first: it stays whole when that
 * leaves the artist a few columns, so two versions of a song that differ only at the end of their
 * titles still look different. A longer title keeps most of the room.
 */
function fitTrack(title: string, artist: string, max: number): [string, string] {
  const room = max - SEP.length;
  if (textColumns(title) + textColumns(artist) <= room) return [title, artist];
  const t = textColumns(title) <= room - MIN_ARTIST ? title : fit(title, room - Math.min(textColumns(artist), Math.floor(room * 0.4)));
  return [t, fit(artist, room - textColumns(t))];
}

interface Row {
  name: string;
  /** Shown after the name, muted (a track's artist) */
  by?: string;
  count: number;
}

function column(col: { x: number; w: number }, heading: string, rows: Row[], id: string): string {
  const right = col.x + col.w;
  const room = (row: Row) => cols(col.w) - 2 - String(row.count).length - 1;
  const fitted = rows.map((row) => (row.by === undefined ? [fit(row.name, room(row)), undefined] : fitTrack(row.name, row.by, room(row))));
  // Two different names cut to the same text, like a song and its instrumental, keep their ends
  // instead, in the artist's room too
  const alike = (i: number) => fitted.some(([other], j) => j !== i && other === fitted[i][0] && rows[j].name !== rows[i].name);
  const lines = rows.map((row, i) => {
    const count = String(row.count);
    const [name, by] = alike(i) ? [fitMiddle(row.name, room(row)), undefined] : fitted[i];
    const y = ROWS_Y + i * ROW_H;
    return (
      `<text x="${col.x}" y="${y}" class="s"><tspan class="acc">${i + 1} </tspan><tspan class="fg">${esc(name)}</tspan>` +
      `${by === undefined ? '' : `<tspan class="mute">${esc(SEP + by)}</tspan>`}</text>` +
      `<text x="${right}" y="${y}" text-anchor="end" class="s mute">${count}</text>`
    );
  });
  return `<g clip-path="url(#${id})">
<text x="${col.x}" y="91" class="k mute">${heading}</text><text x="${right}" y="91" text-anchor="end" class="k mute">plays</text>
${lines.join('\n')}</g>`;
}

/** Renders the card. `week` null (the plays couldn't be read) points to /listening/, as an empty week does. */
export function renderMusicWeekCard(week: WeekTop | null, options: MusicWeekCardOptions = {}): string {
  const { theme, accent } = cardStyle(options);

  const artists: Row[] = (week?.artists ?? []).map((a) => ({ name: clean(a.name) || 'Unknown artist', count: a.count }));
  const tracks: Row[] = (week?.tracks ?? []).map((t) => ({ name: clean(t.name) || 'Unknown track', by: clean(t.artist) || 'Unknown artist', count: t.count }));
  const empty = !week || week.plays === 0;

  const summary = !week
    ? '<tspan class="mute">offline</tspan>'
    : `<tspan class="fg">${plays(week.plays)}</tspan><tspan class="mute"> this week</tspan>`;
  const body = empty
    ? [
        `<text x="${PAD}" y="108" class="b fg">${!week ? 'No plays to show right now' : 'Nothing played this week'}</text>`,
        `<text x="${PAD}" y="128" class="s mute">${!week ? 'See them at' : 'Older plays are at'} skiddle.id/listening/</text>`,
      ].join('\n')
    : `${column(ARTISTS, 'top artists', artists, 'mw-artists')}\n${column(TRACKS, 'top tracks', tracks, 'mw-tracks')}`;

  const list = (rows: Row[]) => rows.map((r) => `${r.name}${r.by ? ` by ${r.by}` : ''} (${plays(r.count)})`).join(', ');
  const title = !week
    ? 'Top music on teal.fm this week: no plays to show right now'
    : week.plays === 0
      ? 'Top music on teal.fm this week: nothing played'
      : `Top music on teal.fm this week, ${plays(week.plays)}. Artists: ${list(artists)}. Tracks: ${list(tracks)}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="mw-title">
<title id="mw-title">${esc(title)}</title>
<style>${colourVars(theme, accent)}
text{font-family:${FONT}}
.card{fill:var(--bg);stroke:var(--line)}
.fg{fill:var(--fg)}.mute{fill:var(--mute)}.acc{fill:var(--acc)}
.rule{stroke:var(--line);stroke-dasharray:3 4}
.p{font-size:12.5px}.b{font-size:13px}.s{font-size:${ROW_PX}px}.k{font-size:11px;letter-spacing:.04em}.brand{font-size:11px}
.cur{animation:blink 1.06s steps(1,end) infinite}@keyframes blink{50%{fill-opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}}
</style>
<defs><clipPath id="mw-artists"><rect x="${ARTISTS.x}" y="76" width="${ARTISTS.w}" height="${H - 76}"/></clipPath><clipPath id="mw-tracks"><rect x="${TRACKS.x}" y="76" width="${TRACKS.w}" height="${H - 76}"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" class="card"/>
<text x="${PAD}" y="27" class="p"><tspan class="acc">skiddle@web</tspan><tspan class="mute">:~$</tspan><tspan class="fg"> teal top --week</tspan><tspan class="acc cur"> █</tspan></text>
<text x="${W - PAD}" y="27" text-anchor="end" class="brand mute">teal.fm</text>
<line x1="${PAD}" y1="41.5" x2="${W - PAD}" y2="41.5" class="rule"/>
<text x="${PAD}" y="67" class="k">${summary}</text>
<text x="${W - PAD}" y="67" text-anchor="end" class="k mute">last 7 days</text>
${body}
</svg>`;
}
