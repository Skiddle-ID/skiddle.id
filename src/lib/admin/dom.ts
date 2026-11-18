/** Small DOM helpers for the admin app */

export const el = <T = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

/** Sets a status line's text and kind (styled by [data-kind] in src/pages/admin/index.astro) */
export function message(id: string, text: string, kind: 'ok' | 'error' | 'info' = 'info') {
  const m = el(id);
  m.textContent = text;
  m.dataset.kind = kind;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Sets an editor's save state (the line by its back button) and its kind, so it's styled the same
 * in every editor (by [data-state] in src/pages/admin/index.astro):
 *   - unsaved: "Unsaved changes", "Not saved yet", "Changes kept on this device"
 *   - busy: anything still going on ("Saving…", "Writing the post…")
 *   - saved: "Saved 18 Nov, 12:03", "Saved and live …", "Loaded the version saved …", "Published …"
 *   - error: "Not saved", "Not saved: changed elsewhere", "Not deleted …", "Not finished"
 */
export function saveState(id: string, text: string) {
  const s = el(id);
  s.textContent = text;
  s.dataset.state = !text
    ? ''
    : text.endsWith('…')
      ? 'busy'
      : /^(Saved|Loaded|Published)/.test(text)
        ? 'saved'
        : /^(Unsaved|Not saved yet|Changes kept)/.test(text)
          ? 'unsaved'
          : /^Not (saved|deleted|finished)/.test(text)
            ? 'error'
            : 'info';
}

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
