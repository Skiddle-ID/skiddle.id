/**
 * The Pages section: the pages' content in Jeff's repo (docs/v4/pages-on-atproto.md), one record
 * each for the site's metadata (search engines and link previews), the home page, the CV, services, uses, About, Now and Notes (key `self`), and one id.skiddle.project record per
 * project. Each name opens its editor, and New project starts one (src/lib/admin/page-editor.ts).
 *
 * Until the v4 launch this section also imported the records from the data files in src/data/,
 * once; they've left git since.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { ABOUT_COLLECTION, CV_COLLECTION, HOME_COLLECTION, NOW_COLLECTION, PROJECT_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION } from '~/lib/page-records.mjs';
import { NOTES_COLLECTION } from '~/lib/notes.mjs';
import { SITE_COLLECTION } from '~/lib/site-meta.mjs';
import { DID } from '~/lib/standard-site.mjs';
import { el, formatTime, message, viewLink } from './dom';
import { report } from './overview';
import { badge, cellLink, cellRow, renderTable } from './table';
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

const COLLECTIONS = [PROJECT_COLLECTION, SITE_COLLECTION, HOME_COLLECTION, CV_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, ABOUT_COLLECTION, NOW_COLLECTION, NOTES_COLLECTION];

/** The pages with one record each, in the order the section lists them */
const PAGES: Omit<Row, 'rkey' | 'have'>[] = [
  { title: 'Site and search engines', collection: SITE_COLLECTION, page: '/', editor: '#page/site', fallback: 'the built-in metadata' },
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
  report('pages', { count: pages.filter((p) => p.have).length + rows.length });
  const all = [...pages, ...rows];
  renderTable(
    {
      host: el('pagesTable'),
      noun: 'pages and projects',
      columns: [
        { label: 'Page', cell: (r) => cellRow(cellLink(r.editor, r.title), ' ', viewLink(r.page, `View ${r.page} on the site`), ...(r.have ? [' ', recordLink(r)] : [])) },
        { label: 'Saved', cell: savedNote, secondary: true },
      ],
      filters: [
        { label: 'Pages', test: (r) => r.collection !== PROJECT_COLLECTION },
        { label: 'Projects', test: (r) => r.collection === PROJECT_COLLECTION },
      ],
      text: (r) => `${r.title} ${r.page}`,
      empty: 'Nothing yet.',
    },
    all,
  );
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

/** When a page's record was saved, or what the page shows without one */
function savedNote(row: Row): string | Node {
  if (!row.have) return badge(`no record: ${row.fallback ? `shows ${row.fallback}` : 'can’t show'}`, row.fallback ? 'muted' : 'warn');
  const updated = row.have.value.updatedAt ?? row.have.value.createdAt;
  return typeof updated === 'string' ? `saved ${formatTime(updated)}` : 'in your repo';
}
