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
 * ticked as a small fix (like `[skip updated]` in a git commit), which leaves "updated" as it was.
 * If the title, description or length changed, it redraws the post's share card. Saving,
 * unpublishing, publishing and scheduling drafts follow PUBLISHING_LIVE (src/lib/admin/launch.ts);
 * while it's off, edits are kept on this device.
 *
 *   - The preview uses the same renderer as the site (src/lib/post-html.mjs) and the site's styles,
 *     and can show the post's share card, drawn in the browser (src/lib/admin/card.ts).
 *   - Publishing a draft draws and uploads its share card, writes its site.standard.document, waits
 *     for the page, announces it on Bluesky, links the thread (comments on) and deletes the draft.
 *     Each step is remembered on this device, so a failure part-way can be finished later without
 *     publishing twice.
 *   - Scheduling a draft sets its `publishAt` and stores its share card on it, drawn for that date;
 *     the scheduler (workers/publisher) publishes it within 5 minutes after that time, the same way.
 *     Edits that change the card redraw it as the draft saves.
 *   - Images are shrunk under 1 MB in the browser if needed, uploaded as blobs, and written into the
 *     Markdown as ![alt](image:NAME). They come from "Add image", or are pasted or dropped into the text.
 *   - The text box has a formatting toolbar and shortcuts (src/lib/admin/markdown-tools.ts), counts
 *     words and minutes to read as the post page does, and has a focus mode that hides the other
 *     fields. On wide screens the preview sits beside it and follows its scrolling.
 *   - Ctrl+S (⌘S on a Mac) saves whichever editor is open: a draft right away instead of after the
 *     pause, a published post's changes, a series or a page. The Save buttons say which.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { CATEGORIES_COLLECTION, DEFAULT_CATEGORIES, categoriesFromRecord, type Category } from '~/lib/categories.mjs';
import { plainText } from '~/lib/plain-text.mjs';
import { announcementRecord } from '~/lib/announcement.mjs';
import { POST_TYPE, SERIES_COLLECTION, DRAFT_COLLECTION, documentFromDraft, seriesSlug, slugOf } from '~/lib/post-record.mjs';
import { renderPost, type PostImage } from '~/lib/post-html.mjs';
import { DID, PUBLICATION_URI, SITE_URL, documentRkey } from '~/lib/standard-site.mjs';
import { wordStats } from '~/lib/markdown-edit.mjs';
import { ranked } from '~/lib/suggest.mjs';
import { countChars } from '~/lib/status-states.mjs';
import { cardKey, cardPostOf, postCard } from './card-text';
import { el, errorText, formatTime, item, message, revalidate, row, saveState, viewLink } from './dom';
import { NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { ariaShortcut, insertText, markdownTools, pressedShortcut, shortcut } from './markdown-tools';
import { missingScopes } from './oauth';
import { leavePage, openPage, pageRoute, savePageNow } from './page-editor';
import { sectionFromHash, showSection } from './sections';
import { tagSuggest } from './tag-suggest';
import { leaveSeries, openSeries, renderSeries, saveSeriesNow, seriesList, seriesRoute, setSeriesList, setupSeries, type SeriesRecord } from './series';
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
  /** When the scheduler publishes it (ISO); absent: not scheduled */
  publishAt?: string;
  /** Its share card, drawn for publishAt, while it's scheduled */
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

type Kind = 'draft' | 'post';

/** What the editor shows: a draft, or a published post in the same shape */
interface Open {
  kind: Kind;
  rkey: string;
  cid: string;
  value: DraftRecord;
  /** The published post's record as it was opened (posts only), to keep its other fields on save */
  doc?: DocumentRecord;
  /** What the stored share card shows (cardKey), for a scheduled draft or a published post */
  card?: string;
}

let session: OAuthSession;
let signInAgain: () => void;
let drafts: RepoRecord<DraftRecord>[] = [];
/** The categories, from Jeff's id.skiddle.categories record (or the four the site started with) */
let categories: Category[] = DEFAULT_CATEGORIES;
let documents: RepoRecord<DocumentRecord>[] = [];

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
  setupSeries({
    session: s,
    posts: () =>
      documents
        .filter((d) => isSitePost(d.value))
        .map((d) => ({ title: d.value.title ?? '', path: d.value.path!, series: d.value.content?.series?.series, part: d.value.content?.series?.part })),
    drafts: () => drafts.map((d) => ({ series: d.value.content.series?.series })),
  });
  window.addEventListener('hashchange', route);
}

