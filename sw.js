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
// C3: landing/legal pages + the demo track (MP3 only — the 51MB source WAV is a rarely-used
// fallback, not worth the offline storage cost). Best-effort like fonts, not core shell: a
// missing legal page must never break the app itself installing for offline use.
const EXTRA_ASSETS = [
  "index.html",
  "impressum.html",
  "datenschutz.html",
  "assets/demo/Elastic Field - Dust Reel.mp3"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Core shell: fail loudly if any of these 5 are missing — that should be fatal.
      c.addAll(SHELL_ASSETS).then(() =>
        // Fonts + landing/legal pages + demo track: best-effort, so one missing/renamed
        // asset can't take down offline mode for the app itself.
        Promise.allSettled([
          ...FONT_ASSETS.map(url => c.add(url)),
          ...EXTRA_ASSETS.map(url => c.add(url))
        ])
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
