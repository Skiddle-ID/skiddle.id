// skiddle.id v5: the only script every page loads (about 2 KB gzipped). Everything works without
// it; it adds the clock, the theme switch, search, the testimonial buttons and the post's checklist.
(() => {
  const d = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = (k, v) => {
    try {
      if (v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // ── Clock: Bangkok and UTC ("Zulu"), once a minute ──
  const fmt = (tz) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
  const bkk = fmt('Asia/Bangkok');
  const utc = fmt('UTC');
  const tick = () => {
    const now = new Date();
    for (const t of $$('[data-clock]')) {
      t.textContent = (t.dataset.clock === 'utc' ? utc : bkk).format(now);
      t.dateTime = now.toISOString();
    }
  };
  tick();
  setTimeout(() => (tick(), setInterval(tick, 60_000)), (60 - new Date().getSeconds()) * 1000);

  // ── Theme: follows the device until someone picks one ──
  const dark = () => (d.dataset.theme ? d.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches);
  const label = () => {
    for (const b of $$('[data-theme-toggle]')) b.setAttribute('aria-label', dark() ? 'Switch to light theme' : 'Switch to dark theme');
  };
  for (const b of $$('[data-theme-toggle]')) {
    b.addEventListener('click', () => {
      d.dataset.theme = dark() ? 'light' : 'dark';
      store('v5.theme', d.dataset.theme);
      label();
    });
  }
  label();

  // ── Search: Ctrl K or ⌘K (by platform), or the button ──
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform);
  for (const k of $$('[data-shortcut]')) k.textContent = mac ? '⌘K' : 'Ctrl K';
  const dialog = $('dialog.cmd');
  const input = $('#cmd-q');
  const items = $$('.cmd-list li');
  const count = $('#cmd-count');
  const open = () => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    input.select();
  };
  for (const b of $$('[data-search-open]')) b.addEventListener('click', open);
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'k' && (mac ? e.metaKey : e.ctrlKey) && !e.altKey) {
      e.preventDefault();
      open();
    }
  });
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let n = 0;
    for (const li of items) {
      const hit = !q || li.textContent.toLowerCase().includes(q);
      li.hidden = !hit;
      n += hit;
    }
    count.textContent = `${n} ${n === 1 ? 'result' : 'results'}`;
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const first = items.find((li) => !li.hidden)?.querySelector('a');
      if (first) {
        e.preventDefault();
        if (e.key === 'Enter') first.click();
        else first.focus();
      }
    }
  });
  dialog?.addEventListener('click', (e) => e.target === dialog && dialog.close());

  // ── Slides: previous, next, and a pause button when it moves by itself ──
  for (const root of $$('[data-slides]')) {
    const track = $('.slides-track', root);
    const slides = $$('.slide', track);
    const ctl = $('.slides-ctl', root);
    const out = $('output', root);
    const pause = $('[data-pause]', root);
    if (!track || slides.length < 2 || !ctl) continue;
    ctl.hidden = false;
    let i = 0;
    const step = () => slides[1].offsetLeft - slides[0].offsetLeft;
    const show = () => (out.textContent = `${i + 1} / ${slides.length}`);
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      track.scrollTo({ left: i * step(), behavior: reduce.matches ? 'auto' : 'smooth' });
      show();
    };
    $('[data-prev]', root).addEventListener('click', () => (stop(), go(i - 1)));
    $('[data-next]', root).addEventListener('click', () => (stop(), go(i + 1)));
    let timer;
    let settle;
    track.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => ((i = Math.round(track.scrollLeft / step())), show()), 120);
    });
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
      if (pause) {
        pause.setAttribute('aria-pressed', 'true');
        pause.querySelector('span').textContent = 'Play';
      }
    };
    const play = () => {
      timer = setInterval(() => !root.matches(':hover, :focus-within') && !document.hidden && go(i + 1), 7000);
      pause?.setAttribute('aria-pressed', 'false');
      if (pause) pause.querySelector('span').textContent = 'Pause';
    };
    pause?.addEventListener('click', () => (timer ? stop() : play()));
    if (root.dataset.slides === 'auto' && !reduce.matches) play();
    else if (pause) stop();
    show();
  }

  // ── The post's checklist: ticks off the sections you've scrolled past ──
  const lists = $$('.checklist').map((nav) => $$('a[href^="#"]', nav));
  const heads = (lists[0] ?? []).map((a) => document.getElementById(a.hash.slice(1)));
  if (heads.length && heads.every(Boolean)) {
    const update = () => {
      let current = -1;
      heads.forEach((h, n) => h.getBoundingClientRect().top < innerHeight * 0.3 && (current = n));
      for (const links of lists) {
        links.forEach((a, n) => {
          a.classList.toggle('is-read', n < current);
          if (n === current) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }
    };
    let raf;
    addEventListener('scroll', () => raf || (raf = requestAnimationFrame(() => ((raf = 0), update()))), { passive: true });
    update();
  }
})();
