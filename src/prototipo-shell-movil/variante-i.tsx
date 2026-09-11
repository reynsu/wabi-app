/**
 * PROTOTIPO — Variante I: barra deslizable.
 *
 * El gesto de Safari en el iPhone: la barra de abajo muestra dónde estás, y se
 * **desliza de costado** para pasar a la pestaña de al lado —las vecinas asoman
 * por los bordes, así que se sabe que hay más—. Deslizarla **para arriba** abre
 * todo lo abierto. Cambiar de pestaña no pide abrir nada ni apuntar a nada: es
 * un pulgar arrastrando. Es la variante más rápida para ir y venir entre dos o
 * tres cosas, que es lo que más se hace.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, LayoutGrid, Plus, X } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";

export function VarianteI() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const puedeVolver = useProto((p) => p.indice > 0);
  const { setOpenMobile } = useSidebar();
  const [todas, setTodas] = useState(false);
  const [board, setBoard] = useState(false);
  const tira = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ y: number; t: number } | null>(null);
  const moviendo = useRef(false);
  const quieta = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activa = tabs.find((t) => t.id === activeId);
  const i = tabs.findIndex((t) => t.id === activeId);

  // Si la pestaña cambia por otro lado —una fila, atrás—, la tira la sigue.
  useEffect(() => {
    const el = tira.current?.children[i] as HTMLElement | undefined;
    if (!el || !tira.current) return;
    moviendo.current = true;
    tira.current.scrollTo({ left: el.offsetLeft - (tira.current.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
    const t = setTimeout(() => (moviendo.current = false), 400);
    return () => clearTimeout(t);
  }, [i, tabs.length]);

  // Cuando la tira se asienta en otra ficha, esa es la activa.
  const alAsentarse = () => {
    const el = tira.current;
    if (!el || moviendo.current) return;
    const centro = el.scrollLeft + el.clientWidth / 2;
    let mejor = 0;
    let dist = Infinity;
    [...el.children].forEach((c, n) => {
      const h = c as HTMLElement;
      const d = Math.abs(h.offsetLeft + h.clientWidth / 2 - centro);
      if (d < dist) {
        dist = d;
        mejor = n;
      }
    });
    const destino = tabs[mejor];
    if (destino && destino.id !== activeId) activateTab(destino.id);
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <Planos />

      <div className="shrink-0 border-t border-border bg-surface-1/90 pt-2 backdrop-blur-md" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Atrás"
            disabled={!puedeVolver}
            onClick={atras}
            className="grid size-11 shrink-0 place-items-center disabled:opacity-25"
          >
            <ChevronLeft className="size-5" />
          </button>

          {/* La tira: una ficha por pestaña, con snap, y las vecinas asomando. */}
          <div
            ref={tira}
            // Un debounce y no `scrollend`: Safari de iOS tardó años en tenerlo.
            onScroll={() => {
              clearTimeout(quieta.current);
              quieta.current = setTimeout(alAsentarse, 140);
            }}
            onPointerDown={(e) => (inicio.current = { y: e.clientY, t: e.timeStamp })}
            onPointerUp={(e) => {
              const s = inicio.current;
              inicio.current = null;
              if (s && s.y - e.clientY > 30 && e.timeStamp - s.t < 600) setTodas(true);
            }}
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-[9%] [scrollbar-width:none] [touch-action:pan-x]"
          >
            {tabs.map((t) => {
              const I = t.icon;
              const esta = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (esta ? setTodas(true) : activateTab(t.id))}
                  className={cn(
                    "flex h-11 w-[82%] shrink-0 snap-center items-center justify-center gap-2 rounded-xl px-3 transition-opacity",
                    esta ? "bg-surface-3 shadow-surface-3" : "bg-surface-2 opacity-50",
                  )}
                >
                  {I && <I className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate text-[15px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 shrink-0 place-items-center">
            <LayoutGrid className="size-5" />
          </button>
        </div>

        {/* Dónde estás entre lo abierto. */}
        <div className="flex h-4 items-center justify-center gap-1">
          {tabs.map((t) => (
            <span key={t.id} className={cn("h-1 rounded-full bg-foreground transition-all", t.id === activeId ? "w-3 opacity-60" : "w-1 opacity-20")} />
          ))}
        </div>
      </div>

      <HojaInferior abierta={todas} onCerrar={() => setTodas(false)} titulo={`${tabs.length} abiertas`}>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {tabs.map((t) => {
            const I = t.icon;
            return (
              <div key={t.id} className={cn("relative flex h-24 flex-col rounded-2xl bg-surface-3 shadow-surface-3", t.id === activeId && "ring-2 ring-[#7c5cff]")}>
                <button
                  type="button"
                  onClick={() => {
                    activateTab(t.id);
                    setTodas(false);
                  }}
                  className="flex flex-1 flex-col gap-2 p-3 text-left"
                >
                  {I && <I className="size-4 text-muted-foreground" />}
                  <span className="line-clamp-2 text-[14px] font-medium">{t.label}</span>
                </button>
                <button type="button" aria-label={`Cerrar ${t.label}`} onClick={() => cerrar(t.id)} className="absolute top-0 right-0 grid size-10 place-items-center text-muted-foreground">
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setTodas(false);
              setOpenMobile(true);
            }}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-[13px] text-muted-foreground"
          >
            <Plus className="size-5" /> Abrir sección
          </button>
        </div>
      </HojaInferior>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}
