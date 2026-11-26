// EscriptPay service worker.
// Keeps it simple and safe for a payments app:
//   - /api/* and anything that isn't a GET always go to the network (never cached)
//   - page loads go to the network first; on a slow connection (no answer in
//     3.5s) the copy saved last time is shown, and offline shows /offline
//   - Next.js build files (/_next/static, hashed and immutable) are cached
// Web push (OneSignal): its worker code runs inside this service worker so
// there is only one. If OneSignal can't load (offline install), the rest of
// the worker still works; push just starts on a later update.
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch {
  // ignore
}

const VERSION = "escriptpay-v2";
const PAGES = "escriptpay-pages-v2";
const SLOW_MS = 3500;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Payment return pages always come fresh from the network.
    if (url.pathname.startsWith("/payment")) {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }
    const key = url.origin + url.pathname; // ignore ?query for the saved copy
    const network = fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(PAGES).then((cache) => cache.put(key, copy));
      }
      return response;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      new Promise((resolve) => {
        let done = false;
        const finish = (response) => {
          if (!done && response) {
            done = true;
            resolve(response);
          }
        };
        // Slow connection: show last time's page if we have it; the fresh
        // one is saved for next time.
        const timer = setTimeout(() => caches.match(key).then(finish), SLOW_MS);
        network
          .then((response) => {
            clearTimeout(timer);
            finish(response);
          })
          .catch(() => {
            clearTimeout(timer);
            caches
              .match(key)
              .then((hit) => hit || caches.match(OFFLINE_URL))
              .then((response) => finish(response || Response.error()));
          });
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
