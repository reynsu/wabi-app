/* El service worker: lo que convierte a la app en instalable y en algo que
   abre sin red.
 *
 * Hecho a mano y sin plugin de build a propósito. Un `vite-plugin-pwa` precachea
 * la lista exacta de archivos del build, que es mejor para una app con backend y
 * datos que cambian; acá el bundle **es** la app —los datos son fixtures que
 * viajan adentro— y lo único que hace falta es guardar lo que se pidió una vez.
 * Sesenta líneas que se leen enteras contra una dependencia que hay que
 * configurar, versionar y entender el día que algo sirva viejo.
 *
 * Dos reglas, y la diferencia entre las dos es lo que evita quedarse servido con
 * una versión vieja para siempre:
 *
 *  - **El documento, primero la red.** Es lo único con un nombre estable
 *    (`index.html`), así que si se sirve de caché sin preguntar, un deploy nuevo
 *    no llega nunca. Sin red, se contesta con la copia guardada, que es lo que
 *    hace que la app abra en un subte.
 *  - **Lo demás, primero la caché.** Los assets del build llevan el hash en el
 *    nombre: si el nombre coincide, el contenido es el mismo, y pedirlo de nuevo
 *    es gastar batería. Lo que no esté guardado se busca y se guarda.
 *
 * Al activarse se borra toda caché que no sea la de esta versión: subir `VERSION`
 * es la manera de tirar lo viejo.
 */

const VERSION = "v1";
const CACHE = `wabi-${VERSION}`;

/* El documento con el que abre la app, resuelto contra el alcance del worker:
   en GitHub Pages la app no vive en la raíz del dominio. */
const DOCUMENTO = new URL("./index.html", self.registration.scope).pathname;

self.addEventListener("install", (e) => {
  // Guardar el documento de entrada ya: es lo que hace falta para que el primer
  // arranque sin red no muestre el dinosaurio.
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(DOCUMENTO)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(DOCUMENTO, copia));
          return res;
        })
        .catch(() => caches.match(DOCUMENTO).then((r) => r ?? Response.error())),
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(
      (guardada) =>
        guardada ??
        fetch(request).then((res) => {
          /* Sólo lo que salió bien y del mismo origen: una respuesta opaca o un
             404 guardado se sirve para siempre. */
          if (res.ok && res.type === "basic") {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
          }
          return res;
        }),
    ),
  );
});
