/**
 * The Timeline section: the events on /timeline/ (id.skiddle.event, docs/v4/timeline.md). Three
 * lists: Upcoming (not over yet), Fill in the details (over, but still only rough), and Past. Each
 * event opens in the page editor (#event/<key>, src/lib/admin/page-editor.ts), and New event starts
 * one (#new-event).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { DETAIL_FIELDS, EVENT_COLLECTION, KINDS, isOver, spanLabel } from '~/lib/timeline.mjs';
import { el, item, message } from './dom';
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
  const rest = past.filter((r) => !rough.includes(r));
  fillList('timelineUpcoming', upcoming, 'Nothing coming up.');
  fillList('timelineRough', rough, 'Nothing to fill in.');
  fillList('timelinePast', rest, 'Nothing yet.');
  el('timelineRoughSection').hidden = rough.length === 0;
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

function fillList(id: string, records: RepoRecord<EventRecord>[], empty: string) {
  el(id).replaceChildren(...(records.length ? records.map(row) : [item(empty, 'admin-muted')]));
}

function row(r: RepoRecord<EventRecord>) {
  const v = r.value;
  const li = item('');
  const head = document.createElement('div');
  const name = document.createElement('a');
  name.href = `#event/${rkeyOf(r.uri)}`;
  name.className = 'admin-pages-name';
  const kind = KINDS[v.kind as keyof typeof KINDS] ?? KINDS.other;
  name.textContent = v.title || kind;
  head.appendChild(name);
  const note = document.createElement('span');
  note.className = 'admin-muted';
  const start = String(v.startsOn);
  note.textContent = [v.title && kind, spanLabel(start, typeof v.endsOn === 'string' && v.endsOn > start ? v.endsOn : start), v.city, v.announced && 'announced']
    .filter(Boolean)
    .join(' · ');
  li.appendChild(head);
  li.appendChild(note);
  return li;
}
