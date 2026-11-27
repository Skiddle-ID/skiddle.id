/**
 * The Timeline section: the events on /timeline/ (id.skiddle.event, docs/v4/timeline.md), as a table
 * (src/lib/admin/table.ts) filtered by Upcoming (not over yet), Fill in (over, but still only rough)
 * and Past. Each
 * event opens in the page editor (#event/<key>, src/lib/admin/page-editor.ts), and New event starts
 * one (#new-event).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { DETAIL_FIELDS, EVENT_COLLECTION, KINDS, isOver, spanLabel } from '~/lib/timeline.mjs';
import { el, message } from './dom';
import { badge, cellLink, renderTable } from './table';
import { missingScopes } from './oauth';
import { report } from './overview';
import { listRecords, type RepoRecord } from './xrpc';

type EventRecord = Record<string, unknown> & { kind?: string; startsOn?: string; endsOn?: string; title?: string; city?: string; announced?: boolean };

let session: OAuthSession;

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';

/**
 * @param s The signed-in session
 * @param signInAgain Starts a new sign-in, for when the session can't write events yet
 */
export function setupTimeline(s: OAuthSession, signInAgain: () => void) {
  session = s;
  el('timelineSignIn').addEventListener('click', () => signInAgain());
}

/** Reads the events and lists them */
export async function loadTimeline() {
  const missing = missingScopes((await session.getTokenInfo()).scope).includes(`repo:${EVENT_COLLECTION}`);
  el('timelineScope').hidden = !missing;
  el<HTMLAnchorElement>('newEvent').hidden = missing;
  const records = (await listRecords<EventRecord>(session, EVENT_COLLECTION)).filter((r) => typeof r.value.startsOn === 'string');
  const byStart = (a: RepoRecord<EventRecord>, b: RepoRecord<EventRecord>) => String(a.value.startsOn).localeCompare(String(b.value.startsOn));
  const upcoming = records.filter((r) => !isOver(r.value)).sort(byStart);
  const past = records.filter((r) => isOver(r.value)).sort((a, b) => byStart(b, a));
  // Over, but it was saved while upcoming, so it has none of its details yet
  const rough = past.filter((r) => !DETAIL_FIELDS.some((k) => r.value[k] !== undefined));
  // Upcoming soonest first, then the rest newest first
  const rows = [...upcoming, ...past].map((r) => ({ r, state: upcoming.includes(r) ? 'upcoming' : rough.includes(r) ? 'rough' : 'past' }));
  const states = { upcoming: ['upcoming', 'ok'], rough: ['fill in', 'warn'], past: ['past', 'muted'] } as const;
  renderTable(
    {
      host: el('timelineTable'),
      noun: 'events',
      columns: [
        { label: 'Event', cell: ({ r }) => cellLink(`#event/${rkeyOf(r.uri)}`, nameOf(r.value)) },
        { label: 'When', cell: ({ r }) => whereWhen(r.value), secondary: true },
        { label: 'State', cell: ({ state }) => badge(states[state as keyof typeof states][0], states[state as keyof typeof states][1]) },
      ],
      filters: [
        { label: 'Upcoming', test: ({ state }) => state === 'upcoming' },
        { label: 'Fill in', test: ({ state }) => state === 'rough' },
        { label: 'Past', test: ({ state }) => state !== 'upcoming' },
      ],
      text: ({ r }) => [r.value.title, r.value.kind, r.value.city].filter(Boolean).join(' '),
      empty: 'No events yet. New event adds one.',
    },
    rows,
  );
  report('timeline', {
    count: upcoming.length,
    stats: { 'Upcoming events': upcoming.length },
    recent: records.map((r) => ({
      kind: 'event',
      text: String(r.value.title || KINDS[r.value.kind as keyof typeof KINDS] || KINDS.other),
      at: String(r.value.updatedAt ?? r.value.createdAt ?? ''),
      href: `#event/${rkeyOf(r.uri)}`,
    })),
  });
  message('timelineMessage', '');
}

/** An event's name: its title, or its kind */
const nameOf = (v: EventRecord) => String(v.title || KINDS[v.kind as keyof typeof KINDS] || KINDS.other);

/** Its days, its city, and whether it's announced */
function whereWhen(v: EventRecord) {
  const start = String(v.startsOn);
  return [v.title && (KINDS[v.kind as keyof typeof KINDS] ?? KINDS.other), spanLabel(start, typeof v.endsOn === 'string' && v.endsOn > start ? v.endsOn : start), v.city, v.announced && 'announced']
    .filter(Boolean)
    .join(' · ');
}
