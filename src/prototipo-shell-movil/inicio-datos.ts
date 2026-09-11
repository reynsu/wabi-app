/**
 * PROTOTIPO — se tira. Lo que muestra Inicio, una sola vez, para que las
 * versiones del hub difieran en cómo lo muestran y no en qué.
 *
 * Es lo mismo que el Inicio de J: el saludo, lo abierto por última visita y
 * cada sección con sus pantallas. Lo único nuevo es *cuándo* se miró cada cosa
 * —"hace 3 min"—, que es lo que hace útil una lista de recientes.
 */

import { useEffect, useState } from "react";

import type { NavLeaf } from "@/navigation";
import { useSesion } from "@/stores/sesion";
import { useWorkspace } from "@/stores/workspace";
import type { WorkspaceTab } from "@/components/workspace-panel";
import { cerrar, useProto } from "./historial";
import { DOCK, abrirHoja, entradaDe, hojaDe, type EntradaDock } from "./dock";

/** El tono de cada sección, como hue de oklch. Violeta es el del sistema (el
 *  292 de los badges); los demás se reparten el círculo lejos de él. */
export const TONO: Record<string, number> = {
  chat: 292,
  email: 245,
  tickets: 65,
  announcements: 15,
  admin: 170,
};

export interface Reciente {
  tab: WorkspaceTab;
  seccion?: EntradaDock;
  visto?: number;
}

export interface SeccionInicio extends EntradaDock {
  abiertas: Set<string>;
}

export function useInicio(onIr: () => void) {
  const tabs = useWorkspace((w) => w.tabs);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const visto = useProto((p) => p.visto);
  const email = useSesion((s) => s.email);

  const recientes: Reciente[] = mru
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t) => t !== undefined)
    .map((tab) => ({ tab, seccion: entradaDe(tab.id), visto: visto[tab.id] }));

  const secciones: SeccionInicio[] = DOCK.map((e) => ({
    ...e,
    abiertas: new Set(tabs.filter((t) => e.hojas.some((h) => h.id === hojaDe(t.id))).map((t) => hojaDe(t.id))),
  }));

  return {
    nombre: email?.split("@")[0],
    recientes,
    secciones,
    ir: (id: string) => {
      activateTab(id);
      onIr();
    },
    abrir: (h: NavLeaf) => {
      abrirHoja(h);
      onIr();
    },
    cerrar: (id: string) => cerrar(id),
  };
}

/** "ahora", "hace 4 min", "hace 2 h". Se refresca solo cada medio minuto. */
export function useHace() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (cuando?: number) => {
    if (!cuando) return "";
    const min = Math.floor((ahora - cuando) / 60_000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.floor(min / 60)} h`;
  };
}

/** Saludo según la hora. */
export const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
};
