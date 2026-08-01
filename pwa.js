(function () {
  const APP_VERSION = window.EXCELLENCE_SYSTEM_VERSION || '20260801-46';
  const RELOAD_KEY = 'excellence-system-reloaded-version';
  const CHECK_INTERVAL = 60 * 1000;

  if (!('serviceWorker' in navigator)) return;

  function alreadyReloaded(version) {
    try { return sessionStorage.getItem(RELOAD_KEY) === version; } catch (_) { return false; }
  }

  function markReloaded(version) {
    try { sessionStorage.setItem(RELOAD_KEY, version); } catch (_) {}
  }

  async function clearOldCaches(currentVersion = APP_VERSION) {
    if (!('caches' in window)) return;
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('excellence-system-') && !name.endsWith(currentVersion))
      .map(name => caches.delete(name)));
  }

  function reloadToVersion(version) {
    if (!version || alreadyReloaded(version)) return;
    markReloaded(version);
    const url = new URL(window.location.href);
    url.searchParams.set('v', version);
    url.searchParams.set('updated', Date.now().toString());
    window.location.replace(url.toString());
  }

  async function checkRemoteVersion(registration) {
    try {
      const response = await fetch(`./version.json?v=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) return;
      const data = await response.json();
      const remoteVersion = data && data.version;
      if (!remoteVersion) return;

      if (remoteVersion !== APP_VERSION) {
        await clearOldCaches(remoteVersion);
        await registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        reloadToVersion(remoteVersion);
      }
    } catch (error) {
      console.warn('Verificação de atualização indisponível:', error);
    }
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, {
        scope: './',
        updateViaCache: 'none'
      });

      await clearOldCaches(APP_VERSION);
      await registration.update();

      if (registration.waiting && !alreadyReloaded(APP_VERSION)) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      checkRemoteVersion(registration);
      setInterval(() => checkRemoteVersion(registration), CHECK_INTERVAL);
      window.addEventListener('focus', () => checkRemoteVersion(registration));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkRemoteVersion(registration);
      });
      window.addEventListener('pageshow', () => checkRemoteVersion(registration));
    } catch (error) {
      console.warn('Service Worker não registrado:', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadToVersion(APP_VERSION);
  });
})();