const STATIC_CACHE = 'chess-trainer-static-v1';
const RUNTIME_CACHE = 'chess-trainer-runtime-v1';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isRuntimeAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/pieces/')
    || url.pathname.startsWith('/fonts/')
    || url.pathname.startsWith('/puzzles/')
    || url.pathname.startsWith('/stockfish')
    || /\.(?:js|css|png|svg|webp|json|wasm|ttf|otf)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put('/index.html', networkResponse.clone());
        return networkResponse;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  if (!isRuntimeAsset(request)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
        })
        .catch(() => {});
      return cached;
    }

    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      return Response.error();
    }
  })());
});
