/**
 * The admin app's lists as tables (Posts, Series, Pages, Timeline): a row per item, a search box, and
 * filters with their counts (All, Drafts, Scheduled…). The first column links to the item's editor.
 * On a phone a row stacks its cells, and the column headings go. The filter and the search stay as
 * they were while the app is open, and the table draws again when its rows change.
 */
export interface Column<T> {
  label: string;
  /** The cell: text, or an element (a link, a badge) */
  cell: (row: T) => string | Node;
  /** Shown smaller and muted, and on a phone under the first cell */
  secondary?: boolean;
}

export interface Filter<T> {
  label: string;
  test: (row: T) => boolean;
}

export interface Table<T> {
  /** The element the table goes in, emptied each time */
  host: HTMLElement;
  /** What it's a table of, for the search box's label: "posts" */
  noun: string;
  columns: Column<T>[];
  /** All comes first by itself */
  filters?: Filter<T>[];
  /** The text the search box matches */
  text: (row: T) => string;
  /** What it says when no row matches */
  empty: string;
}

interface State {
  filter: number;
  query: string;
}
const states = new WeakMap<HTMLElement, State>();

/** Draws the table for these rows */
export function renderTable<T>(t: Table<T>, rows: T[]) {
  const state = states.get(t.host) ?? { filter: 0, query: '' };
  states.set(t.host, state);
  const filters: Filter<T>[] = [{ label: 'All', test: () => true }, ...(t.filters ?? [])];
  if (state.filter >= filters.length) state.filter = 0;

  const tools = document.createElement('div');
  tools.className = 'admin-table-tools';
  if (filters.length > 1) {
    const group = document.createElement('div');
    group.className = 'admin-filters';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', `Show ${t.noun}`);
    filters.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'admin-filter';
      b.setAttribute('aria-pressed', String(i === state.filter));
      const n = rows.filter(f.test).length;
      b.textContent = `${f.label} ${n}`;
      b.addEventListener('click', () => {
        state.filter = i;
        renderTable(t, rows);
      });
      group.appendChild(b);
    });
    tools.appendChild(group);
  }
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'admin-search';
  search.placeholder = 'Search';
  search.setAttribute('aria-label', `Search ${t.noun}`);
  search.value = state.query;
  tools.appendChild(search);

  const table = document.createElement('table');
  table.className = 'admin-table';
  const head = table.createTHead().insertRow();
  for (const c of t.columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = c.label;
    head.appendChild(th);
  }
  const body = table.createTBody();
  const status = document.createElement('p');
  status.className = 'admin-small';
  status.setAttribute('role', 'status');

  const fill = () => {
    const q = state.query.trim().toLowerCase();
    const shown = rows.filter((r) => filters[state.filter].test(r) && (!q || t.text(r).toLowerCase().includes(q)));
    body.replaceChildren(
      ...shown.map((r) => {
        const tr = document.createElement('tr');
        for (const c of t.columns) {
          const td = document.createElement('td');
          if (c.secondary) td.className = 'admin-cell-secondary';
          const v = c.cell(r);
          if (typeof v === 'string') td.textContent = v;
          else td.appendChild(v);
          tr.appendChild(td);
        }
        return tr;
      }),
    );
    table.hidden = shown.length === 0;
    status.textContent = shown.length ? '' : rows.length ? 'Nothing matches.' : t.empty;
    status.hidden = !status.textContent;
  };
  search.addEventListener('input', () => {
    state.query = search.value;
    fill();
  });
  fill();
  t.host.replaceChildren(tools, table, status);
}

/** A cell's link to an item's editor */
export function cellLink(href: string, text: string) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'admin-pages-name';
  a.textContent = text;
  return a;
}

/** A small label in a cell: draft, live, upcoming… */
export function badge(text: string, kind: 'ok' | 'warn' | 'muted' = 'muted') {
  const b = document.createElement('span');
  b.className = 'admin-badge';
  b.dataset.kind = kind;
  b.textContent = text;
  return b;
}

/** A cell holding several things in a row (a link and a "view" link) */
export function cellRow(...parts: (Node | string)[]) {
  const span = document.createElement('span');
  span.className = 'admin-cell-row';
  for (const p of parts) span.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
  return span;
}
