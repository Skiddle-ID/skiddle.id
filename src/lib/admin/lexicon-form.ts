/**
 * A form made from a lexicon, for the page editors (src/lib/admin/page-editor.ts): one field per
 * property of the record, in the lexicon's order, so the editors always match the lexicons in
 * lexicons/id/skiddle/.
 *   - a string: a text box, or a larger one for long text (Markdown); a list to pick from when the
 *     lexicon knows its values; a URL box for format "uri"; the projects for format "at-uri"
 *   - an integer: a number box; a boolean: a checkbox
 *   - an object (a ref to another def): its fields, grouped
 *   - a list: a row per item, each with move up, move down and remove, and a button to add one.
 *     Items that are objects fold, showing their first field.
 * Dates the app sets (format "datetime", e.g. createdAt and updatedAt) aren't shown.
 *
 * `read()` gives the record's fields from the form, leaving out empty ones (as the import does,
 * src/lib/page-records.mjs). `problems()` checks a value against the lexicon as the form is
 * filled in: required fields, lengths (in characters as people see them, and in bytes), URLs,
 * numbers and list sizes. Saving also checks the whole record with @atproto/lexicon.
 */
import { countChars } from '~/lib/status-states.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a lexicon's schema is JSON of many shapes, read by `type`
type Schema = Record<string, any>;
type Value = Record<string, unknown>;

export interface LexiconDoc {
  lexicon: 1;
  id: string;
  defs: Record<string, Schema>;
  [key: string]: unknown;
}

export interface FormOptions {
  /** Called whenever the form changes */
  onChange: () => void;
  /** What a string of format "at-uri" can point at, e.g. the projects */
  choices?: () => { value: string; label: string }[];
}

interface Field {
  el: HTMLElement;
  read: () => unknown;
}

/** Labels that a property's name doesn't spell well */
const LABELS: Record<string, string> = {
  href: 'Link',
  url: 'URL',
  github: 'GitHub',
  bluesky: 'Bluesky',
  source: 'Source code',
  writeup: 'Write-up',
  live: 'Live site',
  id: 'Anchor',
};

/** "selectedProjects" → "Selected projects" */
export const labelOf = (key: string) =>
  LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const empty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** The properties a form shows: all but the dates the app sets */
const shown = (schema: Schema) => Object.entries<Schema>(schema.properties ?? {}).filter(([, s]) => !(s.type === 'string' && s.format === 'datetime'));

/** The record's own object schema */
export const recordSchema = (doc: LexiconDoc): Schema => doc.defs.main.record;

/** A ref to one of the lexicon's own defs (#name, or <its id>#name) resolved to the def; anything else as it is */
function resolve(doc: LexiconDoc, schema: Schema): Schema {
  if (schema.type !== 'ref' || typeof schema.ref !== 'string') return schema;
  const [where, name] = schema.ref.split('#');
  const own = where === '' || where === doc.id || where === `lex:${doc.id}`;
  return own && doc.defs[name ?? 'main'] ? doc.defs[name ?? 'main'] : schema;
}

/** A long text gets a bigger box */
const isLong = (s: Schema) => (s.maxGraphemes ?? 0) >= 1000 || (!s.maxGraphemes && (s.maxLength ?? 0) >= 10000);
const isMedium = (s: Schema) => (s.maxGraphemes ?? 0) >= 300;

let ids = 0;
const nextId = () => `lf-${++ids}`;

function button(text: string, label: string, onClick: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-btn admin-btn-ghost';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function hint(text: string | undefined) {
  if (!text) return undefined;
  const p = document.createElement('p');
  p.className = 'admin-small';
  p.textContent = text;
  return p;
}

/**
 * The form for a record's fields, filled in with `value`
 * @returns its element, and read() for the fields it holds now
 */
export function buildForm(doc: LexiconDoc, value: Value, options: FormOptions): Field {
  const root = document.createElement('div');
  root.className = 'admin-lexform';
  const schema = recordSchema(doc);
  const fields = shown(schema).map(([key, s]) => {
    const f = field(doc, key, s, value[key], (schema.required ?? []).includes(key), options);
    root.appendChild(f.el);
    return [key, f] as const;
  });
  root.addEventListener('input', () => options.onChange());
  root.addEventListener('change', () => options.onChange());
  return {
    el: root,
    read: () => Object.fromEntries(fields.map(([key, f]) => [key, f.read()]).filter(([, v]) => !empty(v))),
  };
}

