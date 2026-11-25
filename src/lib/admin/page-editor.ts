/**
 * The page editors (docs/v4/pages-on-atproto.md, step 5), opened from the Pages section:
 *   - #page/cv, #page/services, #page/uses, #page/about, #page/now and #page/notes: each page's
 *     record, key `self`. Now starts with the built-in list (src/data/now.ts) if there's no record yet
 *   - #page/categories: the post categories (id.skiddle.categories), from the Posts section. It
 *     starts with the site's current categories if there's no record yet, and refuses ids that
 *     can't be ids, come twice, or that posts still use but the list drops (src/lib/categories.mjs)
 *   - #project/<key>: a project; #new-project for a new one, whose key comes from its name
 *
 * Each form is made from its lexicon (src/lib/admin/lexicon-form.ts). Saving:
 *   - checks the record with @atproto/lexicon
 *   - keeps any field the form doesn't know, and sets updatedAt (a new project's createdAt)
 *   - writes it with swapRecord, so a change made on another device isn't overwritten unseen (a
 *     new record with createRecord, which never overwrites one)
 *   - refreshes the site's pages
 * A project can be deleted, after a confirm. Changes are kept on this device until they're saved,
 * as with series. Saving and deleting follow PUBLISHING_LIVE (src/lib/admin/launch.ts).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import aboutLexicon from '../../../lexicons/id/skiddle/about.json';
import categoriesLexicon from '../../../lexicons/id/skiddle/categories.json';
import cvLexicon from '../../../lexicons/id/skiddle/cv.json';
import notesLexicon from '../../../lexicons/id/skiddle/notes.json';
import nowLexicon from '../../../lexicons/id/skiddle/now.json';
import projectLexicon from '../../../lexicons/id/skiddle/project.json';
import servicesLexicon from '../../../lexicons/id/skiddle/services.json';
import usesLexicon from '../../../lexicons/id/skiddle/uses.json';
import { FALLBACK_NOW } from '~/data/now';
import { ABOUT_COLLECTION, CV_COLLECTION, NOW_COLLECTION, PROJECT_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, projectUri } from '~/lib/page-records.mjs';
import { NOTES_COLLECTION } from '~/lib/notes.mjs';
import { CATEGORIES_COLLECTION, DEFAULT_CATEGORIES, categoryProblems } from '~/lib/categories.mjs';
import { seriesSlug } from '~/lib/post-record.mjs';
import { ranked, valuesAt } from '~/lib/suggest.mjs';
import { el, errorText, formatTime, message, revalidate, saveState } from './dom';
import { PAGES_NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { buildForm, problems, recordSchema, type LexiconDoc } from './lexicon-form';
import { XrpcError, createRecord, deleteRecord, getRecord, listRecords, putRecord, type RepoRecord } from './xrpc';

type Value = Record<string, unknown>;

interface PageEditor {
  title: string;
  collection: string;
  lexicon: LexiconDoc;
  /** Where it shows on the site */
  page: string;
  /** What the form starts with when there's no record yet (otherwise it starts empty) */
  initial?: () => Value;
  /** Problems the lexicon can't express */
  check?: (value: Value) => string[];
}

/** How many posts and drafts use each category (src/lib/admin/editor.ts, via setupPageEditor) */
let categoryUsage: () => Map<string, number> = () => new Map();

/** The records with key `self` that have an editor, by their editor's address */
export const PAGE_EDITORS: Record<'cv' | 'services' | 'uses' | 'about' | 'now' | 'notes' | 'categories', PageEditor> = {
  cv: { title: 'The CV', collection: CV_COLLECTION, lexicon: cvLexicon as LexiconDoc, page: '/works/' },
  services: { title: 'Services', collection: SERVICES_COLLECTION, lexicon: servicesLexicon as LexiconDoc, page: '/services/' },
  uses: { title: 'Uses', collection: USES_COLLECTION, lexicon: usesLexicon as LexiconDoc, page: '/uses/' },
  about: { title: 'About', collection: ABOUT_COLLECTION, lexicon: aboutLexicon as LexiconDoc, page: '/about/' },
  now: {
    title: 'Now',
    collection: NOW_COLLECTION,
    lexicon: nowLexicon as LexiconDoc,
    page: '/now/',
    initial: () => ({ items: FALLBACK_NOW.map((text) => ({ text })) }),
  },
  notes: { title: 'Notes', collection: NOTES_COLLECTION, lexicon: notesLexicon as LexiconDoc, page: '/notes/' },
  categories: {
    title: 'Categories',
    collection: CATEGORIES_COLLECTION,
    lexicon: categoriesLexicon as LexiconDoc,
    page: '/topics/',
    initial: () => ({ categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) }),
    check: (value) => categoryProblems(Array.isArray(value.categories) ? (value.categories as { id?: string }[]) : [], categoryUsage()),
  },
};
export type PageName = keyof typeof PAGE_EDITORS;

