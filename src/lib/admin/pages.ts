/**
 * The Pages section: the pages' content in Jeff's repo (docs/v4/pages-on-atproto.md), one record
 * each for the home page, the CV, services, uses, About, Now and Notes (key `self`), and one id.skiddle.project record per
 * project. Each name opens its editor, and New project starts one (src/lib/admin/page-editor.ts).
 *
 * Until the v4 launch this section also imported the records from the data files in src/data/,
 * once; they've left git since.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { ABOUT_COLLECTION, CV_COLLECTION, HOME_COLLECTION, NOW_COLLECTION, PROJECT_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION } from '~/lib/page-records.mjs';
import { NOTES_COLLECTION } from '~/lib/notes.mjs';
import { DID } from '~/lib/standard-site.mjs';
import { el, formatTime, item, message, viewLink } from './dom';
import { missingScopes } from './oauth';
import { getRecord, listRecords, type RepoRecord } from './xrpc';

type PageRecord = Record<string, unknown>;

interface Row {
  title: string;
  collection: string;
  rkey: string;
  /** Where it shows on the site */
  page: string;
  /** Its editor's address */
  editor: string;
  /** What the page shows while there's no record, if it can show without one */
  fallback?: string;
  /** The record in the repo, if there is one */
  have?: RepoRecord<PageRecord>;
}

const COLLECTIONS = [PROJECT_COLLECTION, HOME_COLLECTION, CV_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, ABOUT_COLLECTION, NOW_COLLECTION, NOTES_COLLECTION];

/** The pages with one record each, in the order the section lists them */
const PAGES: Omit<Row, 'rkey' | 'have'>[] = [
  { title: 'Home', collection: HOME_COLLECTION, page: '/', editor: '#page/home', fallback: 'the built-in text' },
  { title: 'The CV', collection: CV_COLLECTION, page: '/works/', editor: '#page/cv' },
  { title: 'Services', collection: SERVICES_COLLECTION, page: '/services/', editor: '#page/services' },
  { title: 'Uses', collection: USES_COLLECTION, page: '/uses/', editor: '#page/uses' },
  { title: 'About', collection: ABOUT_COLLECTION, page: '/about/', editor: '#page/about' },
  { title: 'Now', collection: NOW_COLLECTION, page: '/now/', editor: '#page/now', fallback: 'the built-in list' },
  { title: 'Notes', collection: NOTES_COLLECTION, page: '/notes/', editor: '#page/notes', fallback: 'only the posts tagged #note' },
];

let session: OAuthSession;
let signInAgain: () => void;

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';

/**
 * @param s The signed-in session
 * @param again Starts a new sign-in, for when the session lacks the pages' collections
 */
export function setupPages(s: OAuthSession, again: () => void) {
  session = s;
  signInAgain = again;
  el('pagesSignIn').addEventListener('click', () => signInAgain());
}

/** Reads the pages' records and lists them */
export async function loadPages() {
  const missing = missingScopes((await session.getTokenInfo()).scope).filter((s) => COLLECTIONS.some((c) => s === `repo:${c}`));
  el('pagesScope').hidden = missing.length === 0;

  const [projects, ...singletons] = await Promise.all([
    listRecords<PageRecord>(session, PROJECT_COLLECTION),
    ...PAGES.map((p) => getRecord<PageRecord>(session, p.collection, 'self')),
  ]);
  const pages: Row[] = PAGES.map((p, i) => ({ ...p, rkey: 'self', have: singletons[i] ?? undefined }));
  // In the order they were added, which /projects/ starts from
  const sorted = [...projects].sort((a, b) => String(a.value.createdAt ?? '').localeCompare(String(b.value.createdAt ?? '')) || a.uri.localeCompare(b.uri));
  const rows: Row[] = sorted.map((r) => {
    const rkey = rkeyOf(r.uri);
    return { title: String(r.value.name || rkey), collection: PROJECT_COLLECTION, rkey, page: '/projects/', editor: `#project/${rkey}`, have: r };
  });
  el('pagesList').replaceChildren(...pages.map(rowItem));
  el('projectsList').replaceChildren(...(rows.length ? rows.map(rowItem) : [item('No projects yet.', 'admin-muted')]));
  const absent = pages.filter((p) => !p.have && !p.fallback).length;
  message(
    'pagesMessage',
    absent ? `${absent} ${absent === 1 ? 'page has' : 'pages have'} no record yet: open it to fill it in.` : '',
    absent ? 'error' : 'info',
  );
}

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
  const name = document.createElement('a');
  name.href = row.editor;
  name.className = 'admin-pages-name';
  name.textContent = row.title;
  head.appendChild(name);
  head.appendChild(viewLink(row.page, `View ${row.page} on the site`));
  if (row.have) head.appendChild(recordLink(row));
  const note = document.createElement('span');
  const updated = row.have?.value.updatedAt ?? row.have?.value.createdAt;
  note.className = row.have ? 'admin-muted' : '';
  note.textContent = !row.have ? `no record yet: the page ${row.fallback ? `shows ${row.fallback}` : 'can’t show'}` : typeof updated === 'string' ? `saved ${formatTime(updated)}` : 'in your repo';
  li.appendChild(head);
  li.appendChild(note);
  return li;
}
