// Shared shell for the v4 mockups: top bar (phone), sidebar, mockup control panel.
// Inserted right after this <script> tag, so it renders before the page content.
(function () {
  const P = {
    github: '<path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>',
    bluesky: '<path fill="currentColor" d="M5.2 3.3C7.9 5.3 10.8 9.4 12 11.7c1.2-2.3 4.1-6.4 6.8-8.4 1.9-1.4 5.1-2.6 5.1 1 0 .7-.4 6.1-.7 7-.9 3.1-4.1 3.9-7 3.4 5 .9 6.3 3.7 3.5 6.5-5.2 5.4-7.5-1.3-8-3.1L12 18l-.4-.2c-.6 1.8-2.8 8.5-8 3.1-2.8-2.8-1.5-5.6 3.5-6.5-2.9.5-6.1-.3-7-3.4C.4 10.4 0 5 0 4.3c0-3.6 3.2-2.4 5.2-1Z"/>',
    rss: '<path fill="currentColor" d="M4 4.5a1 1 0 0 1 1-1C14.1 3.5 20.5 9.9 20.5 19a1 1 0 1 1-2 0c0-8-5.5-13.5-13.5-13.5a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1 9.5 9.5 0 0 1 9.5 9.5 1 1 0 1 1-2 0A7.5 7.5 0 0 0 5 11.5a1 1 0 0 1-1-1ZM6 20.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
    sun: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>',
    moon: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
    search: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>',
    menu: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>',
    palette: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
    copy: '<g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></g>',
  };
  const icon = (n, s = 18, cls = '') => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" class="${cls}" aria-hidden="true">${P[n]}</svg>`;
  window.mockIcon = icon;

  const page = document.documentElement.dataset.page;
  const active = page === 'post' ? 'writing' : '';
  const links = [
    ['writing', 'post.html'],
    ['about', '#'],
    ['work', '#'],
    ['flying', '#', 'v4.1'],
    ['uses', '#'],
  ];
  const nav = links
    .map(([label, href, soon]) => `<li><a href="${href}"${label === active ? ' aria-current="page"' : ''}><span class="caret" aria-hidden="true">&gt; </span>${label}${soon ? `<span class="soon">${soon}</span>` : ''}</a></li>`)
    .join('');

  document.currentScript.insertAdjacentHTML(
    'afterend',
    `<div class="topbar">
      <a href="index.html" class="home"><span>skiddle@web ~</span><span class="cursor-blink" aria-hidden="true"></span></a>
      <div style="display:flex;gap:4px">
        <a href="#" class="icon-btn" aria-label="Search">${icon('search')}</a>
        <button class="icon-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">${icon('menu', 20)}</button>
      </div>
    </div>
    <nav class="sidebar" id="sidebar" aria-label="Main">
      <a href="index.html" class="home"><span>skiddle@web ~</span><span class="cursor-blink" aria-hidden="true"></span></a>
      <ul class="nav" data-note="CHANGED · 6 items → 5">${nav}</ul>
      <a href="#" class="side-search"><span class="caret" aria-hidden="true" style="opacity:0">&gt; </span>search<kbd>⌘K</kbd></a>
      <div class="side-foot">
        <button class="icon-btn" id="themeBtn" aria-label="Toggle theme">${icon('sun', 18, 'icon-sun')}${icon('moon', 18, 'icon-moon')}</button>
        <button class="icon-btn accent-btn" id="accentBtn" aria-label="Change accent colour">${icon('palette', 16)}</button>
        <a class="icon-btn" href="#" aria-label="GitHub">${icon('github')}</a>
        <a class="icon-btn" href="#" aria-label="Bluesky">${icon('bluesky')}</a>
        <a class="icon-btn" href="#" aria-label="RSS feed">${icon('rss')}</a>
      </div>
    </nav>
    <div class="backdrop" id="backdrop"></div>`,
  );
})();
