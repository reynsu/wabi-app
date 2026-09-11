/**
 * PROTOTIPO — Variante F: dock de dos pisos.
 *
 * El sidebar partido en sus dos niveles y puesto abajo: el piso de abajo son
 * las secciones, el de arriba las pantallas de la sección elegida. No hay
 * pestañas aparte: **la pantalla es la pestaña**. Una ficha con punto está
 * abierta —conserva lo suyo—; la rellena es la que mirás. Lo que se abre desde
 * adentro (un detalle) se apila debajo de su pantalla y se vuelve con atrás.
 *
 * Tocar una sección sólo cambia el piso de arriba, no navega: se puede espiar
 * qué hay en Email sin dejar lo que se está mirando. Las entradas de una sola
 * pantalla —Tickets, Anuncios— sí navegan, porque no tienen piso que mostrar.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, LayoutGrid, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { DOCK, abrirHoja, entradaDe, hojaDe, masReciente, type EntradaDock } from "./dock";
import type { NavLeaf } from "@/navigation";

export function VarianteF() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const puedeVolver = useProto((p) => p.indice > 0);
  const [board, setBoard] = useState(false);
  const activa = tabs.find((t) => t.id === activeId);
  const entradaActiva = entradaDe(activeId);
  // La sección que se está espiando vale mientras no cambie la pestaña: si
  // cambió por otro lado —atrás, un detalle—, el piso vuelve a seguirla.
  const [espia, setEspia] = useState<{ seccion: string; en?: string } | null>(null);
  const seccion =
    espia && espia.en === activeId ? espia.seccion : (entradaActiva?.id ?? DOCK[0].id);
  const setSeccion = (id: string) => setEspia({ seccion: id, en: useWorkspace.getState().activeId });

  const elegida = DOCK.find((e) => e.id === seccion)!;
  const conPiso = elegida.hojas.length > 1;

  const tocarSeccion = (e: EntradaDock) => {
    setSeccion(e.id);
    if (e.hojas.length === 1) irAHoja(e.hojas[0]);
  };

  const irAHoja = (h: NavLeaf) => {
    const ultima = masReciente(useProto.getState().mru, (id) => hojaDe(id) === h.id);
    if (ultima) activateTab(ultima);
    else abrirHoja(h);
  };

  // La miga: la pantalla, y el detalle si se está en uno.
  const hoja = activeId ? hojaDe(activeId) : undefined;
  const raizLabel = elegida.hojas.find((h) => h.id === hoja)?.label ?? entradaActiva?.hojas.find((h) => h.id === hoja)?.label;
  const enDetalle = activeId?.includes("/item-");

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-1">
        {puedeVolver ? (
          <button type="button" onClick={atras} aria-label="Atrás" className="grid size-11 place-items-center">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
          {enDetalle && <span className="shrink-0 text-[13px] text-muted-foreground">{raizLabel} ›</span>}
          <span className="truncate text-[16px] font-semibold">{activa?.label}</span>
        </span>
        {enDetalle && (
          <button type="button" aria-label="Cerrar detalle" onClick={() => activeId && cerrar(activeId)} className="grid size-11 place-items-center text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
        <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 place-items-center">
          <LayoutGrid className="size-5" />
        </button>
      </header>

      <Planos />

      <div className="shrink-0 border-t border-border bg-surface-1" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}>
        {/* El piso de arriba: las pantallas de la sección. */}
        <AnimatePresence initial={false} mode="popLayout">
          {conPiso && (
            <motion.div
              key={seccion}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              className="flex gap-1.5 overflow-x-auto px-2 pt-2 pb-1 [scrollbar-width:none]"
            >
              {elegida.hojas.map((h) => {
                const mias = tabs.filter((t) => hojaDe(t.id) === h.id).length;
                const esta = hoja === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => irAHoja(h)}
                    className={cn(
                      "relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
                      esta ? "bg-foreground text-background" : "bg-surface-2 text-foreground",
                    )}
                  >
                    {h.label}
                    {mias > 1 && <span className="text-[11px] opacity-60">{mias}</span>}
                    {mias > 0 && !esta && (
                      <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-[#7c5cff]" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* El piso de abajo: las secciones. */}
        <nav className="grid grid-cols-5">
          {DOCK.map((e) => {
            const Icono = e.icon;
            const elegido = e.id === seccion;
            const aca = e.id === entradaActiva?.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => tocarSeccion(e)}
                className={cn(
                  "relative flex h-13 flex-col items-center justify-center gap-0.5",
                  elegido ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", elegido && "bg-surface-3 shadow-surface-3")}>
                  <Icono className="size-5" />
                </span>
                <span className="text-[10px] font-medium">{e.label}</span>
                {aca && !elegido && <span className="absolute top-1.5 left-1/2 ml-3 size-1.5 rounded-full bg-[#7c5cff]" />}
              </button>
            );
          })}
        </nav>
      </div>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}
