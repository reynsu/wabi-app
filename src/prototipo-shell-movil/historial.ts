/**
 * PROTOTIPO — se tira. Rama `prototipo/shell-movil`.
 *
 * Lo que un router le daría al shell móvil, hecho a mano y en memoria para poder
 * probarlo antes de elegir router:
 *
 *  - **la pestaña activa es la URL** (`?variant=A#/chat/accounts`): cada vez que
 *    cambia se empuja una entrada al historial del browser;
 *  - **atrás es atrás del sistema**: el botón de Android, el swipe de iOS o una
 *    flecha en el header llaman a `history.back()` y `popstate` enfoca la
 *    pestaña de esa entrada;
 *  - **una URL tiene que poder reconstruir su pestaña** si ya se cerró. Acá
 *    funciona porque el id lo dice todo (`chat/accounts/item-3`); en la app real
 *    no, porque `WorkspaceTab.content` es un `ReactNode` armado por quien abrió.
 *    Ese es el cambio de modelo que el router va a pedir.
 *
 * Y dos cosas que la tienda no tiene y en móvil hacen falta: el orden de visita
 * (MRU) para saber a quién volver al cerrar, y un registro para mirar qué pasó.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { create } from "zustand";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { useSidebar } from "@/components/ui/sidebar";
import { buscarHoja } from "@/navigation";
import { useWorkspace } from "@/stores/workspace";

/* ───────────────────────────── La variante ───────────────────────────── */

export const VARIANTES = [
  { key: "A", nombre: "Pila + contador" },
  { key: "B", nombre: "Dock abajo" },
  { key: "C", nombre: "Título conmutador" },
  { key: "D", nombre: "Tab bar por sección" },
  { key: "E", nombre: "Dock que crece" },
  { key: "F", nombre: "Dock de dos pisos" },
  { key: "G", nombre: "Dock flotante + lanzador" },
  { key: "H", nombre: "Omnibar (paleta)" },
  { key: "I", nombre: "Barra deslizable" },
  { key: "J", nombre: "Inicio como hub" },
  { key: "J1", nombre: "Inicio · lista" },
  { key: "J2", nombre: "Inicio · continuar" },
  { key: "J3", nombre: "Inicio · al pulgar" },
  { key: "J4", nombre: "Inicio · bento" },
  { key: "K", nombre: "Hojas apiladas" },
  { key: "L", nombre: "Arco del pulgar" },
  { key: "actual", nombre: "El panel de hoy" },
] as const;

export type Variante = (typeof VARIANTES)[number]["key"];

const EVENTO = "prototipo:variante";

const leerVariante = (): Variante => {
  const v = new URLSearchParams(location.search).get("variant");
  return VARIANTES.some((x) => x.key === v) ? (v as Variante) : "A";
};

export function useVariante(): Variante {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENTO, cb);
      window.addEventListener("popstate", cb);
      return () => {
        window.removeEventListener(EVENTO, cb);
        window.removeEventListener("popstate", cb);
      };
    },
    leerVariante,
  );
}

export function ponerVariante(v: Variante) {
  const url = new URL(location.href);
  url.searchParams.set("variant", v);
  history.replaceState(history.state, "", url);
  window.dispatchEvent(new Event(EVENTO));
}

/* ─────────────────────── Pestañas reconstruibles ─────────────────────── */

const raiz = (id: string) => id.split("#")[0];

/** Una pestaña a partir de su id, que es lo que un router hace con una URL.
 *  Las hojas del árbol salen de `NAV`; las de detalle, del id mismo. */
export function reconstruir(id: string): WorkspaceTab | null {
  const item = id.match(/^(.*)\/item-(\d+)$/);
  if (item) {
    const origen = buscarHoja(raiz(item[1]).split("/item-")[0]);
    return { id, label: `Item ${item[2]}`, icon: origen?.icon, content: null };
  }
  const hoja = buscarHoja(raiz(id));
  return hoja
    ? { id, label: hoja.label, icon: hoja.icon, content: hoja.render(id) }
    : null;
}

/** Abrir un detalle desde una fila: la pestaña hija lleva la ruta del padre. */
export function abrirItem(padre: string, n: number) {
  const tab = reconstruir(`${padre}/item-${n}`);
  if (tab) useWorkspace.getState().openTab(tab);
}

/* ─────────────────────────────── El estado ─────────────────────────────── */

interface Proto {
  /** Posición en el historial del browser. Atrás existe si es > 0. */
  indice: number;
  /** Orden de visita, la más reciente primero. */
  mru: string[];
  /** Cuándo se miró por última vez cada pestaña, para decir "hace 3 min". */
  visto: Record<string, number>;
  registro: string[];
  anotar: (linea: string) => void;
}

