/**
 * The Media section (#media): every file ("blob") in Jeff's repo, grouped by what uses it
 * (src/lib/media.mjs): the library (his uploads, each kept by an id.skiddle.media record), the site
 * (share cards, post images and the like) and elsewhere (other apps' files). A file opens to show
 * what it is and what uses it, with Copy Markdown, Copy link and Open. Library files can be renamed,
 * given alt text, and deleted, which deletes the record and lets the PDS drop the file.
 *
 * Uploading takes an image of up to 5 MB: the file goes up (uploadBlob), then its record is
 * written, which keeps it.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { MEDIA_COLLECTION, SITE_BLOB_COLLECTIONS, editorHref, mediaItems, mediaMarkdown, sizeLabel, type MediaItem } from '~/lib/media.mjs';
import { DID } from '~/lib/standard-site.mjs';
import { el, errorText, item, message, revalidate } from './dom';
import { missingScopes } from './oauth';
import { report } from './overview';
import { createRecord, deleteRecord, getRecord, listRecords, putRecord, uploadBlob, xrpc } from './xrpc';

/** The largest upload, as the lexicon allows */
const MAX_BYTES = 5_000_000;
/** Elsewhere can be hundreds of files; this many show until More */
const PAGE = 48;

const GROUPS = [
  { id: 'library', label: 'Library' },
  { id: 'site', label: 'Site' },
  { id: 'elsewhere', label: 'Elsewhere' },
] as const;
type Group = (typeof GROUPS)[number]['id'];

let session: OAuthSession;
let items: MediaItem[] = [];
let group: Group = 'library';
let shown = PAGE;
let open: string | undefined;

/**
 * @param s The signed-in session
 * @param signInAgain Starts a new sign-in, for when the session can't write the library yet
 */
export function setupMedia(s: OAuthSession, signInAgain: () => void) {
  session = s;
  el('mediaSignIn').addEventListener('click', () => signInAgain());
  el<HTMLInputElement>('mediaFile').addEventListener('change', chosen);
  el('mediaUploadCancel').addEventListener('click', resetUpload);
  el('mediaUploadSave').addEventListener('click', () => void upload());
  el('mediaMore').addEventListener('click', () => {
    shown += PAGE;
    renderGrid();
  });
}

/** Reads the repo's files and what uses them */
export async function loadMedia() {
  const missing = missingScopes((await session.getTokenInfo()).scope).includes(`repo:${MEDIA_COLLECTION}`);
  el('mediaScope').hidden = !missing;
  el('mediaUploadLabel').hidden = missing;
  const [cids, ...lists] = await Promise.all([
    listBlobs(),
    ...SITE_BLOB_COLLECTIONS.map((c) => listRecords<Record<string, unknown>>(session, c).then((rs) => rs.map((r) => ({ collection: c, uri: r.uri, value: r.value, cid: r.cid })))),
  ]);
  items = mediaItems(cids, lists.flat());
  report('media', { count: items.length, stats: { 'Media files': items.length } });
  render();
}

/** Every blob in the repo (public: com.atproto.sync.listBlobs) */
async function listBlobs(): Promise<string[]> {
  const out: string[] = [];
  let cursor = '';
  do {
    const page = await xrpc<{ cids: string[]; cursor?: string }>(session, 'com.atproto.sync.listBlobs', { did: DID, limit: '1000', ...(cursor ? { cursor } : {}) });
    out.push(...page.cids);
    cursor = page.cids.length ? (page.cursor ?? '') : '';
  } while (cursor);
  return out;
}

function render() {
  el('mediaFilters').replaceChildren(
    ...GROUPS.map((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'admin-filter';
      b.setAttribute('aria-pressed', String(g.id === group));
      b.textContent = `${g.label} ${items.filter((i) => i.group === g.id).length}`;
      b.addEventListener('click', () => {
        group = g.id;
        shown = PAGE;
        open = undefined;
        render();
      });
      return b;
    }),
  );
  renderGrid();
}

