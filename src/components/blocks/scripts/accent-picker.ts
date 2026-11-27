/**
 * The facts block's colour blocks, which double as an accent picker: the same setting as the
 * sidebar's accent button. Does nothing on a page without them.
 */
const root = document.documentElement;
const swatches = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-accent-choice]'));
const siteAccent = root.dataset.siteAccent || 'blue';
const sync = () => swatches.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accentChoice === (root.dataset.accent || siteAccent))));
swatches.forEach((b) =>
  b.addEventListener('click', () => {
    root.dataset.accent = b.dataset.accentChoice!;
    // The site's own accent means "follow the site" again
    try {
      if (root.dataset.accent === siteAccent) localStorage.removeItem('accent');
      else localStorage.setItem('accent', root.dataset.accent);
    } catch {}
    sync();
  }),
);
if (swatches.length) {
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-accent'] });
  sync();
}
