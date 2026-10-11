// SchoolMitra Production Service Worker (PWA Spec 3.2 - Privacy Hardened)
const CACHE_VERSION = "schoolmitra-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const isDevHost =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "[::1]";

// If running on localhost / development, immediately self-unregister and skip caching
if (isDevHost) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  });
}

// Strictly restricted precache assets: NO authenticated pages or student data
const PRECACHE_ASSETS = [
  "/offline",
  "/icon.svg",
  "/manifest.json",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  if (isDevHost) return;
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (isDevHost) return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Clear all runtime and authenticated caches on sign-out or handle skip-waiting
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_AUTH_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  } else if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  // In development environments (localhost), do not intercept ANY requests
  if (isDevHost) {
    return;
  }

  const url = new URL(event.request.url);

  // 1. Exclude third-party APIs (Razorpay, S3 external endpoints)
  if (url.origin !== self.location.origin || url.hostname.includes("razorpay")) {
    return;
  }

  // 2. /api/* pass-through: NEVER cache ERP API endpoints
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. Static immutable assets (_next/static/*): Cache-First with robust network fallback
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok && response.status === 200) {
              const contentType = response.headers.get("content-type") || "";
              if (!contentType.includes("text/html")) {
                const clone = response.clone();
                caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
              }
            }
            return response;
          })
          .catch(() => {
            return cached || new Response("Asset fetch failed", { status: 408 });
          });
      })
    );
    return;
  }

  // 4. Document / Page navigations: Network-only with /offline fallback.
  // CRITICAL PRIVACY RULE: NEVER cache authenticated HTML document navigations.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const offlinePage = await caches.match("/offline");
        return (
          offlinePage ||
          new Response("Offline - Please connect to the internet", {
            status: 503,
            headers: { "Content-Type": "text/html" },
          })
        );
      })
    );
    return;
  }
});