/**
 * Shows the editor for #draft/<rkey> or #post/<rkey>, the series editor for #series/<key> or
 * #new-series (src/lib/admin/series.ts), a page editor for #page/<name>, #project/<key> or
 * #new-project (src/lib/admin/page-editor.ts), otherwise the section the address names
 */
export async function route() {
  const m = /^#(draft|post)\/([a-z0-9]+)$/.exec(location.hash);
  const s = seriesRoute(location.hash);
  const p = pageRoute(location.hash);
  if (!s) leaveSeries();
  if (!p) leavePage();
  if (m) return open(m[1] as Kind, m[2]);
  await leaveEditor();
  if (s) return openSeries(s);
  if (p) return openPage(p);
  document.body.dataset.view = 'dashboard';
  showSection(sectionFromHash(location.hash));
}

export async function loadPosts() {
  // Writing drafts, uploading images, publishing (the document, its series, the Bluesky post)
  const missing = missingScopes((await session.getTokenInfo()).scope).filter((s) => /draft|blob|standard\.document|series|feed\.post|categories/.test(s));
  el('postsScope').hidden = missing.length === 0;
  el<HTMLButtonElement>('newDraft').disabled = missing.length > 0;
  const [d, docs, s, cats] = await Promise.all([
    listRecords<DraftRecord>(session, DRAFT_COLLECTION).catch(() => []),
    listRecords<DocumentRecord>(session, DOCUMENT),
    listRecords<SeriesRecord>(session, SERIES_COLLECTION),
    getRecord<unknown>(session, CATEGORIES_COLLECTION, 'self').catch(() => null),
  ]);
  drafts = d;
  documents = docs;
  const fromRecord = cats ? categoriesFromRecord(cats.value) : [];
  categories = fromRecord.length ? fromRecord : DEFAULT_CATEGORIES;
  fillCategories();
  setSeriesList(s);
  renderLists();
}

function renderLists() {
  const draftList = el('drafts');
  draftList.textContent = '';
  const sorted = [...drafts].sort((a, b) => (b.value.updatedAt ?? b.value.createdAt).localeCompare(a.value.updatedAt ?? a.value.createdAt));
  if (!sorted.length) draftList.appendChild(item('No drafts.', 'admin-muted'));
  for (const d of sorted) {
    const note = d.value.publishAt ? `scheduled for ${formatWhen(d.value.publishAt)}` : `edited ${formatTime(d.value.updatedAt ?? d.value.createdAt)}`;
    draftList.appendChild(row(`#draft/${rkeyOf(d.uri)}`, d.value.title || 'Untitled', note));
  }

  const published = el('published');
  published.textContent = '';
  const posts = documents.filter((d) => isSitePost(d.value)).sort((a, b) => (b.value.publishedAt ?? '').localeCompare(a.value.publishedAt ?? ''));
  for (const d of posts) {
    const when = d.value.publishedAt ? new Date(d.value.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const r = row(`#post/${rkeyOf(d.uri)}`, d.value.title ?? d.value.path!, when);
    r.appendChild(viewLink(d.value.path!, `View “${d.value.title}” on the site`));
    published.appendChild(r);
  }
  el('publishedCount').textContent = String(posts.length);
  renderSeries();
}

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
  fillCategories();
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
    if (target.id === 'edImage' || target.id === 'edPublishAt') return;
    onChange();
  });
  el('edSchedule').addEventListener('click', () => void schedule());
  el('edUnschedule').addEventListener('click', () => void unschedule());
  el('edDelete').addEventListener('click', deleteDraft);
  el('edPublish').addEventListener('click', () => void publishDraft());
  el('edFinish').addEventListener('click', () => void publishDraft());
  el('edCard').addEventListener('click', () => void showCard());
  el('edSavePost').addEventListener('click', () => void savePost());
  el('edUnpublish').addEventListener('click', unpublish);
  el('edImage').addEventListener('change', chooseImage);
  // The tags posts and drafts already use, most used first
  tagSuggest(el<HTMLInputElement>('edTags'), () =>
    ranked([...documents.filter((d) => isSitePost(d.value)).flatMap((d) => d.value.tags ?? []), ...drafts.flatMap((d) => d.value.tags ?? [])]),
  );
  const area = el<HTMLTextAreaElement>('edMarkdown');
  const tools = el('edTools');
  tools.insertBefore(markdownTools(area, { onImage: (file) => void useImage(file) }), tools.firstChild);
  // On wide screens, the preview beside the text follows it down
  area.addEventListener('scroll', () => {
    const pane = el('edPreviewPane');
    const room = area.scrollHeight - area.clientHeight;
    if (room > 0 && pane.scrollHeight > pane.clientHeight) pane.scrollTop = (area.scrollTop / room) * (pane.scrollHeight - pane.clientHeight);
  });
  el('edFocus').addEventListener('click', () => setFocus(el('editor').dataset.focus === undefined));
  el('editor').addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el('editor').dataset.focus !== undefined) setFocus(false);
  });
  // The save shortcut, on every Save button and save state
  for (const id of ['edSavePost', 'seSave', 'peSave']) {
    el(id).title = `Save (${shortcut('S')})`;
    el(id).setAttribute('aria-keyshortcuts', ariaShortcut('S'));
  }
  for (const id of ['editorState', 'seState', 'peState']) el(id).title = `${shortcut('S')} saves now`;
  window.addEventListener('keydown', (event) => {
    if (pressedShortcut(event) !== 's') return;
    const view = document.body.dataset.view;
    if (view === 'editor') saveNow();
    else if (view === 'series') saveSeriesNow();
    else if (view === 'page') savePageNow();
    else return;
    // Not the browser's "Save page as"
    event.preventDefault();
  });
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

