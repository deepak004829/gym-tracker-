const CACHE_NAME = "gym-log-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./firebase-config.js",
  "./manifest.json",
  "./app.js",
  "./store.js",
  "./date.js",
  "./dom.js",
  "./auth.js",
  "./sync.js",
  "./nav.js",
  "./toast.js",
  "./sheet.js",
  "./icons.js",
  "./confetti.js",
  "./log-sheet.js",
  "./detail-sheet.js",
  "./plan-sheet.js",
  "./settings-sheet.js",
  "./auth-gate.js",
  "./home.js",
  "./progress.js",
  "./gamification.js",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./splash-1170x2532.png",
  "./splash-1284x2778.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((error) => {
        // Never let one bad asset stop the whole app from getting a working
        // service worker — log it and move on instead of failing install.
        console.warn("Service worker precache had an issue:", error);
      })
  );
  // Do NOT call self.skipWaiting() here — we want the waiting SW to stay
  // waiting until the user explicitly taps "Update". The app posts a
  // SKIP_WAITING message (via registerServiceWorker) when they do.
});

// The app sends this message when the user taps the update button.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Stale-while-revalidate: answer instantly from cache when we have it (fast,
// works offline), and refresh the cache in the background so the next load
// picks up whatever changed. Falls back to index.html for offline navigations
// that were never cached.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        networkFetch; // update the cache in the background, don't block on it
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      if (event.request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    })()
  );
});
