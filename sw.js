/**
 * Service Worker - Iron Protocol
 * Cache-busting strategy for fresh deployments on Vercel
 *
 * Bump SW_VERSION on every deploy to invalidate old caches.
 */
const SW_VERSION = '1.0.0';
const CACHE_NAME = `iron-protocol-v${SW_VERSION}`;

// ---------------------------------------------------------------------------
// INSTALL: Skip waiting so new SW activates immediately on deploy
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// ACTIVATE: Claim clients + delete all caches that don't match current version
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
    ])
  );
});

// ---------------------------------------------------------------------------
// FETCH: Network First for HTML/CSS/JS, Stale-While-Revalidate for other assets
// ---------------------------------------------------------------------------
function isHtmlCssJs(request) {
  const url = new URL(request.url);
  const dest = request.destination;
  return (
    request.mode === 'navigate' ||
    dest === 'document' ||
    dest === 'script' ||
    dest === 'style'
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
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
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
    return cached || fetchPromise;
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isHtmlCssJs(event.request)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
