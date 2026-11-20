// Service Worker: macht die App installierbar und startet sie auch bei schwachem Netz.
// Aufgaben-Daten werden NICHT hier zwischengespeichert – die kommen immer live aus Supabase.
const CACHE = "hd-aufgaben-v1";
const SHELL = ["./", "./index.html", "./app.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/emblem.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];
const CDN = "https://cdn.jsdelivr.net/";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !req.url.startsWith(CDN)) return; // Supabase & Co. immer direkt
  // Erst Netz (damit Updates sofort ankommen), sonst Zwischenspeicher
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
