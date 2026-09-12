import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";

import "./index.css";
import App from "./App.tsx";
import { ShapeProvider } from "@/lib/shape-context";
import { SizeProvider } from "@/lib/size-context";
import { SurfaceProvider } from "@/lib/surface-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { iniciarSonido } from "@/stores/sonido";

/*
 * Los cuatro sistemas del registry, cableados una sola vez acá:
 *
 *  motion    — `MotionConfig reducedMotion="user"`, para que la preferencia del
 *              sistema operativo saque los desplazamientos y deje los fundidos.
 *  tamaños   — la escalera de 36px (default) y 28px (compact). Cualquier región
 *              densa se envuelve en su propio `<SizeProvider size="compact">`.
 *  superficies — `SurfaceProvider value={1}` declara el sustrato de la página;
 *              todo lo que se levanta lo hace *relativo* a este número.
 *  figuras   — `ShapeProvider` maneja la escalera de radios.
 *
 * Y uno más, que no es un provider porque no envuelve nada: el sonido. Sus
 * listeners son delegados en el documento, así que se atan una vez acá y
 * alcanzan a todo lo que React monte después. Ver `stores/sonido.ts`.
 */
iniciarSonido();

/* El service worker, sólo en el sitio construido.
 *
 * Es lo que hace que la app se pueda instalar —Chrome no ofrece instalar algo
 * que no sabe abrirse sin red— y lo que la abre sin conexión. Ver `public/sw.js`.
 *
 * En `vite dev` no se registra: el server de desarrollo sirve módulos que se
 * reescriben a cada guardado, y una caché en el medio devuelve el archivo de
 * hace dos ediciones. Y espera a que la página termine de cargar para no pelear
 * ancho de banda con lo que la primera pantalla necesita —pero sin esperar el
 * evento si ya pasó: con el bundle en caché, `load` dispara antes que esto y el
 * worker no se registraba nunca—.
 *
 * El alcance sale de `BASE_URL`, que en GitHub Pages no es la raíz del dominio.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const registrar = () => {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  };
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ShapeProvider defaultShape="rounded">
        <SizeProvider defaultSize="default">
          <SurfaceProvider value={1}>
            <TooltipProvider>
              <App />
            </TooltipProvider>
          </SurfaceProvider>
        </SizeProvider>
      </ShapeProvider>
    </MotionConfig>
  </StrictMode>,
);
