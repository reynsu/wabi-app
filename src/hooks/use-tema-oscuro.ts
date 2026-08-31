import { useSyncExternalStore } from "react";

/* Si el tema oscuro está puesto, como dato reactivo.

   Casi nada de la app necesita preguntarlo: lo contesta el CSS, con las
   variantes `dark:` y los tokens que cambian solos. Lo necesita lo que pinta
   sobre un `canvas` —hoy la onda de una nota de voz—, porque ahí no llega
   ninguna hoja de estilos: al dibujante hay que pasarle un color escrito, y
   cuando el tema cambia hay que pasarle otro.

   Quién manda: la clase `.dark` en el `<html>`, que es lo que `App` prende y
   apaga. Se la mira en vez de compartir el `useState` de allá para que esto
   siga funcionando si mañana el tema lo pone el sistema, una preferencia
   guardada o la ventana flotante —lo que cambia es quién escribe la clase, y
   la clase es la misma—.

   Un solo observador para toda la app: se registra con el primer componente
   que pregunta y se va con el último. Uno por reproductor serían ocho
   observadores mirando el mismo atributo. */

let observador: MutationObserver | null = null;
const avisar = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  avisar.add(alCambiar);

  if (!observador) {
    observador = new MutationObserver(() => {
      for (const avisado of avisar) avisado();
    });
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return () => {
    avisar.delete(alCambiar);
    if (avisar.size === 0) {
      observador?.disconnect();
      observador = null;
    }
  };
}

const leer = () => document.documentElement.classList.contains("dark");

/* En el servidor no hay `<html>` que mirar, así que el tema es el claro. Es lo
   mismo con lo que arranca la app antes de que nadie toque el interruptor. */
const leerEnElServidor = () => false;

export const useTemaOscuro = () =>
  useSyncExternalStore(suscribir, leer, leerEnElServidor);
