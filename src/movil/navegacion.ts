import { useEffect } from "react";
import { create } from "zustand";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { aPestaña, buscarHoja, raiz } from "@/navigation";
import { useWorkspace } from "@/stores/workspace";

/**
 * Cómo se navega en el teléfono, mientras no haya router.
 *
 * En escritorio no hace falta nada de esto: la barra de pestañas muestra todo
 * lo abierto y se vuelve tocando la pestaña. En el teléfono no hay barra, y lo
 * que la reemplaza es el gesto de siempre —atrás—: el botón de Android, el
 * swipe desde el borde en iOS, la flecha del header. Para que atrás signifique
 * algo, cada lugar tiene que ser **una entrada del historial del navegador**.
 *
 * Los lugares son dos: **Inicio** y **una pestaña**. Cada vez que cambia lo que
 * se mira se empuja una entrada, y `popstate` pone adelante la de la entrada a
 * la que se volvió. La URL lo dice con el hash —`#/` es Inicio,
 * `#/chat/accounts` es esa pestaña—, que es lo que un router va a formalizar.
 *
 * **Esto es lo que el router reemplaza, entero.** Por eso vive en un archivo
 * propio y el shell lo usa por tres puertas —`useHistorialMovil`, `irAInicio`,
 * `mostrar`— y nada más.
 *
 * Lo que queda corto hasta entonces: volver a una pestaña que ya se cerró sólo
 * funciona si es una hoja del árbol, porque `WorkspaceTab.content` es un
 * `ReactNode` que armó quien la abrió y de una URL no se puede volver a armar.
 * Un perfil, un reporte o un widget cerrados son un hueco: atrás los saltea.
 * Con router, una pestaña va a ser una ruta y sus parámetros, y el hueco se va.
 */

type Lugar = { vista: "inicio" } | { vista: "pestaña"; id: string };

interface Entrada {
  wabi: Lugar;
  /** Cuántas entradas propias hay antes que ésta. Atrás existe si es > 0. */
  i: number;
}

interface NavegacionMovil {
  enInicio: boolean;
  /** El `i` de la entrada en la que se está. */
  indice: number;
}

export const useNavegacionMovil = create<NavegacionMovil>()(() => ({
  enInicio: true,
  indice: 0,
}));

const url = (lugar: Lugar) => {
  const u = new URL(location.href);
  u.hash = lugar.vista === "inicio" ? "/" : `/${lugar.id}`;
  return u;
};

function escribir(lugar: Lugar, modo: "push" | "replace") {
  const { indice } = useNavegacionMovil.getState();
  const i = modo === "push" ? indice + 1 : indice;
  const entrada: Entrada = { wabi: lugar, i };
  if (modo === "push") history.pushState(entrada, "", url(lugar));
  else history.replaceState(entrada, "", url(lugar));
  useNavegacionMovil.setState({ indice: i, enInicio: lugar.vista === "inicio" });
}

/* La próxima pestaña que se ponga adelante no es una navegación nueva: la puso
   `popstate` —el historial ya se movió solo— o el arranque, que reemplaza la
   entrada en vez de apilar una. Una variable del módulo y no estado: la lee la
   suscripción de la tienda en el mismo tick en que se escribe. */
let proxima: "empujar" | "ya-esta" = "empujar";

/** Rehace una pestaña a partir de su id. Sólo sabe con hojas del árbol. */
const rehacer = (id: string): WorkspaceTab | null => {
  const hoja = buscarHoja(raiz(id));
  return hoja ? aPestaña(hoja, id) : null;
};

/** Pone adelante una pestaña sin que cuente como navegación. */
function ponerSinEmpujar(tab: WorkspaceTab) {
  const { tabs, activeId, activateTab, openTab } = useWorkspace.getState();
  if (tab.id === activeId) return;
  proxima = "ya-esta";
  if (tabs.some((t) => t.id === tab.id)) activateTab(tab.id);
  else openTab(tab);
}

/** Ir a Inicio. Es una entrada más: atrás desde Inicio vuelve a lo que se
 *  estaba mirando. */
export function irAInicio() {
  if (!useNavegacionMovil.getState().enInicio) escribir({ vista: "inicio" }, "push");
}

