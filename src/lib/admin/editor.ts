/**
 * The admin app's posts: a list of drafts and published posts, and one editor for both.
 * See docs/v4/posts-on-atproto.md, step 6.
 *
 * Drafts (#draft/<rkey>) are `id.skiddle.draft` records (lexicons/id/skiddle/draft.json), so they
 * sync between the phone and the laptop. Anyone can read them on the PDS, as drafts in the git repo
 * can be read today, but readers like Leaflet don't list them, and the AT Protocol sync never
 * touches them.
 *   - A draft saves as you type (a second and a half after you stop), with swapRecord so two
 *     devices can't silently overwrite each other, and a copy stays on this device until the save
 *     goes through.
 *
 * Published posts (#post/<rkey>) are `site.standard.document` records. They open in the same
 * editor, with the address fixed (changing it would break links) and an explicit "Save changes",
 * since a save goes live. A save keeps the publish date and sets "updated" to now, unless it's
 * ticked as a small fix (like `[skip updated]` in a git commit), which leaves "updated" as it was. Saving, unpublishing and publishing drafts wait for the v4 launch
 * (src/lib/admin/launch.ts); until then edits are kept on this device.
 *
 *   - The preview uses the same renderer as the site (src/lib/post-html.mjs) and the site's styles.
 *   - Images are shrunk under 1 MB in the browser if needed, uploaded as blobs, and written into the
 *     Markdown as ![alt](image:NAME).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { categoryLabels } from '~/lib/categories.mjs';
import { plainText } from '~/lib/plain-text.mjs';
import { POST_TYPE, SERIES_COLLECTION, DRAFT_COLLECTION, seriesSlug } from '~/lib/post-record.mjs';
import { renderPost, type PostImage } from '~/lib/post-html.mjs';
import { PUBLICATION_URI } from '~/lib/standard-site.mjs';
import { countChars } from '~/lib/status-states.mjs';
import { el, errorText, message } from './dom';
import { NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { missingScopes } from './oauth';
import { XrpcError, createRecord, deleteRecord, getRecord, listRecords, putRecord, uploadBlob, type BlobRef, type RepoRecord } from './xrpc';

const DOCUMENT = 'site.standard.document';
const SAVE_DELAY_MS = 1500;
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGE_WIDTH = 2000;
const LANGS = { en: 'English', id: 'Bahasa Indonesia' } as const;

interface PostContent {
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
  content: PostContent;
  publishAt?: string;
  coverImage?: BlobRef;
  createdAt: string;
  updatedAt?: string;
}

/** A site.standard.document; fields other tools add are kept on save */
interface DocumentRecord {
  $type?: string;
  site?: string;
  path?: string;
  title?: string;
  description?: string;
  tags?: string[];
  publishedAt?: string;
  updatedAt?: string;
  textContent?: string;
  content?: { $type?: string; series?: { series?: string; part?: number } } & Partial<PostContent>;
  [key: string]: unknown;
}

interface SeriesRecord {
  name?: string;
}

type Kind = 'draft' | 'post';

/** What the editor shows: a draft, or a published post in the same shape */
interface Open {
  kind: Kind;
  rkey: string;
  cid: string;
  value: DraftRecord;
  /** The published post's record as it was opened (posts only), to keep its other fields on save */
  doc?: DocumentRecord;
}

let session: OAuthSession;
let signInAgain: () => void;
let drafts: RepoRecord<DraftRecord>[] = [];
let documents: RepoRecord<DocumentRecord>[] = [];
let series: RepoRecord<SeriesRecord>[] = [];

let current: Open | undefined;
let slugTouched = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | undefined;
let conflict = false;
/** A published post has changes that aren't saved */
let dirty = false;

