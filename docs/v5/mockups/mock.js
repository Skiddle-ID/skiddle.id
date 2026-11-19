// Mockup only (not part of the site's budget): the yellow v5 panel with every page, theme,
// accent, a text-spacing test (WCAG 1.4.12), and the notes for the page you're on.
(() => {
  const d = document.documentElement;
  const PAGES = [
    ['index', 'Overview'],
    ['home', 'Home'],
    ['writing', 'Writing'],
    ['post', 'Post'],
    ['series', 'Series'],
    ['series-flight', 'One series'],
    ['topics', 'Topics'],
    ['notes', 'Notes'],
    ['work', 'Work'],
    ['services', 'Services'],
    ['projects', 'Projects'],
    ['cv', 'CV'],
    ['flying', 'Flying'],
    ['about', 'About'],
    ['now', 'Now'],
    ['listening', 'Listening'],
    ['uses', 'Uses'],
    ['changelog', 'Changelog'],
    ['404', '404'],
  ];
  const here = d.dataset.page;
  const notes = document.getElementById('notes');
  const store = (k, v) => {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch {}
  };
  const el = document.createElement('details');
  el.className = 'mock';
  el.innerHTML = `
    <summary>v5 mockup</summary>
    <div class="mock-body">
      <nav aria-label="Mockup pages"><ul class="mock-pages">${PAGES.map(([p, l]) => `<li><a href="${p}.html"${p === here ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
      <fieldset><legend>Theme</legend>
        <button type="button" data-set="theme" value="">Device</button><button type="button" data-set="theme" value="dark">Dark</button><button type="button" data-set="theme" value="light">Light</button>
      </fieldset>
      <fieldset><legend>Accent</legend>
        ${['blue', 'teal', 'purple', 'pink', 'green', 'magenta'].map((a) => `<button type="button" data-set="accent" value="${a === 'blue' ? '' : a}">${a}</button>`).join('')}
      </fieldset>
      <fieldset><legend>Checks</legend>
        <button type="button" data-toggle="spacing" aria-pressed="false">Text spacing</button>
      </fieldset>
      ${notes ? `<div class="mock-notes"><p class="mock-h">Notes for this page</p>${notes.innerHTML}</div>` : ''}
    </div>`;
  document.body.append(el);
  const sync = () => {
    for (const b of el.querySelectorAll('[data-set]')) {
      const k = b.dataset.set;
      b.setAttribute('aria-pressed', String((d.dataset[k] ?? '') === b.value));
    }
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.set) {
      const k = b.dataset.set;
      if (b.value) d.dataset[k] = b.value;
      else delete d.dataset[k];
      store(`v5.${k}`, b.value);
      sync();
    }
    if (b.dataset.toggle === 'spacing') {
      const on = d.classList.toggle('mock-spacing');
      b.setAttribute('aria-pressed', String(on));
    }
  });
  sync();
})();
