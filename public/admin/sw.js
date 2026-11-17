// Service worker for the admin app (/admin/), so it opens like an app once installed.
// Network first, always: online you get the newest version. Offline, it falls back to the
// copy from the last visit (the app then says it can't reach your PDS). Only this site's own
// admin page and its /_astro/ files are cached; sign-in and PDS requests go straight out.
const CACHE = 'admin-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!(url.pathname.startsWith('/admin/') || url.pathname.startsWith('/_astro/'))) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || Response.error())),
  );
});
