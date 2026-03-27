/**
 * Service Worker - Iron Protocol
 * Automatic cache-busting and update strategy for fresh deployments on Vercel
 *
 * SW_VERSION is generated during build from commit SHA or timestamp.
 */
const SW_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `iron-protocol-v${SW_VERSION}`;

function shouldNeverCache(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith('sw.js');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })()
  );
});

function isHtmlCssJs(request) {
  const dest = request.destination;
  return (
    request.mode === 'navigate' ||
    dest === 'document' ||
    dest === 'script' ||
    dest === 'style'
  );
}

function networkFirst(request) {
  const fetchOpts = { cache: 'reload' };

  return fetch(request, fetchOpts)
    .then((response) => {
      if (
        response &&
        response.status === 200 &&
        response.type === 'basic' &&
        !shouldNeverCache(request)
      ) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((response) => {
      if (
        response &&
        response.status === 200 &&
        response.type === 'basic' &&
        !shouldNeverCache(request)
      ) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
    return cached ?? fetchPromise;
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (shouldNeverCache(event.request)) {
    event.respondWith(fetch(event.request, { cache: 'reload' }));
    return;
  }

  if (isHtmlCssJs(event.request)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
