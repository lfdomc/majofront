/* Service worker de la caja (POS): guarda la aplicación para que abra y cobre sin internet.
   - Páginas: primero la red; si no hay, la copia guardada.
   - Archivos de la app (/assets/…, íconos, letras): copia guardada; si no está, la red.
   - Las llamadas al servidor (API) no se tocan: las ventas sin internet las guarda la propia app. */
const CACHE = "caja-v1";
const BASE = ["/pos", "/manifest-pos.webmanifest", "/pos-icono-192.png", "/pos-icono-512.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(BASE).catch(() => {});
    // guardar también los archivos que carga la página (JavaScript y estilos con nombre único)
    try {
      const html = await (await fetch("/pos", { cache: "no-store" })).text();
      const archivos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll(archivos);
    } catch { /* se guardarán al usarse */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mismoSitio = url.origin === self.location.origin;
  const letras = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);

  if (req.mode === "navigate" && mismoSitio) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (url.pathname.startsWith("/pos") && r.ok) (await caches.open(CACHE)).put("/pos", r.clone());
        return r;
      } catch {
        return (await caches.match("/pos")) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }
  if ((mismoSitio && (url.pathname.startsWith("/assets/") || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname))) || letras) {
    e.respondWith((async () => {
      const guardada = await caches.match(req);
      if (guardada) return guardada;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === "opaque") (await caches.open(CACHE)).put(req, r.clone());
        return r;
      } catch {
        return Response.error();
      }
    })());
  }
});
