// ACI LOG service worker: app shell available offline, always fresh when online.
const CACHE = "aci-log-v4";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Google Fonts: cache-first so text renders offline. API calls go straight to the network.
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        c.put(req, res.clone());
        return res;
      }));
    }
    return;
  }
  // App files: network first, revalidated with the server every time (GitHub Pages lets browsers keep
  // pages 10 min otherwise, so a new version could wait), cache as fallback offline.
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});

// Flight reminders (Web Push, see netlify/functions/push.mjs).
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "ACI LOG", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ACI LOG", {
    body: d.body || "", tag: d.tag || undefined, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", data: { url: "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
