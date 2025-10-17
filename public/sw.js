// Minimal service worker for PWA lifecycle
// Bump the cache name when deploying to force clients to fetch new assets
const CACHE_NAME = 'buget-cache-v2';
const ASSETS = [
	'/',
	'/index.html',
	'/manifest.webmanifest',
	'/icon-192.png',
	'/icon-512.png',
	'/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
	self.skipWaiting();
	e.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
	);
});

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
			)
		).then(() => self.clients.claim())
	);
});

// Allow the page to trigger skipWaiting (useful to update immediately after deploy)
self.addEventListener('message', (e) => {
  try{
    if (e && e.data && e.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  }catch(err){/* ignore */}
});

self.addEventListener('fetch', (e) => {
	// Only handle GET requests
	if (e.request.method !== 'GET') return;

	const url = new URL(e.request.url);

	// For navigation requests, try network first then fallback to cache/index.html
	if (e.request.mode === 'navigate') {
		e.respondWith(
			fetch(e.request).then((res) => {
				// update cache in background
				const copy = res.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
				return res;
			}).catch(() => caches.match('/index.html'))
		);
		return;
	}

	// For other requests, respond from cache first then network
	e.respondWith(
		caches.match(e.request).then((cached) =>
			cached || fetch(e.request).then((res) => {
				// put a copy in cache for future
				if (res && res.status === 200 && res.type === 'basic') {
					const resCopy = res.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resCopy));
				}
				return res;
			}).catch(() => {
				// Optional: return a fallback image for image requests
				if (e.request.destination === 'image') {
					return caches.match('/icon-192.png');
				}
			})
		)
	);
});


