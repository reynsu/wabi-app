/**
 * PROTOTIPO — Variante D: tab bar por sección.
 *
 * El dock *es* el sidebar, al modo de una app de iOS: cinco destinos abajo y
 * cada uno recuerda dónde lo dejaste. Tocar Email lleva a la última pestaña de
 * Email que miraste, no al principio de Email. Tocar la sección en la que ya
 * estás muestra su índice —las hojas de la sección y lo que tiene abierto—,
 * que es lo que en iOS hace tocar la pestaña activa: volver a la raíz.
 *
 * Las pestañas del workspace no desaparecen: quedan agrupadas por sección.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { DOCK, abrirHoja, entradaDe, hojaDe, masReciente, type EntradaDock } from "./dock";

export function VarianteD() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const puedeVolver = useProto((p) => p.indice > 0);
  const [indice, setIndice] = useState<string | null>(null);
  const [board, setBoard] = useState(false);

  const activa = tabs.find((t) => t.id === activeId);
  const seccion = indice ?? entradaDe(activeId)?.id;
  const entradaIndice = DOCK.find((e) => e.id === indice);

  const tocar = (e: EntradaDock) => {
    if (e.id === seccion) {
      // La sección en la que estás: su índice, o de vuelta a lo que mirabas.
      setIndice(indice ? null : e.hojas.length > 1 ? e.id : null);
      return;
    }
    const ultima = masReciente(useProto.getState().mru, (id) =>
      e.hojas.some((h) => h.id === hojaDe(id)),
    );
    if (ultima) {
      setIndice(null);
      activateTab(ultima);
    } else if (e.hojas.length === 1) {
      setIndice(null);
      abrirHoja(e.hojas[0]);
    } else setIndice(e.id);
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-1">
        {!indice && puedeVolver ? (
          <button type="button" onClick={atras} className="flex h-11 items-center pr-1 text-[#7c5cff]" aria-label="Atrás">
            <ChevronLeft className="size-6" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          {indice ? entradaIndice?.label : activa?.label}
        </span>
        {!indice && (
          <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 place-items-center">
            <LayoutGrid className="size-5" />
          </button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Planos />
        <AnimatePresence>
          {entradaIndice && (
            <motion.div
              key={entradaIndice.id}
              className="absolute inset-0 overflow-y-auto bg-surface-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Indice entrada={entradaIndice} onIr={() => setIndice(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav
        className="grid shrink-0 grid-cols-5 border-t border-border bg-surface-1/90 backdrop-blur-md"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
      >
        {DOCK.map((e) => {
          const Icono = e.icon;
          const esta = e.id === seccion;
          const abiertas = tabs.filter((t) => e.hojas.some((h) => h.id === hojaDe(t.id))).length;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => tocar(e)}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-0.5",
                esta ? "text-[#7c5cff]" : "text-muted-foreground",
              )}
            >
              <Icono className="size-6" strokeWidth={esta ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{e.label}</span>
              {abiertas > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-foreground/80 px-1 text-[9px] font-semibold text-background">
                  {abiertas}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

/** El índice de una sección: sus hojas, y debajo lo que tiene abierto. */
function Indice({ entrada, onIr }: { entrada: EntradaDock; onIr: () => void }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mias = tabs.filter((t) => entrada.hojas.some((h) => h.id === hojaDe(t.id)));

  return (
    <div className="flex flex-col gap-5 px-3 py-4">
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface-3 shadow-surface-3">
        {entrada.hojas.map((h) => {
          const Icono = h.icon;
          const n = mias.filter((t) => hojaDe(t.id) === h.id).length;
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  abrirHoja(h);
                  onIr();
                }}
                className="flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left active:bg-hover"
              >
                <Icono className="size-5 text-muted-foreground" />
                <span className="flex-1 text-[15px]">{h.label}</span>
                {n > 0 && <span className="text-[12px] text-muted-foreground">{n} abierta{n > 1 && "s"}</span>}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      {mias.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Abiertas en {entrada.label}
          </h3>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface-3 shadow-surface-3">
            {mias.map((t) => (
              <li key={t.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    activateTab(t.id);
                    onIr();
                  }}
                  className="flex min-h-12 min-w-0 flex-1 flex-col justify-center px-4 text-left active:bg-hover"
                >
                  <span className="truncate text-[15px]">{t.label}</span>
                  <code className="truncate text-[11px] text-muted-foreground">/{t.id}</code>
                </button>
                <button
                  type="button"
                  aria-label={`Cerrar ${t.label}`}
                  onClick={() => cerrar(t.id)}
                  className="grid size-12 place-items-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