/** The editor's Category menu, from the categories, keeping what's chosen */
function fillCategories() {
  const select = el<HTMLSelectElement>('edCategory');
  const chosen = select.value;
  fillSelect(select, categories.map((c) => [c.id, c.label]));
  if (chosen) setCategory(chosen);
}

/** Chooses a category, adding it to the menu if the categories don't have it (one since removed) */
function setCategory(id: string) {
  const select = el<HTMLSelectElement>('edCategory');
  if (![...select.options].some((o) => o.value === id)) select.appendChild(new Option(id, id));
  select.value = id;
}

/** How many posts and drafts use each category, for the categories editor */
export function categoryUsage(): Map<string, number> {
  const used = new Map<string, number>();
  const add = (id: string | undefined) => id && used.set(id, (used.get(id) ?? 0) + 1);
  for (const d of documents) if (isSitePost(d.value)) add(d.value.content?.category);
  for (const d of drafts) add(d.value.content?.category);
  return used;
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

/** Focus mode: only the title and the text, the preview and the other fields hidden (Esc leaves it) */
function setFocus(on: boolean) {
  const editor = el('editor');
  if (on) editor.dataset.focus = '';
  else delete editor.dataset.focus;
  const button = el('edFocus');
  button.setAttribute('aria-pressed', String(on));
  button.textContent = on ? 'Leave focus' : 'Focus';
  if (on) showPane('write');
  el<HTMLTextAreaElement>('edMarkdown').focus();
}

/** ⌘S: a draft saves now instead of after the pause; a published post saves if it can */
function saveNow() {
  if (!current) return;
  if (current.kind === 'draft') {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    void saveDraft();
    return;
  }
  if (!el<HTMLButtonElement>('edSavePost').disabled) void savePost();
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
  saveState('editorState', 'Loading…');
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
      saveState('editorState', '');
      message('editorMessage', kind === 'draft' ? 'This draft doesn’t exist any more.' : 'This post isn’t published any more.', 'error');
      return;
    }
    opened.card = storedCard(opened);
    current = opened;
    conflict = false;
    dirty = false;
    fillSelect(el('edSeries'), seriesList().filter((s) => s.value.name).map((s) => [s.uri, s.value.name!]), 'No series');
    fillEditor(opened.value);
    el<HTMLInputElement>('edSlug').readOnly = kind === 'post';
    el<HTMLInputElement>('edMinor').checked = false;
    const view = el<HTMLAnchorElement>('edViewPost');
    view.href = opened.value.path ?? '/posts/';
    el<HTMLButtonElement>('edSavePost').disabled = true;
    el<HTMLButtonElement>('edUnpublish').disabled = !PUBLISHING_LIVE;
    el<HTMLButtonElement>('edPublish').disabled = !PUBLISHING_LIVE;
    el('edFinish').hidden = !(kind === 'draft' && readPublishing(rkey));
    el('edCardImage').hidden = true;
    message('edCardMessage', '');
    showSchedule();
    saveState('editorState',
      kind === 'draft'
        ? `Saved ${formatTime(opened.value.updatedAt ?? opened.value.createdAt)}`
        : `Published ${formatTime(opened.value.createdAt)}${opened.value.updatedAt ? `, updated ${formatTime(opened.value.updatedAt)}` : ''}`);
    showPane('write');
    checkBackup();
  } catch (err) {
    saveState('editorState', '');
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
  setCategory(c.category ?? 'infra');
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
  if (d.content.series && !seriesList().some((s) => s.uri === d.content.series!.series)) out.push('That series doesn’t exist any more.');
  return out;
}