export type PageRoute = { page: PageName } | { project: string } | { newProject: true };

const NEW_PROJECT = '#new-project';
const RECORD_KEY = /^[A-Za-z0-9._:~-]{1,512}$/;

/** The page editor an address asks for, if any */
export function pageRoute(hash: string): PageRoute | undefined {
  if (hash === NEW_PROJECT) return { newProject: true };
  const page = /^#page\/(cv|services|uses|about|now|notes|categories)$/.exec(hash)?.[1];
  if (page) return { page: page as PageName };
  const key = /^#project\/(.+)$/.exec(hash)?.[1];
  if (key && RECORD_KEY.test(key) && key !== '.' && key !== '..') return { project: key };
  return undefined;
}

const routeKey = (r: PageRoute) => ('page' in r ? `page/${r.page}` : 'project' in r ? `project/${r.project}` : 'new-project');

interface Open {
  route: string;
  title: string;
  collection: string;
  lexicon: LexiconDoc;
  /** Where it shows on the site */
  page: string;
  /** The record key; a new project has none until it's saved */
  rkey?: string;
  cid?: string;
  record?: Value;
  read: () => Value;
  check?: (value: Value) => string[];
}

let session: OAuthSession;
let saved: () => Promise<void>;
let projects: RepoRecord<Value>[] = [];
let current: Open | undefined;
/** The form has changes that aren't saved */
let dirty = false;
let conflict = false;

const now = () => new Date().toISOString();
const backupKey = (route: string) => `skiddle-admin:page:${route}`;
const isProject = (o: Open) => o.collection === PROJECT_COLLECTION;
const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';

/**
 * @param s The signed-in session
 * @param onSaved Called after a save or a delete, to refresh the lists
 * @param usage How many posts and drafts use each category, for the categories editor
 */
export function setupPageEditor(s: OAuthSession, onSaved: () => Promise<void>, usage?: () => Map<string, number>) {
  session = s;
  saved = onSaved;
  if (usage) categoryUsage = usage;
  el('peNotLive').textContent = PAGES_NOT_LIVE_YET;
  el('peNotLive').hidden = PUBLISHING_LIVE;
  el('peForm').addEventListener('submit', (event) => event.preventDefault());
  el('peSave').addEventListener('click', () => void save());
  el('peDelete').addEventListener('click', () => void remove());
  el('peLoadTheirs').addEventListener('click', () => void resolveConflict('theirs'));
  el('peKeepMine').addEventListener('click', () => void resolveConflict('mine'));
  el('peRestore').addEventListener('click', restoreBackup);
  el('peDiscard').addEventListener('click', discardBackup);
  window.addEventListener('beforeunload', (event) => {
    if (current && dirty && PUBLISHING_LIVE) event.preventDefault();
  });
}

/** Opens the editor an address asks for */
export async function openPage(route: PageRoute) {
  const key = routeKey(route);
  if (current?.route === key) return;
  leavePage();
  document.body.dataset.view = 'page';
  const target: PageEditor & { rkey?: string } =
    'page' in route
      ? { ...PAGE_EDITORS[route.page], rkey: 'self' }
      : { title: 'project' in route ? route.project : 'A new project', collection: PROJECT_COLLECTION, lexicon: projectLexicon as LexiconDoc, page: '/projects/', rkey: 'project' in route ? route.project : undefined };
  el('peTitle').textContent = target.title;
  // Categories open from the Posts section, the rest from Pages
  const back = el<HTMLAnchorElement>('peBack');
  back.href = target.collection === CATEGORIES_COLLECTION ? '#posts' : '#pages';
  back.textContent = target.collection === CATEGORIES_COLLECTION ? '← Posts' : '← Pages';
  message('peMessage', '');
  el('peConflict').hidden = true;
  el('peBackup').hidden = true;
  el('peForm').hidden = true;
  el('peNote').hidden = true;
  saveState('peState', 'Loading…');
  let record: RepoRecord<Value> | null;
  try {
    [record] = await Promise.all([
      target.rkey ? getRecord<Value>(session, target.collection, target.rkey) : Promise.resolve(null),
      listRecords<Value>(session, PROJECT_COLLECTION).then((list) => (projects = list)),
    ]);
  } catch (err) {
    saveState('peState', '');
    return message('peMessage', `Couldn’t open it: ${errorText(err)}`, 'error');
  }
  const still = pageRoute(location.hash);
  if (!still || routeKey(still) !== key) return; // moved on while it loaded
  if ('project' in route && !record) {
    saveState('peState', '');
    return message('peMessage', 'This project isn’t in your repo.', 'error');
  }
  current = { ...target, route: key, rkey: target.rkey, cid: record?.cid, record: record?.value, read: () => ({}) };
  if ('project' in route && record?.value.name) el('peTitle').textContent = String(record.value.name);
  fill(record?.value ?? target.initial?.() ?? {});
  el('peForm').hidden = false;
  const updated = record?.value.updatedAt ?? record?.value.createdAt;
  saveState('peState', record ? (typeof updated === 'string' ? `Saved ${formatTime(updated)}` : '') : 'Not saved yet');
  // A page whose record wasn't imported starts empty
  el('peNote').hidden = !('page' in route) || !!record;
  checkBackup();
}

