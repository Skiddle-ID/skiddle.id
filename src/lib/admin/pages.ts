/**
 * The Pages section: the pages' content as records in Jeff's repo (docs/v4/pages-on-atproto.md),
 * one id.skiddle.project record per project, and one record each for the CV, services, uses and
 * About (key `self`).
 *
 * For now it fills them from the site's data files in src/data/, once. Each row compares the
 * record in the repo with the record the data makes (src/lib/page-records.mjs, which CI checks
 * against the lexicons), leaving out the dates the import sets. A record is then one of:
 *   - not in the repo yet: **Import** writes it, with createRecord, so it never overwrites one
 *   - the same as the site's data: nothing to do
 *   - different: the data or the record changed since the import. **Replace** writes the data's
 *     version over it, with swapRecord. Once the editors are here, edit the record instead.
 *   - only in the repo (a project since removed from projects.ts): listed, nothing else
 *
 * These collections are the site's own, and v3's sync never touches them, so the import isn't
 * held for the launch (src/lib/admin/launch.ts). Nothing on the site changes yet: v4's pages read
 * the records in a later step. At the switch the data files leave git, and the import with them.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import about from '~/data/about';
import highlights from '~/data/highlights';
import projects from '~/data/projects';
import services from '~/data/services';
import uses, { usesUpdated } from '~/data/uses';
import works from '~/data/works';
import {
  ABOUT_COLLECTION,
  CV_COLLECTION,
  PROJECT_COLLECTION,
  SERVICES_COLLECTION,
  USES_COLLECTION,
  aboutRecord,
  cvRecord,
  projectRecords,
  servicesRecord,
  usesRecord,
} from '~/lib/page-records.mjs';
import { DID } from '~/lib/standard-site.mjs';
import { el, errorText, item, message, viewLink } from './dom';
import { missingScopes } from './oauth';
import { XrpcError, canonical, createRecord, getRecord, listRecords, putRecord, type RepoRecord } from './xrpc';

type PageRecord = Record<string, unknown>;

type State = 'new' | 'same' | 'changed' | 'extra' | 'saved' | 'conflict' | 'failed';

interface Row {
  title: string;
  kind: 'page' | 'project';
  collection: string;
  rkey: string;
  /** Where it shows on the site */
  page: string;
  /** The record the site's data makes, with `at` for the dates the import sets; none for 'extra' */
  make?: (at: string) => PageRecord;
  /** The record in the repo */
  have?: RepoRecord<PageRecord>;
  state: State;
  error?: string;
}

const COLLECTIONS = [PROJECT_COLLECTION, CV_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, ABOUT_COLLECTION];

/** The singletons, in the order the Pages section lists them */
const PAGES: Pick<Row, 'title' | 'collection' | 'page' | 'make'>[] = [
  { title: 'The CV', collection: CV_COLLECTION, page: '/works/', make: (at) => cvRecord(works, highlights, at) },
  { title: 'Services', collection: SERVICES_COLLECTION, page: '/services/', make: (at) => servicesRecord(services, at) },
  // Its date is the data's ("last updated September 2025"), not the import's
  { title: 'Uses', collection: USES_COLLECTION, page: '/uses/', make: () => usesRecord(uses, usesUpdated) },
  { title: 'About', collection: ABOUT_COLLECTION, page: '/about/', make: (at) => aboutRecord(about, at) },
];

let session: OAuthSession;
let signInAgain: () => void;
let rows: Row[] = [];
let busy = false;
let canWrite = false;

/** A record as compared: without the dates the import sets to the time it runs */
function comparable(row: Row, value: PageRecord): string {
  const { createdAt: _createdAt, updatedAt, ...rest } = value;
  if (row.collection === USES_COLLECTION) return canonical({ ...rest, updatedAt });
  return canonical(rest);
}

const toImport = () => rows.filter((r) => r.state === 'new');

/**
 * @param s The signed-in session
 * @param again Starts a new sign-in, for when the session lacks the pages' collections
 */
export function setupPages(s: OAuthSession, again: () => void) {
  session = s;
  signInAgain = again;
  el('pagesSignIn').addEventListener('click', () => signInAgain());
  el('pagesImport').addEventListener('click', importAll);
}

/** Reads the records and compares each with the site's data. Writes nothing. */
export async function loadPages() {
  const missing = missingScopes((await session.getTokenInfo()).scope).filter((s) => COLLECTIONS.some((c) => s === `repo:${c}`));
  canWrite = missing.length === 0;
  el('pagesScope').hidden = canWrite;

  const made = projectRecords(projects, '');
  const [stored, ...singletons] = await Promise.all([
    listRecords<PageRecord>(session, PROJECT_COLLECTION),
    ...PAGES.map((p) => getRecord<PageRecord>(session, p.collection, 'self')),
  ]);
  const byKey = new Map(stored.map((r) => [r.uri.split('/').pop()!, r]));
  const compare = (row: Omit<Row, 'state'>): Row => {
    if (!row.have) return { ...row, state: 'new' };
    return { ...row, state: comparable(row as Row, row.make!('')) === comparable(row as Row, row.have.value) ? 'same' : 'changed' };
  };
  rows = [
    ...PAGES.map((p, i) => compare({ ...p, kind: 'page', rkey: 'self', have: singletons[i] ?? undefined })),
    ...projects.map((p) =>
      compare({ title: p.name, kind: 'project', collection: PROJECT_COLLECTION, rkey: p.id, page: '/projects/', make: (at) => projectRecords(projects, at).get(p.id)!, have: byKey.get(p.id) }),
    ),
    ...stored
      .filter((r) => !made.has(r.uri.split('/').pop()!))
      .map((r): Row => {
        const rkey = r.uri.split('/').pop()!;
        return { title: String(r.value.name || rkey), kind: 'project', collection: PROJECT_COLLECTION, rkey, page: '/projects/', have: r, state: 'extra' };
      }),
  ];
  render();
}