const now = () => new Date().toISOString();
const backupKey = (kind: Kind, rkey: string) => `skiddle-admin:${kind}:${rkey}`;
const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const slugify = (s: string) => seriesSlug(s).slice(0, 80);
const collectionOf = (kind: Kind) => (kind === 'post' ? DOCUMENT : DRAFT_COLLECTION);
const isSitePost = (d: DocumentRecord) => d.site === PUBLICATION_URI && d.content?.$type === POST_TYPE && !!d.path;

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

/** Shows the editor for #draft/<rkey> or #post/<rkey>, otherwise the dashboard */
export async function route() {
  const m = /^#(draft|post)\/([a-z0-9]+)$/.exec(location.hash);
  if (m) return open(m[1] as Kind, m[2]);
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
    draftList.appendChild(row(`#draft/${rkeyOf(d.uri)}`, d.value.title || 'Untitled', `edited ${formatTime(d.value.updatedAt ?? d.value.createdAt)}`));
  }

  const published = el('published');
  published.textContent = '';
  const posts = documents.filter((d) => isSitePost(d.value)).sort((a, b) => (b.value.publishedAt ?? '').localeCompare(a.value.publishedAt ?? ''));
  for (const d of posts) {
    const when = d.value.publishedAt ? new Date(d.value.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const r = row(`#post/${rkeyOf(d.uri)}`, d.value.title ?? d.value.path!, when);
    const view = document.createElement('a');
    view.href = d.value.path!;
    view.target = '_blank';
    view.rel = 'noopener';
    view.className = 'admin-muted';
    view.textContent = 'view';
    view.setAttribute('aria-label', `View “${d.value.title}” on the site`);
    r.appendChild(view);
    published.appendChild(r);
  }
  el('publishedCount').textContent = String(posts.length);
}

/** A list row: a link that opens it in the editor, and a note */
function row(href: string, text: string, note: string) {
  const li = item('');
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  const small = document.createElement('span');
  small.className = 'admin-muted';
  small.textContent = note;
  li.appendChild(link);
  li.appendChild(small);
  return li;
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
  for (const note of document.querySelectorAll<HTMLElement>('[data-not-live]')) {
    note.textContent = NOT_LIVE_YET;
    note.hidden = PUBLISHING_LIVE;
  }
  const form = el<HTMLFormElement>('editorForm');
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'edSlug') slugTouched = true;
    if (target.id === 'edTitle' && !slugTouched && current?.kind === 'draft') el<HTMLInputElement>('edSlug').value = slugify(el<HTMLInputElement>('edTitle').value);
    if (target.id === 'edSeries') suggestPart();
    if (target.id === 'edImage') return;
    onChange();
  });
  el('edDelete').addEventListener('click', deleteDraft);
  el('edSavePost').addEventListener('click', () => void savePost());
  el('edUnpublish').addEventListener('click', unpublish);
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
    if (saveTimer || saving || (dirty && PUBLISHING_LIVE)) event.preventDefault();
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

