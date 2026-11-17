/** Small DOM helpers for the admin app */

export const el = <T = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

/** Sets a status line's text and kind (styled by [data-kind] in src/pages/admin/index.astro) */
export function message(id: string, text: string, kind: 'ok' | 'error' | 'info' = 'info') {
  const m = el(id);
  m.textContent = text;
  m.dataset.kind = kind;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
