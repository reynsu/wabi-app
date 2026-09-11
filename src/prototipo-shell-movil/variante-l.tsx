/**
 * PROTOTIPO — Variante L: arco del pulgar.
 *
 * Un botón en la esquina donde descansa el pulgar derecho. Tocado, abre en
 * abanico lo más reciente sobre un cuarto de círculo alrededor del botón —el
 * arco que el pulgar barre sin mover la mano—. Y es un *marking menu*: se puede
 * apoyar, deslizar hacia un ícono y soltar, así que cambiar de pantalla es un
 * solo gesto de medio segundo, sin mirar, una vez aprendido el lugar de cada
 * cosa. El resto de la pantalla queda para el contenido.
 */

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, LayoutGrid, Menu, Rows3 } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { atras, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";

/* Con cinco gajos de 48px en un cuarto de círculo, 150 es lo mínimo para que
   no se pisen: el arco mide ~235px y quedan ~59px entre centros. */
const RADIO = 150;
const BOTON = 60;

interface Gajo {
  id: string;
  label: string;
  icon?: IconComponent;
  hacer: () => void;
}

export function VarianteL() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const puedeVolver = useProto((p) => p.indice > 0);
  const { setOpenMobile } = useSidebar();
  const [abierto, setAbierto] = useState(false);
  const [apuntado, setApuntado] = useState<number | null>(null);
  const [board, setBoard] = useState(false);
  const centro = useRef<{ x: number; y: number } | null>(null);
  const arrastro = useRef(false);
  const presionado = useRef(false);

  const activa = tabs.find((t) => t.id === activeId);

  // Del borde izquierdo al de arriba: lo más reciente, donde el pulgar llega
  // más cómodo —a la izquierda—; arriba, las salidas fijas.
  const recientes = mru
    .filter((id) => id !== activeId && tabs.some((t) => t.id === id))
    .slice(0, 3)
    .map((id) => tabs.find((t) => t.id === id)!);
  const gajos: Gajo[] = [
    ...recientes.map((t) => ({ id: t.id, label: t.label, icon: t.icon, hacer: () => activateTab(t.id) })),
    { id: "board", label: "Board", icon: LayoutGrid, hacer: () => setBoard(true) },
    { id: "menu", label: "Todo", icon: Menu, hacer: () => setOpenMobile(true) },
  ];
  const posicion = (n: number) => {
    const paso = gajos.length > 1 ? 90 / (gajos.length - 1) : 0;
    const ang = ((180 + n * paso) * Math.PI) / 180;
    return { x: Math.cos(ang) * RADIO, y: Math.sin(ang) * RADIO };
  };

  const cual = (x: number, y: number) => {
    const c = centro.current;
    if (!c) return null;
    const dx = x - c.x;
    const dy = y - c.y;
    if (Math.hypot(dx, dy) < BOTON / 2 + 8) return null;
    let mejor = null as number | null;
    let dist = Infinity;
    gajos.forEach((_, n) => {
      const p = posicion(n);
      const d = Math.hypot(dx - p.x, dy - p.y);
      if (d < dist) {
        dist = d;
        mejor = n;
      }
    });
    return dist < 70 ? mejor : null;
  };

  const elegir = (n: number | null) => {
    if (n !== null) gajos[n].hacer();
    setAbierto(false);
    setApuntado(null);
  };

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
        <span className="truncate text-[16px] font-semibold">{activa?.label}</span>
      </header>

      <Planos />

      <AnimatePresence>
        {abierto && (
          <motion.div
            className="absolute inset-0 z-30 bg-surface-1/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => elegir(null)}
          />
        )}
      </AnimatePresence>

      <div className="absolute right-5 z-40" style={{ bottom: "max(env(safe-area-inset-bottom), 20px)", width: BOTON, height: BOTON }}>
        <AnimatePresence>
          {abierto &&
            gajos.map((g, n) => {
              const p = posicion(n);
              const I = g.icon;
              const esta = apuntado === n;
              return (
                <motion.button
                  key={g.id}
                  type="button"
                  onClick={() => elegir(n)}
                  className="absolute top-1/2 left-1/2 -mt-6 -ml-6 flex size-12 items-center justify-center"
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                  animate={{ x: p.x, y: p.y, scale: esta ? 1.18 : 1, opacity: 1 }}
                  exit={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", damping: 24, stiffness: 420, delay: abierto ? n * 0.018 : 0 }}
                >
                  <span className={cn("grid size-12 place-items-center rounded-full shadow-surface-5", esta ? "bg-[#7c5cff] text-white" : "bg-surface-3")}>
                    {I && <I className="size-5" />}
                  </span>
                  <span
                    className={cn(
                      "pointer-events-none absolute top-1/2 right-full mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                      esta ? "bg-foreground text-background" : "bg-surface-3/90 text-foreground shadow-surface-3",
                      // Los de arriba llevan la etiqueta encima, no a la izquierda
                      // —ahí se pisaría con el vecino—.
                      n >= gajos.length - 2 && "top-auto right-auto bottom-full left-1/2 mr-0 mb-1 -translate-x-1/2 translate-y-0",
                    )}
                  >
                    {g.label}
                  </span>
                </motion.button>
              );
            })}
        </AnimatePresence>

        <button
          type="button"
          aria-label="Ir a…"
          onPointerDown={(e) => {
            // Abierto por un toque, otro toque lo cierra.
            if (abierto) return elegir(null);
            const r = e.currentTarget.getBoundingClientRect();
            centro.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            arrastro.current = false;
            presionado.current = true;
            // La captura es lo que deja seguir el dedo fuera del botón.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* un puntero sintético no se deja capturar */
            }
            setAbierto(true);
          }}
          onPointerMove={(e) => {
            if (!presionado.current) return;
            const n = cual(e.clientX, e.clientY);
            if (n !== null) arrastro.current = true;
            setApuntado(n);
          }}
          onPointerUp={() => {
            presionado.current = false;
            // Soltar sobre un gajo lo elige; soltar sin haber salido del botón
            // deja el abanico abierto para tocar.
            if (arrastro.current) elegir(apuntado);
          }}
          className={cn(
            "relative grid size-full touch-none place-items-center rounded-full shadow-surface-5 transition-colors",
            abierto ? "bg-surface-3 text-foreground" : "bg-foreground text-background",
          )}
        >
          {activa?.icon && !abierto ? <activa.icon className="size-6" /> : <Rows3 className="size-6" />}
          {!abierto && tabs.length > 1 && (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[#7c5cff] px-1 text-[11px] font-semibold text-white">
              {tabs.length}
            </span>
          )}
        </button>
      </div>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}
