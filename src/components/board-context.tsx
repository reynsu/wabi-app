"use client";

/**
 * BoardProvider — cómo una pantalla pone algo en el board de su pestaña.
 *
 * El board vive en el shell y no en las pantallas, y está bien que así sea: es
 * un lugar de la ventana, no de lo que se está mirando. Pero hay contenido que
 * sólo la pantalla conoce —el ticket que está abierto ahora mismo— y que
 * pertenece al board y no al cuerpo: la ficha de estado, la historia de lo que
 * le fue pasando. Sin una puerta, eso obliga a elegir entre meterlo al medio
 * del contenido o no tenerlo.
 *
 * La puerta es una sola función y va con el id de la pestaña adentro, no con
 * "la pestaña activa": todas las pestañas siguen montadas cuando no se las
 * mira —así conservan lo suyo—, y una pantalla escondida que escribiera sobre
 * "la activa" le pisaría el board a la que sí se está mirando.
 *
 * Es el mismo movimiento que hizo `WorkspaceProvider` con las pestañas:
 * levantar al shell lo que el shell ya tenía, y dejar que cualquiera lo pida
 * sin encadenar props hasta ahí.
 */

import { createContext, useContext, type ReactNode } from "react";

import type { WidgetDefinition } from "@/components/widget";

interface BoardContextValue {
  /** Reemplaza los widgets de esa pestaña. Reemplaza y no agrega: lo que la
   *  pantalla aporta es lo que corresponde a lo que se está mirando, y cuando
   *  eso cambia lo de antes ya no corresponde. */
  mostrarWidgets: (tabId: string, widgets: WidgetDefinition[]) => void;
  /** Abre el board de esa pestaña, si estaba cerrado.
   *
   *  Puerta aparte de `mostrarWidgets` a propósito: poner algo y decidir si se
   *  ve son dos cosas distintas. Una pantalla actualiza sus widgets todo el
   *  tiempo mientras se la usa —cambiar de ticket cambia la ficha—, y si eso
   *  además abriera el riel se lo estaría reabriendo en la cara a quien lo
   *  cerró. Esto es lo otro: alguien pidió ver el board, con un clic, y por eso
   *  es una llamada suya y no un efecto secundario.
   *
   *  Sólo abre. No hay `cerrarBoard`: cerrarlo es del que lo está mirando —la
   *  × del riel, el botón de la barra— y una pantalla que lo cierre sola le
   *  saca de la vista algo que no puso ella. */
  abrirBoard: (tabId: string) => void;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  value,
  children,
}: {
  value: BoardContextValue;
  children: ReactNode;
}) {
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/** Null-safe: una pantalla tiene que poder renderizarse fuera del shell —en un
 *  test, en un prototipo— sin que esto la tire abajo. */
// oxlint-disable-next-line react/only-export-components
export function useBoardMaybe() {
  return useContext(BoardContext);
}
