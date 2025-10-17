// Minimal service worker for PWA lifecycle
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Optional basic cache disabled to avoid stale assets during development
// const CACHE = 'app-cache-v1';
// const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
// self.addEventListener('install', (e) => {
//   e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
// });
// self.addEventListener('fetch', (e) => {
//   e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
// });