function renderGrid() {
  const list = items.filter((i) => i.group === group);
  const grid = el('mediaGrid');
  grid.replaceChildren(
    ...(list.length
      ? list.slice(0, shown).map(tile)
      : [emptyNote(group === 'library' ? 'No uploads yet: Upload adds one.' : 'Nothing here.')]),
  );
  el('mediaMore').hidden = list.length <= shown;
  renderDetail();
}

function tile(it: MediaItem) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-media-tile';
  b.setAttribute('aria-pressed', String(it.cid === open));
  b.setAttribute('aria-label', `${it.name ?? it.uses[0]?.label ?? it.cid}: details`);
  const img = document.createElement('img');
  img.src = `/media/${it.cid}`;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  // Not an image the site serves (another app's file, a video…): a placeholder instead
  img.addEventListener('error', () => {
    const ph = document.createElement('span');
    ph.className = 'admin-media-ph';
    ph.textContent = it.mimeType?.split('/')[1] ?? 'file';
    img.replaceWith(ph);
  });
  const cap = document.createElement('span');
  cap.className = 'admin-media-cap';
  cap.textContent = it.name ?? it.uses[0]?.label ?? (it.group === 'elsewhere' ? 'another app’s file' : it.cid.slice(-8));
  b.appendChild(img);
  b.appendChild(cap);
  b.addEventListener('click', () => {
    open = open === it.cid ? undefined : it.cid;
    renderGrid();
    if (open) el('mediaDetail').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  return b;
}

/** The open file: what it is, what uses it, and what can be done with it */
function renderDetail() {
  const box = el('mediaDetail');
  const it = items.find((i) => i.cid === open);
  box.hidden = !it;
  if (!it) return box.replaceChildren();
  const parts: HTMLElement[] = [];
  const head = document.createElement('p');
  head.className = 'admin-small';
  head.textContent = [it.cid, it.mimeType, sizeLabel(it.size)].filter(Boolean).join(' · ');
  parts.push(head);

  const used = document.createElement('ul');
  used.className = 'admin-media-uses';
  if (!it.uses.length) used.appendChild(item('Not used by the site: another app’s file, or one no record of the site names.', 'admin-muted'));
  for (const u of it.uses) {
    const li = document.createElement('li');
    const href = editorHref(u);
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = u.label;
      li.appendChild(a);
    } else li.textContent = u.label;
    used.appendChild(li);
  }
  parts.push(used);

  const actions = document.createElement('div');
  actions.className = 'admin-toolbar admin-quick';
  const url = `${location.origin}/media/${it.cid}`;
  actions.appendChild(button('Copy Markdown', () => copy(mediaMarkdown(it.cid, it.alt ?? ''), 'Markdown copied: paste it into a post.')));
  actions.appendChild(button('Copy link', () => copy(url, 'Link copied.')));
  const openLink = document.createElement('a');
  openLink.className = 'admin-btn';
  openLink.href = `/media/${it.cid}`;
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.textContent = 'Open';
  actions.appendChild(openLink);
  parts.push(actions);

  if (it.mediaRkey) parts.push(libraryForm(it));
  box.replaceChildren(...parts);
}

/** A library file's name and alt text, Save, and Delete */
function libraryForm(it: MediaItem) {
  const form = document.createElement('div');
  form.className = 'admin-form';
  const name = field('Name', 'input', it.name ?? '');
  const alt = field('Alt text: what the image shows', 'textarea', it.alt ?? '');
  const row = document.createElement('div');
  row.className = 'admin-toolbar admin-quick';
  row.appendChild(
    button('Save', async () => {
      try {
        const current = await getRecord<Record<string, unknown>>(session, MEDIA_COLLECTION, it.mediaRkey!);
        if (!current) throw new Error('it isn’t in your repo any more');
        const n = name.control.value.trim();
        const a = alt.control.value.trim();
        const { name: _n, alt: _a, ...rest } = current.value;
        await putRecord(session, MEDIA_COLLECTION, it.mediaRkey!, { ...rest, ...(n ? { name: n } : {}), ...(a ? { alt: a } : {}) }, current.cid);
        message('mediaMessage', 'Saved.', 'ok');
        await loadMedia();
      } catch (err) {
        message('mediaMessage', `Couldn’t save it: ${errorText(err)}`, 'error');
      }
    }),
  );
  row.appendChild(
    button('Delete', async () => {
      const uses = it.uses.filter((u) => u.collection !== MEDIA_COLLECTION);
      const warning = uses.length ? ` ${uses.map((u) => u.label).join(', ')} still uses it, so the file stays until that changes.` : ' Your PDS then removes the file.';
      if (!confirm(`Delete “${it.name ?? it.cid}” from your library? This can’t be undone.${warning}`)) return;
      try {
        await deleteRecord(session, MEDIA_COLLECTION, it.mediaRkey!);
        open = undefined;
        message('mediaMessage', 'Deleted from your library.', 'ok');
        void revalidate();
        await loadMedia();
      } catch (err) {
        message('mediaMessage', `Couldn’t delete it: ${errorText(err)}`, 'error');
      }
    }),
  );
  form.appendChild(name.wrap);
  form.appendChild(alt.wrap);
  form.appendChild(row);
  return form;
}

