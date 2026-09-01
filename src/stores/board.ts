import { create } from "zustand";

import type { WidgetDefinition } from "@/components/widget";
import { useWorkspace } from "@/stores/workspace";
import { WIDGETS } from "@/widgets";

/**
 * El board de cada pestaña: qué widgets tiene y si se está viendo.
 *
 * Vivía partido en dos: el estado en `App` y la puerta para escribirlo en un
 * contexto (`board-context`), que existía sólo para que una pantalla enterrada
 * en el árbol pudiera poner lo suyo sin encadenar props hasta el shell. Con una
 * tienda esa puerta es la tienda, así que el contexto se va entero y `App`
 * deja de sostener algo que no es suyo: el board es de la pestaña, no de la
 * ventana.
 *
 * **Todo va con el id de la pestaña adentro y no con "la activa"**: las que no
 * se miran siguen montadas, y una pantalla escondida que escribiera sobre la
 * activa le pisaría el board a la que sí se está mirando.
 */

/** Lo que una pestaña tiene en el riel. */
export interface BoardState {
  open: boolean;
  widgets: WidgetDefinition[];
}

const SIN_BOARD: BoardState = { open: false, widgets: [] };

/* Qué pantallas vienen con board puesto: una decisión de la app, no del
   componente. El resto empieza sin board y lo abre desde la barra. */
const CON_BOARD = new Set(["chat/analytics"]);

/* El id de una copia es el de su hoja más un sufijo (`chat/search#2`). `raiz` lo
   saca: lo que se pregunta por la hoja —si viene con board— se pregunta con la
   raíz y no con la copia. */
const raiz = (id: string) => id.split("#")[0];

const estrena = (id: string | undefined): BoardState =>
  id && CON_BOARD.has(raiz(id)) ? { open: true, widgets: WIDGETS } : SIN_BOARD;

interface Boards {
  /** Sólo las pestañas que ya se tocaron; la que falta se lee con `estrena`. */
  porPestaña: Record<string, BoardState>;
  /** Reemplaza los widgets de esa pestaña. Reemplaza y no agrega: lo que la
   *  pantalla aporta es lo que corresponde a lo que se está mirando, y cuando
   *  eso cambia lo de antes ya no corresponde.
   *
   *  `open` no se toca acá: poner algo y decidir si se ve son dos cosas
   *  distintas, y mezclarlas haría que actualizar la ficha de un ticket le
   *  vuelva a abrir el riel en la cara a quien lo había cerrado.
   *
   *  La comparación es por identidad del array y no por los ids de adentro:
   *  cuando el ticket cambia de estado los widgets son otros —otro `glance`,
   *  otros datos— pero se siguen llamando igual, así que comparar ids se comía
   *  justamente la actualización que había que hacer. La pantalla los memoriza,
   *  así que la misma lista llega como el mismo array y esto no escribe. */
  mostrarWidgets: (tabId: string, widgets: WidgetDefinition[]) => void;
  /** Abre el board de esa pestaña, si estaba cerrado.
   *
   *  Puerta aparte de `mostrarWidgets` por lo de arriba: esto es lo otro,
   *  alguien pidió ver el board con un clic, y por eso es una llamada suya y no
   *  un efecto secundario.
   *
   *  Sólo abre. No hay `cerrarBoard`: cerrarlo es del que lo está mirando —la ×
   *  del riel, el botón de la barra— y una pantalla que lo cierre sola le saca
   *  de la vista algo que no puso ella. */
  abrirBoard: (tabId: string) => void;
  /** Lo que la barra y el riel hacen con el board que se está mirando: abrirlo,
   *  cerrarlo, sacarle un widget, reordenarlos. */
  editarBoard: (tabId: string, fn: (b: BoardState) => BoardState) => void;
}

export const useBoards = create<Boards>()((set) => ({
  porPestaña: {},

  mostrarWidgets: (tabId, widgets) =>
    set((b) => {
      const previo = b.porPestaña[tabId] ?? estrena(tabId);
      if (previo.widgets === widgets) return b;
      return { porPestaña: { ...b.porPestaña, [tabId]: { ...previo, widgets } } };
    }),

  abrirBoard: (tabId) =>
    set((b) => {
      const previo = b.porPestaña[tabId] ?? estrena(tabId);
      if (previo.open) return b;
      return { porPestaña: { ...b.porPestaña, [tabId]: { ...previo, open: true } } };
    }),

  editarBoard: (tabId, fn) =>
    set((b) => ({
      porPestaña: {
        ...b.porPestaña,
        [tabId]: fn(b.porPestaña[tabId] ?? estrena(tabId)),
      },
    })),
}));

/** El board de la pestaña que se está mirando. El de una que nunca se tocó sale
 *  de `estrena`, así que quien lo lee no tiene que saber que no estaba. */
export function useBoardActivo(): BoardState {
  const activeId = useWorkspace((s) => s.activeId);
  const guardado = useBoards((b) =>
    activeId ? b.porPestaña[activeId] : undefined,
  );
  return guardado ?? estrena(activeId);
}
