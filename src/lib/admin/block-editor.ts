/**
 * The block editor (docs/v4/themes.md, phase 3), at #blocks/<key>: a page made of blocks, an
 * id.skiddle.page record keyed by the page's address (home for /), opened from the Pages section.
 *
 * It opens the page's draft (<key>~draft) if there is one, else the page's record, else, for one of
 * the site's own pages, the page as it shows today: its old record turned into blocks
 * (src/lib/admin/legacy-pages.ts, src/lib/page-legacy.mjs). It edits:
 *   - the page's settings: its title, description, width and whether it hides its heading
 *   - its blocks, in order: each with its kind, its width, a handle to drag it, ↑/↓, Remove and its
 *     options as a form made from its def in the lexicon (src/lib/admin/lexicon-form.ts). A block
 *     of a kind this app doesn't know (saved by a newer one) shows as an unknown block, and is saved
 *     back exactly as it was, in its place
 *   - Add a block, from the kinds in BLOCKS, grouped as BLOCKS groups them: text and links, the
 *     site's data, and the parts of the site's own pages
 * and shows what the page reads from the site's data.
 *
 * A page of Jeff's own (src/lib/own-pages.mjs) starts from the Pages section's New page, with its
 * title, and isn't in the repo until its draft is saved. Delete page, after a confirm, deletes it and
 * its draft; the site's own pages can't be deleted.
 *
 * Save draft checks the record with @atproto/lexicon and writes it as <key>~draft. Preview opens the
 * page reading the draft (?preview=draft). Publish, after a confirm, draws the page's share card
 * (every page but home, and home if "Its own share card" is ticked), copies the saved draft over the
 * page's record and deletes the draft. Each write and delete uses swapRecord, so a change made on
 * another device isn't overwritten unseen, then the site's pages are refreshed. Leaving with unsaved
 * changes asks first. Writes follow PUBLISHING_LIVE (src/lib/admin/launch.ts).
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import pageLexicon from '../../../lexicons/id/skiddle/page.json';
import { BLOCKS, PAGE_COLLECTION, blockType, draftKey, pageFromRecord, readsOf, type BlockGroup } from '~/lib/page-blocks.mjs';
import { ownKeyProblem } from '~/lib/own-pages.mjs';
import { PROJECT_COLLECTION, projectUri } from '~/lib/page-records.mjs';
import { LEGACY_PAGES, isSitePage, legacyPage } from './legacy-pages';
import { el, errorText, formatTime, message, revalidate, saveState } from './dom';
import { PAGES_NOT_LIVE_YET, PUBLISHING_LIVE } from './launch';
import { buildForm, labelOf, problems, recordSchema, type Field, type LexiconDoc } from './lexicon-form';
import { dragHandle, sortable } from './sortable';
import { XrpcError, deleteRecord, getRecord, listRecords, putRecord, uploadBlob, type RepoRecord } from './xrpc';

type Value = Record<string, unknown>;
type BlockKind = keyof typeof BLOCKS;

const WIDTHS = ['full', 'half', 'third'] as const;
const DOC = pageLexicon as LexiconDoc;
const KINDS = Object.keys(BLOCKS) as BlockKind[];
/** The catalogue's groups, in the order it offers them */
const GROUPS: Record<BlockGroup, string> = { text: 'Text and links', data: 'The site’s data', about: 'From the site’s own pages' };
/** How many blocks a page holds (the lexicon's limit) */
const MAX_BLOCKS: number = recordSchema(DOC).properties.blocks.maxLength;
/** The record's fields the editor sets itself, not from the settings form */
const OWN_FIELDS = ['blocks', 'card', 'updatedAt'];

/** The page's settings: the record's fields but its blocks, its card and its date */
const SETTINGS_DOC: LexiconDoc = (() => {
  const doc = structuredClone(DOC);
  const record = recordSchema(doc);
  for (const key of OWN_FIELDS) delete record.properties[key];
  record.required = record.required.filter((key: string) => !OWN_FIELDS.includes(key));
  return doc;
})();

