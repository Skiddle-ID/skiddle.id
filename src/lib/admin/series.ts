/**
 * The admin app's series: the Series section's list, and the series editor (#series/<key>, or
 * #new-series for a new one). See docs/v4/posts-on-atproto.md, step 6.
 *
 * A series is an `id.skiddle.series` record (lexicons/id/skiddle/series.json) whose key is made
 * from its name when it's created. Posts point at the record, so a series can be renamed and its
 * posts follow; the key stays.
 *   - Saving draws the series' share card in the browser (src/lib/admin/card.ts), uploads it, and
 *     writes the record with swapRecord, so a change made on another device isn't overwritten
 *     unseen. Then the site refreshes its pages.
 *   - Until the v4 launch (src/lib/admin/launch.ts) saving and deleting are off, because v3's sync
 *     writes each series' name, planned parts and cadence from git. Changes are kept on this
 *     device until they're saved, as with posts.
 *   - A series can only be deleted while no post or draft belongs to it.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { SERIES_COLLECTION, seriesRecord, seriesSlug } from '~/lib/post-record.mjs';
import { DID } from '~/lib/standard-site.mjs';
import { countChars } from '~/lib/status-states.mjs';
import { cardSeriesOf, type CardSeries } from './card-text';
import { el, errorText, formatTime, item, message, revalidate, row, viewLink } from './dom';
import { PUBLISHING_LIVE, SERIES_NOT_LIVE_YET } from './launch';
import { XrpcError, createRecord, deleteRecord, getRecord, putRecord, uploadBlob, type BlobRef, type RepoRecord } from './xrpc';

export interface SeriesRecord {
  $type?: string;
  name?: string;
  description?: string;
  ongoing?: boolean;
  cadence?: string;
  planned?: PlannedPart[];
  coverImage?: BlobRef;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface PlannedPart {
  part: number;
  title: string;
}

/** What the series editor needs from the rest of the admin app */
export interface SeriesContext {
  session: OAuthSession;
  /** Published posts, with the series (its at:// address) and part they belong to */
  posts: () => { title: string; path: string; series?: string; part?: number }[];
  /** Drafts, with their series */
  drafts: () => { series?: string }[];
}

/** What the form holds */
interface SeriesForm {
  name: string;
  description: string;
  ongoing: boolean;
  cadence: string;
  planned: PlannedPart[];
}

/** The series in the editor; a new one has no key until it's saved */
interface Open {
  key?: string;
  cid?: string;
  record?: SeriesRecord;
}

/** The address of the editor for a new series */
const NEW = '#new-series';
const MAX_DESCRIPTION = 300;

let ctx: SeriesContext;
let series: RepoRecord<SeriesRecord>[] = [];
let current: Open | undefined;
/** The form has changes that aren't saved */
let dirty = false;
let conflict = false;

const now = () => new Date().toISOString();
const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const uriOf = (key: string) => `at://${DID}/${SERIES_COLLECTION}/${key}`;
const backupKey = (key?: string) => `skiddle-admin:series:${key ?? 'new'}`;

export const seriesList = () => series;
export function setSeriesList(list: RepoRecord<SeriesRecord>[]) {
  series = list;
}

/** The series editor's route in an address: a series' key, NEW, or undefined if it isn't one */
export function seriesRoute(hash: string): string | undefined {
  if (hash === NEW) return NEW;
  return /^#series\/([a-z0-9][a-z0-9-]*)$/.exec(hash)?.[1];
}

export function setupSeries(c: SeriesContext) {
  ctx = c;
  for (const id of ['seriesNotLive', 'seNotLive']) {
    el(id).textContent = SERIES_NOT_LIVE_YET;
    el(id).hidden = PUBLISHING_LIVE;
  }
  const form = el<HTMLFormElement>('seForm');
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).id === 'seOngoing') showCadence();
    onChange();
  });
  el('seParts').addEventListener('click', (event) => {
    const remove = (event.target as HTMLElement).closest('button[data-remove]');
    if (!remove) return;
    remove.closest('li')?.remove();
    onChange();
  });
  el('seAddPart').addEventListener('click', addPart);
  el('seCard').addEventListener('click', () => void showCard());
  el('seSave').addEventListener('click', () => void save());
  el('seDelete').addEventListener('click', () => void remove());
  el('seLoadTheirs').addEventListener('click', () => void resolveConflict('theirs'));
  el('seKeepMine').addEventListener('click', () => void resolveConflict('mine'));
  el('seRestore').addEventListener('click', restoreBackup);
  el('seDiscard').addEventListener('click', discardBackup);
  window.addEventListener('beforeunload', (event) => {
    if (current && dirty && PUBLISHING_LIVE) event.preventDefault();
  });
}

