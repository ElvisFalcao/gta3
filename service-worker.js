const CACHE = 'mother-city-shell-v4';
const FILES = ['./', './index.html', './main.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const ENGINE = ['https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(cache => Promise.all(ENGINE.map(url => cache.add(url).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mother-city-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const engineRequest = ENGINE.includes(url.href.split('?')[0]);
  if (request.method !== 'GET' || (url.origin !== self.location.origin && !engineRequest)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('./index.html', copy)); return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const fresh = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || fresh;
  }));
});

