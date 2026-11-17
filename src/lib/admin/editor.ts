/**
 * The admin app's posts: a list of drafts and published posts, and an editor for drafts.
 * See docs/v4/posts-on-atproto.md, step 6.
 *
 * A draft is an `id.skiddle.draft` record (lexicons/id/skiddle/draft.json), so it syncs between the
 * phone and the laptop. Anyone can read it on the PDS, as drafts in the git repo can be read today,
 * but readers like Leaflet don't list it, and the AT Protocol sync never touches it.
 *
 *   - The editor saves as you type (a second and a half after you stop), with swapRecord so two
 *     devices can't silently overwrite each other, and keeps a copy on this device until the save
 *     goes through.
 *   - The preview uses the same renderer as the site (src/lib/post-html.mjs) and the site's styles.
 *   - Images are shrunk under 1 MB in the browser if needed, uploaded as blobs, and written into the
 *     Markdown as ![alt](image:NAME).
 *   - Publishing stays off until the v4 launch: until then the site is built from git, and the sync
 *     would delete a post that isn't in git.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { categoryLabels } from '~/lib/categories.mjs';
import { POST_TYPE, SERIES_COLLECTION, DRAFT_COLLECTION, seriesSlug } from '~/lib/post-record.mjs';
import { renderPost, type PostImage } from '~/lib/post-html.mjs';
import { PUBLICATION_URI } from '~/lib/standard-site.mjs';
import { countChars } from '~/lib/status-states.mjs';
import { el, errorText, message } from './dom';
import { missingScopes } from './oauth';
import { XrpcError, createRecord, deleteRecord, getRecord, listRecords, putRecord, uploadBlob, type BlobRef, type RepoRecord } from './xrpc';

const DOCUMENT = 'site.standard.document';
const SAVE_DELAY_MS = 1500;
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGE_WIDTH = 2000;
const LANGS = { en: 'English', id: 'Bahasa Indonesia' } as const;

interface DraftContent {
  $type: typeof POST_TYPE;
  markdown: string;
  images?: (PostImage & { image: BlobRef })[];
  category?: string;
  lang?: string;
  series?: { series: string; part: number };
  featured?: boolean;
}

interface DraftRecord {
  $type: typeof DRAFT_COLLECTION;
  title: string;
  description?: string;
  path?: string;
  tags?: string[];
  content: DraftContent;
  publishAt?: string;
  coverImage?: BlobRef;
  createdAt: string;
  updatedAt?: string;
}

interface DocumentRecord {
  site?: string;
  path?: string;
  title?: string;
  publishedAt?: string;
  content?: { $type?: string; series?: { series?: string; part?: number } };
}

interface SeriesRecord {
  name?: string;
}

let session: OAuthSession;
let signInAgain: () => void;
let drafts: RepoRecord<DraftRecord>[] = [];
let documents: RepoRecord<DocumentRecord>[] = [];
let series: RepoRecord<SeriesRecord>[] = [];

/** The draft open in the editor */
let current: { rkey: string; cid: string; value: DraftRecord } | undefined;
let slugTouched = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | undefined;
let conflict = false;

const now = () => new Date().toISOString();
const backupKey = (rkey: string) => `skiddle-admin:draft:${rkey}`;
const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const slugify = (s: string) => seriesSlug(s).slice(0, 80);

// ---- Setup and routing ----

/**
 * @param s The signed-in session
 * @param again Starts a new sign-in (for when the session lacks the drafts and images permissions)
 */
export function setupPosts(s: OAuthSession, again: () => void) {
  session = s;
  signInAgain = again;
  el('newDraft').addEventListener('click', newDraft);
  el('postsSignIn').addEventListener('click', () => signInAgain());
  setupEditor();
  window.addEventListener('hashchange', route);
}