/** Mostrar una pestaña: abrirla —o enfocarla, si ya está— y dejar Inicio.
 *
 *  Casi siempre el que empuja la entrada es la suscripción de abajo, que ve
 *  cambiar la pestaña activa. El caso que no ve es volver desde Inicio a la
 *  misma que ya estaba adelante —la primera ficha—: ahí no cambia nada en la
 *  tienda, y la entrada se empuja a mano. */
export function mostrar(tab: WorkspaceTab) {
  const { activeId, openTab } = useWorkspace.getState();
  if (tab.id !== activeId) openTab(tab);
  else if (useNavegacionMovil.getState().enInicio)
    escribir({ vista: "pestaña", id: tab.id }, "push");
}

export const volver = () => history.back();

/**
 * Engancha la tienda de pestañas al historial. Se monta una vez, en el shell
 * móvil, y se desengancha solo si la ventana crece hasta escritorio.
 */
export function useHistorialMovil() {
  // Cualquier pestaña que se ponga adelante —una fila que abre un perfil, una
  // baldosa del board— es una navegación. Va primero para que el arranque, más
  // abajo, ya la encuentre escuchando.
  useEffect(
    () =>
      useWorkspace.subscribe((s, antes) => {
        if (!s.activeId || s.activeId === antes.activeId) return;
        if (proxima === "ya-esta") {
          proxima = "empujar";
          return;
        }
        /* Si la que se estaba mirando ya no existe, la nueva ocupa su lugar en
           vez de apilarse: si no, atrás volvería a algo que se cerró. Que no
           hubiera ninguna no es que se haya cerrado. */
        const seCerro =
          antes.activeId !== undefined && !s.tabs.some((t) => t.id === antes.activeId);
        /* Y si se cerró desde Inicio —su ficha es la primera—, se sigue en
           Inicio: la que queda adelante es la de la tienda, pero nadie pidió ir
           a mirarla. */
        if (seCerro && useNavegacionMovil.getState().enInicio) return;
        escribir({ vista: "pestaña", id: s.activeId }, seCerro ? "replace" : "push");
      }),
    [],
  );

  // El arranque: la URL manda. Un `#/chat/accounts` abre esa pestaña —un
  // enlace, o recargar—; cualquier otra cosa abre en Inicio. El índice se
  // recupera de la entrada, así que recargar a mitad de camino no pierde atrás.
  useEffect(() => {
    const previa = history.state as Entrada | null;
    useNavegacionMovil.setState({ indice: previa?.wabi ? previa.i : 0 });

    const ruta = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const abierta = useWorkspace.getState().tabs.find((t) => t.id === ruta);
    const tab = ruta ? (abierta ?? rehacer(ruta)) : null;
    if (tab) {
      ponerSinEmpujar(tab);
      escribir({ vista: "pestaña", id: tab.id }, "replace");
    } else {
      escribir({ vista: "inicio" }, "replace");
    }
  }, []);

  // Atrás y adelante del sistema.
  useEffect(() => {
    const alVolver = (e: PopStateEvent) => {
      const entrada = e.state as Entrada | null;
      if (!entrada?.wabi) return;
      const haciaAtras = entrada.i < useNavegacionMovil.getState().indice;
      const lugar = entrada.wabi;

      if (lugar.vista === "inicio") {
        useNavegacionMovil.setState({ indice: entrada.i, enInicio: true });
        return;
      }

      const abierta = useWorkspace.getState().tabs.find((t) => t.id === lugar.id);
      const tab = abierta ?? rehacer(lugar.id);
      if (!tab) {
        /* Un hueco: una pestaña cerrada que no se sabe rehacer. Se sigue en la
           misma dirección. Si ya no hay más atrás propio, en vez de salir de la
           app se cae en Inicio. */
        useNavegacionMovil.setState({ indice: entrada.i });
        if (haciaAtras && entrada.i === 0) escribir({ vista: "inicio" }, "replace");
        else if (haciaAtras) history.back();
        else history.forward();
        return;
      }

      useNavegacionMovil.setState({ indice: entrada.i, enInicio: false });
      ponerSinEmpujar(tab);
    };

    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, []);
}
