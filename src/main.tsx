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
