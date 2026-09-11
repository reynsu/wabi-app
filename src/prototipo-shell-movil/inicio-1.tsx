/**
 * PROTOTIPO — Inicio J1: lista.
 *
 * Lo mismo que el Inicio de J, pero como listas agrupadas —la forma de Ajustes
 * en iOS, o del sidebar de Linear— en vez de tarjetas con fichas. Una columna,
 * una fila por pantalla, todo alineado contra el mismo margen: se escanea de
 * arriba abajo sin que el ojo salte entre formas.
 *
 * Tres ajustes de eficiencia sobre J:
 *  - un filtro arriba: con catorce pantallas, escribir "rep" es más rápido que
 *    buscar con la vista;
 *  - recientes con **cuándo**, y sólo tres a la vista;
 *  - las secciones de una sola pantalla —Tickets, Anuncios— no son una tarjeta
 *    con una ficha adentro: van juntas en un grupo sin título, una fila cada una.
 */

import { useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavLeaf } from "@/navigation";
import { TONO, saludo, useHace, useInicio } from "./inicio-datos";

export function InicioLista({ onIr }: { onIr: () => void }) {
  const { nombre, recientes, secciones, ir, abrir, cerrar } = useInicio(onIr);
  const hace = useHace();
  const [q, setQ] = useState("");
  const [todas, setTodas] = useState(false);

  const texto = q.trim().toLowerCase();
  const coincide = (h: NavLeaf) => !texto || h.label.toLowerCase().includes(texto);
  const grupos = [
    ...secciones.filter((s) => s.hojas.length > 1).map((s) => ({ ...s, titulo: s.label as string | undefined })),
    {
      id: "sueltas",
      titulo: undefined,
      hojas: secciones.filter((s) => s.hojas.length === 1).flatMap((s) => s.hojas),
      abiertas: new Set(secciones.flatMap((s) => (s.hojas.length === 1 ? [...s.abiertas] : []))),
    },
  ]
    .map((g) => ({ ...g, hojas: g.hojas.filter(coincide) }))
    .filter((g) => g.hojas.length > 0);
  const visibles = todas ? recientes : recientes.slice(0, 3);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[22px] font-bold leading-tight">
          {saludo()}
          {nombre && <span className="text-muted-foreground">, {nombre}</span>}
        </p>
      </div>

      <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-3 px-3 shadow-surface-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pantalla"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button type="button" aria-label="Borrar" onClick={() => setQ("")} className="grid size-7 place-items-center text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </label>

      {!texto && recientes.length > 0 && (
        <Grupo
          titulo="Recientes"
          accion={
            recientes.length > 3 && (
              <button type="button" onClick={() => setTodas((t) => !t)} className="text-[13px] text-[#7c5cff]">
                {todas ? "Menos" : `Ver las ${recientes.length}`}
              </button>
            )
          }
        >
          {visibles.map(({ tab, seccion, visto }) => (
            <li key={tab.id} className="flex items-center">
              <button type="button" onClick={() => ir(tab.id)} className="flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left active:bg-hover">
                <Icono icono={tab.icon} tono={seccion && TONO[seccion.id]} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px]">{tab.label}</span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {/* La sección sólo si dice algo: "Tickets · Tickets" no. */}
                    {seccion && seccion.hojas.length > 1 && `${seccion.label} · `}
                    {hace(visto)}
                  </span>
                </span>
              </button>
              <button type="button" aria-label={`Cerrar ${tab.label}`} onClick={() => cerrar(tab.id)} className="grid size-11 shrink-0 place-items-center text-muted-foreground/70">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </Grupo>
      )}

      {grupos.map((g) => (
        <Grupo key={g.id} titulo={g.titulo}>
          {g.hojas.map((h) => {
            const s = secciones.find((x) => x.hojas.includes(h));
            const abierta = g.abiertas.has(h.id);
            return (
              <li key={h.id}>
                <button type="button" onClick={() => abrir(h)} className="flex min-h-12 w-full items-center gap-3 py-1.5 pr-3 pl-3 text-left active:bg-hover">
                  <Icono icono={h.icon} tono={s && TONO[s.id]} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{h.label}</span>
                  {abierta && <span className="rounded-full bg-surface-1 px-2 py-0.5 text-[11px] text-muted-foreground">abierta</span>}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            );
          })}
        </Grupo>
      ))}

      {grupos.length === 0 && <p className="py-6 text-center text-[14px] text-muted-foreground">Ninguna pantalla se llama así.</p>}
    </div>
  );
}

function Grupo({ titulo, accion, children }: { titulo?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      {(titulo || accion) && (
        <div className="flex items-baseline justify-between px-3">
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h3>
          {accion}
        </div>
      )}
      {/* El filete arranca después del ícono, como en iOS: separa filas sin
          cortar la columna de íconos. */}
      <ul className="flex flex-col overflow-hidden rounded-xl bg-surface-3 shadow-surface-3 [&>li+li]:relative [&>li+li]:before:absolute [&>li+li]:before:top-0 [&>li+li]:before:right-0 [&>li+li]:before:left-14 [&>li+li]:before:h-px [&>li+li]:before:bg-border">
        {children}
      </ul>
    </section>
  );
}

/** El ícono sobre un plato del tono de su sección: el color dice de dónde es
 *  sin leer la etiqueta. */
export function Icono({ icono: I, tono, className }: { icono?: ComponentType<{ className?: string }>; tono?: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg",
        "bg-[oklch(0.95_0.035_var(--h))] text-[oklch(0.45_0.13_var(--h))]",
        "dark:bg-[oklch(0.32_0.05_var(--h))] dark:text-[oklch(0.85_0.08_var(--h))]",
        className,
      )}
      style={{ "--h": tono ?? 260 } as CSSProperties}
    >
      {I && <I className="size-4" />}
    </span>
  );
}
