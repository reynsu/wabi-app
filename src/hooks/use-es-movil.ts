import { useEffect, useState } from "react";

/* Si la pantalla es de un teléfono.

   El corte es el mismo que usa el sidebar —768px, su `mobileBreakpoint`— y no
   uno nuevo: dos ideas de "mobile" en la misma app terminan siendo dos, y el
   día que una pantalla cambie de forma con una y no con la otra el arreglo va
   a estar en el archivo que nadie está mirando.

   Se pregunta acá y no con una clase `md:` porque lo que cambia no es sólo
   cómo se ve: en el teléfono el reproductor de audio es **otro componente**,
   con otros controles, y su onda la pinta un `canvas` al que ninguna hoja de
   estilos llega. Pintar los dos y esconder uno sería montar dos wavesurfer por
   nota para tirar uno.

   Arranca en `false` —la rama de escritorio— y la corrige un efecto: es lo
   mismo que hace el sidebar, y lo que hace que el servidor y el primer pintado
   del cliente digan lo mismo. */
const CORTE = 768;

export function useEsMovil() {
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${CORTE - 1}px)`);
    const mirar = () => setEsMovil(mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
  }, []);

  return esMovil;
}