// ---- Uploading ----

let picked: File | undefined;

function chosen() {
  const input = el<HTMLInputElement>('mediaFile');
  const file = input.files?.[0];
  message('mediaMessage', '');
  if (!file) return;
  if (!file.type.startsWith('image/')) return message('mediaMessage', 'Pick an image: PNG, JPEG, GIF, WebP or AVIF.', 'error');
  if (file.size > MAX_BYTES) return message('mediaMessage', `That’s ${sizeLabel(file.size)}; the most is ${sizeLabel(MAX_BYTES)}.`, 'error');
  picked = file;
  el<HTMLImageElement>('mediaUploadPreview').src = URL.createObjectURL(file);
  el<HTMLInputElement>('mediaUploadName').value = file.name;
  el<HTMLTextAreaElement>('mediaUploadAlt').value = '';
  el('mediaUpload').hidden = false;
  el('mediaUploadAlt').focus();
}

function resetUpload() {
  picked = undefined;
  el<HTMLInputElement>('mediaFile').value = '';
  const preview = el<HTMLImageElement>('mediaUploadPreview');
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  preview.removeAttribute('src');
  el('mediaUpload').hidden = true;
}

async function upload() {
  if (!picked) return;
  const save = el<HTMLButtonElement>('mediaUploadSave');
  save.disabled = true;
  message('mediaMessage', 'Uploading…');
  try {
    const file = await uploadBlob(session, picked);
    const name = el<HTMLInputElement>('mediaUploadName').value.trim();
    const alt = el<HTMLTextAreaElement>('mediaUploadAlt').value.trim();
    // The record keeps the file: without it the PDS would remove it
    await createRecord(session, MEDIA_COLLECTION, { $type: MEDIA_COLLECTION, file, ...(name ? { name } : {}), ...(alt ? { alt } : {}), createdAt: new Date().toISOString() });
    resetUpload();
    group = 'library';
    open = file.ref.$link;
    message('mediaMessage', 'Uploaded to your library.', 'ok');
    await loadMedia();
  } catch (err) {
    message('mediaMessage', `Couldn’t upload it: ${errorText(err)}`, 'error');
  } finally {
    save.disabled = false;
  }
}

// ---- Small parts ----

/** A line across the whole grid, when a group has no files */
function emptyNote(text: string) {
  const p = document.createElement('p');
  p.className = 'admin-muted admin-media-empty';
  p.textContent = text;
  return p;
}

function button(text: string, onClick: () => void | Promise<void>) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-btn';
  b.textContent = text;
  b.addEventListener('click', () => void onClick());
  return b;
}

function field(label: string, kind: 'input' | 'textarea', value: string) {
  const wrap = document.createElement('label');
  wrap.className = 'admin-field';
  const l = document.createElement('span');
  l.textContent = label;
  const control = document.createElement(kind) as HTMLInputElement | HTMLTextAreaElement;
  control.value = value;
  if (control instanceof HTMLTextAreaElement) control.rows = 3;
  wrap.appendChild(l);
  wrap.appendChild(control);
  return { wrap, control };
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    message('mediaMessage', done, 'ok');
  } catch {
    message('mediaMessage', `Couldn’t copy it. Here it is: ${text}`, 'info');
  }
}
