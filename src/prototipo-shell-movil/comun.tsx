/**
 * PROTOTIPO — se tira. Las piezas que las tres variantes comparten: no son
 * layout, son el modelo (planos vivos) y los rellenos (contenido y board de
 * mentira, la hoja de abajo, el conmutador de variantes).
 */

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsRight, Bug, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useBoardActivo } from "@/stores/board";
import { useWorkspace } from "@/stores/workspace";
import type { WorkspaceTab } from "@/components/workspace-panel";
import {
  VARIANTES,
  abrirItem,
  ponerVariante,
  useProto,
  type Variante,
} from "./historial";

/* ─────────────────────────── Planos vivos ─────────────────────────── */

/**
 * Todas las pestañas montadas, cada una en su caja de scroll, y sólo la activa
 * visible —lo mismo que hace `WorkspacePanel`—. Es lo que hace que volver a una
 * pestaña la encuentre como quedó: el scroll, lo escrito.
 */
export function Planos({ className }: { className?: string }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      {tabs.map((tab) => {
        const activa = tab.id === activeId;
        return (
          <div
            key={tab.id}
            inert={!activa}
            className="absolute inset-0 overflow-y-auto overscroll-contain"
            style={{ visibility: activa ? "visible" : "hidden" }}
          >
            <ContenidoFalso tab={tab} />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Contenido de mentira ─────────────────────── */

export function ContenidoFalso({ tab }: { tab: WorkspaceTab }) {
  const [nota, setNota] = useState("");
  const Icono = tab.icon;
  const profundidad = tab.id.split("/item-").length - 1;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-40">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 text-[13px] text-muted-foreground">
        {Icono && <Icono className="size-4 shrink-0" />}
        <span className="min-w-0">
          Contenido de <b className="text-foreground">{tab.label}</b> — ignorado
          en este prototipo.
          <code className="mt-1 block truncate text-[11px]">#/{tab.id}</code>
        </span>
      </div>

      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Escribí algo, cambiá de pestaña y volvé: sigue acá.
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Estado de esta pestaña…"
          className="h-11 rounded-lg border border-border bg-surface-3 px-3 text-[15px] text-foreground outline-none focus:border-foreground/40"
        />
      </label>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface-3 shadow-surface-3">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => abrirItem(tab.id, n)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-hover"
            >
              <span className="size-8 shrink-0 rounded-full bg-surface-1" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="h-2.5 w-2/3 rounded bg-foreground/15" />
                <span className="h-2 w-1/3 rounded bg-foreground/8" />
              </span>
              <span className="text-[12px] text-muted-foreground">
                {profundidad < 2 ? `Item ${n}` : ""}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── Board de mentira ─────────────────────────── */

/** Los widgets del board de la pestaña activa, como baldosas. Sólo
 *  Chat › Analytics viene con board puesto. */
export function BoardFalso() {
  const board = useBoardActivo();

  if (board.widgets.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px] text-muted-foreground">
        <span className="size-10 rounded-xl border border-dashed border-border" />
        El board de esta pestaña está vacío.
        <span className="text-[12px]">Chat › Analytics es la que trae widgets.</span>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {board.widgets.map((w) => {
        const Icono = w.icon;
        return (
          <div
            key={w.id}
            className={cn(
              "flex min-h-24 flex-col gap-2 rounded-xl bg-surface-3 p-3 shadow-surface-3",
              w.span?.startsWith("2") && "col-span-2",
            )}
          >
            <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Icono className="size-3.5" />
              {w.label}
            </span>
            <span className="h-3 w-1/2 rounded bg-foreground/15" />
            <span className="mt-auto h-8 rounded bg-foreground/5" />
          </div>
        );
      })}
    </div>
  );
}

export const useCuantosWidgets = () => useBoardActivo().widgets.length;

/* ─────────────────────────── Hoja de abajo ─────────────────────────── */

export function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  alto = "70dvh",
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  alto?: string;
  children: ReactNode;
}) {
  const arrastre = useDragControls();
  return (
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface-2 shadow-surface-5"
            style={{ maxHeight: alto, paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragControls={arrastre}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 90 || i.velocity.y > 500) && onCerrar()}
          >
            <div className="touch-none" onPointerDown={(e) => arrastre.start(e)}>
            <div className="flex justify-center pt-2 pb-1">
              <span className="h-1 w-9 rounded-full bg-foreground/20" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-[15px] font-semibold">{titulo}</span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onCerrar}
                className="grid size-9 place-items-center rounded-full bg-surface-1 text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────── Conmutador de variantes ──────────────────────── */

/** Una tira fija arriba, fuera del diseño que se evalúa: abajo están el dock y
 *  el board asomado, y un pill ahí los taparía. Sólo en `vite dev`. */
export function ConmutadorProto({ variante }: { variante: Variante }) {
  const [estado, setEstado] = useState(false);
  const i = VARIANTES.findIndex((v) => v.key === variante);
  const mover = (d: number) =>
    ponerVariante(VARIANTES[(i + d + VARIANTES.length) % VARIANTES.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "ArrowRight") mover(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] flex h-8 items-center justify-between bg-[#1f1147] px-1 font-mono text-[11px] text-white">
        <button type="button" onClick={() => mover(-1)} className="grid size-8 place-items-center" aria-label="Variante anterior">
          <ChevronLeft className="size-4" />
        </button>
        <span className="truncate">
          PROTOTIPO · {variante} ({VARIANTES[i].nombre})
        </span>
        <span className="flex">
          <button
            type="button"
            onClick={() => setEstado((e) => !e)}
            className={cn("grid size-8 place-items-center", estado && "text-[#b9a6ff]")}
            aria-label="Ver estado"
          >
            <Bug className="size-3.5" />
          </button>
          <button type="button" onClick={() => mover(1)} className="grid size-8 place-items-center" aria-label="Variante siguiente">
            <ChevronsRight className="size-4" />
          </button>
        </span>
      </div>
      {estado && <EstadoProto />}
    </>
  );
}

function EstadoProto() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const { indice, mru, registro } = useProto();

  return (
    <div className="fixed inset-x-2 top-9 z-[60] max-h-[45dvh] overflow-y-auto rounded-lg bg-[#1f1147]/95 p-3 font-mono text-[10.5px] leading-relaxed text-white shadow-surface-5">
      <div>url: {location.hash || "—"}</div>
      <div>historial: entrada {indice} · atrás {indice > 0 ? "sí" : "no"}</div>
      <div className="mt-1 text-[#b9a6ff]">abiertas ({tabs.length}), todas montadas:</div>
      {tabs.map((t) => (
        <div key={t.id}>
          {t.id === activeId ? "▸" : " "} {t.id}
        </div>
      ))}
      <div className="mt-1 text-[#b9a6ff]">visita (MRU):</div>
      <div>{mru.join(" ← ")}</div>
      <div className="mt-1 text-[#b9a6ff]">registro:</div>
      {registro.map((r, n) => (
        <div key={n} className={n === 0 ? "" : "opacity-60"}>
          {r}
        </div>
      ))}
    </div>
  );
}
