/* LeetPing service worker: offline app shell, push alarms, notification actions. */
const CACHE = 'leetping-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Network first for pages, fall back to the cached shell offline (SPA routing).
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // Static assets: cache first, then network (and remember it).
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && /\/(_expo|assets|icons)\//.test(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

function showAlarm(a) {
  return self.registration.showNotification(a.title || 'LeetPing', {
    body: a.body || 'Time to solve a LeetCode problem.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: a.tag || undefined,
    renotify: !!a.tag,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400],
    data: { url: a.url || '/' },
    actions: [
      { action: 'solve', title: 'Solve now' },
      { action: 'snooze', title: 'Snooze 10 min' },
    ],
  });
}

// Web Push from the LeetPing server (fires even when the app is closed).
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'LeetPing', body: e.data && e.data.text() };
  }
  e.waitUntil(showAlarm(data));
});

// In-page timers post alarms here so they get action buttons.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'alarm') e.waitUntil(showAlarm(e.data.alarm));
});

self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  n.close();
  const url = (n.data && n.data.url) || '/';
  if (e.action === 'snooze') {
    // Ask the server to push this again in 10 minutes (works with the app closed).
    e.waitUntil(
      self.registration.pushManager
        .getSubscription()
        .then((sub) =>
          fetch('/api/snooze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub, title: n.title, body: n.body, url, minutes: 10 }),
          }),
        )
        .catch(() => null),
    );
    return;
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (url.startsWith('http') && !url.startsWith(self.location.origin)) return self.clients.openWindow(url);
      const win = wins.find((w) => 'focus' in w);
      if (win) return win.focus().then(() => win.navigate && win.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
