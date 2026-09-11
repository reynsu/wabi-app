/**
 * PROTOTIPO — Variante C: el título es el conmutador.
 *
 * Una sola puerta para "dónde estoy y a dónde puedo ir": el título del header
 * es un botón. Abre una hoja con lo abierto ordenado por la última visita —no
 * por orden de apertura, que en un teléfono no dice nada— y, al final, el resto
 * de la app. La flecha de atrás toma el lugar del menú cuando hay a dónde
 * volver. El board no es un botón: asoma abajo, siempre, y se levanta con el
 * pulgar — es lo más parecido al riel que se ve junto al trabajo.
 */

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronUp, LayoutGrid, Menu, X } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos, useCuantosWidgets } from "./comun";

const ASOMA = 52;

export function VarianteC() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activa = tabs.find((t) => t.id === activeId);
  const puedeVolver = useProto((p) => p.indice > 0);
  const { setOpenMobile } = useSidebar();
  const [lista, setLista] = useState(false);
  const Icono = activa?.icon;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-2">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-1.5">
        <button
          type="button"
          aria-label={puedeVolver ? "Atrás" : "Menú"}
          onClick={puedeVolver ? atras : () => setOpenMobile(true)}
          className="grid size-11 place-items-center rounded-full active:bg-hover"
        >
          {puedeVolver ? <ChevronLeft className="size-5" /> : <Menu className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => setLista(true)}
          className="mx-auto flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 active:bg-hover"
        >
          {Icono && <Icono className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate text-[16px] font-semibold">{activa?.label}</span>
          {tabs.length > 1 && (
            <span className="rounded-full bg-surface-1 px-1.5 text-[11px] font-semibold text-muted-foreground">
              {tabs.length}
            </span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <span />
      </header>

      <Planos className="border-t border-border" />
      <div style={{ height: ASOMA }} className="shrink-0" />

      <BoardAsomado key={activeId} />

      <HojaInferior abierta={lista} onCerrar={() => setLista(false)} titulo="Abiertas">
        <Lista
          onElegir={() => setLista(false)}
          onSecciones={() => {
            setLista(false);
            setOpenMobile(true);
          }}
        />
      </HojaInferior>
    </div>
  );
}

function Lista({ onElegir, onSecciones }: { onElegir: () => void; onSecciones: () => void }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const orden = [...tabs].sort((a, b) => {
    const ia = mru.indexOf(a.id);
    const ib = mru.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div className="flex flex-col pb-3">
      <ul className="mx-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface-3 shadow-surface-3">
        {orden.map((t) => {
          const Icono = t.icon;
          const esta = t.id === activeId;
          return (
            <motion.li layout key={t.id} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  activateTab(t.id);
                  onElegir();
                }}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left active:bg-hover"
              >
                {Icono && <Icono className="size-4 shrink-0 text-muted-foreground" />}
                <span className="flex min-w-0 flex-col">
                  <span className={cn("truncate text-[15px]", esta && "font-semibold")}>{t.label}</span>
                  <code className="truncate text-[11px] text-muted-foreground">/{t.id}</code>
                </span>
                {esta && <Check className="ml-auto size-4 shrink-0 text-[#7c5cff]" />}
              </button>
              <button
                type="button"
                aria-label={`Cerrar ${t.label}`}
                onClick={() => cerrar(t.id)}
                className="grid size-12 shrink-0 place-items-center text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </motion.li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onSecciones}
        className="mx-3 mt-3 flex min-h-12 items-center gap-3 rounded-xl px-4 text-[15px] text-[#7c5cff] active:bg-hover"
      >
        <Menu className="size-4" /> Todas las secciones…
      </button>
    </div>
  );
}

/** El board asomado: una franja fija abajo que se levanta con un toque o
 *  arrastrándola. No tapa el trabajo mientras está baja, y al subir se queda
 *  a dos tercios —se sigue viendo arriba de qué está—. */
function BoardAsomado() {
  const [arriba, setArriba] = useState(false);
  const widgets = useCuantosWidgets();
  const arrastre = useDragControls();

  return (
    <motion.section
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl bg-surface-1 shadow-surface-5"
      initial={false}
      animate={{ height: arriba ? "66%" : ASOMA }}
      transition={{ type: "spring", damping: 34, stiffness: 380 }}
      drag="y"
      dragControls={arrastre}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragEnd={(_, i) => {
        if (i.offset.y < -30) setArriba(true);
        if (i.offset.y > 30) setArriba(false);
      }}
    >
      <button
        type="button"
        onClick={() => setArriba((a) => !a)}
        onPointerDown={(e) => arrastre.start(e)}
        className="flex shrink-0 touch-none flex-col items-center"
        style={{ height: ASOMA }}
      >
        <span className="mt-2 h-1 w-9 rounded-full bg-foreground/20" />
        <span className="flex flex-1 items-center gap-2 text-[13px] text-muted-foreground">
          <LayoutGrid className="size-4" />
          Board {widgets > 0 ? `· ${widgets} widgets` : "vacío"}
          {arriba ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto" inert={!arriba}>
        <BoardFalso />
      </div>
    </motion.section>
  );
}
