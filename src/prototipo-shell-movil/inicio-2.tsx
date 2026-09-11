/**
 * PROTOTIPO — Inicio J2: continuar.
 *
 * Una jerarquía en lugar de un inventario. Lo que más se hace al volver a
 * Inicio es **volver a lo que se estaba haciendo**, así que eso es una tarjeta
 * grande, sola, arriba —un toque, el blanco más grande de la pantalla—. Lo
 * demás abierto baja a una fila de fichas chicas. Y el árbol entero se vuelve
 * una grilla de íconos con el color de su sección: catorce pantallas en cuatro
 * filas, reconocibles por forma y color antes que por texto.
 */

import { ArrowRight, X } from "lucide-react";

import { saludo, TONO, useHace, useInicio } from "./inicio-datos";
import { Icono } from "./inicio-1";

export function InicioContinuar({ onIr }: { onIr: () => void }) {
  const { nombre, recientes, secciones, ir, abrir, cerrar } = useInicio(onIr);
  const hace = useHace();
  const [primera, ...resto] = recientes;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-10">
      <p className="px-1 text-[13px] text-muted-foreground">
        {saludo()}
        {nombre && `, ${nombre}`}
      </p>

      {primera && (
        <button
          type="button"
          onClick={() => ir(primera.tab.id)}
          className="-mt-3 flex flex-col gap-3 rounded-3xl bg-foreground p-5 text-left text-background shadow-surface-5 active:scale-[0.99]"
        >
          <span className="text-[12px] font-medium uppercase tracking-wide opacity-60">Seguir con</span>
          <span className="flex items-center gap-3">
            {primera.tab.icon && (
              <span className="grid size-11 place-items-center rounded-2xl bg-background/15">
                <primera.tab.icon className="size-5" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[20px] font-semibold leading-tight">{primera.tab.label}</span>
              <span className="text-[13px] opacity-60">
                {primera.seccion && primera.seccion.hojas.length > 1 && `${primera.seccion.label} · `}
                {hace(primera.visto)}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 opacity-70" />
          </span>
        </button>
      )}

      {resto.length > 0 && (
        <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {resto.map(({ tab, seccion }) => (
            <span key={tab.id} className="flex h-10 shrink-0 items-center rounded-full bg-surface-3 shadow-surface-3">
              <button type="button" onClick={() => ir(tab.id)} className="flex h-full items-center gap-2 pr-1 pl-1.5">
                <Icono icono={tab.icon} tono={seccion && TONO[seccion.id]} className="size-7 rounded-full" />
                <span className="max-w-[9rem] truncate text-[13px] font-medium">{tab.label}</span>
              </button>
              <button type="button" aria-label={`Cerrar ${tab.label}`} onClick={() => cerrar(tab.id)} className="grid size-8 place-items-center text-muted-foreground/70">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h3 className="px-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Todas las pantallas</h3>
        {/* Una grilla corrida, sin cortes por sección: el color ya agrupa, y
            cortar dejaba filas de uno o dos íconos —Tickets, Anuncios—. */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {secciones.flatMap((s) =>
            s.hojas.map((h) => (
              <button key={h.id} type="button" onClick={() => abrir(h)} className="flex flex-col items-center gap-1.5 active:scale-95">
                <span className="relative">
                  <Icono icono={h.icon} tono={TONO[s.id]} className="size-14 rounded-2xl [&>svg]:size-6" />
                  {s.abiertas.has(h.id) && (
                    <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-1 bg-[#7c5cff]" />
                  )}
                </span>
                <span className="line-clamp-2 text-center text-[11px] leading-tight">{h.label}</span>
                {/* Dos "Search" y dos "Reports": el nombre de la sección los separa. */}
                <span className="-mt-1 text-[10px] text-muted-foreground">{s.hojas.length > 1 ? s.label : " "}</span>
              </button>
            )),
          )}
        </div>
      </section>
    </div>
  );
}
