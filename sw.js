const APP_VERSION = '20260805-60';
const CACHE_NAME = `excellence-system-${APP_VERSION}`;

const CORE_FILES = [
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
  `./autora-marcia-pedro.jpg?v=${APP_VERSION}`,
  `./material-link-patch.js?v=${APP_VERSION}`,
  `./ecosystem-v44-patch.js?v=${APP_VERSION}`,
  `./diario-bordo-patch.js?v=${APP_VERSION}`,
  `./diario-report-patch.js?v=${APP_VERSION}`,
  `./agenda-fast-patch.js?v=${APP_VERSION}`,
  `./agenda-mini-calendar-patch.js?v=${APP_VERSION}`,
  `./agenda-day-click-patch.js?v=${APP_VERSION}`,
  `./agenda-click-hard-patch.js?v=${APP_VERSION}`,
  `./agenda-layout-stable-patch.js?v=${APP_VERSION}`,
  `./apontamento-producao-patch.js?v=${APP_VERSION}`,
  `./cliente-upload-patch.js?v=${APP_VERSION}`
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .catch(() => null)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key.startsWith('excellence-system-') && key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isFreshAsset(url, request) {
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|json)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  if (!isLocal) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (isFreshAsset(url, event.request)) {
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
      const network = fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});