function field(doc: LexiconDoc, key: string, raw: Schema, value: unknown, required: boolean, options: FormOptions): Field {
  const schema = resolve(doc, raw);
  const label = labelOf(key);
  if (schema.type === 'object') return objectField(doc, label, schema, (value ?? {}) as Value, options, raw.description ?? schema.description);
  if (schema.type === 'array') return listField(doc, label, schema, Array.isArray(value) ? value : [], options);

  const wrap = document.createElement('div');
  wrap.className = 'admin-field';
  const id = nextId();
  if (schema.type === 'boolean') {
    const check = document.createElement('label');
    check.className = 'admin-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = value === true;
    check.appendChild(input);
    check.appendChild(document.createTextNode(` ${label}`));
    wrap.appendChild(check);
    const h = hint(schema.description);
    if (h) wrap.appendChild(h);
    // Unticked leaves it out, like a project that isn't featured
    return { el: wrap, read: () => (input.checked ? true : undefined) };
  }

  const head = document.createElement('div');
  head.className = 'admin-label-row';
  const l = document.createElement('label');
  l.htmlFor = id;
  l.textContent = label;
  head.appendChild(l);
  if (required) {
    const r = document.createElement('span');
    r.className = 'admin-muted';
    r.textContent = 'required';
    head.appendChild(r);
  }
  wrap.appendChild(head);
  const input = control(schema, value, options);
  input.id = id;
  wrap.appendChild(input);
  const h = hint(schema.description);
  if (h) {
    h.id = `${id}-hint`;
    input.setAttribute('aria-describedby', h.id);
    wrap.appendChild(h);
  }
  return { el: wrap, read: () => readControl(schema, input) };
}

/** The input for a string or an integer */
function control(schema: Schema, value: unknown, options: FormOptions): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (schema.type === 'integer') {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    if (schema.minimum !== undefined) input.min = String(schema.minimum);
    if (schema.maximum !== undefined) input.max = String(schema.maximum);
    input.value = typeof value === 'number' ? String(value) : '';
    return input;
  }
  const text = typeof value === 'string' ? value : '';
  const picks = schema.format === 'at-uri' ? options.choices?.() : schema.knownValues?.map((v: string) => ({ value: v, label: v }));
  if (picks) {
    const select = document.createElement('select');
    select.appendChild(new Option('—', ''));
    for (const p of picks) select.appendChild(new Option(p.label, p.value));
    // A value the list doesn't have stays (lexicons' known values are open)
    if (text && !picks.some((p: { value: string }) => p.value === text)) select.appendChild(new Option(text, text));
    select.value = text;
    return select;
  }
  if (isLong(schema) || isMedium(schema)) {
    const area = document.createElement('textarea');
    area.rows = isLong(schema) ? 8 : 3;
    area.value = text;
    return area;
  }
  const input = document.createElement('input');
  input.type = schema.format === 'uri' ? 'url' : 'text';
  if (schema.format === 'uri') input.inputMode = 'url';
  input.autocomplete = 'off';
  input.value = text;
  return input;
}

function readControl(schema: Schema, input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): unknown {
  const v = input.value.trim();
  if (!v) return undefined;
  if (schema.type === 'integer') return Number.isFinite(Number(v)) ? Number(v) : v;
  return v;
}

function objectField(doc: LexiconDoc, label: string, schema: Schema, value: Value, options: FormOptions, description?: string): Field {
  const set = document.createElement('fieldset');
  set.className = 'admin-field admin-lexform-group';
  const legend = document.createElement('legend');
  legend.className = 'admin-legend';
  legend.textContent = label;
  set.appendChild(legend);
  const h = hint(description);
  if (h) set.appendChild(h);
  const fields = shown(schema).map(([key, s]) => {
    const f = field(doc, key, s, value[key], (schema.required ?? []).includes(key), options);
    set.appendChild(f.el);
    return [key, f] as const;
  });
  return { el: set, read: () => Object.fromEntries(fields.map(([key, f]) => [key, f.read()]).filter(([, v]) => !empty(v))) };
}

