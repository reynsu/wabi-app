import { create } from "zustand";

import type { WorkspaceTab } from "@/components/workspace-panel";

/**
 * Las pestañas del panel, en una tienda.
 *
 * Estaban en un contexto, y el contexto era lo correcto salvo por una cosa: las
 * pestañas se abren desde cualquier lado —una fila de una tabla, un nombre, una
 * baldosa del board, el pie de un vistazo— y todos esos lugares están adentro
 * del árbol, así que hasta acá el contexto alcanzaba. Lo que no alcanzaba es lo
 * de afuera: `WorkspacePanel` no sabe nada de esto y no tiene por qué, pero un
 * `openTab` desde un handler que no es de React —o desde una tienda de dominio,
 * el día que una acción tenga que abrir algo— no tenía cómo llegar.
 *
 * Con una tienda, leer es `useWorkspace(selector)` y escribir es
 * `useWorkspace.getState().openTab(...)`, esté uno pintando o no. Y desaparece
 * el proveedor: no hay un `WorkspaceProvider` que envolver ni un orden de
 * montaje que respetar.
 *
 * `WorkspacePanel` sigue sin saber nada: recibe sus pestañas por props y
 * funciona solo, con tienda o sin ella. Lo que se fue es quién se las pasa.
 */

interface Workspace {
  tabs: WorkspaceTab[];
  activeId: string | undefined;
  /** Cuándo se miró por última vez cada pestaña abierta, en ms.
   *
   *  En escritorio no hace falta —la barra muestra todo lo abierto en el orden
   *  en que se abrió, y ese orden es el que se busca con la vista—. En el
   *  teléfono no hay barra: lo abierto se ve en Inicio, y ahí el orden útil es
   *  el de la última vez que se miró cada cosa. Se guarda la hora y no un
   *  orden porque de la hora sale el orden, y un "hace 3 min" si algún día
   *  hace falta decirlo. */
  vistas: Record<string, number>;
  /** Abre una pestaña y la enfoca. Si ya hay una con ese id no se duplica: se
   *  enfoca la que está, que es lo que uno espera al volver a pedir algo que ya
   *  tiene abierto. Con `focus: false` abre en segundo plano. */
  openTab: (tab: WorkspaceTab, options?: { focus?: boolean }) => void;
  /** Cierra una pestaña. Si era la activa, la toma su vecina —la de la derecha,
   *  o la de la izquierda si era la última—. */
  closeTab: (id: string) => void;
  /** Enfoca una que ya está abierta. Un id que no existe se ignora. */
  activateTab: (id: string) => void;
}

/* La pestaña que queda adelante se anota como vista ahora. Si no cambió, no
   se toca: volver a pedir la que ya se está mirando no es mirarla de nuevo. */
const verAhora = (
  vistas: Record<string, number>,
  antes: string | undefined,
  despues: string | undefined,
) => (despues && despues !== antes ? { ...vistas, [despues]: Date.now() } : vistas);

export const useWorkspace = create<Workspace>()((set) => ({
  tabs: [],
  activeId: undefined,
  vistas: {},

  openTab: (tab, { focus = true } = {}) =>
    set((s) => {
      const abierta = s.tabs.some((t) => t.id === tab.id);
      const activeId = focus ? tab.id : (s.activeId ?? tab.id);
      return {
        /* Ya abierta: gana la que está. Reemplazarla por el descriptor nuevo
           remontaría su contenido y perdería lo que hubiera adentro —el scroll,
           un formulario a medio llenar—. */
        tabs: abierta ? s.tabs : [...s.tabs, tab],
        activeId,
        vistas: verAhora(s.vistas, s.activeId, activeId),
      };
    }),

  /* Cerrar toca las dos cosas en el mismo paso, y elegir la vecina necesita la
     lista de **antes** de sacarla. Por eso una sola escritura y no dos: con dos
     habría que leer una desde adentro de la otra. */
  closeTab: (id) =>
    set((s) => {
      const i = s.tabs.findIndex((t) => t.id === id);
      if (i === -1) return s;
      const activeId =
        s.activeId === id ? (s.tabs[i + 1] ?? s.tabs[i - 1])?.id : s.activeId;
      const { [id]: _cerrada, ...vistas } = s.vistas;
      return {
        tabs: s.tabs.filter((t) => t.id !== id),
        activeId,
        vistas: verAhora(vistas, s.activeId, activeId),
      };
    }),

  activateTab: (id) =>
    set((s) =>
      s.tabs.some((t) => t.id === id)
        ? { activeId: id, vistas: verAhora(s.vistas, s.activeId, id) }
        : s,
    ),
}));

/** Cuál pestaña está activa. Es lo que más se lee y casi nunca junto con la
 *  lista: con selector, abrir una pestaña no vuelve a pintar a todo el que sólo
 *  quería saber cuál está adelante. */
export const usePestañaActiva = () => useWorkspace((s) => s.activeId);