/** A published post in the editor's shape */
function postAsDraft(doc: DocumentRecord): DraftRecord {
  const { images, category, lang, series: part, featured, markdown } = doc.content ?? {};
  return {
    $type: DRAFT_COLLECTION,
    title: doc.title ?? '',
    ...(doc.description ? { description: doc.description } : {}),
    ...(doc.path ? { path: doc.path } : {}),
    ...(doc.tags?.length ? { tags: doc.tags } : {}),
    content: {
      $type: POST_TYPE,
      markdown: markdown ?? '',
      ...(images?.length ? { images } : {}),
      ...(category ? { category } : {}),
      ...(lang ? { lang } : {}),
      ...(part?.series && part.part ? { series: { series: part.series, part: part.part } } : {}),
      ...(featured ? { featured } : {}),
    },
    createdAt: doc.publishedAt ?? now(),
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

async function open(kind: Kind, rkey: string) {
  if (current?.kind === kind && current.rkey === rkey) return;
  await leaveEditor();
  document.body.dataset.view = 'editor';
  const editor = el('editor');
  editor.dataset.kind = kind;
  message('editorMessage', '');
  el('editorConflict').hidden = true;
  el('editorBackup').hidden = true;
  el('editorState').textContent = 'Loading…';
  try {
    let opened: Open | undefined;
    if (kind === 'draft') {
      const record = await getRecord<DraftRecord>(session, DRAFT_COLLECTION, rkey);
      if (record) opened = { kind, rkey, cid: record.cid, value: record.value };
    } else {
      const record = await getRecord<DocumentRecord>(session, DOCUMENT, rkey);
      if (record && isSitePost(record.value)) opened = { kind, rkey, cid: record.cid, value: postAsDraft(record.value), doc: record.value };
    }
    if (!opened) {
      el('editorState').textContent = '';
      message('editorMessage', kind === 'draft' ? 'This draft doesn’t exist any more.' : 'This post isn’t published any more.', 'error');
      return;
    }
    current = opened;
    conflict = false;
    dirty = false;
    fillSelect(el('edSeries'), series.filter((s) => s.value.name).map((s) => [s.uri, s.value.name!]), 'No series');
    fillEditor(opened.value);
    el<HTMLInputElement>('edSlug').readOnly = kind === 'post';
    el<HTMLInputElement>('edMinor').checked = false;
    const view = el<HTMLAnchorElement>('edViewPost');
    view.href = opened.value.path ?? '/posts/';
    el<HTMLButtonElement>('edSavePost').disabled = true;
    el<HTMLButtonElement>('edUnpublish').disabled = !PUBLISHING_LIVE;
    // Publishing a draft (drawing its share card, announcing it on Bluesky) is built with the launch
    el<HTMLButtonElement>('edPublish').disabled = true;
    el('editorState').textContent =
      kind === 'draft'
        ? `Saved ${formatTime(opened.value.updatedAt ?? opened.value.createdAt)}`
        : `Published ${formatTime(opened.value.createdAt)}${opened.value.updatedAt ? `, updated ${formatTime(opened.value.updatedAt)}` : ''}`;
    showPane('write');
    checkBackup();
  } catch (err) {
    el('editorState').textContent = '';
    message('editorMessage', `Couldn’t open it: ${errorText(err)}`, 'error');
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

/** What the form shows, in the editor's shape */
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
  const content: PostContent = { $type: POST_TYPE, markdown };
  if (images.length) content.images = images;
  content.category = el<HTMLSelectElement>('edCategory').value;
  const lang = el<HTMLSelectElement>('edLang').value;
  if (lang && lang !== 'en') content.lang = lang;
  if (seriesUri && Number.isInteger(part) && part >= 1) content.series = { series: seriesUri, part };
  if (el<HTMLInputElement>('edFeatured').checked) content.featured = true;
  const draft: DraftRecord = { ...base, title: el<HTMLInputElement>('edTitle').value.trim(), content, updatedAt: now() };
  if (description) draft.description = description;
  else delete draft.description;
  // A published post's address never changes here (it would break links to it)
  if (current!.kind === 'post') draft.path = base.path;
  else if (slug) draft.path = `/posts/${slug}/`;
  else delete draft.path;
  if (tags.length) draft.tags = tags;
  else delete draft.tags;
  return draft;
}

/** Problems that would make the record invalid or the post unpublishable */
function problems(d: DraftRecord): string[] {
  const out: string[] = [];
  if (current?.kind === 'post' && !d.title) out.push('A published post needs a title.');
  if (countChars(d.title) > 500) out.push('The title is over 500 characters.');
  if (d.description && countChars(d.description) > 300) out.push('The description is over 300 characters (readers cut it there).');
  if (new TextEncoder().encode(d.content.markdown).length > 200_000) out.push('The post is over 200 KB of text.');
  const slug = /^\/posts\/([^/]+)\/$/.exec(d.path ?? '')?.[1];
  if (slug && current?.kind === 'draft') {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) out.push('The address can only have lowercase letters, digits and dashes.');
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
  const issues = renderEditorPreview();
  if (conflict) return;
  saveBackup();
  if (current.kind === 'post') {
    dirty = true;
    el('editorState').textContent = PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device';
    el<HTMLButtonElement>('edSavePost').disabled = !PUBLISHING_LIVE || issues.length > 0;
    return;
  }
  el('editorState').textContent = 'Not saved yet';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void saveDraft();
  }, SAVE_DELAY_MS);
}

/** Renders the preview, and returns the form's problems */
function renderEditorPreview(): string[] {
  if (!current) return [];
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
  return issues;
}

async function saveDraft(force = false): Promise<void> {
  if (!current || current.kind !== 'draft' || (conflict && !force)) return;
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
      removeBackup(target.kind, target.rkey);
      if (current === target) el('editorState').textContent = `Saved ${formatTime(draft.updatedAt!)}`;
    } catch (err) {
      saveFailed(err);
    }
  })();
  await saving;
  saving = undefined;
}

