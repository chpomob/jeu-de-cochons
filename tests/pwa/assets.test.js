import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const TEST_ORIGIN = 'https://cochons.test';
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function readProjectFile(path) {
  return readFileSync(resolve(PROJECT_ROOT, path));
}

function readJson(path) {
  return JSON.parse(readProjectFile(path).toString('utf8'));
}

function readPngDimensions(path) {
  const png = readProjectFile(path);

  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new TypeError(`${path} n est pas un PNG valide.`);
  }

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

function normalizeCacheKey(input) {
  const url = typeof input === 'string' ? input : input.url;

  return new URL(url, TEST_ORIGIN).href;
}

function createMockCacheStorage(fetchMock, options = {}) {
  const stores = new Map();

  function createCache() {
    const entries = new Map();

    return {
      async addAll(urls) {
        await Promise.all(
          urls.map(async (url) => {
            const response = await fetchMock(url);

            if (!response.ok) {
              throw new TypeError(`Echec du precache: ${url}`);
            }

            entries.set(normalizeCacheKey(url), response.clone());
          }),
        );
      },
      has(input) {
        return entries.has(normalizeCacheKey(input));
      },
      async match(input) {
        const response = entries.get(normalizeCacheKey(input));

        return response?.clone();
      },
      async put(input, response) {
        if (options.rejectPut === true) {
          throw new TypeError('CacheStorage put refuse');
        }

        entries.set(normalizeCacheKey(input), response.clone());
      },
    };
  }

  return {
    async delete(cacheName) {
      return stores.delete(cacheName);
    },
    async keys() {
      return [...stores.keys()];
    },
    async match(input) {
      if (options.rejectMatch === true) {
        throw new TypeError('CacheStorage match refuse');
      }

      for (const cache of stores.values()) {
        const response = await cache.match(input);

        if (response !== undefined) {
          return response;
        }
      }

      return undefined;
    },
    async open(cacheName) {
      if (options.rejectOpen === true) {
        throw new TypeError('CacheStorage open refuse');
      }

      if (!stores.has(cacheName)) {
        stores.set(cacheName, createCache());
      }

      return stores.get(cacheName);
    },
  };
}

function createWorkerRequest(path, overrides = {}) {
  return {
    destination: '',
    method: 'GET',
    mode: 'same-origin',
    url: new URL(path, TEST_ORIGIN).href,
    ...overrides,
  };
}

function createDefaultFetchResponse(input) {
  const path = new URL(typeof input === 'string' ? input : input.url, TEST_ORIGIN)
    .pathname;

  if (path === '/index.html') {
    return new Response(
      '<script type="module" src="/assets/main.abc123.js"></script>' +
        '<link rel="stylesheet" href="/assets/main.def456.css">',
    );
  }

  return new Response(`response:${path}`);
}

function createServiceWorkerHarness(options = {}) {
  const listeners = new Map();
  const fetchMock = vi.fn(async (input) => createDefaultFetchResponse(input));
  const caches = createMockCacheStorage(fetchMock, options.cacheStorage);
  const consoleMock = {
    error: vi.fn(),
    warn: vi.fn(),
  };
  const selfMock = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    clients: {
      claim: vi.fn(() => Promise.resolve()),
    },
    location: new URL(`${TEST_ORIGIN}/sw.js?version=0.1.0`),
    skipWaiting: vi.fn(() => Promise.resolve()),
  };

  vm.runInNewContext(
    readProjectFile('public/sw.js').toString('utf8'),
    {
      caches,
      console: consoleMock,
      fetch: fetchMock,
      Promise,
      Request,
      Response,
      self: selfMock,
      Set,
      TypeError,
      URL,
    },
    { filename: 'public/sw.js' },
  );

  return {
    caches,
    consoleMock,
    async dispatchFetch(request) {
      let responsePromise;

      listeners.get('fetch')({
        request,
        respondWith(promise) {
          responsePromise = Promise.resolve(promise);
        },
      });

      return responsePromise;
    },
    async dispatchLifecycle(type) {
      const promises = [];

      listeners.get(type)({
        waitUntil(promise) {
          promises.push(Promise.resolve(promise));
        },
      });

      await Promise.all(promises);
    },
    fetchMock,
    selfMock,
  };
}

