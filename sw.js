/* ============================================================
   LAS LOMAS BETS — sw.js
   Service worker: guarda los archivos de la app en caché para que
   funcione sin señal (muy común en la cancha). Estrategia
   "stale-while-revalidate": siempre responde de inmediato con lo que
   ya está en caché (rápido + funciona sin señal), y de paso pide la
   versión más nueva por internet para dejarla lista para la próxima
   vez. NO cachea nada de localStorage ni de tus datos — eso sigue
   viviendo solo en el teléfono, aparte de esto.

   IMPORTANTE al subir una actualización de código: sube este archivo
   también (junto con el resto del .zip) y sube en 1 el número de
   CACHE_NAME de abajo (v1 -> v2 -> v3...). Así el teléfono sabe que
   hay una versión nueva que descargar; si no lo subes, puede tardar
   en notar el cambio.
   ============================================================ */

const CACHE_NAME = "llb-cache-v8";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./ui.js",
  "./logic.js",
  "./data.js",
  "./manifest.json",
  "./favicon.png",
  "./icon-v2.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Solo interceptamos peticiones a nuestro propio dominio (no las de
  // Google Fonts u otros orígenes externos, que se manejan solas).
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const actualizarEnSegundoPlano = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return response;
        })
        .catch(() => cached); // sin señal: nos quedamos con lo que ya había en caché
      return cached || actualizarEnSegundoPlano;
    })
  );
});
