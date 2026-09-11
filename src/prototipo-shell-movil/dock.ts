/**
 * PROTOTIPO — se tira. El árbol de navegación visto como dock: cinco entradas
 * que caben abajo, a partir del mismo `NAV`.
 *
 * El árbol no se deja poner en cinco de una: tiene tres secciones con nombre,
 * dos hojas sueltas y Support colgando solo. Acá las sueltas suben a entrada
 * propia —Tickets y Announcements son destinos de uso diario— y Support se va
 * con Admin. Es una decisión de navegación que el sidebar no tuvo que tomar.
 */

import { Megaphone, MessagesSquare, Mail, Settings2, Wrench } from "lucide-react";

import type { IconComponent } from "@/lib/icon-context";
import { HOJAS, NAV, type NavLeaf } from "@/navigation";
import { useWorkspace } from "@/stores/workspace";
import { reconstruir } from "./historial";

export interface EntradaDock {
  id: string;
  label: string;
  icon: IconComponent;
  hojas: NavLeaf[];
}

const grupo = (id: string) => NAV.find((g) => g.id === id)?.items ?? [];
const hoja = (id: string) => HOJAS.filter((h) => h.id === id);

export const DOCK: EntradaDock[] = [
  { id: "chat", label: "Chat", icon: MessagesSquare, hojas: grupo("chat") },
  { id: "email", label: "Email", icon: Mail, hojas: grupo("email") },
  { id: "tickets", label: "Tickets", icon: Wrench, hojas: hoja("tickets") },
  { id: "announcements", label: "Anuncios", icon: Megaphone, hojas: hoja("announcements") },
  { id: "admin", label: "Admin", icon: Settings2, hojas: [...grupo("admin"), ...hoja("support")] },
];

/** La hoja de la que sale una pestaña: sin copia (`#2`) y sin detalle
 *  (`/item-3`). */
export const hojaDe = (tabId: string) => tabId.split("#")[0].split("/item-")[0];

export const entradaDe = (tabId: string | undefined) =>
  tabId ? DOCK.find((e) => e.hojas.some((h) => h.id === hojaDe(tabId))) : undefined;

export function abrirHoja(h: NavLeaf) {
  const tab = reconstruir(h.id);
  if (tab) useWorkspace.getState().openTab(tab);
}

/** La pestaña abierta más recién visitada que cumpla la condición. */
export function masReciente(mru: string[], cumple: (id: string) => boolean) {
  const abiertas = new Set(useWorkspace.getState().tabs.map((t) => t.id));
  return mru.find((id) => abiertas.has(id) && cumple(id));
}
