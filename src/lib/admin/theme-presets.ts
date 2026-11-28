/**
 * The Theme editor's presets (src/lib/admin/page-editor.ts, src/lib/theme-presets.mjs,
 * id.skiddle.themePreset), under the theme's form:
 *   - Today's look, built in, first: applying it is Reset, then Save
 *   - the saved presets, each with Apply (after a confirm: the theme is saved with its design, and
 *     keeps its mode, accent and cards' design), Rename, Export and Delete (after a confirm)
 *   - Save as preset: the design in the form, under a name; its key comes from the name
 *   - Export this theme: the design in the form, as a preset file
 *   - Import: a preset file, checked with @atproto/lexicon and for readable colours, saved as a
 *     preset, never applied straight away
 * Writes follow PUBLISHING_LIVE, and edits use swapRecord, as the other editors do. A session signed
 * in before presets existed can't write them, and is asked to sign in again.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import presetLexicon from '../../../lexicons/id/skiddle/themePreset.json';
import themeLexicon from '../../../lexicons/id/skiddle/theme.json';
import { THEME_PRESET_COLLECTION, TODAYS_LOOK, designOf, presetFile, presetFromFile, presetKey, presetRecord } from '~/lib/theme-presets.mjs';
import { el, errorText, formatTime, message } from './dom';
import { PUBLISHING_LIVE } from './launch';
import { missingScopes } from './oauth';
import { badge, cellRow, renderTable } from './table';
import { themeProblems } from './theme-editor';
import { createRecord, deleteRecord, listRecords, putRecord, type RepoRecord } from './xrpc';

type Value = Record<string, unknown>;

/** What the presets need from the Theme editor */
export interface ThemeForm {
  /** The theme the form holds */
  read: () => Value;
  /** Whether the form has changes that aren't saved */
  dirty: () => boolean;
  /** Puts a design into the form over the saved theme, and saves it; true if it saved */
  apply: (design: Value) => Promise<boolean>;
}

interface Row {
  name: string;
  design: Value;
  /** A saved preset's record; Today's look has none */
  record?: RepoRecord<Value>;
}

let session: OAuthSession;
let form: ThemeForm | undefined;
let saved: RepoRecord<Value>[] = [];

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const now = () => new Date().toISOString();
const say = (text: string, kind: 'ok' | 'error' | 'info' = 'info') => message('presetsMessage', text, kind);

/**
 * @param s The signed-in session
 * @param signInAgain Starts a new sign-in, for a session that can't write presets yet
 */
export function setupThemePresets(s: OAuthSession, signInAgain: () => void) {
  session = s;
  el('presetsSignIn').addEventListener('click', () => signInAgain());
  el('presetSave').addEventListener('click', () => void saveAsPreset());
  el('presetExport').addEventListener('click', () => {
    if (form) download('theme', presetFile(presetRecord(`The theme, ${now().slice(0, 10)}`, form.read(), now())));
  });
  const input = el<HTMLInputElement>('presetImport');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void importFile(file);
  });
}

/** Shows the presets under the Theme editor's form, and reads them */
export async function showPresets(theme: ThemeForm) {
  form = theme;
  el('presets').hidden = false;
  say('');
  for (const id of ['presetSave', 'presetImport']) el<HTMLButtonElement | HTMLInputElement>(id).disabled = !PUBLISHING_LIVE;
  try {
    const [list, info] = await Promise.all([listRecords<Value>(session, THEME_PRESET_COLLECTION), session.getTokenInfo()]);
    if (form !== theme) return;
    el('presetsScope').hidden = !missingScopes(info.scope).includes(`repo:${THEME_PRESET_COLLECTION}`);
    saved = list;
    draw();
  } catch (err) {
    say(`Couldn’t read the presets: ${errorText(err)}`, 'error');
  }
}

/** Hides them, when the Theme editor closes */
export function hidePresets() {
  form = undefined;
  el('presets').hidden = true;
}

