/** Small DOM helpers for the admin app */

export const el = <T = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

/** Sets a status line's text and kind (styled by [data-kind] in src/pages/admin/index.astro) */
export function message(id: string, text: string, kind: 'ok' | 'error' | 'info' = 'info') {
  const m = el(id);
  m.textContent = text;
  m.dataset.kind = kind;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function item(text: string, className = '') {
  const li = document.createElement('li');
  if (text) li.textContent = text;
  if (className) li.className = className;
  return li;
}

/** A list row: a link that opens it in the editor, and a note */
export function row(href: string, text: string, note: string) {
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

/** A "view" link that opens the page on the site in a new tab */
export function viewLink(href: string, label: string) {
  const view = document.createElement('a');
  view.href = href;
  view.target = '_blank';
  view.rel = 'noopener';
  view.className = 'admin-muted';
  view.textContent = 'view';
  view.setAttribute('aria-label', label);
  return view;
}

/** Asks the site to refresh its cached pages after a change (src/pages/api/revalidate.ts) */
export const revalidate = () => fetch('/api/revalidate', { method: 'POST' }).then(
  () => undefined,
  () => undefined,
);
