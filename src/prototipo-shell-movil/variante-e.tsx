/**
 * PROTOTIPO — Variante E: el dock crece hasta ser el sidebar.
 *
 * Una sola pieza abajo con tres alturas, como la hoja de Maps. Baja, es una
 * barra: dónde estás, atrás y el board. A media altura muestra lo abierto como
 * tarjetas. Arriba del todo es el sidebar entero —el mismo árbol, las mismas
 * secciones—. No hay header: el título vive en el dock, a la altura del pulgar.
 */

import { useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ChevronLeft, ChevronUp, LayoutGrid, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV } from "@/navigation";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { abrirHoja, hojaDe } from "./dock";

const ALTURAS = [68, "46%", "92%"] as const;

export function VarianteE() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const puedeVolver = useProto((p) => p.indice > 0);
  const [altura, setAltura] = useState<0 | 1 | 2>(0);
  const [board, setBoard] = useState(false);
  const arrastre = useDragControls();
  const activa = tabs.find((t) => t.id === activeId);
  const Icono = activa?.icon;

  const recientes = [...tabs].sort((a, b) => ind(mru, a.id) - ind(mru, b.id));
  const ir = (fn: () => void) => {
    fn();
    setAltura(0);
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-2">
      <Planos />
      <div style={{ height: ALTURAS[0] }} className="shrink-0" />

      <AnimatePresence>
        {altura > 0 && (
          <motion.div
            className="absolute inset-0 z-20 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAltura(0)}
          />
        )}
      </AnimatePresence>

      <motion.section
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-surface-1 shadow-surface-5"
        initial={false}
        animate={{ height: ALTURAS[altura] }}
        transition={{ type: "spring", damping: 34, stiffness: 380 }}
        drag="y"
        dragControls={arrastre}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, i) => {
          if (i.offset.y < -40) setAltura((a) => (a < 2 ? ((a + 1) as 1 | 2) : a));
          if (i.offset.y > 40) setAltura((a) => (a > 0 ? ((a - 1) as 0 | 1) : a));
        }}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Se arrastra desde la barra y no desde la lista: si no, el gesto de
            subir el dock se come el de scrollear el árbol. */}
        <div className="touch-none" onPointerDown={(e) => arrastre.start(e)}>
        <button
          type="button"
          aria-label="Cambiar altura del dock"
          onClick={() => setAltura((a) => ((a + 1) % 3) as 0 | 1 | 2)}
          className="flex w-full justify-center pt-2 pb-1"
        >
          <span className="h-1 w-9 rounded-full bg-foreground/20" />
        </button>

        {/* La barra: lo único que se ve con el dock abajo. */}
        <div className="flex h-14 shrink-0 items-center gap-1 px-2">
          {puedeVolver ? (
            <button type="button" aria-label="Atrás" onClick={atras} className="grid size-11 place-items-center rounded-full active:bg-hover">
              <ChevronLeft className="size-5" />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <button
            type="button"
            onClick={() => setAltura((a) => (a === 0 ? 1 : 0))}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-4 text-left"
          >
            {Icono && <Icono className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate text-[15px] font-semibold">{activa?.label}</span>
            <span className="ml-auto text-[12px] text-muted-foreground">{tabs.length}</span>
            <ChevronUp className={cn("size-4 shrink-0 text-muted-foreground transition-transform", altura > 0 && "rotate-180")} />
          </button>
          <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 place-items-center rounded-full active:bg-hover">
            <LayoutGrid className="size-5" />
          </button>
        </div>
        </div>

        {/* Lo que el dock trae al subir: lo abierto primero, el árbol después. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" inert={altura === 0}>
          <h3 className="px-5 pt-3 pb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Abiertas</h3>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {recientes.map((t) => {
              const I = t.icon;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "relative flex h-24 w-32 shrink-0 flex-col rounded-2xl bg-surface-3 shadow-surface-3",
                    t.id === activeId && "ring-2 ring-[#7c5cff]",
                  )}
                >
                  <button type="button" onClick={() => ir(() => activateTab(t.id))} className="flex flex-1 flex-col gap-2 p-3 text-left">
                    {I && <I className="size-4 text-muted-foreground" />}
                    <span className="line-clamp-2 text-[13px] font-medium">{t.label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Cerrar ${t.label}`}
                    onClick={() => cerrar(t.id)}
                    className="absolute top-0 right-0 grid size-9 place-items-center text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {NAV.map((g) => (
            <section key={g.id} className="px-3 pt-3">
              {g.label && (
                <h3 className="px-2 pb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</h3>
              )}
              <ul>
                {g.items.map((h) => {
                  const I = h.icon;
                  const esta = activeId !== undefined && hojaDe(activeId) === h.id;
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => ir(() => abrirHoja(h))}
                        className={cn(
                          "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] active:bg-hover",
                          esta && "bg-surface-3 font-semibold shadow-surface-3",
                        )}
                      >
                        <I className="size-5 text-muted-foreground" />
                        {h.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div className="h-8" />
        </div>
      </motion.section>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

const ind = (mru: string[], id: string) => {
  const i = mru.indexOf(id);
  return i === -1 ? 999 : i;
};
