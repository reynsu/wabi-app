/**
 * PROTOTIPO — Inicio J3: al pulgar.
 *
 * Inicio ordenado por distancia al pulgar y no por importancia de lectura. La
 * mitad de arriba —a donde no se llega con una mano— es aire y el saludo. Todo
 * lo que se toca está en la mitad de abajo, y lo que más se toca más abajo:
 *
 *   recientes            ← se toca a veces
 *   pantallas de la sección
 *   secciones (segmentado) ← se toca siempre, justo donde descansa el dedo
 *
 * Una sección a la vez, no las cinco apiladas: la lista nunca pasa de cuatro
 * filas, así que nunca hay que scrollear para ver una pantalla.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONO, saludo, useHace, useInicio } from "./inicio-datos";
import { Icono } from "./inicio-1";

export function InicioPulgar({ onIr }: { onIr: () => void }) {
  const { nombre, recientes, secciones, ir, abrir, cerrar } = useInicio(onIr);
  const hace = useHace();
  // Arranca en la sección de lo último que se miró: es la más probable.
  const [elegida, setElegida] = useState(recientes[0]?.seccion?.id ?? secciones[0].id);
  const seccion = secciones.find((s) => s.id === elegida)!;

  return (
    <div className="flex min-h-full flex-col px-4 pb-4">
      <div className="flex flex-1 flex-col justify-center py-8">
        <p className="text-[28px] font-bold leading-tight tracking-tight">
          {saludo()}
          {nombre && (
            <>
              ,<br />
              <span className="text-muted-foreground">{nombre}</span>
            </>
          )}
        </p>
      </div>

      {recientes.length > 0 && (
        <section className="mb-4 flex flex-col gap-2">
          <h3 className="px-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Seguir</h3>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {recientes.map(({ tab, seccion: s, visto }) => (
              <div key={tab.id} className="relative flex w-36 shrink-0 flex-col rounded-2xl bg-surface-3 shadow-surface-3">
                <button type="button" onClick={() => ir(tab.id)} className="flex flex-col gap-2 p-3 text-left">
                  <Icono icono={tab.icon} tono={s && TONO[s.id]} className="size-7" />
                  <span className="flex flex-col">
                    <span className="truncate text-[14px] font-medium">{tab.label}</span>
                    <span className="text-[11px] text-muted-foreground">{hace(visto)}</span>
                  </span>
                </button>
                <button type="button" aria-label={`Cerrar ${tab.label}`} onClick={() => cerrar(tab.id)} className="absolute top-0.5 right-0.5 grid size-8 place-items-center text-muted-foreground/70">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <motion.ul layout className="mb-3 flex flex-col overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3">
        {seccion.hojas.map((h, n) => (
          <motion.li
            key={h.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, delay: n * 0.02 }}
            className={cn(n > 0 && "border-t border-border")}
          >
            <button type="button" onClick={() => abrir(h)} className="flex min-h-13 w-full items-center gap-3 px-3 text-left active:bg-hover">
              <Icono icono={h.icon} tono={TONO[seccion.id]} />
              <span className="flex-1 text-[15px] font-medium">{h.label}</span>
              {seccion.abiertas.has(h.id) && <span className="size-2 rounded-full bg-[#7c5cff]" />}
            </button>
          </motion.li>
        ))}
      </motion.ul>

      {/* El segmentado: una marca que viaja, no cinco que se prenden y apagan. */}
      <nav className="grid grid-cols-5 gap-1 rounded-2xl bg-surface-1 p-1 shadow-[inset_0_0_0_1px_var(--color-border)]">
        {secciones.map((s) => {
          const esta = s.id === elegida;
          const I = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setElegida(s.id)}
              className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl", esta ? "text-foreground" : "text-muted-foreground")}
            >
              {esta && (
                <motion.span
                  layoutId="inicio-segmento"
                  className="absolute inset-0 rounded-xl bg-surface-3 shadow-surface-3"
                  transition={{ type: "spring", damping: 30, stiffness: 420 }}
                />
              )}
              <I className="relative size-5" />
              <span className="relative text-[10px] font-medium">{s.label}</span>
              {s.abiertas.size > 0 && !esta && <span className="absolute top-1.5 right-2.5 size-1.5 rounded-full bg-[#7c5cff]" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
