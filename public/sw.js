const CACHE_PREFIX = 'jeu-de-cochons-';
const CACHE_VERSION =
  new URL(self.location.href).searchParams.get('version') ?? 'dev';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL_URLS = Object.freeze([
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]);
const PWA_METADATA_PATHS = new Set([
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]);
const STATIC_ASSET_DESTINATIONS = new Set([
  'font',
  'image',
  'manifest',
  'script',
  'style',
]);

function isHttpRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function normalizeSameOriginPath(url) {
  return `${url.pathname}${url.search}`;
}

async function discoverBuildAssets() {
  const response = await fetch('/index.html', { cache: 'no-store' });

  if (!response.ok) {
    throw new TypeError(`Impossible de precacher index.html: HTTP ${response.status}`);
  }

  const html = await response.text();
  const matches = html.matchAll(
    /(?:src|href)="(\/assets\/[^"]+\.(?:css|js))"/giu,
  );
  return [...matches].map((match) => match[1]);
}

async function preCacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const buildAssetUrls = await discoverBuildAssets().catch((error) => {
    console.warn('[sw] Assets Vite non precaches:', error);
    return [];
  });
  const urls = [...new Set([...APP_SHELL_URLS, ...buildAssetUrls])];

  await cache.addAll(urls);
}

async function deleteOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function openRuntimeCache() {
  try {
    return await caches.open(CACHE_NAME);
  } catch (error) {
    console.warn('[sw] CacheStorage indisponible:', error);
    return undefined;
  }
}

async function matchRuntimeCache(input) {
  const cache = await openRuntimeCache();

  if (cache === undefined) {
    return undefined;
  }

  try {
    return await cache.match(input);
  } catch (error) {
    console.warn('[sw] Lecture du cache impossible:', error);
    return undefined;
  }
}

async function matchAnyCache(request) {
  try {
    return await caches.match(request);
  } catch (error) {
    console.warn('[sw] Recherche dans les caches impossible:', error);
    return undefined;
  }
}

async function storeRuntimeResponse(request, response) {
  if (!response.ok) {
    return;
  }

  const cache = await openRuntimeCache();

  if (cache === undefined) {
    return;
  }

  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[sw] Ecriture du cache ignoree:', error);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    await storeRuntimeResponse(request, response);

    return response;
  } catch (error) {
    const cachedResponse = await matchRuntimeCache(request);

    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    const cachedHome = await matchRuntimeCache('/index.html');

    if (cachedHome !== undefined) {
      return cachedHome;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await matchAnyCache(request);

  if (cachedResponse !== undefined) {
    return cachedResponse;
  }

  const response = await fetch(request);

  await storeRuntimeResponse(request, response);

  return response;
}

function shouldUseCacheFirst(request) {
  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      STATIC_ASSET_DESTINATIONS.has(request.destination))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(preCacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !isHttpRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  const path = normalizeSameOriginPath(url);

  if (request.mode === 'navigate' || path === '/' || path === '/index.html') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && PWA_METADATA_PATHS.has(path)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (shouldUseCacheFirst(request)) {
    event.respondWith(cacheFirst(request));
  }
});