/**
 * Saves a published post's changes to its record, keeping the fields the editor doesn't show
 * (the share card, the Bluesky thread, its publish date), then asks the site to refresh its pages.
 * "updated" becomes now, unless the save is ticked as a small fix.
 */
async function savePost(force = false): Promise<void> {
  if (!PUBLISHING_LIVE || !current || current.kind !== 'post' || !current.doc || (conflict && !force)) return;
  const form = formDraft();
  if (problems(form).length) return;
  const target = current;
  const minor = el<HTMLInputElement>('edMinor').checked;
  const doc: DocumentRecord = {
    ...target.doc!,
    title: form.title,
    tags: form.tags,
    textContent: plainText(form.content.markdown),
    content: form.content,
    updatedAt: minor ? target.doc!.updatedAt : now(),
  };
  if (!doc.updatedAt) delete doc.updatedAt;
  if (form.description) doc.description = form.description;
  else delete doc.description;
  if (!form.tags) delete doc.tags;
  const button = el<HTMLButtonElement>('edSavePost');
  button.disabled = true;
  el('editorState').textContent = 'Saving…';
  try {
    const res = await putRecord(session, DOCUMENT, target.rkey, doc, target.cid);
    Object.assign(target, { cid: res.cid, doc, value: postAsDraft(doc) });
    const listed = documents.find((d) => rkeyOf(d.uri) === target.rkey);
    if (listed) Object.assign(listed, { cid: res.cid, value: doc });
    removeBackup(target.kind, target.rkey);
    dirty = false;
    await fetch('/api/revalidate', { method: 'POST' }).catch(() => {});
    el<HTMLInputElement>('edMinor').checked = false;
    if (current === target) el('editorState').textContent = `Saved and live ${formatTime(now())}${minor ? ' (a small fix: not marked as updated)' : ''}`;
  } catch (err) {
    button.disabled = false;
    saveFailed(err);
  }
}

function saveFailed(err: unknown) {
  if (err instanceof XrpcError && err.error === 'InvalidSwap') {
    conflict = true;
    el('editorConflict').hidden = false;
    el('editorState').textContent = 'Not saved: changed elsewhere';
  } else {
    el('editorState').textContent = 'Not saved';
    message('editorMessage', `Couldn’t save: ${errorText(err)}. Your changes are kept on this device.`, 'error');
  }
}

async function resolveConflict(choice: 'theirs' | 'mine') {
  if (!current) return;
  const target = current;
  const latest = await getRecord<DraftRecord & DocumentRecord>(session, collectionOf(target.kind), target.rkey);
  el('editorConflict').hidden = true;
  conflict = false;
  if (!latest) return message('editorMessage', target.kind === 'draft' ? 'The draft was deleted elsewhere.' : 'The post was unpublished elsewhere.', 'error');
  target.cid = latest.cid;
  if (choice === 'theirs') {
    if (target.kind === 'post') {
      target.doc = latest.value;
      target.value = postAsDraft(latest.value);
      dirty = false;
    } else target.value = latest.value;
    removeBackup(target.kind, target.rkey);
    fillEditor(target.value);
    el('editorState').textContent = `Loaded the version saved ${formatTime(target.value.updatedAt ?? target.value.createdAt)}`;
  } else if (target.kind === 'post') {
    target.doc = latest.value;
    await savePost(true);
  } else {
    await saveDraft(true);
  }
}