/** A kind of block's options as a lexicon whose record is its def, for buildForm and problems */
const blockDoc = (kind: BlockKind): LexiconDoc => ({ ...DOC, defs: { ...DOC.defs, main: { type: 'record', record: DOC.defs[kind] } } });

/** A block's kind from its $type, if this app knows it */
function kindOf(type: unknown): BlockKind | undefined {
  const prefix = `${PAGE_COLLECTION}#`;
  if (typeof type !== 'string' || !type.startsWith(prefix)) return undefined;
  const kind = type.slice(prefix.length);
  return (KINDS as string[]).includes(kind) ? (kind as BlockKind) : undefined;
}

const isObject = (v: unknown): v is Value => !!v && typeof v === 'object' && !Array.isArray(v);
const without = (v: Value, keys: string[]) => Object.fromEntries(Object.entries(v).filter(([k]) => !keys.includes(k)));

/** Where a page is on the site: / for home, /<key>/ for the others */
const addressOf = (key: string) => (key === 'home' ? '/' : `/${key}/`);

/** A page's own key, as an address asks for it: a record key without a `~` (drafts have one) */
export function blocksRoute(hash: string): string | undefined {
  const key = /^#blocks\/([A-Za-z0-9._:-]{1,512})$/.exec(hash)?.[1];
  return key && key !== '.' && key !== '..' ? key : undefined;
}

/** Checks a page record with @atproto/lexicon, in the lexicon's own terms (a card's { $link } is a blob) */
export async function assertValidPage(record: Value) {
  const { Lexicons, jsonToLex } = await import('@atproto/lexicon');
  // A copy: loading a lexicon rewrites its refs in place, which the forms read
  new Lexicons([structuredClone(DOC) as never]).assertValidRecord(PAGE_COLLECTION, jsonToLex(record));
}

/** One block in the editor: a kind this app knows, with its form, or one it doesn't, kept as it is */
type Row =
  | {
      kind: 'known';
      type: BlockKind;
      li: HTMLLIElement;
      width: HTMLSelectElement;
      options: Field;
      /** The #block's fields the editor doesn't know, kept */
      kept: Value;
      /** The block's fields its def doesn't have, kept */
      keptBlock: Value;
    }
  | { kind: 'unknown'; li: HTMLLIElement; raw: Value };

interface Open {
  key: string;
  page?: RepoRecord<Value>;
  draft?: RepoRecord<Value>;
  /** The record the editor started from: the draft, the page's record, or a site page as it shows today */
  base: Value;
  settings: Field;
  rows: Row[];
  /** What a save, a publish or a delete that met a change made elsewhere was doing */
  conflict?: 'save' | 'publish' | 'delete';
}

let session: OAuthSession;
let saved: () => Promise<void>;
/** A new page from New page, until the editor opens it */
let pending: { key: string; title: string } | undefined;
let projects: RepoRecord<Value>[] = [];
let current: Open | undefined;
/** The form has changes that aren't saved */
let dirty = false;
let busy = false;

/**
 * @param s The signed-in session
 * @param onSaved Called after a save or a publish, to refresh the Pages list
 */
