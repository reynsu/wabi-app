/**
 * PROTOTIPO — Variante B: dock abajo.
 *
 * La más fiel al workspace de escritorio: las pestañas siguen a la vista, pero
 * bajan a donde llega el pulgar y se vuelven fichas de 44px. La activa es la
 * única con ×. No hay flecha de atrás en pantalla —atrás es el gesto del
 * sistema— y el board no sube: entra desde la derecha como una página, que es
 * lo que el riel era en escritorio, un lugar al costado.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, LayoutGrid, Menu, Plus, X } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { cerrar } from "./historial";
import { BoardFalso, Planos, useCuantosWidgets } from "./comun";

export function VarianteB() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const activa = tabs.find((t) => t.id === activeId);
  const widgets = useCuantosWidgets();
  const { setOpenMobile } = useSidebar();
  const [board, setBoard] = useState(false);
  const fila = useRef<HTMLDivElement>(null);

  // La ficha activa siempre a la vista, aunque la haya abierto una fila.
  useEffect(() => {
    fila.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId ?? "")}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center justify-center border-b border-border px-12">
        <span className="truncate text-[15px] font-semibold">{activa?.label}</span>
        <button
          type="button"
          aria-label="Board"
          onClick={() => setBoard(true)}
          className="absolute right-1 grid size-11 place-items-center"
        >
          <LayoutGrid className="size-5" />
          {widgets > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#7c5cff]" />}
        </button>
      </header>

      <Planos />

      {/* El dock. Queda afuera del scroll de la fila el menú, igual que en
          escritorio el botón del sidebar queda afuera de las pestañas. */}
      <nav
        className="flex shrink-0 items-center gap-1 border-t border-border bg-surface-1 pl-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)", paddingTop: 6 }}
      >
        <button
          type="button"
          aria-label="Menú"
          onClick={() => setOpenMobile(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full active:bg-hover"
        >
          <Menu className="size-5" />
        </button>
        <div
          ref={fila}
          className="flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto pr-3 [scrollbar-width:none]"
        >
          {tabs.map((t) => {
            const Icono = t.icon;
            const esta = t.id === activeId;
            return (
              <motion.div
                layout
                key={t.id}
                data-id={t.id}
                className={cn(
                  "flex h-11 max-w-[11rem] shrink-0 snap-start items-center rounded-full",
                  esta ? "bg-foreground text-background" : "bg-surface-3 text-foreground shadow-surface-3",
                )}
              >
                <button
                  type="button"
                  onClick={() => activateTab(t.id)}
                  className={cn("flex h-full min-w-0 items-center gap-2 pl-3.5", esta ? "pr-1" : "pr-3.5")}
                >
                  {Icono && <Icono className="size-4 shrink-0 opacity-70" />}
                  <span className="truncate text-[13px] font-medium">{t.label}</span>
                </button>
                {esta && (
                  <button
                    type="button"
                    aria-label={`Cerrar ${t.label}`}
                    onClick={() => cerrar(t.id)}
                    className="grid size-9 shrink-0 place-items-center opacity-70"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </motion.div>
            );
          })}
          <button
            type="button"
            aria-label="Abrir sección"
            onClick={() => setOpenMobile(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {board && (
          <motion.section
            className="fixed inset-x-0 top-8 bottom-0 z-40 flex flex-col bg-surface-1"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 360 }}
          >
            <header className="flex h-12 shrink-0 items-center border-b border-border px-1">
              <button
                type="button"
                onClick={() => setBoard(false)}
                className="flex h-11 items-center gap-1 pr-3 pl-1 text-[15px] text-[#7c5cff]"
              >
                <ChevronLeft className="size-5" /> {activa?.label}
              </button>
              <span className="ml-auto pr-4 text-[15px] font-semibold">Board</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BoardFalso />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
