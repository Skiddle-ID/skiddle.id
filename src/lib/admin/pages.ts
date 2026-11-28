/**
 * The Pages section: the pages' content in Jeff's repo. One record each (key `self`) for the site's
 * metadata (search engines and link previews) and for what the pages' blocks read: the Now list, the
 * services and testimonials, and the note picks; and one id.skiddle.project record per project. Each
 * name opens its editor, and New project starts one (src/lib/admin/page-editor.ts).
 *
 * The pages made of blocks (id.skiddle.page, docs/v4/themes.md) are listed too, each opening the
 * block editor (src/lib/admin/block-editor.ts) with its draft noted. The site's own (Home, the CV,
 * Services, Uses, About, Now and Notes) are always there, with what each shows without a page
 * record (src/lib/admin/site-pages.ts). Then Jeff's own pages, each published or a draft, under Your
 * pages; New page picks a new one's title and address (src/lib/own-pages.mjs), checked as it's
 * typed, and opens it in the block editor.
 *
 * Until the v4 launch this section also imported the records from the data files in src/data/,
 * once; they've left git since.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { NOW_COLLECTION, PROJECT_COLLECTION, SERVICES_COLLECTION } from '~/lib/page-records.mjs';
import { NOTES_COLLECTION } from '~/lib/notes.mjs';
import { SITE_COLLECTION } from '~/lib/site-meta.mjs';
import { PAGE_COLLECTION, SITE_PAGES, draftKey, isPageKey } from '~/lib/page-blocks.mjs';
import { ownKeyFrom, ownKeyProblem, ownPagePath } from '~/lib/own-pages.mjs';
import { SITE_PAGE_DEFS, isSitePage } from './site-pages';
import { newPage } from './block-editor';
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
  /** A page made of blocks: its draft, if there is one */
  draft?: RepoRecord<PageRecord>;
  /** A page of Jeff's own: why it can't show on the site, if it can't (a key made elsewhere) */
  problem?: string | null;
}

const COLLECTIONS = [PROJECT_COLLECTION, PAGE_COLLECTION, SITE_COLLECTION, SERVICES_COLLECTION, NOW_COLLECTION, NOTES_COLLECTION];

/** The records with key `self`, in the order the section lists them: the site's metadata, then what the pages' blocks read */
const PAGES: Omit<Row, 'rkey' | 'have'>[] = [
  { title: 'Site and search engines', collection: SITE_COLLECTION, page: '/', editor: '#page/site', fallback: 'the built-in metadata' },
  { title: 'The Now list', collection: NOW_COLLECTION, page: '/now/', editor: '#page/now', fallback: 'the built-in list' },
  { title: 'Services and testimonials', collection: SERVICES_COLLECTION, page: '/services/', editor: '#page/services' },
  { title: 'Note picks', collection: NOTES_COLLECTION, page: '/notes/', editor: '#page/notes', fallback: 'only the posts tagged #note' },
];

let session: OAuthSession;
let signInAgain: () => void;
/** The page records' keys, drafts' too, as last read: a new page can't take one's address */
let pageKeys: string[] = [];

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';

/**
 * @param s The signed-in session
 * @param again Starts a new sign-in, for when the session lacks the pages' collections
 */
export function setupPages(s: OAuthSession, again: () => void) {
  session = s;
  signInAgain = again;
  el('pagesSignIn').addEventListener('click', () => signInAgain());
  setupNewPage();
}

/** New page: a title and an address, which follows the title until it's typed in, checked as you type */
function setupNewPage() {
  const form = el<HTMLFormElement>('newPageForm');
  const title = el<HTMLInputElement>('newPageTitle');
  const key = el<HTMLInputElement>('newPageKey');
  const create = el<HTMLButtonElement>('newPageCreate');
  let typed = false;
  const check = () => {
    const problem = title.value.trim() ? ownKeyProblem(key.value, pageKeys) : 'Give it a title.';
    message('newPageProblem', problem ?? `It’ll be at ${ownPagePath(key.value)}`, problem ? 'error' : 'info');
    key.setAttribute('aria-invalid', String(!!problem && !!key.value));
    create.disabled = !!problem;
  };
  const toggle = (open: boolean) => {
    form.hidden = !open;
    el('newPageOpen').setAttribute('aria-expanded', String(open));
    if (!open) return;
    form.reset();
    typed = false;
    check();
    title.focus();
  };
  el('newPageOpen').addEventListener('click', () => toggle(form.hidden));
  el('newPageCancel').addEventListener('click', () => toggle(false));
  title.addEventListener('input', () => {
    if (!typed) key.value = ownKeyFrom(title.value);
    check();
  });
  key.addEventListener('input', () => {
    typed = true;
    check();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    check();
    if (create.disabled) return;
    toggle(false);
    newPage(key.value, title.value.trim());
  });
}