function listField(doc: LexiconDoc, label: string, schema: Schema, values: unknown[], options: FormOptions): Field {
  const items = resolve(doc, schema.items);
  const set = document.createElement('fieldset');
  set.className = 'admin-field admin-lexform-group';
  const legend = document.createElement('legend');
  legend.className = 'admin-legend';
  legend.textContent = label;
  set.appendChild(legend);
  const h = hint(schema.description);
  if (h) set.appendChild(h);
  const list = document.createElement('ol');
  list.className = 'admin-lexform-list';
  set.appendChild(list);
  const rows: { li: HTMLLIElement; read: () => unknown }[] = [];
  const noun = label.replace(/s$/, '').toLowerCase();

  const renumber = () => {
    for (const [i, r] of rows.entries()) {
      r.li.dataset.n = String(i + 1);
      const title = r.li.querySelector<HTMLElement>(':scope > details > summary > .admin-lexform-title');
      if (title) title.textContent = summaryOf(r.read(), items, i);
    }
    add.hidden = schema.maxLength !== undefined && rows.length >= schema.maxLength;
  };

  const addRow = (value: unknown, fresh: boolean) => {
    const li = document.createElement('li');
    const controls = document.createElement('div');
    controls.className = 'admin-lexform-controls';
    let read: () => unknown;
    if (items.type === 'object') {
      const details = document.createElement('details');
      details.open = fresh;
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.className = 'admin-lexform-title';
      summary.appendChild(title);
      details.appendChild(summary);
      const body = objectField(doc, '', items, (value ?? {}) as Value, options);
      body.el.querySelector('legend')?.remove();
      body.el.classList.add('admin-lexform-item');
      details.appendChild(body.el);
      details.appendChild(controls);
      li.appendChild(details);
      read = body.read;
      details.addEventListener('input', () => (title.textContent = summaryOf(read(), items, rows.findIndex((r) => r.li === li))));
    } else {
      const input = control(items, value, options);
      input.setAttribute('aria-label', `${labelOf(noun)} ${rows.length + 1}`);
      li.className = 'admin-lexform-row';
      li.appendChild(input);
      li.appendChild(controls);
      read = () => readControl(items, input);
    }
    const row = { li, read };
    const move = (by: number) => {
      const i = rows.indexOf(row);
      const j = i + by;
      if (j < 0 || j >= rows.length) return;
      rows.splice(i, 1);
      rows.splice(j, 0, row);
      if (by < 0) list.insertBefore(li, rows[j + 1].li);
      else list.insertBefore(li, rows[j - 1].li.nextSibling);
      renumber();
      options.onChange();
    };
    controls.appendChild(button('↑', `Move this ${noun} up`, () => move(-1)));
    controls.appendChild(button('↓', `Move this ${noun} down`, () => move(1)));
    controls.appendChild(
      button('Remove', `Remove this ${noun}`, () => {
        rows.splice(rows.indexOf(row), 1);
        li.remove();
        renumber();
        options.onChange();
      }),
    );
    rows.push(row);
    list.appendChild(li);
    if (fresh) li.querySelector<HTMLElement>('input, textarea, select')?.focus();
  };

  const add = button(`Add ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`, `Add ${noun}`, () => {
    addRow(items.type === 'object' ? {} : '', true);
    renumber();
    options.onChange();
  });
  add.classList.add('admin-self-start');
  set.appendChild(add);
  for (const v of values) addRow(v, false);
  renumber();
  return { el: set, read: () => rows.map((r) => r.read()).filter((v) => !empty(v)) };
}

/** What a folded item shows: its number and first two text fields, e.g. "1. Role · Protocol engineer" */
function summaryOf(value: unknown, schema: Schema, i: number): string {
  const v = (value ?? {}) as Value;
  const text = shown(schema)
    .filter(([, s]) => s.type === 'string')
    .map(([k]) => v[k])
    .filter((x): x is string => typeof x === 'string' && x !== '')
    .slice(0, 2)
    .join(' · ');
  return `${i + 1}. ${text ? (countChars(text) > 70 ? `${[...text].slice(0, 70).join('')}…` : text) : 'New'}`;
}

// ---- Checking ----

const bytes = (s: string) => new TextEncoder().encode(s).length;
const isUri = (s: string) => /^[a-z][a-z0-9+.-]*:\S+$/i.test(s);

/** What's wrong with a record's fields, for the lexicon, in words */
export function problems(doc: LexiconDoc, value: Value): string[] {
  const out: string[] = [];
  checkObject(doc, recordSchema(doc), value, '', out);
  return [...new Set(out)];
}

function checkObject(doc: LexiconDoc, schema: Schema, value: Value, where: string, out: string[]) {
  for (const key of schema.required ?? []) {
    const s = schema.properties?.[key];
    if (s?.format === 'datetime') continue; // set by the app
    if (empty(value[key])) out.push(`${where}${labelOf(key)} is required.`);
  }
  for (const [key, raw] of shown(schema)) {
    const v = value[key];
    if (empty(v)) continue;
    check(doc, resolve(doc, raw), v, `${where}${labelOf(key)}`, out);
  }
}

function check(doc: LexiconDoc, schema: Schema, v: unknown, where: string, out: string[]) {
  if (schema.type === 'string') {
    const s = String(v);
    if (schema.maxGraphemes && countChars(s) > schema.maxGraphemes) out.push(`${where} is over ${schema.maxGraphemes} characters.`);
    else if (schema.maxLength && bytes(s) > schema.maxLength) out.push(`${where} is too long.`);
    if (schema.format === 'uri' && !isUri(s)) out.push(`${where} isn’t a full URL, like https://… or mailto:….`);
  } else if (schema.type === 'integer') {
    if (typeof v !== 'number' || !Number.isInteger(v)) out.push(`${where} is a whole number.`);
    else if ((schema.minimum !== undefined && v < schema.minimum) || (schema.maximum !== undefined && v > schema.maximum)) {
      out.push(`${where} is from ${schema.minimum} to ${schema.maximum}.`);
    }
  } else if (schema.type === 'array' && Array.isArray(v)) {
    if (schema.maxLength !== undefined && v.length > schema.maxLength) out.push(`${where} has more than ${schema.maxLength}.`);
    const items = resolve(doc, schema.items);
    for (const [i, item] of v.entries()) check(doc, items, item, `${where} ${i + 1}`, out);
  } else if (schema.type === 'object' && v && typeof v === 'object') {
    checkObject(doc, schema, v as Value, `${where} › `, out);
  }
}
