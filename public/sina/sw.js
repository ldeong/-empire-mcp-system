const CACHE_NAME = 'sina-empire-v1';
const urlsToCache = [
    '/sina/',
    '/sina/index.html',
    '/sina/app.js',
    '/sina/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