/** Shows the editor for #draft/<rkey>, otherwise the dashboard */
export async function route() {
  const rkey = /^#draft\/([a-z0-9]+)$/.exec(location.hash)?.[1];
  if (rkey) return openDraft(rkey);
  await leaveEditor();
  document.body.dataset.view = 'dashboard';
}

export async function loadPosts() {
  const missing = missingScopes((await session.getTokenInfo()).scope).filter((s) => /draft|blob/.test(s));
  el('postsScope').hidden = missing.length === 0;
  el<HTMLButtonElement>('newDraft').disabled = missing.length > 0;
  [drafts, documents, series] = await Promise.all([
    listRecords<DraftRecord>(session, DRAFT_COLLECTION).catch(() => []),
    listRecords<DocumentRecord>(session, DOCUMENT),
    listRecords<SeriesRecord>(session, SERIES_COLLECTION),
  ]);
  renderLists();
}

function renderLists() {
  const draftList = el('drafts');
  draftList.textContent = '';
  const sorted = [...drafts].sort((a, b) => (b.value.updatedAt ?? b.value.createdAt).localeCompare(a.value.updatedAt ?? a.value.createdAt));
  if (!sorted.length) draftList.appendChild(item('No drafts.', 'admin-muted'));
  for (const d of sorted) {
    const row = item('');
    const link = document.createElement('a');
    link.href = `#draft/${rkeyOf(d.uri)}`;
    link.textContent = d.value.title || 'Untitled';
    const when = document.createElement('span');
    when.className = 'admin-muted';
    when.textContent = `edited ${formatTime(d.value.updatedAt ?? d.value.createdAt)}`;
    row.appendChild(link);
    row.appendChild(when);
    draftList.appendChild(row);
  }

  const published = el('published');
  published.textContent = '';
  const posts = documents
    .filter((d) => d.value.site === PUBLICATION_URI && d.value.content?.$type === POST_TYPE && d.value.path)
    .sort((a, b) => (b.value.publishedAt ?? '').localeCompare(a.value.publishedAt ?? ''));
  for (const d of posts) {
    const row = item('');
    const link = document.createElement('a');
    link.href = d.value.path!;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = d.value.title ?? d.value.path!;
    const when = document.createElement('span');
    when.className = 'admin-muted';
    when.textContent = d.value.publishedAt ? new Date(d.value.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    row.appendChild(link);
    row.appendChild(when);
    published.appendChild(row);
  }
  el('publishedCount').textContent = String(posts.length);
}

function item(text: string, className = '') {
  const li = document.createElement('li');
  if (text) li.textContent = text;
  if (className) li.className = className;
  return li;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function newDraft() {
  const button = el<HTMLButtonElement>('newDraft');
  button.disabled = true;
  try {
    const record: DraftRecord = { $type: DRAFT_COLLECTION, title: '', content: { $type: POST_TYPE, markdown: '' }, createdAt: now(), updatedAt: now() };
    const res = await createRecord(session, DRAFT_COLLECTION, record);
    drafts.push({ uri: res.uri, cid: res.cid, value: record });
    location.hash = `#draft/${rkeyOf(res.uri)}`;
  } catch (err) {
    message('postsMessage', `Couldn't start a draft: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
  }
}

// ---- The editor ----

function setupEditor() {
  fillSelect(el('edCategory'), Object.entries(categoryLabels));
  fillSelect(el('edLang'), Object.entries(LANGS));
  const form = el<HTMLFormElement>('editorForm');
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'edSlug') slugTouched = true;
    if (target.id === 'edTitle' && !slugTouched) el<HTMLInputElement>('edSlug').value = slugify(el<HTMLInputElement>('edTitle').value);
    if (target.id === 'edSeries') suggestPart();
    if (target.id === 'edImage') return;
    onChange();
  });
  el('edDelete').addEventListener('click', deleteDraft);
  el('edImage').addEventListener('change', chooseImage);
  el('edImageUpload').addEventListener('click', uploadChosenImage);
  el('edImageCancel').addEventListener('click', clearChosenImage);
  el('edLoadTheirs').addEventListener('click', () => resolveConflict('theirs'));
  el('edKeepMine').addEventListener('click', () => resolveConflict('mine'));
  el('edRestore').addEventListener('click', restoreBackup);
  el('edDiscard').addEventListener('click', discardBackup);
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-pane]')) {
    tab.addEventListener('click', () => showPane(tab.dataset.pane as 'write' | 'preview'));
  }
  window.addEventListener('beforeunload', (event) => {
    if (saveTimer || saving) event.preventDefault();
  });
}

function fillSelect(select: HTMLSelectElement, options: [string, string][], blank?: string) {
  select.textContent = '';
  if (blank !== undefined) select.appendChild(new Option(blank, ''));
  for (const [value, label] of options) select.appendChild(new Option(label, value));
}

function showPane(pane: 'write' | 'preview') {
  el('editor').dataset.pane = pane;
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-pane]')) tab.setAttribute('aria-selected', String(tab.dataset.pane === pane));
}

async function openDraft(rkey: string) {
  if (current?.rkey === rkey) return;
  await leaveEditor();
  document.body.dataset.view = 'editor';
  message('editorMessage', '');
  el('editorState').textContent = 'Loading…';
  try {
    const record = await getRecord<DraftRecord>(session, DRAFT_COLLECTION, rkey);
    if (!record) {
      el('editorState').textContent = '';
      message('editorMessage', 'This draft doesn’t exist any more.', 'error');
      return;
    }
    current = { rkey, cid: record.cid, value: record.value };
    conflict = false;
    fillSelect(el('edSeries'), series.filter((s) => s.value.name).map((s) => [s.uri, s.value.name!]), 'No series');
    fillEditor(record.value);
    el('editorState').textContent = `Saved ${formatTime(record.value.updatedAt ?? record.value.createdAt)}`;
    showPane('write');
    checkBackup();
  } catch (err) {
    el('editorState').textContent = '';
    message('editorMessage', `Couldn’t open the draft: ${errorText(err)}`, 'error');
  }
}

function fillEditor(d: DraftRecord) {
  const c = d.content;
  el<HTMLInputElement>('edTitle').value = d.title;
  el<HTMLTextAreaElement>('edDescription').value = d.description ?? '';
  const slug = /^\/posts\/([^/]+)\/$/.exec(d.path ?? '')?.[1] ?? '';
  el<HTMLInputElement>('edSlug').value = slug || slugify(d.title);
  slugTouched = Boolean(slug);
  el<HTMLSelectElement>('edCategory').value = c.category ?? 'infra';
  el<HTMLSelectElement>('edLang').value = c.lang ?? 'en';
  el<HTMLInputElement>('edTags').value = (d.tags ?? []).join(', ');
  el<HTMLSelectElement>('edSeries').value = c.series?.series ?? '';
  el<HTMLInputElement>('edPart').value = c.series ? String(c.series.part) : '';
  el<HTMLInputElement>('edFeatured').checked = c.featured ?? false;
  el<HTMLTextAreaElement>('edMarkdown').value = c.markdown;
  updateSeriesFields();
  renderEditorPreview();
}

/** The draft as the form shows it */
function formDraft(): DraftRecord {
  const base = current!.value;
  const markdown = el<HTMLTextAreaElement>('edMarkdown').value;
  const used = new Set([...markdown.matchAll(/\]\(image:([^)\s]+)/g)].map((m) => m[1]));
  const images = (base.content.images ?? []).filter((i) => used.has(i.name));
  const seriesUri = el<HTMLSelectElement>('edSeries').value;
  const part = Number(el<HTMLInputElement>('edPart').value);
  const slug = el<HTMLInputElement>('edSlug').value.trim();
  const description = el<HTMLTextAreaElement>('edDescription').value.trim();
  const tags = el<HTMLInputElement>('edTags')
    .value.split(',')
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
  const content: DraftContent = { $type: POST_TYPE, markdown };
  if (images.length) content.images = images;
  content.category = el<HTMLSelectElement>('edCategory').value;
  const lang = el<HTMLSelectElement>('edLang').value;
  if (lang && lang !== 'en') content.lang = lang;
  if (seriesUri && Number.isInteger(part) && part >= 1) content.series = { series: seriesUri, part };
  if (el<HTMLInputElement>('edFeatured').checked) content.featured = true;
  const draft: DraftRecord = { ...base, title: el<HTMLInputElement>('edTitle').value.trim(), content, updatedAt: now() };
  if (description) draft.description = description;
  else delete draft.description;
  if (slug) draft.path = `/posts/${slug}/`;
  else delete draft.path;
  if (tags.length) draft.tags = tags;
  else delete draft.tags;
  return draft;
}

/** Problems that would make the record invalid or the post unpublishable */
function problems(d: DraftRecord): string[] {
  const out: string[] = [];
  if (countChars(d.title) > 500) out.push('The title is over 500 characters.');
  if (d.description && countChars(d.description) > 300) out.push('The description is over 300 characters (readers cut it there).');
  if (new TextEncoder().encode(d.content.markdown).length > 200_000) out.push('The post is over 200 KB of text.');
  const slug = /^\/posts\/([^/]+)\/$/.exec(d.path ?? '')?.[1];
  if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) out.push('The address can only have lowercase letters, digits and dashes.');
  if (slug) {
    const takenBy = documents.find((doc) => doc.value.path === d.path && doc.value.site === PUBLICATION_URI);
    if (takenBy) out.push(`/posts/${slug}/ is already a published post (“${takenBy.value.title}”).`);
    else if (drafts.some((x) => rkeyOf(x.uri) !== current?.rkey && x.value.path === d.path)) out.push(`Another draft uses /posts/${slug}/.`);
  }
  for (const t of d.tags ?? []) if (countChars(t) > 50) out.push(`The tag “${t}” is over 50 characters.`);
  if ((d.tags?.length ?? 0) > 50) out.push('More than 50 tags.');
  for (const i of d.content.images ?? []) if (!i.alt.trim()) out.push(`The image ${i.name} has no alt text.`);
  if (d.content.series && !series.some((s) => s.uri === d.content.series!.series)) out.push('That series doesn’t exist any more.');
  return out;
}

function onChange() {
  if (!current) return;
  renderEditorPreview();
  if (conflict) return;
  el('editorState').textContent = 'Not saved yet';
  saveBackup();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void save();
  }, SAVE_DELAY_MS);
}

function renderEditorPreview() {
  if (!current) return;
  const d = formDraft();
  const { html } = renderPost(d.content.markdown, { images: d.content.images ?? [] });
  // The title and description sit above the post, as on the post page, outside its prose styles
  const head = el('edPreviewHead');
  head.textContent = '';
  const title = document.createElement('h1');
  title.className = 'admin-preview-title';
  title.textContent = d.title || 'Untitled';
  head.appendChild(title);
  if (d.description) {
    const lead = document.createElement('p');
    lead.className = 'admin-muted';
    lead.textContent = d.description;
    head.appendChild(lead);
  }
  el('edPreview').innerHTML = html;
  const issues = problems(d);
  message('editorProblems', issues.join(' '), issues.length ? 'error' : 'info');
  el('edDescriptionCount').textContent = `${countChars(d.description ?? '')}/300`;
}

async function save(force = false): Promise<void> {
  if (!current || (conflict && !force)) return;
  if (saving) await saving;
  const draft = formDraft();
  const target = current;
  el('editorState').textContent = 'Saving…';
  saving = (async () => {
    try {
      const res = await putRecord(session, DRAFT_COLLECTION, target.rkey, draft, target.cid);
      target.cid = res.cid;
      target.value = draft;
      const listed = drafts.find((d) => rkeyOf(d.uri) === target.rkey);
      if (listed) Object.assign(listed, { cid: res.cid, value: draft });
      removeBackup(target.rkey);
      if (current === target) el('editorState').textContent = `Saved ${formatTime(draft.updatedAt!)}`;
    } catch (err) {
      if (err instanceof XrpcError && err.error === 'InvalidSwap') {
        conflict = true;
        el('editorConflict').hidden = false;
        el('editorState').textContent = 'Not saved: changed elsewhere';
      } else {
        el('editorState').textContent = 'Not saved';
        message('editorMessage', `Couldn’t save: ${errorText(err)}. Your changes are kept on this device.`, 'error');
      }
    }
  })();
  await saving;
  saving = undefined;
}

async function resolveConflict(choice: 'theirs' | 'mine') {
  if (!current) return;
  const latest = await getRecord<DraftRecord>(session, DRAFT_COLLECTION, current.rkey);
  el('editorConflict').hidden = true;
  conflict = false;
  if (!latest) return message('editorMessage', 'The draft was deleted elsewhere.', 'error');
  current.cid = latest.cid;
  if (choice === 'theirs') {
    current.value = latest.value;
    removeBackup(current.rkey);
    fillEditor(latest.value);
    el('editorState').textContent = `Saved ${formatTime(latest.value.updatedAt ?? latest.value.createdAt)}`;
  } else {
    await save(true);
  }
}

/** Saves what's pending, then closes the editor */
async function leaveEditor() {
  if (!current) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await save();
  } else if (saving) await saving;
  current = undefined;
  clearChosenImage();
  renderLists();
}

async function deleteDraft() {
  if (!current) return;
  const title = current.value.title || 'Untitled';
  if (!confirm(`Delete the draft “${title}”? This can’t be undone.`)) return;
  try {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await deleteRecord(session, DRAFT_COLLECTION, current.rkey);
    removeBackup(current.rkey);
    drafts = drafts.filter((d) => rkeyOf(d.uri) !== current!.rkey);
    current = undefined;
    location.hash = '';
    message('postsMessage', `Deleted the draft “${title}”.`, 'ok');
  } catch (err) {
    message('editorMessage', `Couldn’t delete it: ${errorText(err)}`, 'error');
  }
}

// ---- Series ----

function updateSeriesFields() {
  el<HTMLInputElement>('edPart').disabled = !el<HTMLSelectElement>('edSeries').value;
}

/** The next part number of the chosen series */
function suggestPart() {
  updateSeriesFields();
  const uri = el<HTMLSelectElement>('edSeries').value;
  if (!uri) return void (el<HTMLInputElement>('edPart').value = '');
  const parts = documents.map((d) => (d.value.content?.series?.series === uri ? (d.value.content.series.part ?? 0) : 0));
  el<HTMLInputElement>('edPart').value = String(Math.max(0, ...parts) + 1);
}

// ---- Images ----

let chosen: { blob: Blob; width: number; height: number; name: string } | undefined;

async function chooseImage() {
  const input = el<HTMLInputElement>('edImage');
  const file = input.files?.[0];
  input.value = '';
  if (!file || !current) return;
  message('edImageMessage', 'Preparing…');
  try {
    const prepared = await prepareImage(file);
    const taken = new Set((current.value.content.images ?? []).map((i) => i.name));
    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image';
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    chosen = { ...prepared, name };
    el<HTMLImageElement>('edImageThumb').src = URL.createObjectURL(prepared.blob);
    el('edImageBox').hidden = false;
    el<HTMLInputElement>('edImageAlt').value = '';
    el<HTMLInputElement>('edImageAlt').focus();
    message('edImageMessage', `${prepared.width}×${prepared.height}, ${Math.round(prepared.blob.size / 1024)} KB${prepared.blob === file ? '' : ' (shrunk)'}. Describe it for people who can’t see it.`);
  } catch (err) {
    message('edImageMessage', `Couldn’t use that image: ${errorText(err)}`, 'error');
  }
}

/** The image as-is if it's small enough, otherwise re-encoded as WebP, narrower, until it's under 1 MB */
async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('use a PNG, JPEG, WebP or GIF');
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.size <= MAX_IMAGE_BYTES && width <= MAX_IMAGE_WIDTH) {
    bitmap.close();
    return { blob: file, width, height };
  }
  let w = Math.min(width, MAX_IMAGE_WIDTH);
  for (let quality = 0.85; ; ) {
    const h = Math.round((height * w) / width);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.size <= MAX_IMAGE_BYTES) {
      bitmap.close();
      return { blob, width: w, height: h };
    }
    if (quality > 0.6) quality -= 0.1;
    else w = Math.round(w * 0.8);
    if (w < 320) throw new Error('it won’t shrink under 1 MB');
  }
}

async function uploadChosenImage() {
  if (!chosen || !current) return;
  const alt = el<HTMLInputElement>('edImageAlt').value.trim();
  if (!alt) return message('edImageMessage', 'Add alt text first: it’s what screen readers say instead of the image.', 'error');
  const button = el<HTMLButtonElement>('edImageUpload');
  button.disabled = true;
  message('edImageMessage', 'Uploading…');
  try {
    const blob = await uploadBlob(session, chosen.blob);
    const image = { name: chosen.name, image: blob, alt, width: chosen.width, height: chosen.height };
    current.value = { ...current.value, content: { ...current.value.content, images: [...(current.value.content.images ?? []), image] } };
    insertAtCursor(el<HTMLTextAreaElement>('edMarkdown'), `\n![${alt.replace(/[[\]]/g, '')}](image:${chosen.name})\n`);
    clearChosenImage();
    onChange();
  } catch (err) {
    message('edImageMessage', `Couldn’t upload it: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
  }
}

function clearChosenImage() {
  if (chosen) URL.revokeObjectURL(el<HTMLImageElement>('edImageThumb').src);
  chosen = undefined;
  el('edImageBox').hidden = true;
  message('edImageMessage', '');
}

function insertAtCursor(area: HTMLTextAreaElement, text: string) {
  const start = area.selectionStart ?? area.value.length;
  const end = area.selectionEnd ?? start;
  area.value = area.value.slice(0, start) + text + area.value.slice(end);
  area.selectionStart = area.selectionEnd = start + text.length;
  area.focus();
}

// ---- A copy on this device, until the save goes through ----

function saveBackup() {
  if (!current) return;
  try {
    localStorage.setItem(backupKey(current.rkey), JSON.stringify({ at: now(), cid: current.cid, value: formDraft() }));
  } catch {}
}

function removeBackup(rkey: string) {
  try {
    localStorage.removeItem(backupKey(rkey));
  } catch {}
}

function readBackup(rkey: string): { at: string; cid: string; value: DraftRecord } | undefined {
  try {
    const raw = localStorage.getItem(backupKey(rkey));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Offers changes that were typed here but never saved (the connection dropped, the tab closed) */
function checkBackup() {
  const backup = current && readBackup(current.rkey);
  el('editorBackup').hidden = !backup;
  if (backup) el('edBackupTime').textContent = formatTime(backup.at);
}

function restoreBackup() {
  const backup = current && readBackup(current.rkey);
  el('editorBackup').hidden = true;
  if (!backup || !current) return;
  fillEditor({ ...backup.value, content: { ...backup.value.content, images: backup.value.content.images ?? current.value.content.images } });
  current.value = { ...current.value, content: { ...current.value.content, images: backup.value.content.images ?? current.value.content.images } };
  onChange();
}

function discardBackup() {
  if (current) removeBackup(current.rkey);
  el('editorBackup').hidden = true;
}
