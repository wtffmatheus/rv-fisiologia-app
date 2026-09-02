const CACHE_NAME = 'rv-fisiologia-pwa-v2'

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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('rv-fisiologia-pwa-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Supabase/R2/serviços externos continuam sempre pela rede.
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
