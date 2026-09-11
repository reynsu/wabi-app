/**
 * PROTOTIPO — Variante A: pila + contador.
 *
 * El modelo del navegador del teléfono. Arriba, un header con el título de lo
 * que se mira, la flecha de atrás cuando hay a dónde volver y un cuadradito con
 * el número de cosas abiertas. El cuadradito abre la vista general —todas las
 * pestañas como tarjetas, a pantalla completa— y el board sube en una hoja.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, LayoutGrid, Menu, Plus, X } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos, useCuantosWidgets } from "./comun";

const BOTON =
  "grid size-11 shrink-0 place-items-center rounded-full text-foreground active:bg-hover";

export function VarianteA() {
  const tabs = useWorkspace((w) => w.tabs);
  const activa = useWorkspace((w) => w.tabs.find((t) => t.id === w.activeId));
  const puedeVolver = useProto((p) => p.indice > 0);
  const widgets = useCuantosWidgets();
  const { setOpenMobile } = useSidebar();
  const [general, setGeneral] = useState(false);
  const [board, setBoard] = useState(false);
  const Icono = activa?.icon;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-surface-1">
      <header className="flex h-14 shrink-0 items-center gap-1 px-1.5">
        <button type="button" aria-label="Menú" className={BOTON} onClick={() => setOpenMobile(true)}>
          <Menu className="size-5" />
        </button>
        <AnimatePresence initial={false}>
          {puedeVolver && (
            <motion.button
              type="button"
              aria-label="Atrás"
              className={cn(BOTON, "-ml-2")}
              onClick={atras}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 44 }}
              exit={{ opacity: 0, width: 0 }}
            >
              <ChevronLeft className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          {Icono && <Icono className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate text-[17px] font-semibold">{activa?.label}</span>
        </div>
        <button type="button" aria-label="Board" className={cn(BOTON, "relative")} onClick={() => setBoard(true)}>
          <LayoutGrid className="size-5" />
          {widgets > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-[#7c5cff] px-1 text-[10px] font-semibold text-white">
              {widgets}
            </span>
          )}
        </button>
        <button type="button" aria-label="Pestañas abiertas" className={BOTON} onClick={() => setGeneral(true)}>
          <span className="grid size-6 place-items-center rounded-md border-2 border-foreground text-[11px] font-bold">
            {tabs.length}
          </span>
        </button>
      </header>

      {/* El plano: el mismo gesto que el panel de escritorio —una superficie
          levantada sobre el sustrato— pero a lo ancho y sin pestaña que se le
          funda. */}
      <Planos className="rounded-t-2xl bg-surface-2 shadow-surface-3" />

      <AnimatePresence>
        {general && <VistaGeneral onCerrar={() => setGeneral(false)} />}
      </AnimatePresence>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

function VistaGeneral({ onCerrar }: { onCerrar: () => void }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const { setOpenMobile } = useSidebar();

  return (
    <motion.div
      className="fixed inset-x-0 top-8 bottom-0 z-40 flex flex-col bg-surface-1"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.18 }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-[17px] font-semibold">{tabs.length} abiertas</span>
        <button type="button" onClick={onCerrar} className="h-11 px-2 text-[15px] font-semibold text-[#7c5cff]">
          Listo
        </button>
      </header>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto px-4 pb-28">
        {tabs.map((t) => {
          const Icono = t.icon;
          return (
            <motion.div
              layout
              key={t.id}
              className={cn(
                "relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3",
                t.id === activeId && "ring-2 ring-[#7c5cff]",
              )}
            >
              <button
                type="button"
                className="flex min-h-0 flex-1 flex-col text-left"
                onClick={() => {
                  activateTab(t.id);
                  onCerrar();
                }}
              >
                <span className="flex h-10 items-center gap-2 border-b border-border px-3 pr-10 text-[12px] font-medium">
                  {Icono && <Icono className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{t.label}</span>
                </span>
                <span className="flex flex-1 flex-col gap-2 p-3">
                  {Array.from({ length: 5 }, (_, n) => (
                    <span key={n} className="h-2 rounded bg-foreground/10" style={{ width: `${90 - n * 12}%` }} />
                  ))}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Cerrar ${t.label}`}
                onClick={() => cerrar(t.id)}
                className="absolute top-0.5 right-0.5 grid size-9 place-items-center text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
        <button
          type="button"
          onClick={() => {
            onCerrar();
            setOpenMobile(true);
          }}
          className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-medium text-background shadow-surface-5"
        >
          <Plus className="size-4" /> Abrir sección
        </button>
      </div>
    </motion.div>
  );
}
