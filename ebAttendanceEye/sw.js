const CACHE_NAME = 'edu-bot-attendance-v1';
const APP_SHELL = [
    './',
    './index.html',
    './app.html',
    './manifest.json',
    './pwa.js',
    './style.css',
    './app.js',
    './icon.png',
    './icon-192.png',
    './icon-512.png',
    './bootstrap/css/bootstrap.css',
    './bootstrap/js/bootstrap.js',
    './js/db.js',
    './js/camera.js',
    './js/face.js',
    './js/attendance.js',
    './js/thingspeak.js',
    './js/ui.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName.startsWith('edu-bot-attendance-') && cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

function cacheResponse(event, request, response) {
    if (!response.ok) return;

    const cacheUpdate = caches.open(CACHE_NAME)
        .then((cache) => cache.put(request, response.clone()))
        .catch((error) => console.error('Failed to update the app cache:', error));
    event.waitUntil(cacheUpdate);
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    cacheResponse(event, request, response);
                    return response;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    if (cachedPage) return cachedPage;

                    const fallbackPage = requestUrl.pathname.endsWith('/app.html') ? './app.html' : './index.html';
                    const fallback = await caches.match(fallbackPage);
                    if (fallback) return fallback;

                    return new Response('This page is unavailable offline.', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(request).then((response) => {
                cacheResponse(event, request, response);
                return response;
            });
        })
    );
});