function onChange() {
  if (!current) return;
  const issues = renderEditorPreview();
  if (conflict) return;
  saveBackup();
  if (current.kind === 'post') {
    dirty = true;
    saveState('editorState', PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device');
    el<HTMLButtonElement>('edSavePost').disabled = !PUBLISHING_LIVE || issues.length > 0;
    return;
  }
  saveState('editorState', 'Not saved yet');
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
  const { words, minutes } = wordStats(d.content.markdown);
  el('edWords').textContent = `${words.toLocaleString('en')} ${words === 1 ? 'word' : 'words'} · ${minutes} min read`;
  return issues;
}

/** Saves the open draft; returns whether it saved */
async function saveDraft(force = false): Promise<boolean> {
  if (!current || current.kind !== 'draft' || (conflict && !force)) return false;
  if (saving) await saving;
  const draft = formDraft();
  const target = current;
  let saved = false;
  saveState('editorState', 'Saving…');
  saving = (async () => {
    try {
      // A scheduled draft's card has to match it, since the scheduler can't draw one
      const card = draft.publishAt ? cardKey(postCard(cardPostOf(draft))) : undefined;
      if (card && card !== target.card) {
        saveState('editorState', 'Redrawing the share card…');
        const { drawPostCard } = await import('./card');
        draft.coverImage = await uploadBlob(session, await drawPostCard(cardPostOf(draft)));
        saveState('editorState', 'Saving…');
      }
      const res = await putRecord(session, DRAFT_COLLECTION, target.rkey, draft, target.cid);
      target.cid = res.cid;
      target.value = draft;
      if (card) target.card = card;
      const listed = drafts.find((d) => rkeyOf(d.uri) === target.rkey);
      if (listed) Object.assign(listed, { cid: res.cid, value: draft });
      removeBackup(target.kind, target.rkey);
      if (current === target) saveState('editorState', `Saved ${formatTime(draft.updatedAt!)}`);
      saved = true;
    } catch (err) {
      saveFailed(err);
    }
  })();
  await saving;
  saving = undefined;
  return saved;
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
  saveState('editorState', 'Saving…');
  try {
    const card = cardKey(postCard(cardPostOf(form, target.doc!.publishedAt)));
    if (card !== target.card) {
      saveState('editorState', 'Redrawing the share card…');
      const { drawPostCard } = await import('./card');
      doc.coverImage = await uploadBlob(session, await drawPostCard(cardPostOf(form, target.doc!.publishedAt)));
      saveState('editorState', 'Saving…');
    }
    const res = await putRecord(session, DOCUMENT, target.rkey, doc, target.cid);
    Object.assign(target, { cid: res.cid, doc, value: postAsDraft(doc), card });
    const listed = documents.find((d) => rkeyOf(d.uri) === target.rkey);
    if (listed) Object.assign(listed, { cid: res.cid, value: doc });
    removeBackup(target.kind, target.rkey);
    dirty = false;
    await revalidate();
    el<HTMLInputElement>('edMinor').checked = false;
    if (current === target) saveState('editorState', `Saved and live ${formatTime(now())}${minor ? ' (a small fix: not marked as updated)' : ''}`);
  } catch (err) {
    button.disabled = false;
    saveFailed(err);
  }
}

function saveFailed(err: unknown) {
  if (err instanceof XrpcError && err.error === 'InvalidSwap') {
    conflict = true;
    el('editorConflict').hidden = false;
    saveState('editorState', 'Not saved: changed elsewhere');
  } else {
    saveState('editorState', 'Not saved');
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
    target.card = storedCard(target);
    removeBackup(target.kind, target.rkey);
    fillEditor(target.value);
    showSchedule();
    saveState('editorState', `Loaded the version saved ${formatTime(target.value.updatedAt ?? target.value.createdAt)}`);
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
    location.hash = '#posts';
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
    await revalidate();
    location.hash = '#posts';
    message('postsMessage', `Unpublished “${title}”.`, 'ok');
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') saveFailed(err);
    else message('editorMessage', `Couldn’t unpublish it: ${errorText(err)}`, 'error');
  }
}

// ---- Share card and publishing ----

/** What the open draft's or post's form would put on its card */
const cardPost = () => cardPostOf(formDraft(), current?.kind === 'post' ? current.doc?.publishedAt : undefined);

/** What the stored card shows: a published post's, or a scheduled draft's (drawn for it when it was saved) */
function storedCard(o: Open): string | undefined {
  if (o.kind === 'post') return cardKey(postCard(cardPostOf(o.value, o.doc?.publishedAt)));
  return o.value.publishAt && o.value.coverImage ? cardKey(postCard(cardPostOf(o.value))) : undefined;
}

/** Draws the share card in the preview pane (nothing is uploaded) */
async function showCard() {
  const button = el<HTMLButtonElement>('edCard');
  button.disabled = true;
  message('edCardMessage', 'Drawing the share card…');
  try {
    const { drawPostCard } = await import('./card');
    const image = el<HTMLImageElement>('edCardImage');
    if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
    image.src = URL.createObjectURL(await drawPostCard(cardPost()));
    image.hidden = false;
    message('edCardMessage', '');
  } catch (err) {
    message('edCardMessage', `Couldn’t draw it: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
  }
}

/** Where a draft's publishing has got to, kept on this device until it's done */
interface Publishing {
  draftRkey: string;
  publishedAt: string;
  cover?: BlobRef;
  rkey?: string;
  docCid?: string;
  doc?: DocumentRecord;
  post?: { uri: string; cid: string };
}
const publishingKey = (draftRkey: string) => `skiddle-admin:publishing:${draftRkey}`;

function readPublishing(draftRkey: string): Publishing | undefined {
  try {
    const raw = localStorage.getItem(publishingKey(draftRkey));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Waits until the post's page answers, for up to 30 seconds */
async function waitLive(path: string) {
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${path}?live=${Date.now()}`, { cache: 'no-store' }).catch(() => undefined);
    if (res?.ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${path} didn’t come up within 30 seconds`);
}

/**
 * Publishes the open draft, or finishes publishing it after a failure: each step that's done is
 * remembered on this device and skipped the next time
 */
async function publishDraft() {
  if (!PUBLISHING_LIVE || !current || current.kind !== 'draft') return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await saveDraft();
  } else if (saving) await saving;
  const target = current;
  let d = formDraft();
  const issues = problems(d);
  if (!d.title) issues.push('A post needs a title.');
  if (!d.path) issues.push('A post needs an address.');
  if (issues.length) return message('editorMessage', issues.join(' '), 'error');
  const resuming = readPublishing(target.rkey);
  const url = `${SITE_URL}${d.path}`;
  const instead = d.publishAt ? ` instead of ${formatWhen(d.publishAt)}` : '';
  if (!resuming && !confirm(`Publish “${d.title}” now${instead}? It goes live at ${url} and is announced on Bluesky.`)) return;
  // Unscheduled first, so the scheduler doesn't publish it as well
  if (d.publishAt) {
    if (!(await setSchedule(undefined))) return;
    d = formDraft();
  }

  const p: Publishing = resuming ?? { draftRkey: target.rkey, publishedAt: now() };
  const remember = () => {
    try {
      localStorage.setItem(publishingKey(p.draftRkey), JSON.stringify(p));
    } catch {}
  };
  const step = (text: string) => saveState('editorState', text);
  el<HTMLButtonElement>('edPublish').disabled = true;
  el('edFinish').hidden = true;
  message('editorMessage', '');
  try {
    if (!p.cover) {
      step('Drawing the share card…');
      const { drawPostCard } = await import('./card');
      const png = await drawPostCard(cardPostOf(d, p.publishedAt));
      step('Uploading the share card…');
      p.cover = await uploadBlob(session, png);
      remember();
    }
    if (!p.docCid) {
      step('Writing the post…');
      p.rkey = documentRkey({ slug: slugOf(d.path)!, pubDate: new Date(p.publishedAt) });
      if (await getRecord(session, DOCUMENT, p.rkey)) throw new Error(`a post already has the record key ${p.rkey}`);
      p.doc = documentFromDraft(d, { publishedAt: p.publishedAt, coverImage: p.cover }) as DocumentRecord;
      p.docCid = (await putRecord(session, DOCUMENT, p.rkey, p.doc)).cid;
      remember();
      await revalidate();
      step('Waiting for the page…');
      await waitLive(d.path!);
    }
    if (!p.post) {
      step('Announcing it on Bluesky…');
      // Under the post's own key (as the scheduler does), so a second try finds it instead of posting again
      const announcement = announcementRecord({ title: d.title, description: d.description, lang: d.content.lang ?? 'en', url, thumb: p.cover });
      const res = await createRecord(session, 'app.bsky.feed.post', announcement, p.rkey).catch(async (err) => {
        const posted = await getRecord(session, 'app.bsky.feed.post', p.rkey!);
        if (!posted) throw err;
        return posted;
      });
      p.post = { uri: res.uri, cid: res.cid };
      remember();
    }
    if (!p.doc!.bskyPostRef) {
      step('Turning comments on…');
      p.doc = { ...p.doc!, bskyPostRef: p.post };
      p.docCid = (await putRecord(session, DOCUMENT, p.rkey!, p.doc, p.docCid)).cid;
      remember();
    }
    step('Removing the draft…');
    await deleteRecord(session, DRAFT_COLLECTION, p.draftRkey).catch((err) => {
      if (!(err instanceof XrpcError && /not ?found/i.test(`${err.error} ${err.message}`))) throw err;
    });
    try {
      localStorage.removeItem(publishingKey(p.draftRkey));
    } catch {}
    removeBackup('draft', p.draftRkey);
    await revalidate();
    drafts = drafts.filter((x) => rkeyOf(x.uri) !== p.draftRkey);
    documents.push({ uri: `at://${DID}/${DOCUMENT}/${p.rkey}`, cid: p.docCid!, value: p.doc! });
    current = undefined;
    location.hash = `#post/${p.rkey}`;
    message('postsMessage', `Published “${d.title}” at ${url}, and announced it on Bluesky.`, 'ok');
  } catch (err) {
    if (current === target) {
      step('Not finished');
      el('edFinish').hidden = false;
      message(
        'editorMessage',
        `${p.docCid ? `“${d.title}” is live, but ` : ''}publishing stopped: ${errorText(err)}. Finish publishing tries the rest again.`,
        'error',
      );
    }
  }
}

// ---- Scheduling ----

const pad = (n: number) => String(n).padStart(2, '0');
/** A date as a datetime-local field's value, in this device's time zone */
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** e.g. "Thu 20 Nov 2026, 09:00 GMT+7" */
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

/** The open draft's schedule: when, and the buttons */
function showSchedule() {
  if (!current || current.kind !== 'draft') return;
  const at = current.value.publishAt;
  const input = el<HTMLInputElement>('edPublishAt');
  input.value = at ? localInput(new Date(at)) : '';
  input.min = localInput(new Date());
  el('edZone').textContent = `Your time (${Intl.DateTimeFormat().resolvedOptions().timeZone}). It goes live within 5 minutes after that, and is announced on Bluesky.`;
  el('edScheduled').textContent = at ? `Scheduled for ${formatWhen(at)}.` : '';
  el('edScheduled').hidden = !at;
  el('edUnschedule').hidden = !at;
  const button = el<HTMLButtonElement>('edSchedule');
  button.textContent = at ? 'Change the time' : 'Schedule';
  button.disabled = !PUBLISHING_LIVE;
}

/**
 * Sets (or with no date, removes) the open draft's publishAt, with its share card drawn for that
 * time, and saves the draft. Returns whether it saved.
 */
async function setSchedule(at: Date | undefined): Promise<boolean> {
  if (!current || current.kind !== 'draft') return false;
  if (conflict) {
    message('editorMessage', 'This draft was changed on another device: load that version or keep yours first.', 'error');
    return false;
  }
  const target = current;
  const before = { value: target.value, card: target.card };
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (saving) await saving;
  if (at) {
    const d = { ...formDraft(), publishAt: at.toISOString() };
    saveState('editorState', 'Drawing the share card…');
    const { drawPostCard } = await import('./card');
    const png = await drawPostCard(cardPostOf(d));
    saveState('editorState', 'Uploading the share card…');
    const coverImage = await uploadBlob(session, png);
    target.value = { ...target.value, publishAt: d.publishAt, coverImage };
    target.card = cardKey(postCard(cardPostOf(d)));
  } else {
    const { publishAt: _at, coverImage: _card, ...rest } = target.value;
    target.value = rest;
    target.card = undefined;
  }
  const saved = await saveDraft();
  if (!saved) Object.assign(target, before);
  if (current === target) {
    showSchedule();
    renderLists();
  }
  return saved;
}

/** Schedules the open draft for the time in the date field */
async function schedule() {
  if (!PUBLISHING_LIVE || !current || current.kind !== 'draft') return;
  const value = el<HTMLInputElement>('edPublishAt').value;
  const at = value ? new Date(value) : undefined;
  const d = formDraft();
  const issues = problems(d);
  if (!d.title) issues.push('A post needs a title.');
  if (!d.path) issues.push('A post needs an address.');
  if (!at || Number.isNaN(at.valueOf())) issues.push('Pick a date and time.');
  else if (at.valueOf() < Date.now() + 60_000) issues.push('Pick a time at least a minute from now.');
  if (issues.length) return message('editorMessage', issues.join(' '), 'error');
  const button = el<HTMLButtonElement>('edSchedule');
  button.disabled = true;
  message('editorMessage', '');
  try {
    if (await setSchedule(at)) message('editorMessage', `Scheduled: “${d.title}” goes live at ${SITE_URL}${d.path} on ${formatWhen(at!.toISOString())}.`, 'ok');
  } catch (err) {
    saveState('editorState', 'Not scheduled');
    message('editorMessage', `Couldn’t schedule it: ${errorText(err)}`, 'error');
  } finally {
    showSchedule();
  }
}

async function unschedule() {
  if (!current || current.kind !== 'draft') return;
  try {
    if (await setSchedule(undefined)) message('editorMessage', 'Unscheduled: it stays a draft.', 'ok');
  } catch (err) {
    message('editorMessage', `Couldn’t unschedule it: ${errorText(err)}`, 'error');
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

function chooseImage() {
  const input = el<HTMLInputElement>('edImage');
  const file = input.files?.[0];
  input.value = '';
  if (file) void useImage(file);
}

/**
 * Gets an image ready to upload, from "Add image" or pasted or dropped into the text: shrunk if it
 * needs to be, named, and shown with a box for its alt text. "Upload and insert" puts it where the
 * cursor was.
 */
async function useImage(file: File) {
  if (!current) return;
  message('edImageMessage', 'Preparing…');
  try {
    const prepared = await prepareImage(file);
    const taken = new Set((current.value.content.images ?? []).map((i) => i.name));
    // A pasted screenshot is called "image.png" by every browser
    const base = (file.name !== 'image.png' && slugify(file.name.replace(/\.[^.]+$/, ''))) || 'image';
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
    insertText(el<HTMLTextAreaElement>('edMarkdown'), `\n![${alt.replace(/[[\]]/g, '')}](image:${chosen.name})\n`);
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
