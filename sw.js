/* sw.js — service worker for Mr Pepper.
 *
 * Registered (loopback-guarded) from index.html. THE TWO RULES, both
 * load-bearing on a shared origin (launcher: tools/templates/game-sw.js):
 *   1. Never serve or cache anything outside /mr-pepper/ — the SDK, the
 *      launcher and other games fall through to the network untouched.
 *   2. Never clean up origin-wide: delete only our own mr-pepper-* caches.
 * Bump CACHE_NAME's suffix on every deploy so clients pick up new assets.
 */

const GAME_ID = 'mr-pepper';
const CACHE_NAME = `${GAME_ID}-v1`;
const SCOPE = `/${GAME_ID}/`;

const ASSETS = [
  SCOPE,
  `${SCOPE}index.html`,
  `${SCOPE}style.css`,
  `${SCOPE}main.js`,
  `${SCOPE}core.js`,
  `${SCOPE}render.js`,
  `${SCOPE}input.js`,
  `${SCOPE}audio.js`,
  `${SCOPE}soundpack.js`,
  `${SCOPE}manifest.json`,
  `${SCOPE}icon.svg`,
  `${SCOPE}icon.png`,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((n) => n.startsWith(`${GAME_ID}-`) && n !== CACHE_NAME) // OURS only
        .map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE)) return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