/** Saves a draft's pending changes, then closes the editor */
async function leaveEditor() {
  if (!current) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await saveDraft();
  } else if (saving) await saving;
  current = undefined;
  dirty = false;
  clearChosenImage();
  renderLists();
}

async function deleteDraft() {
  if (!current || current.kind !== 'draft') return;
  const target = current;
  const title = target.value.title || 'Untitled';
  if (!confirm(`Delete the draft “${title}”? This can’t be undone.`)) return;
  try {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await deleteRecord(session, DRAFT_COLLECTION, target.rkey);
    removeBackup(target.kind, target.rkey);
    drafts = drafts.filter((d) => rkeyOf(d.uri) !== target.rkey);
    current = undefined;
    location.hash = '';
    message('postsMessage', `Deleted the draft “${title}”.`, 'ok');
  } catch (err) {
    message('editorMessage', `Couldn’t delete it: ${errorText(err)}`, 'error');
  }
}

/** Takes a published post off the site (its record is deleted; its Bluesky post stays) */
async function unpublish() {
  if (!PUBLISHING_LIVE || !current || current.kind !== 'post') return;
  const target = current;
  const title = target.value.title;
  if (!confirm(`Unpublish “${title}”? Its page will be gone from skiddle.id and from readers like Leaflet. Its Bluesky post stays. This can’t be undone, but you can publish it again from a draft.`)) return;
  try {
    await deleteRecord(session, DOCUMENT, target.rkey, target.cid);
    removeBackup(target.kind, target.rkey);
    documents = documents.filter((d) => rkeyOf(d.uri) !== target.rkey);
    current = undefined;
    dirty = false;
    await fetch('/api/revalidate', { method: 'POST' }).catch(() => {});
    location.hash = '';
    message('postsMessage', `Unpublished “${title}”.`, 'ok');
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') saveFailed(err);
    else message('editorMessage', `Couldn’t unpublish it: ${errorText(err)}`, 'error');
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

/**
 * The image as-is if it's small enough, otherwise re-encoded, narrower, until it's under 1 MB: as WebP,
 * or as JPEG where the browser can't write WebP (Safari, which quietly gives back a PNG instead)
 */
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
    let blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.type !== 'image/webp') blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
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
    localStorage.setItem(backupKey(current.kind, current.rkey), JSON.stringify({ at: now(), cid: current.cid, value: formDraft() }));
  } catch {}
}

function removeBackup(kind: Kind, rkey: string) {
  try {
    localStorage.removeItem(backupKey(kind, rkey));
  } catch {}
}

function readBackup(kind: Kind, rkey: string): { at: string; cid: string; value: DraftRecord } | undefined {
  try {
    const raw = localStorage.getItem(backupKey(kind, rkey));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Offers changes that were made here but never saved (the connection dropped, the tab closed) */
function checkBackup() {
  const backup = current && readBackup(current.kind, current.rkey);
  el('editorBackup').hidden = !backup;
  if (backup) el('edBackupTime').textContent = formatTime(backup.at);
}

function restoreBackup() {
  const backup = current && readBackup(current.kind, current.rkey);
  el('editorBackup').hidden = true;
  if (!backup || !current) return;
  const images = backup.value.content.images ?? current.value.content.images;
  current.value = { ...current.value, content: { ...current.value.content, images } };
  fillEditor({ ...backup.value, path: current.kind === 'post' ? current.value.path : backup.value.path, content: { ...backup.value.content, images } });
  onChange();
}

function discardBackup() {
  if (current) removeBackup(current.kind, current.rkey);
  el('editorBackup').hidden = true;
}
