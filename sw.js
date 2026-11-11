/* Audrey Care Ops: service worker.

   What it is for: (1) it makes the app installable on a phone/desktop (browsers want a real service worker with a
   fetch handler), and (2) it lets the page itself open when the connection is flaky or briefly down.

   What it deliberately does NOT do:
   - It never touches any other website (Supabase data and login, CDN scripts, fonts, map tiles). Those requests go
     straight to the network exactly as if this file did not exist, so business data is never cached here and a stale
     copy of it can never be shown.
   - It never serves an old copy while the network works: every request for one of this site's own files goes to the
     network first (a genuine round-trip, skipping the browser's HTTP cache), so a new deploy is picked up at once.
     The cached copy is used only when the network request fails.

   The file must be served from the site root (not a blob: address, which browsers refuse for service workers). */
const CACHE = 'audrey-care-shell-v3';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// One cache entry per file (query string ignored), so the cache stays small however many ?v=/?_= variants are requested.
function cacheKeyFor(url) { return new Request(url.origin + url.pathname); }

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                         // saves and logins are never ours
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Supabase, CDNs, fonts, map tiles: not ours
  if (url.pathname.endsWith('/sw.js')) return;
  if (req.cache === 'no-store' || url.searchParams.has('_')) return; // the page's own "is there a newer version?" check
  if (req.headers.has('range')) return;                     // partial downloads (media) are not cacheable

  event.respondWith((async () => {
    const key = cacheKeyFor(url);
    try {
      const res = await fetch(req, { cache: 'reload' });    // genuine network round-trip, never a stale HTTP-cache copy
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}));
      }
      return res;
    } catch (err) {
      const hit = await caches.match(key);
      if (hit) return hit;
      if (req.mode === 'navigate') {                          // opening the app (or a bookmarked page) while offline
        const shell = (await caches.match(cacheKeyFor(new URL('./', self.location)))) ||
                      (await caches.match(cacheKeyFor(new URL('./index.html', self.location))));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