/** ⌘S in a page editor: saves, if the Save button could */
export function savePageNow() {
  if (current && !el<HTMLButtonElement>('peSave').disabled) void save();
}

/** Closes the editor; unsaved changes stay on this device */
export function leavePage() {
  if (!current) return;
  current = undefined;
  dirty = false;
  conflict = false;
  el('peFields').textContent = '';
}

/** Builds the form for a record's fields */
function fill(value: Value) {
  if (!current) return;
  const form = buildForm(current.lexicon, value, {
    onChange,
    // The CV's selected projects
    choices: () =>
      projects
        .map((p) => ({ value: projectUri(rkeyOf(p.uri)), label: String(p.value.name ?? rkeyOf(p.uri)) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    // Values already used in the same place: in this record, and in the other projects for a project
    suggest: (path) => {
      if (!current) return [];
      const open = current;
      const others = isProject(open) ? projects.filter((p) => rkeyOf(p.uri) !== open.rkey).map((p) => p.value) : [];
      return ranked([open.read(), ...others].flatMap((v) => valuesAt(v, path)));
    },
  });
  current.read = form.read as () => Value;
  el('peFields').replaceChildren(form.el);
  refresh();
}

/** The key a new project would get from its name, or the record's own */
const keyFor = (o: Open, value: Value) => o.rkey ?? seriesSlug(String(value.name ?? '').trim());

/** What's wrong with the form: the lexicon's rules, and a new project's key */
function issues(o: Open, value: Value): string[] {
  const out = [...problems(o.lexicon, value), ...(o.check?.(value) ?? [])];
  if (isProject(o) && !o.rkey && value.name) {
    const key = keyFor(o, value);
    if (!key) out.push('The name needs a letter or a digit, for its key.');
    else if (projects.some((p) => rkeyOf(p.uri) === key)) out.push(`Another project already has the key ${key}.`);
  }
  return out;
}

/** Updates the problems, the key and the buttons from the form */
function refresh() {
  if (!current) return;
  const value = current.read();
  const found = issues(current, value);
  // A new project that nothing's been typed into yet isn't wrong, just empty
  message('peProblems', current.record || dirty ? found.join(' ') : '', found.length ? 'error' : 'info');
  const key = keyFor(current, value);
  el('peKey').textContent = !isProject(current)
    ? ''
    : current.rkey
      ? `Its key is ${current.rkey}.`
      : key
        ? `Its key will be ${key}, from the name. The name can change later; the key can’t.`
        : '';
  el('peKey').hidden = !el('peKey').textContent;
  el<HTMLButtonElement>('peSave').disabled = !PUBLISHING_LIVE || conflict || found.length > 0 || (!!current.record && !dirty);
  const view = el<HTMLAnchorElement>('peView');
  view.href = current.page;
  view.hidden = !current.record;
  const del = el<HTMLButtonElement>('peDelete');
  del.hidden = !isProject(current) || !current.record;
  del.disabled = !PUBLISHING_LIVE;
}

function onChange() {
  if (!current) return;
  if (!conflict) {
    dirty = true;
    saveBackup();
    saveState('peState', PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device');
  }
  refresh();
}

/** The record to write: the form's fields over any the form doesn't know, plus the dates */
function recordOf(o: Open, value: Value, at: string): Value {
  const known = new Set(Object.keys(recordSchema(o.lexicon).properties ?? {}));
  const kept = Object.fromEntries(Object.entries(o.record ?? {}).filter(([k]) => !known.has(k) && k !== '$type'));
  const dates = isProject(o) ? { createdAt: (o.record?.createdAt as string | undefined) ?? at, ...(o.record ? { updatedAt: at } : {}) } : { updatedAt: at };
  return { $type: o.collection, ...kept, ...value, ...dates };
}

async function save(force = false) {
  if (!PUBLISHING_LIVE || !current || (conflict && !force)) return;
  const target = current;
  const value = target.read();
  if (issues(target, value).length) return;
  const key = keyFor(target, value);
  const step = (text: string) => {
    if (current === target) saveState('peState', text);
  };
  el<HTMLButtonElement>('peSave').disabled = true;
  message('peMessage', '');
  try {
    step('Checking…');
    const record = recordOf(target, value, now());
    const { Lexicons } = await import('@atproto/lexicon');
    // A copy: loading a lexicon rewrites its refs in place, which the form reads
    new Lexicons([structuredClone(target.lexicon) as never]).assertValidRecord(target.collection, record);
    step('Saving…');
    const res = target.record
      ? await putRecord(session, target.collection, key, record, target.cid)
      : await createRecord(session, target.collection, record, key);
    const wasNew = !target.rkey;
    Object.assign(target, { rkey: key, cid: res.cid, record });
    removeBackup(target.route);
    await revalidate();
    void saved().catch(() => {});
    if (current === target) {
      dirty = false;
      if (wasNew) {
        // The editor now shows the saved project, at its own address
        target.route = `project/${key}`;
        history.replaceState(null, '', `#project/${key}`);
        el('peTitle').textContent = String(record.name ?? key);
      }
      el('peNote').hidden = true;
      step(`Saved ${formatTime(String(record.updatedAt ?? record.createdAt))}`);
      refresh();
    }
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') {
      conflict = true;
      el('peConflict').hidden = false;
      step('Not saved: changed elsewhere');
    } else {
      step('Not saved');
      message('peMessage', `Couldn’t save: ${errorText(err)}. Your changes are kept on this device.`, 'error');
    }
    if (current === target) refresh();
  }
}

async function resolveConflict(choice: 'theirs' | 'mine') {
  if (!current?.rkey) return;
  const target = current;
  try {
    const latest = await getRecord<Value>(session, target.collection, target.rkey!);
    el('peConflict').hidden = true;
    conflict = false;
    if (!latest) return message('peMessage', 'It was deleted elsewhere.', 'error');
    if (choice === 'theirs') {
      Object.assign(target, { cid: latest.cid, record: latest.value });
      removeBackup(target.route);
      dirty = false;
      fill(latest.value);
      const updated = latest.value.updatedAt;
      saveState('peState', typeof updated === 'string' ? `Loaded the version saved ${formatTime(updated)}` : 'Loaded the saved version');
    } else {
      // Keep the form; write it over the newer version
      Object.assign(target, { cid: latest.cid, record: latest.value });
      await save(true);
    }
  } catch (err) {
    message('peMessage', `Couldn’t load it: ${errorText(err)}`, 'error');
  }
}

/** Deletes a project, after a confirm */
async function remove() {
  if (!PUBLISHING_LIVE || !current?.rkey || !isProject(current)) return;
  const target = current;
  const name = String(target.record?.name ?? target.rkey);
  if (!confirm(`Delete the project “${name}”? This can’t be undone. If the CV selects it, it drops off the CV.`)) return;
  try {
    await deleteRecord(session, PROJECT_COLLECTION, target.rkey!, target.cid);
    removeBackup(target.route);
    current = undefined;
    dirty = false;
    await revalidate();
    location.hash = '#pages';
    // After the list reloads, which sets its own message
    await saved().catch(() => {});
    message('pagesMessage', `Deleted the project “${name}”.`, 'ok');
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') {
      conflict = true;
      el('peConflict').hidden = false;
      saveState('peState', 'Not deleted: changed elsewhere');
    } else message('peMessage', `Couldn’t delete it: ${errorText(err)}`, 'error');
  }
}

// ---- A copy on this device, until the save goes through ----

function saveBackup() {
  if (!current) return;
  try {
    localStorage.setItem(backupKey(current.route), JSON.stringify({ at: now(), value: current.read() }));
  } catch {}
}

function readBackup(route: string): { at: string; value: Value } | undefined {
  try {
    const raw = localStorage.getItem(backupKey(route));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function removeBackup(route: string) {
  try {
    localStorage.removeItem(backupKey(route));
  } catch {}
}

/** Offers changes that were made here but never saved */
function checkBackup() {
  const backup = current && readBackup(current.route);
  el('peBackup').hidden = !backup;
  if (backup) el('peBackupTime').textContent = formatTime(backup.at);
}

function restoreBackup() {
  const backup = current && readBackup(current.route);
  el('peBackup').hidden = true;
  if (!backup || !current) return;
  fill(backup.value);
  onChange();
}

function discardBackup() {
  if (current) removeBackup(current.route);
  el('peBackup').hidden = true;
}
