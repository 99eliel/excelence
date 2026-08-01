const APP_VERSION = '20260801-42';
const CACHE_NAME = `excellence-system-${APP_VERSION}`;

const FILES = [
  './',
  `./index.html?v=${APP_VERSION}`,
  `./styles.css?v=${APP_VERSION}`,
  `./app.js?v=${APP_VERSION}`,
  `./iso-data.js?v=${APP_VERSION}`,
  `./pwa.js?v=${APP_VERSION}`,
  `./firebase-config.js?v=${APP_VERSION}`,
  `./manifest.json?v=${APP_VERSION}`,
  `./version.json?v=${APP_VERSION}`,
  `./logo.png?v=${APP_VERSION}`,
  `./icon-192.png?v=${APP_VERSION}`,
  `./icon-512.png?v=${APP_VERSION}`,
  `./autora-marcia-pedro.jpg?v=${APP_VERSION}`
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .catch(() => null)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocalAsset = url.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';
  const mustBeFresh = isNavigation || /\.(html|js|css|json)$/i.test(url.pathname);

  if (!isLocalAsset) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if (mustBeFresh) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match(`./index.html?v=${APP_VERSION}`)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
