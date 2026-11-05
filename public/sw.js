// ============================================================
// SayurLogi Service Worker — PWA offline support + caching.
// ============================================================
// Strategies:
//   - API (/api/*): networkFirst — always fresh, offline fallback.
//   - Static assets (images, fonts, /_next/static/*): staleWhileRevalidate
//     — fast load, background revalidation. Static assets don't change
//     often (hashed filenames), so stale is safe.
//   - Navigation requests (page loads): networkFirst — always fetch
//     fresh HTML when online. This is CRITICAL because page content
//     (top bar, hero, promo, etc.) is admin-editable. With SWR, admin
//     would need to reload TWICE to see their changes. networkFirst
//     ensures changes appear on the first reload, with offline fallback.
// ============================================================

const CACHE_VERSION = "v31";
const STATIC_CACHE = `sayurlogi-static-${CACHE_VERSION}`;
const PAGE_CACHE = `sayurlogi-page-${CACHE_VERSION}`;
const API_CACHE = `sayurlogi-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/manifest.json",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/products/")
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (page loads) — networkFirst so admin-editable
  // content (top bar, hero, promo, etc.) always reflects the latest
  // DB state on reload. Falls back to cached page only when offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ success: false, message: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