function button(text: string, label: string, onClick: () => void, disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-btn admin-btn-ghost';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

/** The list: Today's look, then the saved presets by name */
function draw() {
  const rows: Row[] = [
    TODAYS_LOOK,
    ...saved
      .map((r) => ({ name: String(r.value.name ?? rkeyOf(r.uri)), design: designOf(r.value), record: r }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const off = !PUBLISHING_LIVE;
  renderTable<Row>(
    {
      host: el('presetsList'),
      noun: 'presets',
      text: (r) => r.name,
      empty: '',
      columns: [
        { label: 'Preset', cell: (r) => (r.record ? r.name : cellRow(r.name, ' ', badge('built in'))) },
        { label: 'Updated', secondary: true, cell: (r) => (r.record ? formatTime(String(r.record.value.updatedAt ?? r.record.value.createdAt ?? '')) : 'in the site’s code') },
        {
          label: 'Actions',
          cell: (r) =>
            cellRow(
              button('Apply', `Apply ${r.name}`, () => void apply(r), off),
              ...(r.record
                ? [
                    button('Rename', `Rename ${r.name}`, () => void rename(r.record!), off),
                    button('Export', `Export ${r.name}`, () => download(rkeyOf(r.record!.uri), presetFile(r.record!.value))),
                    button('Delete', `Delete ${r.name}`, () => void remove(r.record!), off),
                  ]
                : [button('Export', `Export ${r.name}`, () => download('todays-look', presetFile(presetRecord(r.name, r.design, now()))))]),
            ),
        },
      ],
    },
    rows,
  );
}

/** Saves the theme with a preset's design, after a confirm */
async function apply(row: Row) {
  if (!form || !PUBLISHING_LIVE) return;
  const lost = form.dirty() ? ' The changes in the form that aren’t saved are lost.' : '';
  if (!confirm(`Apply “${row.name}”? The theme is saved with its colours, fonts, sizes, corners, spacing and terminal touches, and the site changes at once. The mode, the accent and the cards’ design stay.${lost}`)) return;
  say('');
  if (await form.apply(row.design)) say(`Applied “${row.name}”.`, 'ok');
}

/** Saves the design in the form as a new preset, under the name typed */
async function saveAsPreset() {
  if (!form || !PUBLISHING_LIVE) return;
  const input = el<HTMLInputElement>('presetName');
  const name = input.value.trim();
  const value = form.read();
  const problem = name ? themeProblems(value).join(' ') : 'Give the preset a name.';
  if (problem) return say(problem, 'error');
  if (await create(presetRecord(name, value, now()))) input.value = '';
}

/** Writes a new preset, checked against the lexicon, under a key from its name */
async function create(record: Value): Promise<boolean> {
  const key = presetKey(String(record.name), saved.map((r) => rkeyOf(r.uri)));
  try {
    await check(record);
    const res = await createRecord(session, THEME_PRESET_COLLECTION, record, key);
    saved = [...saved, { uri: res.uri, cid: res.cid, value: record }];
    draw();
    say(`Saved the preset “${String(record.name)}”.`, 'ok');
    return true;
  } catch (err) {
    say(`Couldn’t save the preset: ${errorText(err)}`, 'error');
    return false;
  }
}

/** Checks a preset with @atproto/lexicon, as the editors check a record before they save it */
async function check(record: Value) {
  const { Lexicons, jsonToLex } = await import('@atproto/lexicon');
  // Copies: loading a lexicon rewrites its refs in place
  new Lexicons(structuredClone([themeLexicon, presetLexicon]) as never).assertValidRecord(THEME_PRESET_COLLECTION, jsonToLex(record));
}

async function rename(record: RepoRecord<Value>) {
  const old = String(record.value.name ?? '');
  const name = prompt(`A new name for “${old}”:`, old)?.trim();
  if (!name || name === old) return;
  const value = { ...record.value, name, updatedAt: now() };
  await change(`Renamed it “${name}”.`, async () => {
    await check(value);
    const res = await putRecord(session, THEME_PRESET_COLLECTION, rkeyOf(record.uri), value, record.cid);
    return saved.map((r) => (r.uri === record.uri ? { ...r, cid: res.cid, value } : r));
  });
}

async function remove(record: RepoRecord<Value>) {
  const name = String(record.value.name ?? rkeyOf(record.uri));
  if (!confirm(`Delete the preset “${name}”? This can’t be undone. The theme stays as it is.`)) return;
  await change(`Deleted the preset “${name}”.`, async () => {
    await deleteRecord(session, THEME_PRESET_COLLECTION, rkeyOf(record.uri), record.cid);
    return saved.filter((r) => r.uri !== record.uri);
  });
}

/**
 * A rename or a delete, which writes with swapRecord, so a preset changed on another device since it
 * was read isn't overwritten
 * @param op Writes, and gives the presets as they are after it
 */
async function change(done: string, op: () => Promise<RepoRecord<Value>[]>) {
  try {
    saved = await op();
    draw();
    say(done, 'ok');
  } catch (err) {
    say(`Couldn’t change it: ${errorText(err)}. Open the Theme editor again to see the presets as they are now.`, 'error');
  }
}

/** Reads a preset file and saves it as a preset, if it's valid and its colours are readable */
async function importFile(file: File) {
  if (!PUBLISHING_LIVE) return;
  say('');
  const { Lexicons, jsonToLex } = await import('@atproto/lexicon');
  const lex = new Lexicons(structuredClone([themeLexicon, presetLexicon]) as never);
  const text = file.size > 1_000_000 ? '' : await file.text();
  const read = text ? presetFromFile(text, lex, jsonToLex, now()) : { problem: 'The file is too big to be a preset.' };
  if ('problem' in read) return say(`Couldn’t import ${file.name}: ${read.problem}`, 'error');
  const unreadable = themeProblems(read.record);
  if (unreadable.length) return say(`Couldn’t import ${file.name}: its colours are hard to read. ${unreadable.join(' ')}`, 'error');
  await create(read.record);
}

/** Downloads a preset file */
function download(name: string, json: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `${name}.theme-preset.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
