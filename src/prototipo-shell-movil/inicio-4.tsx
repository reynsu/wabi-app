/**
 * PROTOTIPO — Inicio J4: bento.
 *
 * Todo Inicio en una sola pantalla, sin scrollear, como un tablero de baldosas
 * de distinto tamaño. El tamaño lo decide cuánto hay adentro, no un orden de
 * lectura: Email, con cuatro pantallas, es alta; Tickets, con una, es un
 * cuadrado chico que **es** el botón. Cada baldosa lleva el tono de su sección
 * de fondo, así que la pantalla se lee como un mapa: el ojo encuentra "lo
 * azul" antes que la palabra Email.
 */

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavLeaf } from "@/navigation";
import { TONO, saludo, useHace, useInicio, type SeccionInicio } from "./inicio-datos";
import { Icono } from "./inicio-1";

export function InicioBento({ onIr }: { onIr: () => void }) {
  const { nombre, recientes, secciones, ir, abrir, cerrar } = useInicio(onIr);
  const hace = useHace();
  const s = (id: string) => secciones.find((x) => x.id === id)!;

  return (
    <div className="flex flex-col gap-3 px-3 pt-4 pb-6">
      <p className="px-1 text-[22px] font-bold leading-tight">
        {saludo()}
        {nombre && <span className="text-muted-foreground">, {nombre}</span>}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Recientes: la baldosa ancha de arriba, tres filas como máximo. */}
        {recientes.length > 0 && (
          <Baldosa className="col-span-2 bg-surface-3 p-1.5 shadow-surface-3">
            <span className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Seguir</span>
            {recientes.slice(0, 3).map(({ tab, seccion, visto }) => (
              <span key={tab.id} className="flex items-center">
                <button type="button" onClick={() => ir(tab.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left active:bg-hover">
                  <Icono icono={tab.icon} tono={seccion && TONO[seccion.id]} className="size-7" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{tab.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{hace(visto)}</span>
                </button>
                <button type="button" aria-label={`Cerrar ${tab.label}`} onClick={() => cerrar(tab.id)} className="grid size-10 shrink-0 place-items-center text-muted-foreground/70">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </Baldosa>
        )}

        <Seccion s={s("chat")} abrir={abrir} />
        <Seccion s={s("email")} abrir={abrir} className="row-span-2" />
        {/* Las de una pantalla: la baldosa entera es el botón. */}
        <div className="grid grid-cols-2 gap-2.5">
          <Unica s={s("tickets")} abrir={abrir} />
          <Unica s={s("announcements")} abrir={abrir} />
        </div>
        <Seccion s={s("admin")} abrir={abrir} className="col-span-2" columnas />
      </div>
    </div>
  );
}

function Baldosa({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-3xl", className)} style={style}>
      {children}
    </div>
  );
}

const tinte = (id: string) =>
  ({ "--h": TONO[id] }) as CSSProperties;
const FONDO = "bg-[oklch(0.965_0.022_var(--h))] dark:bg-[oklch(0.27_0.035_var(--h))]";
const TINTA = "text-[oklch(0.42_0.12_var(--h))] dark:text-[oklch(0.86_0.08_var(--h))]";

function Seccion({
  s,
  abrir,
  className,
  columnas,
}: {
  s: SeccionInicio;
  abrir: (h: NavLeaf) => void;
  className?: string;
  columnas?: boolean;
}) {
  const I = s.icon;
  return (
    <Baldosa className={cn(FONDO, "p-1.5", className)} style={tinte(s.id)}>
      <span className={cn("flex items-center gap-2 px-2.5 pt-2 pb-1.5", TINTA)}>
        <I className="size-4" />
        <span className="text-[13px] font-semibold">{s.label}</span>
      </span>
      <span className={cn("grid gap-0.5", columnas && "grid-cols-2")}>
        {s.hojas.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => abrir(h)}
            className="flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-left text-[14px] active:bg-black/5 dark:active:bg-white/10"
          >
            <span className="min-w-0 flex-1 truncate">{h.label}</span>
            {s.abiertas.has(h.id) && <span className={cn("size-1.5 shrink-0 rounded-full bg-current", TINTA)} />}
          </button>
        ))}
      </span>
    </Baldosa>
  );
}

function Unica({ s, abrir }: { s: SeccionInicio; abrir: (h: NavLeaf) => void }) {
  const h = s.hojas[0];
  const I = h.icon;
  return (
    <button
      type="button"
      onClick={() => abrir(h)}
      style={tinte(s.id)}
      className={cn("relative flex aspect-square flex-col justify-between rounded-3xl p-3 text-left active:scale-[0.97]", FONDO)}
    >
      <I className={cn("size-5", TINTA)} />
      <span className="text-[13px] font-semibold leading-tight">{s.label}</span>
      {s.abiertas.has(h.id) && <span className={cn("absolute top-3 right-3 size-1.5 rounded-full bg-current", TINTA)} />}
    </button>
  );
}
