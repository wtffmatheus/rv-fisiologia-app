const CACHE_NAME = 'rv-fisiologia-pwa-v3'

const CORE_ASSETS = [
  '/',
  '/manifest-rv-app.webmanifest',
  '/logo-rv-app.png',
  '/icons/favicon-rv-v2.png',
  '/icons/icon-rvapp-192.png',
  '/icons/icon-rvapp-512.png',
  '/icons/maskable-rvapp-512.png',
  '/icons/apple-touch-icon-rvapp.png',
]

function canCache(response) {
  return Boolean(response && response.ok && response.type === 'basic')
}

async function putInCache(cacheKey, response) {
  if (!canCache(response)) return response

  const cache = await caches.open(CACHE_NAME)
  await cache.put(cacheKey, response.clone())
  return response
}

async function networkFirst(request, fallbackKey) {
  try {
    const response = await fetch(request)

    if (canCache(response)) {
      await putInCache(fallbackKey || request, response)
    }

    return response
  } catch {
    const cached = await caches.match(fallbackKey || request)
    if (cached) return cached

    if (fallbackKey !== '/') {
      const shell = await caches.match('/')
      if (shell) return shell
    }

    throw new Error('offline')
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  return putInCache(request, response)
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)

  const networkPromise = fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() => null)

  return cached || networkPromise
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          CORE_ASSETS.map((asset) =>
            cache.add(new Request(asset, { cache: 'reload' })),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('rv-fisiologia-pwa-') &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Supabase, R2 e qualquer serviço externo nunca entram no cache do PWA.
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    // Assets do Vite têm hash no nome: podem ficar em cache com segurança.
    event.respondWith(cacheFirst(request))
    return
  }

  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo-rv-app.png' ||
    url.pathname === '/manifest-rv-app.webmanifest' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Demais arquivos locais: rede primeiro, cache como fallback.
  event.respondWith(networkFirst(request))
})
