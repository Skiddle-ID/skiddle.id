// v4 mockup behaviour: control panel, sidebar drawer, theme/accent buttons, ToC highlight.
(function () {
  const root = document.documentElement;
  const save = (k, v) => { try { localStorage.setItem('v4mock.' + k, v); } catch (e) {} };
  const page = root.dataset.page;

  // Control panel
  const opt = (key, val, label) => `<button type="button" data-set="${key}" data-val="${val}">${label}</button>`;
  document.body.insertAdjacentHTML(
    'beforeend',
    `<details class="mock" id="mock" open>
      <summary><span class="mock-tag">v4 mockup</span><span class="mock-hint">controls</span></summary>
      <div class="mock-body">
        <div class="mock-row"><span>home design</span>${[['home', 'index.html', 'A terminal'], ['editorial', 'editorial.html', 'B editorial'], ['tmux', 'tmux.html', 'C tmux'], ['bento', 'bento.html', 'D bento']].map(([p, href, label]) => `<a href="${href}"${page === p ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div>
        <div class="mock-row"><span>page</span><a href="post.html"${page === 'post' ? ' aria-current="page"' : ''}>post (A)</a><a href="designs.html">compare all</a></div>
        <div class="mock-row"><span>theme</span>${opt('theme', 'dark', 'dark')}${opt('theme', 'light', 'light')}</div>
        <div class="mock-row"><span>reading font</span>${opt('body', 'sans', 'sans (v4)')}${opt('body', 'mono', 'mono (v3)')}</div>
        <div class="mock-row" data-only="home"><span>hero</span>${opt('hero', 'you', 'you')}${opt('hero', 'consulting', 'consulting')}</div>
        <div class="mock-row"><span>notes</span>${opt('notes', 'on', 'on')}${opt('notes', 'off', 'off')}</div>
      </div>
    </details>`,
  );
  const mock = document.getElementById('mock');
  if (matchMedia('(max-width: 639px)').matches) mock.open = false;

  const sync = () => {
    for (const b of mock.querySelectorAll('[data-set]')) {
      b.setAttribute('aria-pressed', String(root.dataset[b.dataset.set] === b.dataset.val));
    }
  };
  mock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    root.dataset[b.dataset.set] = b.dataset.val;
    save(b.dataset.set, b.dataset.val);
    sync();
  });
  sync();

  // Sidebar theme and accent buttons
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    save('theme', root.dataset.theme);
    sync();
  });
  const ACCENTS = ['blue', 'teal', 'purple', 'pink', 'green'];
  document.getElementById('accentBtn')?.addEventListener('click', () => {
    root.dataset.accent = ACCENTS[(ACCENTS.indexOf(root.dataset.accent || 'blue') + 1) % ACCENTS.length];
  });

  // Phone drawer
  const btn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn?.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop?.addEventListener('click', () => setOpen(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // "On this page": highlight the section being read
  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (heads.length) {
    const update = () => {
      let cur = null;
      for (const h of heads) if (h.getBoundingClientRect().top <= innerHeight * 0.25) cur = h.id;
      for (const a of links) a.classList.toggle('on', a.getAttribute('href') === '#' + cur);
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }
})();
