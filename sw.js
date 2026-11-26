// Service Worker: macht die App installierbar und startet sie auch bei schwachem Netz.
// Aufgaben-Daten werden NICHT hier zwischengespeichert – die kommen immer live aus Supabase.
const CACHE = "hd-portal-v15";
const SHELL = ["./", "./index.html", "./app.js", "./preise.js", "./labor.js", "./beratung.js", "./kalender.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/emblem.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./img/logo.png", "./img/logo-weiss.png"];
const CDN = ["https://cdn.jsdelivr.net/", "https://unpkg.com/", "https://cdnjs.cloudflare.com/"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
  if (!same && !CDN.some(c => req.url.startsWith(c))) return; // Supabase & Co. immer direkt
  // Erst Netz (damit Updates sofort ankommen), sonst Zwischenspeicher
  e.respondWith(
    // same-origin: am Browser-Zwischenspeicher vorbei (GitHub Pages cacht sonst bis zu 10 Min.)
    fetch(same ? new Request(req, { cache: "no-store" }) : req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
