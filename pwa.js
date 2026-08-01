(function () {
  const APP_VERSION = window.EXCELLENCE_SYSTEM_VERSION || '20260801-41';
  const RELOAD_KEY = 'excellence-system-reloaded-version';
  const VERSION_CHECK_INTERVAL = 10 * 60 * 1000;

  if (!('serviceWorker' in navigator)) return;

  function alreadyReloaded(version) {
    try {
      return sessionStorage.getItem(RELOAD_KEY) === version;
    } catch (error) {
      return false;
    }
  }

  function markReloaded(version) {
    try {
      sessionStorage.setItem(RELOAD_KEY, version);
    } catch (error) {
      // Sem armazenamento de sessão, apenas evita quebrar a inicialização.
    }
  }

  async function clearOldCaches() {
    if (!('caches' in window)) return;
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('excellence-system-') && !name.endsWith(APP_VERSION))
        .map(name => caches.delete(name))
    );
  }

  function reloadOnce(version) {
    if (alreadyReloaded(version)) return;
    markReloaded(version);
    window.location.replace(`./index.html?v=${encodeURIComponent(version)}`);
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, {
        scope: './',
        updateViaCache: 'none'
      });

      await clearOldCaches();
      registration.update();

      if (registration.waiting && !alreadyReloaded(APP_VERSION)) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller && !alreadyReloaded(APP_VERSION)) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      async function checkRemoteVersion() {
        try {
          const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
          if (!response.ok) return;

          const data = await response.json();
          const remoteVersion = data && data.version;

          if (remoteVersion && remoteVersion !== APP_VERSION && !alreadyReloaded(remoteVersion)) {
            await clearOldCaches();
            await registration.update();
            reloadOnce(remoteVersion);
          }
        } catch (error) {
          console.warn('Verificação de versão indisponível:', error);
        }
      }

      checkRemoteVersion();
      setInterval(checkRemoteVersion, VERSION_CHECK_INTERVAL);
    } catch (error) {
      console.warn('Service Worker não registrado:', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadOnce(APP_VERSION);
  });
})();
