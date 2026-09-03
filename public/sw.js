const CACHE_NAME = 'rv-fisiologia-pwa-v6'

const CORE_ASSETS = [
  '/',
  '/manifest-rv-app.webmanifest',
  '/logo-rv-app.png',
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

async function networkFirst(request, fallbackKey, noStore = false) {
  try {
    const response = await fetch(
      request,
      noStore ? { cache: 'no-store' } : undefined,
    )

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

async function reloadOpenWindows() {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  await Promise.allSettled(
    windows.map((client) => {
      if (!('navigate' in client)) return Promise.resolve()

      const url = new URL(client.url)
      url.searchParams.set('rv_sw', String(Date.now()))

      return client.navigate(url.toString())
    }),
  )
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
    (async () => {
      const keys = await caches.keys()

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('rv-fisiologia-pwa-') &&
              key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      )

      await self.clients.claim()
      await reloadOpenWindows()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data?.json() || {}
  } catch {
    payload = {
      title: 'RV App',
      body: event.data?.text() || 'Você tem uma nova notificação.',
    }
  }

  const title = payload.title || 'RV App'

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Você tem uma nova notificação.',
      icon: payload.icon || '/icons/icon-rvapp-192.png',
      badge: payload.badge || '/icons/icon-rvapp-192.png',
      tag: payload.tag || 'rv-admin-notification',
      data: payload.data || { url: '/' },
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = new URL(
    event.notification.data?.url || '/',
    self.location.origin,
  ).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windows) {
        if (!('focus' in client)) continue

        if ('navigate' in client) {
          await client.navigate(target)
        }

        await client.focus()
        return
      }

      await self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/', true))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
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

  event.respondWith(networkFirst(request))
})