describe('PWA assets', () => {
  it('declare un manifest installable', () => {
    const manifest = readJson('public/manifest.json');

    expect(manifest).toMatchObject({
      name: 'Jeu de Cochons',
      short_name: 'Cochons',
      start_url: '/',
      display: 'standalone',
      background_color: '#FFF8F0',
      theme_color: '#E87878',
    });
    expect(manifest.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]);
  });

  it('fournit des icones PNG aux dimensions attendues', () => {
    expect(readPngDimensions('public/icons/icon-192.png')).toEqual({
      width: 192,
      height: 192,
    });
    expect(readPngDimensions('public/icons/icon-512.png')).toEqual({
      width: 512,
      height: 512,
    });
  });

  it('deploie une CSP sans script inline', () => {
    const netlifyConfig = readProjectFile('netlify.toml').toString('utf8');

    expect(netlifyConfig).toContain('Content-Security-Policy');
    expect(netlifyConfig).toMatch(/script-src 'self'/u);
    expect(netlifyConfig).not.toContain('unsafe-inline');
  });

  it('precache les routes critiques et les assets de build a l installation', async () => {
    const { caches, dispatchLifecycle, selfMock } = createServiceWorkerHarness();

    await dispatchLifecycle('install');

    const cache = await caches.open('jeu-de-cochons-0.1.0');

    expect(cache.has('/')).toBe(true);
    expect(cache.has('/index.html')).toBe(true);
    expect(cache.has('/manifest.json')).toBe(true);
    expect(cache.has('/icons/icon-192.png')).toBe(true);
    expect(cache.has('/icons/icon-512.png')).toBe(true);
    expect(cache.has('/assets/main.abc123.js')).toBe(true);
    expect(cache.has('/assets/main.def456.css')).toBe(true);
    expect(selfMock.skipWaiting).toHaveBeenCalledOnce();
  });

  it('supprime seulement les caches possedes par l application a l activation', async () => {
    const { caches, dispatchLifecycle, selfMock } = createServiceWorkerHarness();

    await caches.open('jeu-de-cochons-0.1.0');
    await caches.open('jeu-de-cochons-old');
    await caches.open('jeu-de-cochonsville-cache');
    await caches.open('other-app-cache');

    await dispatchLifecycle('activate');

    expect(await caches.keys()).toEqual([
      'jeu-de-cochons-0.1.0',
      'jeu-de-cochonsville-cache',
      'other-app-cache',
    ]);
    expect(selfMock.clients.claim).toHaveBeenCalledOnce();
  });

  it('sert index.html en secours pour une navigation hors ligne', async () => {
    const { dispatchFetch, dispatchLifecycle, fetchMock } =
      createServiceWorkerHarness();

    await dispatchLifecycle('install');
    fetchMock.mockRejectedValue(new TypeError('hors ligne'));

    const response = await dispatchFetch(
      createWorkerRequest('/partie', {
        destination: 'document',
        mode: 'navigate',
      }),
    );

    await expect(response.text()).resolves.toContain('/assets/main.abc123.js');
  });

  it('met en cache les assets statiques apres le premier acces', async () => {
    const { dispatchFetch, fetchMock } = createServiceWorkerHarness();
    const request = createWorkerRequest('/assets/main.abc123.js', {
      destination: 'script',
    });

    fetchMock
      .mockResolvedValueOnce(new Response('asset-v1'))
      .mockResolvedValueOnce(new Response('asset-v2'));

    const firstResponse = await dispatchFetch(request);
    const secondResponse = await dispatchFetch(request);

    await expect(firstResponse.text()).resolves.toBe('asset-v1');
    await expect(secondResponse.text()).resolves.toBe('asset-v1');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['/manifest.json', 'manifest', 'ancien manifest', 'manifest frais'],
    ['/icons/icon-192.png', 'image', 'ancienne icone', 'icone fraiche'],
  ])(
    'revalide %s au lieu de le servir en cache-first',
    async (path, destination, oldBody, freshBody) => {
      const { caches, dispatchFetch, fetchMock } = createServiceWorkerHarness();
      const cache = await caches.open('jeu-de-cochons-0.1.0');

      await cache.put(path, new Response(oldBody));
      fetchMock.mockResolvedValueOnce(new Response(freshBody));

      const response = await dispatchFetch(
        createWorkerRequest(path, {
          destination,
        }),
      );
      const cachedResponse = await cache.match(path);

      await expect(response.text()).resolves.toBe(freshBody);
      await expect(cachedResponse.text()).resolves.toBe(freshBody);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it('sert la reponse reseau network-first meme si CacheStorage refuse open', async () => {
    const { dispatchFetch, fetchMock } = createServiceWorkerHarness({
      cacheStorage: { rejectOpen: true },
    });

    fetchMock.mockResolvedValueOnce(new Response('manifest en ligne'));

    const response = await dispatchFetch(
      createWorkerRequest('/manifest.json', {
        destination: 'manifest',
      }),
    );

    await expect(response.text()).resolves.toBe('manifest en ligne');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sert la reponse reseau cache-first meme si CacheStorage refuse match et put', async () => {
    const { dispatchFetch, fetchMock } = createServiceWorkerHarness({
      cacheStorage: { rejectMatch: true, rejectPut: true },
    });
    const request = createWorkerRequest('/assets/main.abc123.js', {
      destination: 'script',
    });

    fetchMock.mockResolvedValueOnce(new Response('asset en ligne'));

    const response = await dispatchFetch(request);

    await expect(response.text()).resolves.toBe('asset en ligne');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
