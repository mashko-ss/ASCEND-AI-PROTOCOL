/**
 * Service Worker - Iron Protocol
 * Automatic cache-busting and update strategy for fresh deployments on Vercel
 *
 * BUMP SW_VERSION on every deploy to invalidate old caches and force clients to update.
 * Example: '1.0.1' -> '1.0.2' or use build timestamp: Date.now().toString()
 */
const SW_VERSION = '1.0.0';
const CACHE_NAME = `iron-protocol-v${SW_VERSION}`;

function shouldNeverCache(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith('sw.js');
}

// ---------------------------------------------------------------------------
// INSTALL: Force waiting SW to become active immediately
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      self.skipWaiting();
    })
  );
});

// ---------------------------------------------------------------------------
// ACTIVATE: Claim all clients + delete outdated caches
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FETCH: Network First for HTML/CSS/JS, Stale-While-Revalidate for others
// Uses cache: 'reload' to bypass HTTP cache for critical assets
// ---------------------------------------------------------------------------
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
