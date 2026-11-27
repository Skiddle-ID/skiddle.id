/**
 * The Media section (#media): every file ("blob") in Jeff's repo, grouped by what uses it
 * (src/lib/media.mjs): the library (his uploads, each kept by an id.skiddle.media record), the site
 * (share cards, post images and the like) and elsewhere (other apps' files). A file opens to show
 * what it is and what uses it, with Copy Markdown, Copy link and Open. Library files can be renamed,
 * given alt text, and deleted, which deletes the record and lets the PDS drop the file.
 *
 * Replace swaps a library file for a new image, keeping its name and alt text. A file can't be
 * changed in place (its address, /media/<cid>, is its content's fingerprint), so the posts and pages
 * whose text links to the old one are listed, and the ones ticked are moved to the new link. If any
 * still link to the old file, it stays in the library as its own entry, so those links keep working.
 *
 * Uploading takes an image of up to 5 MB: the file goes up (uploadBlob), then its record is
 * written, which keeps it.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { MEDIA_COLLECTION, MEDIA_READ_COLLECTIONS, editorHref, mediaItems, mediaMarkdown, relinked, sizeLabel, type BlobUse, type MediaItem } from '~/lib/media.mjs';
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
    ...MEDIA_READ_COLLECTIONS.map((c) => listRecords<Record<string, unknown>>(session, c).then((rs) => rs.map((r) => ({ collection: c, uri: r.uri, value: r.value, cid: r.cid })))),
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
    li.appendChild(useLink(u));
    if (u.link) li.appendChild(document.createTextNode(' (links to it)'));
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
      const holds = it.uses.filter((u) => u.collection !== MEDIA_COLLECTION && !u.link);
      const links = it.uses.filter((u) => u.link);
      const warning = holds.length
        ? ` ${holds.map((u) => u.label).join(', ')} still uses it, so the file stays until that changes.`
        : ` Your PDS then removes the file.${links.length ? ` ${links.map((u) => u.label).join(', ')} links to it, and that image will stop showing.` : ''}`;
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
  const replace = replacePanel(it);
  row.appendChild(replace.pick);
  form.appendChild(name.wrap);
  form.appendChild(alt.wrap);
  form.appendChild(row);
  form.appendChild(replace.panel);
  return form;
}

/** A use, as a link to its editor where it has one */
function useLink(u: BlobUse): Node {
  const href = editorHref(u);
  if (!href) return document.createTextNode(u.label);
  const a = document.createElement('a');
  a.href = href;
  a.textContent = u.label;
  return a;
}

// ---- Replacing ----

/** Replace…: pick an image, see it, choose which links move to it, and Replace */
function replacePanel(it: MediaItem) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'sr-only';
  const pick = document.createElement('label');
  pick.className = 'admin-btn';
  pick.textContent = 'Replace…';
  pick.appendChild(input);

  const panel = document.createElement('div');
  panel.className = 'admin-media-upload admin-form';
  panel.hidden = true;

  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    message('mediaMessage', '');
    if (!f) return;
    if (!f.type.startsWith('image/')) return message('mediaMessage', 'Pick an image: PNG, JPEG, GIF, WebP or AVIF.', 'error');
    if (f.size > MAX_BYTES) return message('mediaMessage', `That’s ${sizeLabel(f.size)}; the most is ${sizeLabel(MAX_BYTES)}.`, 'error');
    draw(f);
  });

  const draw = (f: File) => {
    const parts: Node[] = [];
    const title = document.createElement('p');
    title.textContent = `Replace “${it.name ?? it.cid}” with ${f.name} (${sizeLabel(f.size)}). The name and alt text stay.`;
    parts.push(title);
    const canvas = document.createElement('canvas');
    canvas.hidden = true;
    void drawPreview(f, canvas);
    parts.push(canvas);

    // Posts and pages whose text links to the old file: ticked ones move to the new link
    const links = it.uses.filter((u) => u.link);
    const boxes: [BlobUse, HTMLInputElement][] = [];
    if (links.length) {
      const fs = document.createElement('fieldset');
      fs.className = 'admin-media-uses';
      const lg = document.createElement('legend');
      lg.textContent = 'Also change the link to the new image in:';
      fs.appendChild(lg);
      for (const u of links) {
        const l = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        l.appendChild(box);
        l.appendChild(document.createTextNode(' '));
        l.appendChild(useLink(u));
        fs.appendChild(l);
        boxes.push([u, box]);
      }
      parts.push(fs);
    }
    const holds = it.uses.filter((u) => u.collection !== MEDIA_COLLECTION && !u.link);
    const note = document.createElement('p');
    note.className = 'admin-small';
    note.textContent = [
      links.length ? 'A post or page left unticked keeps showing the old image, which then stays in the library as its own entry.' : 'Nothing links to it, so the old file goes once it’s replaced.',
      holds.length ? `${holds.map((u) => u.label).join(', ')} holds the old file itself, so it stays for that.` : '',
      'A published post changes on the site at once.',
    ]
      .filter(Boolean)
      .join(' ');
    parts.push(note);

    const row = document.createElement('div');
    row.className = 'admin-toolbar admin-quick';
    const go = button('Replace', async () => {
      go.disabled = true;
      try {
        await replace(
          it,
          f,
          boxes.filter(([, b]) => b.checked).map(([u]) => u),
          boxes.filter(([, b]) => !b.checked).map(([u]) => u),
        );
      } finally {
        go.disabled = false;
      }
    });
    go.classList.add('admin-btn-primary');
    row.appendChild(go);
    row.appendChild(
      button('Cancel', () => {
        panel.hidden = true;
        panel.replaceChildren();
      }),
    );
    parts.push(row);
    panel.replaceChildren(...parts);
    panel.hidden = false;
  };
  return { pick, panel };
}

