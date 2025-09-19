self.addEventListener('install', event => {
  event.waitUntil(caches.open('sina-cache').then(cache => {
    return cache.addAll(['/sina/interface', '/sina/pwa-manifest.json']);
  }));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