/** Writes every record that isn't in the repo yet */
async function importAll() {
  const list = toImport();
  if (busy || !canWrite || !list.length) return;
  const n = list.length;
  const ok = confirm(
    `Import ${n} ${n === 1 ? 'record' : 'records'} into your repo from the site’s data? Records are public, like the pages, and go further: other services can keep copies even after a delete.`,
  );
  if (!ok) return;
  await write(list, async (row, at) => {
    const value = row.make!(at);
    const res = await createRecord(session, row.collection, value, row.rkey);
    return { res, value };
  });
}

/** Writes the site's data over one record that differs from it */
async function replace(row: Row) {
  if (busy || !canWrite || row.state !== 'changed' || !row.have) return;
  if (!confirm(`Replace ${row.title} in your repo with the site’s data? Any change made to the record since the import is lost.`)) return;
  const have = row.have;
  await write([row], async (r, at) => {
    const made = r.make!(at);
    // A project keeps the date it was first imported
    const value = r.kind === 'project' ? { ...made, createdAt: have.value.createdAt ?? at, updatedAt: at } : made;
    const res = await putRecord(session, r.collection, r.rkey, value, have.cid);
    return { res, value };
  });
}

async function write(list: Row[], one: (row: Row, at: string) => Promise<{ res: { uri: string; cid: string }; value: PageRecord }>) {
  busy = true;
  render();
  try {
    for (const [i, row] of list.entries()) {
      message('pagesMessage', `Writing ${i + 1} of ${list.length}: ${row.title}…`);
      try {
        const { res, value } = await one(row, new Date().toISOString());
        Object.assign(row, { have: { uri: res.uri, cid: res.cid, value }, state: 'saved', error: undefined });
      } catch (err) {
        if (err instanceof XrpcError && err.error === 'InvalidSwap') row.state = 'conflict';
        else Object.assign(row, { state: 'failed', error: errorText(err) });
      }
      render();
    }
  } finally {
    busy = false;
    render();
  }
}

const NOTES: Record<State, string> = {
  new: 'not in your repo yet',
  same: 'in your repo, the same as the site’s data',
  changed: 'in your repo, different from the site’s data',
  extra: 'in your repo, not in the site’s data',
  saved: 'written to your repo',
  conflict: 'changed somewhere else since this page loaded: reload the page to see it',
  failed: 'couldn’t write it',
};

function recordLink(row: Row) {
  const a = document.createElement('a');
  a.href = `https://pdsls.dev/at://${DID}/${row.collection}/${row.rkey}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'admin-muted';
  a.textContent = 'record';
  a.setAttribute('aria-label', `${row.title}’s record in your repo`);
  return a;
}

function rowItem(row: Row) {
  const li = item('');
  const head = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = row.title;
  head.appendChild(name);
  head.appendChild(viewLink(row.page, `View ${row.page} on the site`));
  if (row.have) head.appendChild(recordLink(row));
  const note = document.createElement('span');
  note.className = row.state === 'same' ? 'admin-muted' : '';
  note.textContent = NOTES[row.state] + (row.error ? `: ${row.error}` : '');
  li.appendChild(head);
  li.appendChild(note);
  if (row.state === 'changed') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-btn admin-btn-ghost';
    button.textContent = 'Replace';
    button.setAttribute('aria-label', `Replace ${row.title} with the site’s data`);
    button.disabled = busy || !canWrite;
    button.addEventListener('click', () => replace(row));
    li.appendChild(button);
  }
  return li;
}

function render() {
  el('pagesList').replaceChildren(...rows.filter((r) => r.kind === 'page').map(rowItem));
  el('projectsList').replaceChildren(...rows.filter((r) => r.kind === 'project').map(rowItem));

  const count = (states: State[]) => rows.filter((r) => states.includes(r.state)).length;
  const pending = toImport().length;
  const button = el<HTMLButtonElement>('pagesImport');
  button.hidden = !pending;
  button.textContent = `Import ${pending} ${pending === 1 ? 'record' : 'records'}`;
  button.disabled = busy || !canWrite;
  if (busy) return;

  const parts: string[] = [];
  const add = (n: number, text: string) => n && parts.push(`${n} ${text}`);
  add(pending, 'not in your repo yet');
  add(count(['same']), 'the same as the site’s data');
  add(count(['saved']), 'written');
  add(count(['changed']), 'different');
  add(count(['extra']), 'only in your repo');
  const problems = count(['failed', 'conflict']);
  add(problems, problems === 1 ? 'with a problem' : 'with problems');
  const kind = problems ? 'error' : pending || count(['changed']) ? 'info' : 'ok';
  message('pagesMessage', `${rows.length} records: ${parts.join(', ')}.`, kind);
}