/**
 * Uploads the new image, moves the chosen links to it, keeps the old file as its own library entry if
 * anything still links to it, then puts the new file in the library record
 */
async function replace(it: MediaItem, picked: File, move: BlobUse[], keep: BlobUse[]) {
  message('mediaMessage', 'Uploading…');
  try {
    const file = await uploadBlob(session, picked);
    const to = file.ref.$link;
    if (to === it.cid) return message('mediaMessage', 'That’s the same image: nothing to replace.', 'error');

    const failed: BlobUse[] = [];
    for (const u of move) {
      message('mediaMessage', `Changing the link in ${u.label}…`);
      try {
        const cur = await getRecord<Record<string, unknown>>(session, u.collection, u.rkey);
        if (cur) await putRecord(session, u.collection, u.rkey, relinked(cur.value, it.cid, to), cur.cid);
      } catch {
        failed.push(u);
      }
    }

    const current = await getRecord<Record<string, unknown>>(session, MEDIA_COLLECTION, it.mediaRkey!);
    if (!current) throw new Error('it isn’t in your repo any more');
    const stillLinked = [...keep, ...failed];
    // Written before the swap, so the old file always has a record keeping it
    if (stillLinked.length) {
      const name = `${it.name ?? 'image'} (before replacing)`.slice(0, 100);
      await createRecord(session, MEDIA_COLLECTION, { ...current.value, file: current.value.file, name, createdAt: new Date().toISOString() });
    }
    await putRecord(session, MEDIA_COLLECTION, it.mediaRkey!, { ...current.value, file }, current.cid);

    open = to;
    void revalidate();
    message(
      'mediaMessage',
      [
        'Replaced.',
        move.length - failed.length ? `Changed the link in ${move.length - failed.length} ${move.length - failed.length === 1 ? 'place' : 'places'}.` : '',
        failed.length ? `Couldn’t change ${failed.map((u) => u.label).join(', ')}: it still shows the old image.` : '',
        stillLinked.length ? 'The old image stays in the library, “(before replacing)”.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      failed.length ? 'error' : 'ok',
    );
    await loadMedia();
  } catch (err) {
    message('mediaMessage', `Couldn’t replace it: ${errorText(err)}`, 'error');
  }
}

/** Draws a picked image, decoded, on a canvas (no address made from the file) */
async function drawPreview(file: File, canvas: HTMLCanvasElement) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    canvas.hidden = false;
  } catch {
    canvas.hidden = true;
  }
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
  void preview(file);
  el<HTMLInputElement>('mediaUploadName').value = file.name;
  el<HTMLTextAreaElement>('mediaUploadAlt').value = '';
  el('mediaUpload').hidden = false;
  el('mediaUploadAlt').focus();
}

/** Draws the picked image on the upload's preview canvas */
const preview = (file: File) => drawPreview(file, el<HTMLCanvasElement>('mediaUploadPreview'));

function resetUpload() {
  picked = undefined;
  el<HTMLInputElement>('mediaFile').value = '';
  const canvas = el<HTMLCanvasElement>('mediaUploadPreview');
  canvas.width = 0;
  canvas.height = 0;
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
