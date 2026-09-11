/**
 * PROTOTIPO — Variante J: inicio como hub.
 *
 * La navegación deja de ser un menú y pasa a ser una pantalla: **Inicio**, a un
 * toque desde cualquier lado. Arriba, "seguir donde estabas" —lo abierto, por
 * última visita—; debajo, cada sección como una tarjeta con sus pantallas
 * adentro. Es el patrón de hub-and-spoke de las apps de consola modernas
 * (Linear, Notion, Stripe en el teléfono): se entra, se hace una cosa, se
 * vuelve al centro. Casi sin chrome mientras se trabaja.
 */

import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, House, LayoutGrid, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSesion } from "@/stores/sesion";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { DOCK, abrirHoja, entradaDe, hojaDe } from "./dock";

/** Lo que se dibuja como Inicio. J trae el suyo; J1–J4 prueban otros sobre el
 *  mismo shell. */
export type HubInicio = ComponentType<{ onIr: () => void }>;

export function VarianteJ({ hub: Hub = HubOriginal }: { hub?: HubInicio }) {
  const activa = useWorkspace((w) => w.tabs.find((t) => t.id === w.activeId));
  const puedeVolver = useProto((p) => p.indice > 0);
  const [inicio, setInicio] = useState(true);
  const [board, setBoard] = useState(false);
  const seccion = entradaDe(activa?.id);

  // Inicio no es una pestaña, así que atrás del sistema lo cierra. Con router
  // sería la ruta `/` y esto no haría falta.
  useEffect(() => {
    const salir = () => setInicio(false);
    window.addEventListener("popstate", salir);
    return () => window.removeEventListener("popstate", salir);
  }, []);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center gap-1 px-1">
        <button
          type="button"
          aria-label="Inicio"
          onClick={() => setInicio(true)}
          className={cn("grid size-11 place-items-center rounded-full", inicio && "text-[#7c5cff]")}
        >
          <House className="size-5" />
        </button>
        {!inicio && puedeVolver && (
          <button type="button" onClick={atras} aria-label="Atrás" className="-ml-2 grid size-11 place-items-center">
            <ChevronLeft className="size-5" />
          </button>
        )}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          {!inicio && seccion && seccion.hojas.length > 1 && <span className="shrink-0 text-[13px] text-muted-foreground">{seccion.label} /</span>}
          <span className="truncate text-[16px] font-semibold">{inicio ? "Inicio" : activa?.label}</span>
        </span>
        {!inicio && (
          <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 place-items-center">
            <LayoutGrid className="size-5" />
          </button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col border-t border-border">
        <Planos />
        <AnimatePresence>
          {inicio && (
            <motion.div
              className="absolute inset-0 overflow-y-auto bg-surface-1"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.15 }}
            >
              <Hub onIr={() => setInicio(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

function HubOriginal({ onIr }: { onIr: () => void }) {
  const tabs = useWorkspace((w) => w.tabs);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const email = useSesion((s) => s.email);
  const recientes = mru.map((id) => tabs.find((t) => t.id === id)).filter((t) => t !== undefined);

  return (
    <div className="flex flex-col gap-6 pt-5 pb-10">
      <p className="px-5 text-[22px] font-bold leading-tight">
        Hola{email ? `, ${email.split("@")[0]}` : ""}
      </p>

      {recientes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Seguir donde estabas</h3>
          <div className="flex snap-x gap-2.5 overflow-x-auto px-5 [scrollbar-width:none]">
            {recientes.map((t) => {
              const I = t.icon;
              const s = entradaDe(t.id);
              return (
                <div key={t.id} className="relative flex h-28 w-40 shrink-0 snap-start flex-col rounded-2xl bg-surface-3 shadow-surface-3">
                  <button
                    type="button"
                    onClick={() => {
                      activateTab(t.id);
                      onIr();
                    }}
                    className="flex flex-1 flex-col gap-1 p-3 text-left"
                  >
                    {I && <I className="mb-1 size-4 text-muted-foreground" />}
                    <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{t.label}</span>
                    <span className="mt-auto text-[11px] text-muted-foreground">{s?.label}</span>
                  </button>
                  <button type="button" aria-label={`Cerrar ${t.label}`} onClick={() => cerrar(t.id)} className="absolute top-0 right-0 grid size-9 place-items-center text-muted-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 px-4">
        {DOCK.map((e) => {
          const I = e.icon;
          return (
            <div key={e.id} className="rounded-2xl bg-surface-3 p-2 shadow-surface-3">
              <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                <span className="grid size-7 place-items-center rounded-lg bg-surface-1">
                  <I className="size-4" />
                </span>
                <span className="text-[15px] font-semibold">{e.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {e.hojas.map((h) => {
                  const abierta = tabs.some((t) => hojaDe(t.id) === h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        abrirHoja(h);
                        onIr();
                      }}
                      className="flex h-10 items-center gap-1.5 rounded-xl bg-surface-1 px-3 text-[13px] font-medium active:bg-hover"
                    >
                      <h.icon className="size-3.5 text-muted-foreground" />
                      {h.label}
                      {abierta && <span className="size-1.5 rounded-full bg-[#7c5cff]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
