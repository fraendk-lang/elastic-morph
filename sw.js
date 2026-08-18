/* Elastic Morph — service worker (cache-first, offline-ready).
   Only active when the app is served over http(s)/localhost.
   When opened directly via file:// this script is simply ignored. */
const CACHE = "elastic-morph-v113";
const SHELL_ASSETS = [
  "elastic-morph.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "assets/demo/demo.json"
];
const FONT_ASSETS = [
  "assets/fonts/space-grotesk-500.woff2",
  "assets/fonts/space-grotesk-700.woff2",
  "assets/fonts/fraunces-400.woff2",
  "assets/fonts/fraunces-700.woff2",
  "assets/fonts/jetbrains-mono-500.woff2",
  "assets/fonts/jetbrains-mono-700.woff2",
  "assets/fonts/anton-400.woff2",
  "assets/fonts/caveat-500.woff2",
  "assets/fonts/caveat-700.woff2",
  "assets/fonts/bricolage-grotesque-500.woff2",
  "assets/fonts/bricolage-grotesque-800.woff2"
];
// Kept as the single source of truth for what the runtime fetch handler below caches
// network-first — that logic caches per-request regardless of this list's grouping.
const ASSETS = [...SHELL_ASSETS, ...FONT_ASSETS];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Core shell: fail loudly if any of these 5 are missing — that should be fatal.
      c.addAll(SHELL_ASSETS).then(() =>
        // Fonts: install best-effort so one missing/renamed font can't take down offline mode.
        Promise.allSettled(FONT_ASSETS.map(url => c.add(url)))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always load the freshest app when online, fall back to cache offline.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