/** Published posts in a series, by part */
function publishedParts(key: string | undefined) {
  if (!key) return [];
  const uri = uriOf(key);
  return ctx
    .posts()
    .filter((p) => p.series === uri && p.part)
    .sort((a, b) => a.part! - b.part!);
}

// ---- The Series section ----

/** Each series, with its published and planned parts */
export function renderSeries() {
  const list = el('seriesList');
  list.textContent = '';
  if (!series.length) list.appendChild(item('No series yet.', 'admin-muted'));
  for (const s of [...series].sort((a, b) => (a.value.name ?? '').localeCompare(b.value.name ?? ''))) {
    const v = s.value;
    const key = rkeyOf(s.uri);
    const parts = publishedParts(key).map((p) => p.part);
    const planned = (v.planned ?? []).filter((p) => !parts.includes(p.part)).length;
    const note = [
      `${parts.length} published`,
      planned ? `${planned} planned` : '',
      v.ongoing ? (v.cadence ? `new ${v.cadence}` : 'ongoing') : '',
    ]
      .filter(Boolean)
      .join(', ');
    const r = row(`#series/${key}`, v.name ?? key, note);
    // The site lists a series once it has a published part
    if (parts.length && v.name) r.appendChild(viewLink(`/series/#${seriesSlug(v.name)}`, `View “${v.name}” on the site`));
    list.appendChild(r);
  }
}

// ---- The editor ----

/** Opens the series editor for a series' key, or NEW */
export async function openSeries(route: string) {
  if (current && (current.key ?? NEW) === route) return;
  leaveSeries();
  document.body.dataset.view = 'series';
  const key = route === NEW ? undefined : route;
  message('seMessage', '');
  el('seConflict').hidden = true;
  el('seBackup').hidden = true;
  el('seForm').hidden = true;
  el('seState').textContent = key ? 'Loading…' : '';
  let opened: Open = {};
  if (key) {
    try {
      const record = await getRecord<SeriesRecord>(ctx.session, SERIES_COLLECTION, key);
      if (seriesRoute(location.hash) !== route) return; // moved on while it loaded
      if (!record) {
        el('seState').textContent = '';
        return message('seMessage', 'This series doesn’t exist any more.', 'error');
      }
      opened = { key, cid: record.cid, record: record.value };
    } catch (err) {
      el('seState').textContent = '';
      return message('seMessage', `Couldn’t open it: ${errorText(err)}`, 'error');
    }
  }
  current = opened;
  dirty = false;
  conflict = false;
  el('seForm').hidden = false;
  el('seCardImage').hidden = true;
  message('seCardMessage', '');
  fillForm(formOf(opened.record));
  el('seState').textContent = opened.record
    ? opened.record.updatedAt
      ? `Saved ${formatTime(opened.record.updatedAt)}`
      : ''
    : 'A new series';
  checkBackup();
  if (!key) el('seName').focus();
}

/** Closes the editor; unsaved changes stay on this device */
export function leaveSeries() {
  if (!current) return;
  current = undefined;
  dirty = false;
  conflict = false;
  const image = el<HTMLImageElement>('seCardImage');
  if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
  image.removeAttribute('src');
  renderSeries();
}

function formOf(r?: SeriesRecord): SeriesForm {
  return {
    name: r?.name ?? '',
    description: r?.description ?? '',
    ongoing: r?.ongoing ?? false,
    cadence: r?.cadence ?? '',
    planned: [...(r?.planned ?? [])].sort((a, b) => a.part - b.part),
  };
}

function fillForm(f: SeriesForm) {
  el<HTMLInputElement>('seName').value = f.name;
  el<HTMLTextAreaElement>('seDescription').value = f.description;
  el<HTMLInputElement>('seOngoing').checked = f.ongoing;
  el<HTMLInputElement>('seCadence').value = f.cadence;
  showCadence();
  // Published parts (read-only, from the posts) and planned ones, in order
  const list = el('seParts');
  list.textContent = '';
  const rows = [
    ...publishedParts(current?.key).map((p) => ({ part: p.part!, li: publishedRow(p.part!, p.title, p.path) })),
    ...f.planned.map((p) => ({ part: p.part, li: plannedRow(p) })),
  ].sort((a, b) => a.part - b.part);
  for (const r of rows) list.appendChild(r.li);
  refresh();
}