export const useProto = create<Proto>()((set) => ({
  indice: 0,
  mru: [],
  visto: {},
  registro: [],
  anotar: (linea) => set((s) => ({ registro: [linea, ...s.registro].slice(0, 8) })),
}));

const url = (id: string) => {
  const u = new URL(location.href);
  u.hash = `/${id}`;
  return u;
};

/* La próxima activación no es una navegación nueva: o viene de `popstate` —el
   historial ya se movió— o de cerrar la activa, que reemplaza la entrada en vez
   de apilar una. Si no, cerrar y tocar atrás volvería a abrir lo que se cerró. */
let proxima: "push" | "pop" | "replace" = "push";

/** Cierra una pestaña volviendo a la **última visitada**, no a la vecina de la
 *  derecha: en móvil no hay barra que diga quién es la vecina. */
export function cerrar(id: string, destino?: string) {
  const { tabs, activeId, activateTab, openTab, closeTab } = useWorkspace.getState();
  const { mru, anotar } = useProto.getState();
  if (!destino && tabs.length <= 1) return anotar(`no se cierra la última (${id})`);
  if (id === activeId) {
    // Con destino —cerrar un detalle vuelve a su padre—, ése; si no, la última
    // visitada.
    const siguiente = destino ?? mru.find((x) => x !== id && tabs.some((t) => t.id === x));
    if (siguiente) {
      proxima = "replace";
      if (tabs.some((t) => t.id === siguiente)) activateTab(siguiente);
      else {
        const tab = reconstruir(siguiente);
        if (tab) openTab(tab);
      }
    }
  }
  closeTab(id);
  useProto.setState((s) => ({ mru: s.mru.filter((x) => x !== id) }));
  anotar(`cerrar ${id}`);
}

export const atras = () => history.back();

/**
 * Enchufa la tienda de pestañas al historial del browser. Se monta una vez, en
 * el shell móvil.
 */
export function useHistorialProto() {
  const activeId = useWorkspace((w) => w.activeId);
  const { setOpenMobile } = useSidebar();
  const indiceRef = useRef(0);

  // Al entrar: la URL manda. Si trae una ruta, se abre esa pestaña (enlace
  // profundo); si no, se anota la activa como la primera entrada.
  useEffect(() => {
    const ruta = decodeURIComponent(location.hash.replace(/^#\//, ""));
    const i = history.state?.i ?? 0;
    indiceRef.current = i;
    useProto.setState({ indice: i });
    const { activeId: actual, openTab } = useWorkspace.getState();
    if (ruta && ruta !== actual) {
      const tab = reconstruir(ruta);
      if (tab) {
        proxima = "replace";
        openTab(tab);
        useProto.getState().anotar(`enlace profundo → ${ruta}`);
        return;
      }
    }
    if (actual) history.replaceState({ tab: actual, i }, "", url(actual));
  }, []);

  // Cada cambio de pestaña activa es una navegación.
  useEffect(() => {
    // Un render viejo —el enlace profundo ya abrió otra— no navega.
    if (!activeId || activeId !== useWorkspace.getState().activeId) return;
    setOpenMobile(false);
    useProto.setState((s) => ({
      mru: [activeId, ...s.mru.filter((x) => x !== activeId)],
      visto: { ...s.visto, [activeId]: Date.now() },
    }));

    const modo = proxima;
    proxima = "push";
    const { anotar } = useProto.getState();
    if (modo === "pop") return;
    if (modo === "replace" || history.state?.tab === activeId) {
      history.replaceState({ tab: activeId, i: indiceRef.current }, "", url(activeId));
      if (modo === "replace") anotar(`replace ${activeId}`);
      return;
    }
    const i = indiceRef.current + 1;
    indiceRef.current = i;
    useProto.setState({ indice: i });
    history.pushState({ tab: activeId, i }, "", url(activeId));
    anotar(`push ${activeId}`);
  }, [activeId, setOpenMobile]);

  // Atrás y adelante del sistema.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { tab?: string; i?: number } | null;
      if (!st?.tab) return;
      const vuelve = (st.i ?? 0) < indiceRef.current;
      indiceRef.current = st.i ?? 0;
      useProto.setState({ indice: indiceRef.current });

      const { tabs, activeId, activateTab, openTab } = useWorkspace.getState();
      const { anotar } = useProto.getState();
      if (st.tab === activeId) return;
      if (tabs.some((t) => t.id === st.tab)) {
        proxima = "pop";
        activateTab(st.tab);
        anotar(`${vuelve ? "atrás" : "adelante"} → ${st.tab}`);
        return;
      }
      const tab = reconstruir(st.tab);
      if (tab) {
        proxima = "pop";
        openTab(tab);
        anotar(`reconstruida ${st.tab} (estaba cerrada)`);
      } else {
        anotar(`hueco ${st.tab}, se saltea`);
        if (vuelve) history.back();
        else history.forward();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
