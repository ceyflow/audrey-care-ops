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

/* ---------- Chat notifications (Web Push) ----------
   The chat-push function sends { title, body, thread, tag } to every registered phone/browser of the people in a chat.
   Every push must show a notification (iPhone insists on it); when the app is already open and visible it is shown
   silently and tidied away after a few seconds. Tapping it opens the chat. */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Audrey Care';
  const tag = d.tag || 'chat';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const watching = wins.some(w => w.visibilityState === 'visible');
    const icon = new URL('assets/icons/icon-192.png', self.location).href;
    await self.registration.showNotification(title, {
      body: d.body || '', tag, renotify: true, icon, badge: icon, silent: watching,
      data: { thread: d.thread || null },
    });
    if (watching) {
      await new Promise(r => setTimeout(r, 3500));
      const shown = await self.registration.getNotifications({ tag });
      shown.forEach(n => n.close());
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const thread = event.notification.data && event.notification.data.thread;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); w.postMessage({ type: 'open-chat', thread }); return; }
    }
    const url = new URL('./', self.location);
    if (thread) url.searchParams.set('chat', thread);
    url.hash = 'chat';
    await self.clients.openWindow(url.href);
  })());
});