function publishedRow(part: number, title: string, path: string) {
  const li = item('');
  li.dataset.published = '';
  const n = document.createElement('span');
  n.className = 'admin-part-n';
  n.textContent = String(part);
  const link = document.createElement('a');
  link.href = path;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = title;
  const note = document.createElement('span');
  note.className = 'admin-muted';
  note.textContent = 'published';
  li.appendChild(n);
  li.appendChild(link);
  li.appendChild(note);
  return li;
}

function plannedRow(p: PlannedPart) {
  const li = item('');
  li.dataset.planned = '';
  const n = document.createElement('input');
  n.type = 'number';
  n.min = '1';
  n.inputMode = 'numeric';
  n.className = 'admin-part-n';
  n.value = Number.isFinite(p.part) ? String(p.part) : '';
  n.setAttribute('aria-label', 'Part number');
  const title = document.createElement('input');
  title.type = 'text';
  title.autocomplete = 'off';
  title.placeholder = 'Title';
  title.value = p.title;
  title.setAttribute('aria-label', 'Title of the planned part');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'admin-btn admin-btn-ghost admin-part-remove';
  remove.dataset.remove = '';
  remove.textContent = '×';
  remove.title = 'Remove';
  remove.setAttribute('aria-label', 'Remove this planned part');
  li.appendChild(n);
  li.appendChild(title);
  li.appendChild(remove);
  return li;
}

function readForm(): SeriesForm {
  const planned = [...document.querySelectorAll<HTMLLIElement>('#seParts li[data-planned]')].map((li) => ({
    part: Number(li.querySelector<HTMLInputElement>('input[type="number"]')!.value),
    title: li.querySelector<HTMLInputElement>('input[type="text"]')!.value,
  }));
  return {
    name: el<HTMLInputElement>('seName').value,
    description: el<HTMLTextAreaElement>('seDescription').value,
    ongoing: el<HTMLInputElement>('seOngoing').checked,
    cadence: el<HTMLInputElement>('seCadence').value,
    planned,
  };
}

function showCadence() {
  el('seCadenceField').hidden = !el<HTMLInputElement>('seOngoing').checked;
}

/** The key a new series would get, or the series' own */
const keyFor = (f: SeriesForm) => current?.key ?? seriesSlug(f.name.trim());

/** Problems that would make the record invalid, or clash with another series */
function problems(f: SeriesForm): string[] {
  const out: string[] = [];
  const name = f.name.trim();
  if (!name) out.push('A series needs a name.');
  else if (countChars(name) > 100) out.push('The name is over 100 characters.');
  // The site tells series apart by name, and the key comes from it
  const twin = name && series.find((s) => rkeyOf(s.uri) !== current?.key && s.value.name?.trim().toLowerCase() === name.toLowerCase());
  if (twin) out.push(`Another series is called “${twin.value.name}”.`);
  else if (name && !current?.key) {
    const key = keyFor(f);
    if (!key) out.push('The name needs a letter or a digit.');
    else if (series.some((s) => rkeyOf(s.uri) === key)) out.push(`Another series already has the key ${key}.`);
  }
  if (countChars(f.description.trim()) > MAX_DESCRIPTION) out.push(`The description is over ${MAX_DESCRIPTION} characters.`);
  if (f.ongoing && countChars(f.cadence.trim()) > 64) out.push('“How often” is over 64 characters.');
  if (f.planned.length > 100) out.push('More than 100 planned parts.');
  const seen = new Set<number>();
  for (const p of f.planned) {
    if (!Number.isInteger(p.part) || p.part < 1) out.push('Part numbers are whole numbers from 1.');
    else if (seen.has(p.part)) out.push(`Two planned parts are part ${p.part}.`);
    else seen.add(p.part);
    if (!p.title.trim()) out.push(Number.isInteger(p.part) && p.part >= 1 ? `Planned part ${p.part} has no title.` : 'A planned part has no title.');
    else if (countChars(p.title.trim()) > 300) out.push(`The title of planned part ${p.part} is over 300 characters.`);
  }
  return [...new Set(out)];
}

