// ACI LOG service worker: app shell available offline, always fresh when online.
const CACHE = "aci-log-v6";
const OCR_CACHE = "aci-ocr-v1"; // photo reader (tesseract.js): kept across app updates, it never changes for a given version
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The app must open in flight and on captive Wi-Fi, where the network can hang instead of failing.
// App files: served at once from the phone (cache first), then refreshed in the background for next time;
// the page itself checks for a newer version and reloads when one is online.
// Requests with a query string (data.json?t=…, the version check ./?v=…) and API calls go to the network.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Photo reader (tesseract.js, its engine and English data, all versioned on jsDelivr): cache-first, so reading a
    // recap photo works in flight once it has been loaded once with internet.
    if (url.hostname === "cdn.jsdelivr.net" && /tesseract/.test(url.pathname)) {
      e.respondWith(caches.open(OCR_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      }));
      return;
    }
    // Google Fonts: cache-first so text renders offline. API calls go straight to the network.
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      }));
    }
    return;
  }
  if (url.search || url.pathname.includes("/api/")) return;
  const nav = req.mode === "navigate";
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true }) || (nav && (await c.match("./index.html") || await c.match("./")));
    const net = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res.ok && res.type === "basic") c.put(req, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    // nothing on the phone yet: network, but never wait forever
    return Promise.race([net, new Promise((_, ko) => setTimeout(() => ko(new Error("timeout")), 15000))])
      .catch(async () => (await c.match("./index.html")) || Response.error());
  })());
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
