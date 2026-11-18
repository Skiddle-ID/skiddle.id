/**
 * The page editors (docs/v4/pages-on-atproto.md, step 5), opened from the Pages section:
 *   - #page/cv, #page/services, #page/uses and #page/about: each page's record, key `self`
 *   - #project/<key>: a project; #new-project for a new one, whose key comes from its name
 *
 * Each form is made from its lexicon (src/lib/admin/lexicon-form.ts). Saving:
 *   - checks the record with @atproto/lexicon
 *   - keeps any field the form doesn't know, and sets updatedAt (a new project's createdAt)
 *   - writes it with swapRecord, so a change made on another device isn't overwritten unseen (a
 *     new record with createRecord, which never overwrites one)
 *   - refreshes the site's pages
 * A project can be deleted, after a confirm. Until the v4 launch (src/lib/admin/launch.ts) saving
 * and deleting are off: skiddle.id still shows the data files, and the parity check expects the
 * records to match them. Changes are kept on this device until they're saved, as with series.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import aboutLexicon from '../../../lexicons/id/skiddle/about.json';
import cvLexicon from '../../../lexicons/id/skiddle/cv.json';
import projectLexicon from '../../../lexicons/id/skiddle/project.json';
import servicesLexicon from '../../../lexicons/id/skiddle/services.json';
import usesLexicon from '../../../lexicons/id/skiddle/uses.json';
import { ABOUT_COLLECTION, CV_COLLECTION, PROJECT_COLLECTION, SERVICES_COLLECTION, USES_COLLECTION, projectUri } from '~/lib/page-records.mjs';
import { seriesSlug } from '~/lib/post-record.mjs';
import { el, errorText, formatTime, message, revalidate } from './dom';
import { PAGES_NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { buildForm, problems, recordSchema, type LexiconDoc } from './lexicon-form';
import { XrpcError, createRecord, deleteRecord, getRecord, listRecords, putRecord, type RepoRecord } from './xrpc';

type Value = Record<string, unknown>;

/** The pages with one record each, by their editor's address */
export const PAGE_EDITORS = {
  cv: { title: 'The CV', collection: CV_COLLECTION, lexicon: cvLexicon as LexiconDoc, page: '/works/' },
  services: { title: 'Services', collection: SERVICES_COLLECTION, lexicon: servicesLexicon as LexiconDoc, page: '/services/' },
  uses: { title: 'Uses', collection: USES_COLLECTION, lexicon: usesLexicon as LexiconDoc, page: '/uses/' },
  about: { title: 'About', collection: ABOUT_COLLECTION, lexicon: aboutLexicon as LexiconDoc, page: '/about/' },
} as const;
export type PageName = keyof typeof PAGE_EDITORS;

export type PageRoute = { page: PageName } | { project: string } | { newProject: true };

const NEW_PROJECT = '#new-project';
const RECORD_KEY = /^[A-Za-z0-9._:~-]{1,512}$/;

/** The page editor an address asks for, if any */
export function pageRoute(hash: string): PageRoute | undefined {
  if (hash === NEW_PROJECT) return { newProject: true };
  const page = /^#page\/(cv|services|uses|about)$/.exec(hash)?.[1];
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
 * @param onSaved Called after a save or a delete, to refresh the Pages section
 */
export function setupPageEditor(s: OAuthSession, onSaved: () => Promise<void>) {
  session = s;
  saved = onSaved;
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
  const target =
    'page' in route
      ? { ...PAGE_EDITORS[route.page], rkey: 'self' as string | undefined }
      : { title: 'project' in route ? route.project : 'A new project', collection: PROJECT_COLLECTION, lexicon: projectLexicon as LexiconDoc, page: '/projects/', rkey: 'project' in route ? route.project : undefined };
  el('peTitle').textContent = target.title;
  message('peMessage', '');
  el('peConflict').hidden = true;
  el('peBackup').hidden = true;
  el('peForm').hidden = true;
  el('peNote').hidden = true;
  el('peState').textContent = 'Loading…';
  let record: RepoRecord<Value> | null;
  try {
    [record] = await Promise.all([
      target.rkey ? getRecord<Value>(session, target.collection, target.rkey) : Promise.resolve(null),
      listRecords<Value>(session, PROJECT_COLLECTION).then((list) => (projects = list)),
    ]);
  } catch (err) {
    el('peState').textContent = '';
    return message('peMessage', `Couldn’t open it: ${errorText(err)}`, 'error');
  }
  const still = pageRoute(location.hash);
  if (!still || routeKey(still) !== key) return; // moved on while it loaded
  if ('project' in route && !record) {
    el('peState').textContent = '';
    return message('peMessage', 'This project isn’t in your repo. Import it from the Pages section first.', 'error');
  }
  current = { ...target, route: key, rkey: target.rkey, cid: record?.cid, record: record?.value, read: () => ({}) };
  if ('project' in route && record?.value.name) el('peTitle').textContent = String(record.value.name);
  fill(record?.value ?? {});
  el('peForm').hidden = false;
  const updated = record?.value.updatedAt ?? record?.value.createdAt;
  el('peState').textContent = record ? (typeof updated === 'string' ? `Saved ${formatTime(updated)}` : '') : 'Not saved yet';
  // A page whose record wasn't imported starts empty
  el('peNote').hidden = !('page' in route) || !!record;
  checkBackup();
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
  });
  current.read = form.read as () => Value;
  el('peFields').replaceChildren(form.el);
  refresh();
}

/** The key a new project would get from its name, or the record's own */
const keyFor = (o: Open, value: Value) => o.rkey ?? seriesSlug(String(value.name ?? '').trim());

/** What's wrong with the form: the lexicon's rules, and a new project's key */
function issues(o: Open, value: Value): string[] {
  const out = problems(o.lexicon, value);
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
    el('peState').textContent = PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device';
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
    if (current === target) el('peState').textContent = text;
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
      el('peState').textContent = typeof updated === 'string' ? `Loaded the version saved ${formatTime(updated)}` : 'Loaded the saved version';
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
      el('peState').textContent = 'Not deleted: changed elsewhere';
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