/** Updates the problems, counts, notes and buttons from the form; returns the problems */
function refresh(): string[] {
  const f = readForm();
  const issues = problems(f);
  // A new series that nothing's been typed into yet isn't wrong, just empty
  message('seProblems', current?.key || dirty ? issues.join(' ') : '', issues.length ? 'error' : 'info');
  el('seDescriptionCount').textContent = `${countChars(f.description.trim())}/${MAX_DESCRIPTION}`;
  const key = keyFor(f);
  el('seKey').textContent = current?.key
    ? `Its key is ${current.key}. It stays if you rename the series, and its posts follow the new name.`
    : key
      ? `Its key will be ${key}, from the name. The name can change later; the key can’t.`
      : '';
  el<HTMLButtonElement>('seSave').disabled = !PUBLISHING_LIVE || conflict || issues.length > 0 || (!!current?.key && !dirty);

  const published = publishedParts(current?.key);
  el('seOffSite').hidden = published.length > 0;
  const view = el<HTMLAnchorElement>('seView');
  view.hidden = !published.length || !current?.record?.name;
  if (current?.record?.name) view.href = `/series/#${seriesSlug(current.record.name)}`;

  // Deleting: only an existing series that nothing belongs to
  const del = el<HTMLButtonElement>('seDelete');
  const uri = current?.key && uriOf(current.key);
  const posts = uri ? ctx.posts().filter((p) => p.series === uri).length : 0;
  const drafts = uri ? ctx.drafts().filter((d) => d.series === uri).length : 0;
  del.hidden = !current?.key;
  del.disabled = !PUBLISHING_LIVE || posts + drafts > 0;
  const note = el('seDeleteNote');
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  note.textContent =
    current?.key && posts + drafts
      ? `It can’t be deleted while ${[posts ? count(posts, 'post') : '', drafts ? count(drafts, 'draft') : ''].filter(Boolean).join(' and ')} belong${posts + drafts === 1 ? 's' : ''} to it.`
      : '';
  note.hidden = !note.textContent;
  return issues;
}

function onChange() {
  if (!current) return;
  if (!conflict) {
    dirty = true;
    saveBackup();
    el('seState').textContent = PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device';
  }
  refresh();
}

/** A planned part after the last published or planned one */
function addPart() {
  const f = readForm();
  const numbers = [...publishedParts(current?.key).map((p) => p.part!), ...f.planned.map((p) => p.part).filter(Number.isFinite)];
  const li = plannedRow({ part: Math.max(0, ...numbers) + 1, title: '' });
  el('seParts').appendChild(li);
  li.querySelector<HTMLInputElement>('input[type="text"]')!.focus();
  onChange();
}

// ---- Share card and saving ----

/** What the share card shows for the form */
function cardSeries(f: SeriesForm): CardSeries {
  return cardSeriesOf(keyFor(f), f, publishedParts(current?.key).map((p) => p.part!));
}