export function setupBlockEditor(s: OAuthSession, onSaved: () => Promise<void>) {
  session = s;
  saved = onSaved;
  el('bkNotLive').textContent = PAGES_NOT_LIVE_YET;
  el('bkNotLive').hidden = PUBLISHING_LIVE;
  el('bkForm').addEventListener('submit', (event) => event.preventDefault());
  const kinds = el<HTMLSelectElement>('bkAddKind');
  for (const [group, label] of Object.entries(GROUPS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    for (const kind of KINDS) if (BLOCKS[kind].group === group) optgroup.appendChild(new Option(labelOf(kind), kind));
    kinds.appendChild(optgroup);
  }
  el('bkAdd').addEventListener('click', () => {
    if (!current) return;
    addRow(current, { block: { $type: blockType(kinds.value) } }, true);
    changed();
  });
  el('bkSave').addEventListener('click', () => void saveDraft());
  el('bkPreview').addEventListener('click', () => {
    if (current) window.open(`${addressOf(current.key)}?preview=draft`, '_blank', 'noopener');
  });
  el('bkPublish').addEventListener('click', () => void publish());
  el('bkDelete').addEventListener('click', () => void deletePage());
  el('bkLoadTheirs').addEventListener('click', () => void resolveConflict('theirs'));
  el('bkKeepMine').addEventListener('click', () => void resolveConflict('mine'));
  sortable(el('bkBlocks'), {
    items: ':scope > li',
    handle: '.admin-drag',
    onDrop: () => {
      if (!current) return;
      const order = [...el('bkBlocks').children];
      current.rows.sort((a, b) => order.indexOf(a.li) - order.indexOf(b.li));
      changed();
    },
  });
  window.addEventListener('beforeunload', (event) => {
    if (current && dirty && PUBLISHING_LIVE) event.preventDefault();
  });
}

/** Opens the block editor for a new page of Jeff's own, at an address New page checked */
export function newPage(key: string, title: string) {
  pending = { key, title };
  location.hash = `#blocks/${key}`;
}

/** Opens the block editor for a page */
export async function openBlocks(key: string) {
  if (current?.key === key || !leaveBlocks()) return;
  document.body.dataset.view = 'blocks';
  el('bkTitle').textContent = isSitePage(key) ? LEGACY_PAGES[key].title : addressOf(key);
  el('bkFrom').textContent = '';
  el('bkConflict').hidden = true;
  el('bkForm').hidden = true;
  message('bkMessage', '');
  saveState('bkState', 'Loading…');
  let page: RepoRecord<Value> | null;
  let draft: RepoRecord<Value> | null;
  let legacy: Value | undefined;
  try {
    [page, draft] = await Promise.all([
      getRecord<Value>(session, PAGE_COLLECTION, key),
      getRecord<Value>(session, PAGE_COLLECTION, draftKey(key)),
      listRecords<Value>(session, PROJECT_COLLECTION).then((list) => (projects = list)),
    ]);
    if (!page && !draft && isSitePage(key)) legacy = await legacyPage(session, key);
  } catch (err) {
    saveState('bkState', '');
    return message('bkMessage', `Couldn’t open it: ${errorText(err)}`, 'error');
  }
  if (blocksRoute(location.hash) !== key) return; // moved on while it loaded
  const title = pending?.key === key ? pending.title : '';
  pending = undefined;
  // A page that isn't one of the site's own can only be made where the site would show it
  const problem = isSitePage(key) ? null : ownKeyProblem(key);
  if (problem && !page && !draft) {
    saveState('bkState', '');
    return message('bkMessage', `There can’t be a page here: ${problem}`, 'error');
  }
  const base = draft?.value ?? page?.value ?? legacy ?? { $type: PAGE_COLLECTION, title, blocks: [] };
  el('bkFrom').textContent = problem
    ? `It doesn’t show on the site: ${problem} You can delete it.`
    : draft
      ? `The draft, saved ${formatTime(String(draft.value.updatedAt))}.${page ? ' The page shows the published version until you publish it.' : ' Not published yet.'}`
      : page
        ? 'The published page. Saving makes a draft; the page changes when you publish it.'
        : isSitePage(key)
          ? `No page record yet, so ${addressOf(key)} shows ${LEGACY_PAGES[key].shows}: these are its blocks. Save a draft, preview it, then publish it.`
          : 'Not in your repo yet. Save a draft to create it.';
  current = { key, page: page ?? undefined, draft: draft ?? undefined, base, settings: { el: document.createElement('div'), read: () => ({}) }, rows: [] };
  fill(current);
  el('bkForm').hidden = false;
  saveState('bkState', draft ? `Saved as a draft ${formatTime(String(draft.value.updatedAt))}` : page ? `Published ${formatTime(String(page.value.updatedAt))}` : 'Not saved yet');
}

/** ⌘S in the block editor: saves the draft, if Save draft could */
export function saveBlocksNow() {
  if (current && !el<HTMLButtonElement>('bkSave').disabled) void saveDraft();
}

/**
 * Closes the editor, unless it has unsaved changes and leaving is cancelled (the address goes back)
 * @returns whether it closed
 */
export function leaveBlocks(): boolean {
  if (!current) return true;
  if (dirty && PUBLISHING_LIVE && !confirm('Leave without saving the draft? Your changes to this page will be lost.')) {
    history.replaceState(null, '', `#blocks/${current.key}`);
    return false;
  }
  current = undefined;
  dirty = false;
  el('bkSettings').textContent = '';
  el('bkBlocks').textContent = '';
  return true;
}

/** Builds the settings form and the blocks from a record */
function fill(open: Open) {
  const options = { onChange: changed };
  open.settings = buildForm(SETTINGS_DOC, without(open.base, ['$type', ...OWN_FIELDS]), options);
  el('bkSettings').replaceChildren(open.settings.el);
  el('bkOwnCardRow').hidden = open.key !== 'home';
  el<HTMLInputElement>('bkOwnCard').checked = isObject(open.base.card);
  open.rows = [];
  el('bkBlocks').textContent = '';
  for (const item of Array.isArray(open.base.blocks) ? open.base.blocks : []) addRow(open, isObject(item) ? item : {}, false);
  refresh();
}

/** The projects, for a projects block's list */
const projectChoices = () =>
  projects
    .map((p) => {
      const rkey = p.uri.split('/').pop() ?? '';
      return { value: projectUri(rkey), label: String(p.value.name ?? rkey) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

function button(text: string, label: string, onClick: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-btn admin-btn-ghost';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Adds a block at the end
 * @param item The record's #block: { width?, block }
 * @param fresh Just added: its options open, focused
 */
function addRow(open: Open, item: Value, fresh: boolean) {
  const block = isObject(item.block) ? item.block : {};
  const type = kindOf(block.$type);
  const li = document.createElement('li');
  li.className = 'admin-block';
  const head = document.createElement('div');
  head.className = 'admin-block-head';
  const title = document.createElement('strong');
  title.className = 'admin-block-title';
  head.appendChild(dragHandle('Drag to move this block'));
  head.appendChild(title);
  li.appendChild(head);

  let row: Row;
  if (!type) {
    title.textContent = `An unknown block (${typeof block.$type === 'string' ? block.$type : 'no type'})`;
    const note = document.createElement('p');
    note.className = 'admin-small';
    note.textContent = 'Saved by a newer version of this app. The site leaves it out; it’s kept here as it is.';
    li.appendChild(note);
    row = { kind: 'unknown', li, raw: item };
  } else {
    title.textContent = labelOf(type);
    const width = document.createElement('select');
    for (const w of WIDTHS) width.appendChild(new Option(w[0].toUpperCase() + w.slice(1), w));
    const given = typeof item.width === 'string' ? item.width : 'full';
    // A width the list doesn't have stays (the lexicon's known values are open)
    if (!(WIDTHS as readonly string[]).includes(given)) width.appendChild(new Option(given, given));
    width.value = given;
    width.addEventListener('change', changed);
    head.appendChild(width);
    const def = DOC.defs[type];
    const hint = document.createElement('p');
    hint.className = 'admin-small';
    hint.textContent = def.description ?? '';
    li.appendChild(hint);
    const known = Object.keys(def.properties ?? {});
    const options = buildForm(blockDoc(type), without(block, ['$type']), { onChange: changed, choices: projectChoices });
    if (known.length) {
      const details = document.createElement('details');
      details.className = 'admin-block-options';
      details.open = fresh;
      const summary = document.createElement('summary');
      summary.textContent = 'Options';
      details.appendChild(summary);
      details.appendChild(options.el);
      li.appendChild(details);
    }
    row = { kind: 'known', type, li, width, options, kept: without(item, ['width', 'block']), keptBlock: without(block, ['$type', ...known]) };
  }

  const controls = document.createElement('div');
  controls.className = 'admin-lexform-controls';
  const move = (by: number) => {
    const i = open.rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= open.rows.length) return;
    open.rows.splice(i, 1);
    open.rows.splice(j, 0, row);
    el('bkBlocks').insertBefore(li, by < 0 ? open.rows[j + 1].li : open.rows[j - 1].li.nextSibling);
    changed();
  };
  controls.appendChild(button('↑', 'Move this block up', () => move(-1)));
  controls.appendChild(button('↓', 'Move this block down', () => move(1)));
  controls.appendChild(
    button('Remove', 'Remove this block', () => {
      open.rows.splice(open.rows.indexOf(row), 1);
      li.remove();
      changed();
    }),
  );
  head.appendChild(controls);
  open.rows.push(row);
  el('bkBlocks').appendChild(li);
  if (fresh) (li.querySelector<HTMLElement>('details :is(input, textarea, select)') ?? li.querySelector('select'))?.focus();
}

/** A block as the record holds it */
function itemOf(row: Row): Value {
  if (row.kind === 'unknown') return row.raw;
  const width = row.width.value;
  return { ...row.kept, ...(width !== 'full' ? { width } : {}), block: { ...row.keptBlock, $type: blockType(row.type), ...(row.options.read() as Value) } };
}

/** The page's record as the form has it, without its date */
function recordOf(open: Open): Value {
  const settings = open.settings.read() as Value;
  const kept = without(open.base, ['$type', ...Object.keys(recordSchema(DOC).properties)]);
  const card = isObject(open.base.card) ? { card: open.base.card } : {};
  return { $type: PAGE_COLLECTION, ...kept, ...settings, blocks: open.rows.map(itemOf), ...card };
}

/** What's wrong with the form: the settings' and each block's, as the lexicon says */
function issues(open: Open): string[] {
  const out = problems(SETTINGS_DOC, open.settings.read() as Value);
  for (const [i, row] of open.rows.entries()) {
    if (row.kind === 'known') out.push(...problems(blockDoc(row.type), row.options.read() as Value).map((p) => `Block ${i + 1} (${labelOf(row.type)}): ${p}`));
  }
  if (open.rows.length > MAX_BLOCKS) out.push(`A page holds up to ${MAX_BLOCKS} blocks.`);
  return out;
}

/** Updates the numbers, what the page reads, the problems and the buttons from the form */
function refresh() {
  if (!current) return;
  const open = current;
  for (const [i, row] of open.rows.entries()) {
    if (row.kind === 'known') row.width.setAttribute('aria-label', `Width of block ${i + 1}, ${labelOf(row.type)}`);
  }
  el('bkAdd').hidden = open.rows.length >= MAX_BLOCKS;
  const page = pageFromRecord(recordOf(open));
  const reads = page ? readsOf(page) : [];
  el('bkReads').textContent = `Reads: ${reads.length ? reads.join(', ') : 'nothing from the site’s data'}.`;
  const found = issues(open);
  message('bkProblems', found.join(' '), found.length ? 'error' : 'info');
  const blocked = !PUBLISHING_LIVE || busy || !!open.conflict;
  el<HTMLButtonElement>('bkSave').disabled = blocked || found.length > 0 || (!!open.draft && !dirty);
  el<HTMLButtonElement>('bkPreview').disabled = !open.draft || dirty;
  el<HTMLButtonElement>('bkPublish').disabled = blocked || !open.draft || dirty;
  el('bkDelete').hidden = isSitePage(open.key) || (!open.page && !open.draft);
  el<HTMLButtonElement>('bkDelete').disabled = blocked;
  el('bkHint').textContent = dirty ? 'Save the draft to preview or publish it.' : open.draft ? '' : 'Save a draft to preview it.';
  const view = el<HTMLAnchorElement>('bkView');
  view.href = addressOf(open.key);
  view.hidden = !open.page;
}

function changed() {
  if (!current) return;
  dirty = true;
  if (!current.conflict) saveState('bkState', PUBLISHING_LIVE ? 'Unsaved changes' : 'Changes kept on this device');
  refresh();
}

/** Marks a write that met a change made elsewhere */
function conflicted(open: Open, action: NonNullable<Open['conflict']>) {
  open.conflict = action;
  el('bkConflict').hidden = false;
  saveState('bkState', { save: 'Not saved', publish: 'Not published', delete: 'Not deleted' }[action] + ': changed elsewhere');
}

async function saveDraft() {
  if (!PUBLISHING_LIVE || !current || busy || current.conflict) return;
  const open = current;
  if (issues(open).length) return;
  const step = (text: string) => {
    if (current === open) saveState('bkState', text);
  };
  busy = true;
  refresh();
  message('bkMessage', '');
  try {
    step('Checking…');
    const record = { ...recordOf(open), updatedAt: new Date().toISOString() };
    await assertValidPage(record);
    step('Saving…');
    const res = await putRecord(session, PAGE_COLLECTION, draftKey(open.key), record, open.draft?.cid);
    open.draft = { uri: res.uri, cid: res.cid, value: record };
    open.base = record;
    await revalidate();
    void saved().catch(() => {});
    if (current === open) {
      dirty = false;
      el('bkFrom').textContent = `The draft${open.page ? '. The page shows the published version until you publish it.' : '. Not published yet.'}`;
      step(`Saved as a draft ${formatTime(record.updatedAt)}`);
    }
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') conflicted(open, 'save');
    else {
      step('Not saved');
      message('bkMessage', `Couldn’t save the draft: ${errorText(err)}`, 'error');
    }
  } finally {
    busy = false;
    refresh();
  }
}

/** Draws the page's share card, if it gets one, and the record to publish: the saved draft, with or without its card */
async function publishedRecord(open: Open, draft: Value): Promise<Value> {
  const ownCard = open.key !== 'home' || el<HTMLInputElement>('bkOwnCard').checked;
  const record: Value = { ...without(draft, ['card']), updatedAt: new Date().toISOString() };
  if (!ownCard) return record;
  saveState('bkState', 'Drawing the share card…');
  const { drawPageCard } = await import('./card');
  const title = String(draft.title ?? '');
  const description = typeof draft.description === 'string' ? draft.description : undefined;
  const png = await drawPageCard({ key: open.key, title, description });
  saveState('bkState', 'Uploading the share card…');
  return { ...record, card: await uploadBlob(session, png) };
}

/**
 * Publishes the saved draft: draws its share card, writes it over the page's record (only over the
 * version this editor read), then deletes the draft (only the version it saved)
 */
async function publish() {
  if (!PUBLISHING_LIVE || !current?.draft || dirty || busy || current.conflict) return;
  const open = current;
  const draft = open.draft!;
  const address = addressOf(open.key);
  if (!confirm(`Publish the draft? ${address} shows it from now on${open.page ? ', instead of the version published now' : ''}.`)) return;
  busy = true;
  refresh();
  message('bkMessage', '');
  let published = false;
  try {
    const record = await publishedRecord(open, draft.value);
    saveState('bkState', 'Checking…');
    await assertValidPage(record);
    saveState('bkState', 'Publishing…');
    const res = await putRecord(session, PAGE_COLLECTION, open.key, record, open.page?.cid);
    published = true;
    open.page = { uri: res.uri, cid: res.cid, value: record };
    open.base = record;
    saveState('bkState', 'Deleting the draft…');
    await deleteRecord(session, PAGE_COLLECTION, draftKey(open.key), draft.cid);
    open.draft = undefined;
    await revalidate();
    void saved().catch(() => {});
    if (current === open) {
      el('bkFrom').textContent = 'The published page. Saving makes a draft; the page changes when you publish it.';
      saveState('bkState', `Published ${formatTime(String(record.updatedAt))}`);
    }
  } catch (err) {
    if (published) {
      // The page is live; only the draft is left
      await revalidate();
      saveState('bkState', `Published ${formatTime(String(open.page?.value.updatedAt))}`);
      message('bkMessage', `Published, but the draft couldn’t be deleted: ${errorText(err)}`, 'error');
    } else if (err instanceof XrpcError && err.error === 'InvalidSwap') conflicted(open, 'publish');
    else {
      saveState('bkState', 'Not published');
      message('bkMessage', `Couldn’t publish it: ${errorText(err)}`, 'error');
    }
  } finally {
    busy = false;
    refresh();
  }
}

/**
 * Deletes a page of Jeff's own and its draft, after a confirm: the page first, so the site stops
 * showing it, then the draft. If the draft's delete fails, Delete page deletes what's left.
 */
async function deletePage() {
  if (!PUBLISHING_LIVE || !current || busy || current.conflict || isSitePage(current.key)) return;
  const open = current;
  const address = addressOf(open.key);
  const title = String((open.page ?? open.draft)?.value.title || address);
  const what = open.page ? `${address} stops showing it${open.draft ? ', and its draft is deleted too' : ''}` : 'Its draft is deleted';
  if (!confirm(`Delete “${title}”? ${what}. This can’t be undone.`)) return;
  busy = true;
  refresh();
  message('bkMessage', '');
  let deleted = false;
  let done = '';
  try {
    saveState('bkState', 'Deleting…');
    if (open.page) {
      await deleteRecord(session, PAGE_COLLECTION, open.key, open.page.cid);
      open.page = undefined;
      deleted = true;
    }
    if (open.draft) {
      await deleteRecord(session, PAGE_COLLECTION, draftKey(open.key), open.draft.cid);
      open.draft = undefined;
      deleted = true;
    }
    if (current === open) {
      dirty = false;
      leaveBlocks();
      location.hash = '#pages';
    }
    done = `Deleted “${title}”. ${address} is the site’s 404 now.`;
  } catch (err) {
    if (err instanceof XrpcError && err.error === 'InvalidSwap') conflicted(open, 'delete');
    else {
      saveState('bkState', 'Not deleted');
      message('bkMessage', `Couldn’t delete it${deleted ? ' all: the page is deleted, its draft isn’t' : ''}: ${errorText(err)}`, 'error');
    }
  } finally {
    busy = false;
    refresh();
    if (deleted) {
      await revalidate();
      await saved().catch(() => {});
    }
    if (done) message('pagesMessage', done, 'ok');
  }
}

/**
 * After a write met a change made elsewhere: load the page and draft as they are now, or keep the
 * form and write it over them
 */
async function resolveConflict(choice: 'theirs' | 'mine') {
  if (!current?.conflict) return;
  const open = current;
  const action = open.conflict;
  const mine = open.draft?.value;
  try {
    const [page, draft] = await Promise.all([getRecord<Value>(session, PAGE_COLLECTION, open.key), getRecord<Value>(session, PAGE_COLLECTION, draftKey(open.key))]);
    el('bkConflict').hidden = true;
    open.conflict = undefined;
    open.page = page ?? undefined;
    open.draft = draft ?? undefined;
    if (choice === 'theirs') {
      open.base = draft?.value ?? page?.value ?? open.base;
      dirty = false;
      fill(open);
      const at = (draft ?? page)?.value.updatedAt;
      saveState('bkState', typeof at === 'string' ? `Loaded the version saved ${formatTime(at)}` : 'Loaded the saved version');
    } else if (action === 'save') await saveDraft();
    else if (action === 'delete') await deletePage();
    else {
      // Publish the draft this editor saved, over the newer page, then delete the draft as it is now
      if (!draft || !mine) return message('bkMessage', 'The draft was deleted elsewhere. Save it again to publish it.', 'error');
      open.draft = { ...draft, value: mine };
      await publish();
    }
  } catch (err) {
    message('bkMessage', `Couldn’t load it: ${errorText(err)}`, 'error');
  }
}
