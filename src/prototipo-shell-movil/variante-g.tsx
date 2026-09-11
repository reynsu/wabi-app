/**
 * PROTOTIPO — Variante G: dock flotante + lanzador.
 *
 * El dock del Mac: lo que flota abajo es **lo abierto**, como las apps que
 * están corriendo, y el sidebar se vuelve un lanzador —todas las pantallas de
 * la app como íconos, agrupadas por sección— detrás del primer botón. Separa
 * las dos preguntas que el sidebar de escritorio contesta juntas: "¿qué tengo
 * entre manos?" (el dock) y "¿a dónde más puedo ir?" (el lanzador).
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Grip, LayoutGrid, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV } from "@/navigation";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { abrirHoja, hojaDe } from "./dock";

/* Cuántas caben: con cuatro, en 375px el board se cae por el borde. */
const EN_DOCK = 3;

export function VarianteG() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const puedeVolver = useProto((p) => p.indice > 0);
  const [lanzador, setLanzador] = useState(false);
  const [board, setBoard] = useState(false);
  const activa = tabs.find((t) => t.id === activeId);

  // En el dock van las más recientes, pero en orden de apertura: si se
  // reordenaran por visita, el ícono que acabás de tocar saltaría bajo el dedo.
  const recientes = new Set(
    [...tabs].sort((a, b) => ind(mru, a.id) - ind(mru, b.id)).slice(0, EN_DOCK).map((t) => t.id),
  );
  const enDock = tabs.filter((t) => recientes.has(t.id));
  const resto = tabs.length - enDock.length;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-1 bg-surface-2/80 px-1 backdrop-blur-md">
        {puedeVolver ? (
          <button type="button" onClick={atras} aria-label="Atrás" className="grid size-11 place-items-center">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="truncate text-[16px] font-semibold">{activa?.label}</span>
      </header>

      <Planos className="pt-12" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}>
        <nav className="pointer-events-auto flex max-w-full items-end gap-1 rounded-[26px] border border-border bg-surface-1/85 p-1.5 shadow-surface-5 backdrop-blur-xl">
          <button
            type="button"
            aria-label="Todas las pantallas"
            onClick={() => setLanzador(true)}
            className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-foreground text-background"
          >
            <Grip className="size-5" />
          </button>
          <span className="mx-0.5 h-8 w-px self-center bg-border" />
          {enDock.map((t) => {
            const I = t.icon;
            const esta = t.id === activeId;
            return (
              <motion.button
                layout
                key={t.id}
                type="button"
                onClick={() => activateTab(t.id)}
                className={cn(
                  "relative flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px]",
                  esta ? "bg-surface-3 shadow-surface-3" : "",
                )}
              >
                {I && <I className="size-5" />}
                <span className="w-full truncate px-1 text-center text-[9.5px] leading-none text-muted-foreground">{t.label}</span>
                {esta && <span className="absolute -bottom-1 size-1 rounded-full bg-foreground" />}
              </motion.button>
            );
          })}
          {resto > 0 && (
            <button
              type="button"
              onClick={() => setLanzador(true)}
              className="grid h-12 w-10 shrink-0 place-items-center text-[12px] font-semibold text-muted-foreground"
            >
              +{resto}
            </button>
          )}
          <span className="mx-0.5 h-8 w-px self-center bg-border" />
          <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-12 shrink-0 place-items-center rounded-[18px]">
            <LayoutGrid className="size-5" />
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {lanzador && <Lanzador onCerrar={() => setLanzador(false)} />}
      </AnimatePresence>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

function Lanzador({ onCerrar }: { onCerrar: () => void }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const ir = (fn: () => void) => {
    fn();
    onCerrar();
  };

  return (
    <motion.div
      className="fixed inset-x-0 top-8 bottom-0 z-40 overflow-y-auto bg-surface-1/90 backdrop-blur-2xl"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.16 }}
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[22px] font-bold">Wabi</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-surface-3 shadow-surface-3">
          <X className="size-4" />
        </button>
      </div>

      <section className="px-5 pt-5">
        <h3 className="pb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Abiertas · {tabs.length}</h3>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3">
          {tabs.map((t) => {
            const I = t.icon;
            return (
              <li key={t.id} className="flex items-center">
                <button type="button" onClick={() => ir(() => activateTab(t.id))} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left">
                  {I && <I className="size-4 shrink-0 text-muted-foreground" />}
                  <span className={cn("truncate text-[15px]", t.id === activeId && "font-semibold")}>{t.label}</span>
                </button>
                <button type="button" aria-label={`Cerrar ${t.label}`} onClick={() => cerrar(t.id)} className="grid size-12 shrink-0 place-items-center text-muted-foreground">
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {NAV.map((g) => (
        <section key={g.id} className="px-5 pt-6">
          {g.label && <h3 className="pb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</h3>}
          <div className="grid grid-cols-4 gap-x-3 gap-y-4">
            {g.items.map((h) => {
              const I = h.icon;
              const abierta = tabs.some((t) => hojaDe(t.id) === h.id);
              return (
                <button key={h.id} type="button" onClick={() => ir(() => abrirHoja(h))} className="flex flex-col items-center gap-1.5">
                  <span className="relative grid size-14 place-items-center rounded-2xl bg-surface-3 shadow-surface-3">
                    <I className="size-6" />
                    {abierta && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#7c5cff]" />}
                  </span>
                  <span className="line-clamp-2 text-center text-[11px] leading-tight">{h.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="h-16" />
    </motion.div>
  );
}

const ind = (mru: string[], id: string) => {
  const i = mru.indexOf(id);
  return i === -1 ? 999 : i;
};
