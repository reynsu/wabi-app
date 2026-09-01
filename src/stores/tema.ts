import { create } from "zustand";

/**
 * Claro u oscuro.
 *
 * Lo pregunta gente muy distinta: el botón de la barra, la ventana flotante que
 * copia la clase del `<html>`, el `Toaster` de Sileo, y —la que obligó a que
 * esto exista— la onda de una nota de voz, que se pinta en un `canvas` donde
 * ninguna hoja de estilos llega y hay que pasarle un color escrito.
 *
 * Antes eran dos fuentes: un `useState` en `App` para lo que pintaba React, y
 * un `MutationObserver` sobre la clase del `<html>` para lo que pintaba a mano.
 * Dos maneras de saber lo mismo, y la segunda existía sólo porque la primera no
 * llegaba hasta allá. Con una tienda hay una sola, y la clase del `<html>` pasa
 * a ser lo que siempre debió ser: **la salida**, no la fuente.
 */

interface Tema {
  oscuro: boolean;
  alternar: () => void;
}

/* La clase la escribe la tienda y nadie más. Es lo que hace que preguntar por
   el tema y verlo aplicado no puedan contradecirse. */
const aplicar = (oscuro: boolean) => {
  document.documentElement.classList.toggle("dark", oscuro);
  return oscuro;
};

export const useTema = create<Tema>()((set) => ({
  oscuro: false,
  alternar: () => set((t) => ({ oscuro: aplicar(!t.oscuro) })),
}));

/** Si el tema oscuro está puesto. Lo usa lo que pinta a mano —hoy, la onda de
 *  una nota de voz—: ahí no llega el CSS, así que hay que preguntarlo. */
export const useTemaOscuro = () => useTema((t) => t.oscuro);

/** El tema de este instante, para el que no está pintando. */
export const temaDeAhora = () => useTema.getState().oscuro;