/** Draws the share card under the form (nothing is uploaded) */
async function showCard() {
  const button = el<HTMLButtonElement>('seCard');
  button.disabled = true;
  message('seCardMessage', 'Drawing the share card…');
  try {
    const { drawSeriesCard } = await import('./card');
    const image = el<HTMLImageElement>('seCardImage');
    if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
    image.src = URL.createObjectURL(await drawSeriesCard(cardSeries(readForm())));
    image.hidden = false;
    message('seCardMessage', '');
  } catch (err) {
    message('seCardMessage', `Couldn’t draw it: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
  }
}

/**
 * Draws and uploads the share card, then writes the record: a new series under its key, an
 * existing one only if nobody changed it since it was opened
 */
async function save(force = false) {
  if (!PUBLISHING_LIVE || !current || (conflict && !force)) return;
  const f = readForm();
  if (problems(f).length) return;
  const target = current;
  const key = keyFor(f);
  const step = (text: string) => {
    if (current === target) el('seState').textContent = text;
  };
  el<HTMLButtonElement>('seSave').disabled = true;
  message('seMessage', '');
  try {
    step('Drawing the share card…');
    const { drawSeriesCard } = await import('./card');
    const png = await drawSeriesCard(cardSeries(f));
    step('Uploading the share card…');
    const coverImage = await uploadBlob(ctx.session, png);
    step('Saving…');
    const record = seriesRecord({ ...f, coverImage }, target.record ?? {}) as SeriesRecord;
    const wasNew = !target.key;
    const res = wasNew
      ? await createRecord(ctx.session, SERIES_COLLECTION, record, key)
      : await putRecord(ctx.session, SERIES_COLLECTION, key, record, target.cid);
    Object.assign(target, { key, cid: res.cid, record });
    removeBackup(wasNew ? undefined : key);
    const listed = series.find((s) => rkeyOf(s.uri) === key);
    if (listed) Object.assign(listed, { cid: res.cid, value: record });
    else series.push({ uri: res.uri, cid: res.cid, value: record });
    await revalidate();
    if (current === target) {
      dirty = false;
      // The editor now shows the saved series, at its own address
      if (wasNew) history.replaceState(null, '', `#series/${key}`);
      step(`Saved ${formatTime(record.updatedAt!)}`);
      refresh();
    }
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') {
      conflict = true;
      el('seConflict').hidden = false;
      step('Not saved: changed elsewhere');
    } else {
      step('Not saved');
      message('seMessage', `Couldn’t save: ${errorText(err)}. Your changes are kept on this device.`, 'error');
    }
    if (current === target) refresh();
  }
}

async function resolveConflict(choice: 'theirs' | 'mine') {
  if (!current?.key) return;
  const target = current;
  try {
    const latest = await getRecord<SeriesRecord>(ctx.session, SERIES_COLLECTION, target.key!);
    el('seConflict').hidden = true;
    conflict = false;
    if (!latest) return message('seMessage', 'The series was deleted elsewhere.', 'error');
    target.cid = latest.cid;
    target.record = latest.value;
    if (choice === 'theirs') {
      removeBackup(target.key);
      dirty = false;
      fillForm(formOf(latest.value));
      el('seState').textContent = latest.value.updatedAt ? `Loaded the version saved ${formatTime(latest.value.updatedAt)}` : 'Loaded the saved version';
    } else {
      await save(true);
    }
  } catch (err) {
    message('seMessage', `Couldn’t load it: ${errorText(err)}`, 'error');
  }
}

/** Deletes a series that no post or draft belongs to */
async function remove() {
  if (!PUBLISHING_LIVE || !current?.key) return;
  const target = current;
  const key = target.key!;
  const name = target.record?.name ?? key;
  const uri = uriOf(key);
  if (ctx.posts().some((p) => p.series === uri) || ctx.drafts().some((d) => d.series === uri)) return;
  if (!confirm(`Delete the series “${name}”? This can’t be undone.`)) return;
  try {
    await deleteRecord(ctx.session, SERIES_COLLECTION, key, target.cid);
    removeBackup(key);
    series = series.filter((s) => rkeyOf(s.uri) !== key);
    current = undefined;
    dirty = false;
    await revalidate();
    renderSeries();
    location.hash = '#series';
    message('seriesMessage', `Deleted the series “${name}”.`, 'ok');
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') {
      conflict = true;
      el('seConflict').hidden = false;
      el('seState').textContent = 'Not deleted: changed elsewhere';
    } else message('seMessage', `Couldn’t delete it: ${errorText(err)}`, 'error');
  }
}

// ---- A copy on this device, until the save goes through ----

function saveBackup() {
  if (!current) return;
  try {
    localStorage.setItem(backupKey(current.key), JSON.stringify({ at: now(), form: readForm() }));
  } catch {}
}

function readBackup(key?: string): { at: string; form: SeriesForm } | undefined {
  try {
    const raw = localStorage.getItem(backupKey(key));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function removeBackup(key?: string) {
  try {
    localStorage.removeItem(backupKey(key));
  } catch {}
}

/** Offers changes that were made here but never saved */
function checkBackup() {
  const backup = current && readBackup(current.key);
  el('seBackup').hidden = !backup;
  if (backup) el('seBackupTime').textContent = formatTime(backup.at);
}

function restoreBackup() {
  const backup = current && readBackup(current.key);
  el('seBackup').hidden = true;
  if (!backup || !current) return;
  fillForm(backup.form);
  onChange();
}

function discardBackup() {
  if (current) removeBackup(current.key);
  el('seBackup').hidden = true;
}