/** Reads the pages' records and lists them */
export async function loadPages() {
  const missing = missingScopes((await session.getTokenInfo()).scope).filter((s) => COLLECTIONS.some((c) => s === `repo:${c}`));
  el('pagesScope').hidden = missing.length === 0;

  const [projects, blockRecords, ...singletons] = await Promise.all([
    listRecords<PageRecord>(session, PROJECT_COLLECTION),
    listRecords<PageRecord>(session, PAGE_COLLECTION),
    ...PAGES.map((p) => getRecord<PageRecord>(session, p.collection, 'self')),
  ]);
  const pages: Row[] = PAGES.map((p, i) => ({ ...p, rkey: 'self', have: singletons[i] ?? undefined }));
  pageKeys = blockRecords.map((r) => rkeyOf(r.uri));
  const blocks = blockPages(blockRecords);
  // In the order they were added, which /projects/ starts from
  const sorted = [...projects].sort((a, b) => String(a.value.createdAt ?? '').localeCompare(String(b.value.createdAt ?? '')) || a.uri.localeCompare(b.uri));
  const rows: Row[] = sorted.map((r) => {
    const rkey = rkeyOf(r.uri);
    return { title: String(r.value.name || rkey), collection: PROJECT_COLLECTION, rkey, page: '/projects/', editor: `#project/${rkey}`, have: r };
  });
  report('pages', { count: pages.filter((p) => p.have).length + blocks.filter((p) => p.have).length + rows.length });
  const all = [...blocks, ...pages, ...rows];
  renderTable(
    {
      host: el('pagesTable'),
      noun: 'pages and projects',
      columns: [
        // A page of Jeff's own that's only a draft isn't on the site yet
        { label: 'Page', cell: (r) => cellRow(cellLink(r.editor, r.title), ...(r.have || !isOwn(r) ? [' ', viewLink(r.page, `View ${r.page} on the site`)] : []), ...(r.have ? [' ', recordLink(r)] : [])) },
        { label: 'Saved', cell: savedNote, secondary: true },
      ],
      filters: [
        { label: 'Pages', test: (r) => r.collection !== PROJECT_COLLECTION },
        { label: 'Your pages', test: isOwn },
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

/** A page of Jeff's own */
const isOwn = (row: Row) => row.collection === PAGE_COLLECTION && !isSitePage(row.rkey);

/**
 * The pages made of blocks, with their drafts: the site's own first, always, then Jeff's own by
 * address, including those with only a draft
 */
function blockPages(records: RepoRecord<PageRecord>[]): Row[] {
  const byKey = new Map(records.map((r) => [rkeyOf(r.uri), r]));
  const own = [...byKey.keys()].map((k) => k.replace(/~draft$/, '')).filter((k) => isPageKey(k) && !isSitePage(k));
  return [...new Set<string>([...SITE_PAGES, ...own.sort()])].map((key) => {
    const [have, draft] = [byKey.get(key), byKey.get(draftKey(key))];
    if (isSitePage(key)) {
      const { title, builtIn } = SITE_PAGE_DEFS[key];
      return { title, collection: PAGE_COLLECTION, rkey: key, page: key === 'home' ? '/' : `/${key}/`, editor: `#blocks/${key}`, fallback: builtIn?.shows, have, draft };
    }
    const title = String((have ?? draft)?.value.title || key);
    return { title, collection: PAGE_COLLECTION, rkey: key, page: ownPagePath(key), editor: `#blocks/${key}`, have, draft, problem: ownKeyProblem(key) };
  });
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

/** When a page's record was saved, or what the page shows without one, and when its draft was saved */
function savedNote(row: Row): string | Node {
  if (isOwn(row)) return ownState(row);
  const note = row.collection === PAGE_COLLECTION ? 'no page record' : 'no record';
  const saved = !row.have
    ? badge(`${note}: ${row.fallback ? `shows ${row.fallback}` : row.draft ? 'not published yet' : 'can’t show'}`, row.fallback || row.draft ? 'muted' : 'warn')
    : savedAt(row.have.value) ?? 'in your repo';
  const draft = row.draft && savedAt(row.draft.value);
  return draft ? cellRow(saved, ` · draft ${draft}`) : saved;
}

/** A page of Jeff's own: published or a draft, or why it can't show; when each was saved */
function ownState(row: Row): Node {
  const state = row.problem ? badge(`not shown: ${row.problem}`, 'warn') : row.have ? badge('published', 'ok') : badge('draft', 'muted');
  const times = (row.have ? [savedAt(row.have.value), row.draft && `draft ${savedAt(row.draft.value) ?? 'saved'}`] : [row.draft && savedAt(row.draft.value)]).filter((t): t is string => !!t);
  return cellRow(state, ...(times.length ? [` ${times.join(' · ')}`] : []));
}

const savedAt = (value: PageRecord) => {
  const at = value.updatedAt ?? value.createdAt;
  return typeof at === 'string' ? `saved ${formatTime(at)}` : undefined;
};
