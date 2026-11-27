/**
 * The admin app's Overview (#overview): counts of posts, drafts, scheduled posts and upcoming
 * events, buttons for the usual jobs, and what changed lately. It also puts the counts in the
 * sidebar (src/lib/admin/sections.ts). It reads nothing itself: the sections report what they load
 * (the posts in src/lib/admin/editor.ts, the series, the pages, the timeline, the status), and it
 * draws again after each report.
 */
import { el, formatTime, item } from './dom';

/** Something that changed, for the Recent list */
export interface RecentItem {
  /** What it is: post, draft, event, status */
  kind: string;
  text: string;
  /** When, an ISO date */
  at: string;
  /** Where it opens in the admin, e.g. #draft/<key> */
  href: string;
}

interface Report {
  /** The sidebar's count for the section */
  count?: number;
  /** Overview's numbers, by label */
  stats?: Record<string, number>;
  recent?: RecentItem[];
}

const reports = new Map<string, Report>();

/** The order Overview shows its numbers in */
const STAT_ORDER = ['Posts', 'Drafts', 'Scheduled', 'Upcoming events', 'Series', 'Media files'];
/** How many changes Recent lists */
const RECENT = 8;

/** A section's latest numbers and changes, e.g. report('posts', { count: 16, stats: { Posts: 16 } }) */
export function report(section: string, r: Report) {
  reports.set(section, r);
  render();
}

function render() {
  // The sidebar's counts
  for (const badge of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const n = reports.get(badge.dataset.count!)?.count;
    badge.textContent = n === undefined ? '' : String(n);
  }

  const stats = new Map<string, number>();
  for (const r of reports.values()) for (const [label, n] of Object.entries(r.stats ?? {})) stats.set(label, n);
  const tiles = [...stats].sort(([a], [b]) => STAT_ORDER.indexOf(a) - STAT_ORDER.indexOf(b));
  el('overviewStats').replaceChildren(
    ...tiles.map(([label, n]) => {
      const tile = document.createElement('div');
      tile.className = 'admin-stat';
      const l = document.createElement('span');
      l.className = 'admin-muted';
      l.textContent = label;
      const v = document.createElement('strong');
      v.textContent = String(n);
      tile.appendChild(l);
      tile.appendChild(v);
      return tile;
    }),
  );

  const recent = [...reports.values()]
    .flatMap((r) => r.recent ?? [])
    .filter((x) => !Number.isNaN(Date.parse(x.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, RECENT);
  el('overviewRecent').replaceChildren(
    ...(recent.length
      ? recent.map((x) => {
          const li = item('');
          const head = document.createElement('div');
          const link = document.createElement('a');
          link.href = x.href;
          link.className = 'admin-pages-name';
          link.textContent = x.text;
          head.appendChild(link);
          const note = document.createElement('span');
          note.className = 'admin-muted';
          note.textContent = `${x.kind} · ${formatTime(x.at)}`;
          li.appendChild(head);
          li.appendChild(note);
          return li;
        })
      : [item('Loading…', 'admin-muted')]),
  );
}

/** Overview's buttons: New draft starts one as the Posts section's button does */
export function setupOverview() {
  el('overviewNewDraft').addEventListener('click', () => el<HTMLButtonElement>('newDraft').click());
}
