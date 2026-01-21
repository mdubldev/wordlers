const CACHE_NAME = 'word-league-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/parser.js',
  '/js/storage.js',
  '/js/api.js',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Handle share target (POST from iOS/Android share sheet)
  if (event.request.url.includes('/share') && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const text = formData.get('text') || '';
        return Response.redirect('/?share=' + encodeURIComponent(text), 303);
      })()
    );
    return;
  }

  // Handle share target (GET fallback for older browsers)
  if (event.request.url.includes('/share') && event.request.method === 'GET') {
    event.respondWith(
      Response.redirect('/?share=' + encodeURIComponent(new URL(event.request.url).searchParams.get('text') || ''), 303)
    );
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Convex API requests
  if (event.request.url.includes('convex.cloud')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // Return cached, but also update cache in background
          event.waitUntil(
            fetch(event.request)
              .then((response) => {
                if (response.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(event.request, response));
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        return fetch(event.request)
          .then((response) => {
            if (response.ok && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
      })
  );
});
