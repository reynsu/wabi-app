/**
 * PROTOTIPO — se tira. Cómo mostrar las pestañas abiertas en el Inicio del
 * teléfono.
 *
 * Cuatro variantes del bloque de lo abierto sobre el Inicio de verdad —el resto
 * de la pantalla no cambia—, conmutables con `?abiertas=` y la barra flotante
 * de abajo (← → en el teclado). Sólo en `vite dev`: en el build esto ni se
 * monta. "actual" es lo que hay hoy, para comparar.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { cn } from "@/lib/utils";
import { Hoja } from "./hoja";

const VARIANTES = [
  { key: "actual", nombre: "Fichas (hoy)" },
  { key: "A", nombre: "Lista" },
  { key: "B", nombre: "Tarjetas" },
  { key: "C", nombre: "Mosaico" },
  { key: "D", nombre: "Pila" },
] as const;
type Variante = (typeof VARIANTES)[number]["key"];

const EVENTO = "prototipo:abiertas";
const leer = (): Variante => {
  const v = new URLSearchParams(location.search).get("abiertas");
  return VARIANTES.some((x) => x.key === v) ? (v as Variante) : "A";
};
const poner = (v: Variante) => {
  const u = new URL(location.href);
  u.searchParams.set("abiertas", v);
  // El estado de la entrada se conserva: es el del historial móvil.
  history.replaceState(history.state, "", u);
  window.dispatchEvent(new Event(EVENTO));
};
const useVariante = () =>
  useSyncExternalStore((cb) => {
    window.addEventListener(EVENTO, cb);
    return () => window.removeEventListener(EVENTO, cb);
  }, leer);

export interface AbiertasProps {
  /** Lo de hoy, tal cual lo arma Inicio. */
  actual: ReactNode;
  /** Por última visita: la primera es la que se estaba mirando. */
  recientes: WorkspaceTab[];
  vistas: Record<string, number>;
  seccionDe: (id: string) => string | undefined;
  plato: (tab: WorkspaceTab, className: string) => ReactNode;
  mostrar: (tab: WorkspaceTab) => void;
  cerrar: (id: string) => void;
}

export function AbiertasPrototipo(props: AbiertasProps) {
  const v = useVariante();
  return (
    <>
      {v === "actual" && props.actual}
      {v === "A" && <Lista {...props} />}
      {v === "B" && <Tarjetas {...props} />}
      {v === "C" && <Mosaico {...props} />}
      {v === "D" && <Pila {...props} />}
      <Conmutador variante={v} cuantas={props.recientes.length} />
    </>
  );
}

/* ─────────────────────────── A · Lista ───────────────────────────
   Filas como las de Ajustes: el nombre entero —nada se trunca a 9rem—, de qué
   sección es y cuándo se miró. Tres a la vista y el resto detrás de un "Show
   all": lo abierto no empuja la grilla fuera de la pantalla. */

function Lista({ recientes, vistas, seccionDe, plato, mostrar, cerrar }: AbiertasProps) {
  const [todas, setTodas] = useState(false);
  const hace = useHace();
  if (recientes.length === 0) return null;
  const visibles = todas ? recientes : recientes.slice(0, 3);

  return (
    <section className="-mt-2 flex flex-col gap-2.5">
      <Titulo nombre="Open" cuenta={recientes.length}>
        {recientes.length > 3 && (
          <button type="button" onClick={() => setTodas((t) => !t)} className="text-[12px] font-medium text-[oklch(0.5_0.2_292)]">
            {todas ? "Show less" : `Show all ${recientes.length}`}
          </button>
        )}
      </Titulo>
      <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3 [&>li+li]:border-t [&>li+li]:border-border">
        {visibles.map((t, n) => (
          <li key={t.id} className="flex items-center">
            <button type="button" onClick={() => mostrar(t)} className="flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left active:bg-hover">
              {plato(t, "size-8 rounded-lg")}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{t.label}</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {n === 0 ? "Viewing" : [seccionDe(t.id), hace(vistas[t.id])].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
            <Cerrar tab={t} cerrar={cerrar} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────── B · Tarjetas ───────────────────────────
   Un carrusel de tarjetas del tamaño de un pulgar: más blanco que una ficha y
   con lugar para dos líneas de nombre. La que se estaba mirando va primera y
   marcada. Asoma la siguiente en el borde, así se sabe que hay más. */

function Tarjetas({ recientes, vistas, seccionDe, plato, mostrar, cerrar }: AbiertasProps) {
  const hace = useHace();
  if (recientes.length === 0) return null;

  return (
    <section className="-mt-2 flex flex-col gap-2.5">
      <Titulo nombre="Open" cuenta={recientes.length} />
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {recientes.map((t, n) => (
          <div
            key={t.id}
            className={cn(
              "relative flex h-28 w-[40%] shrink-0 snap-start flex-col rounded-2xl bg-surface-3 shadow-surface-3",
              n === 0 && "ring-2 ring-[oklch(0.58_0.2_292)]",
            )}
          >
            <button type="button" onClick={() => mostrar(t)} className="flex flex-1 flex-col gap-2 p-3 text-left">
              {plato(t, "size-8 rounded-lg")}
              <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{t.label}</span>
              <span className="mt-auto truncate text-[11px] text-muted-foreground">
                {n === 0 ? "Viewing" : hace(vistas[t.id]) || seccionDe(t.id)}
              </span>
            </button>
            <div className="absolute top-1 right-1">
              <Cerrar tab={t} cerrar={cerrar} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── C · Mosaico ───────────────────────────
   Dos columnas de mosaicos bajos, sin scroll de costado: todo lo abierto se ve
   de un vistazo y ocupa como mucho dos filas. A partir de la quinta, el último
   mosaico dice cuántas más hay y las abre en una hoja. */

function Mosaico({ recientes, seccionDe, plato, mostrar, cerrar }: AbiertasProps) {
  const [hoja, setHoja] = useState(false);
  if (recientes.length === 0) return null;
  const sobran = recientes.length > 4;
  const visibles = sobran ? recientes.slice(0, 3) : recientes;

  return (
    <section className="-mt-2 flex flex-col gap-2.5">
      <Titulo nombre="Open" cuenta={recientes.length} />
      <div className="grid grid-cols-2 gap-2">
        {visibles.map((t, n) => (
          <div key={t.id} className={cn("flex h-12 items-center rounded-xl bg-surface-3 shadow-surface-3", n === 0 && "ring-2 ring-[oklch(0.58_0.2_292)]")}>
            <button type="button" onClick={() => mostrar(t)} className="flex h-full min-w-0 flex-1 items-center gap-2 pl-2 text-left">
              {plato(t, "size-8 rounded-lg")}
              <span className="min-w-0 truncate text-[13px] font-medium">{t.label}</span>
            </button>
            <Cerrar tab={t} cerrar={cerrar} chico />
          </div>
        ))}
        {sobran && (
          <button
            type="button"
            onClick={() => setHoja(true)}
            className="flex h-12 items-center justify-center rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground"
          >
            +{recientes.length - 3} more
          </button>
        )}
      </div>
      <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo={`${recientes.length} open`}>
        <ListaCompleta {...{ recientes, seccionDe, plato, cerrar }} mostrar={(t) => (setHoja(false), mostrar(t))} />
      </Hoja>
    </section>
  );
}

/* ─────────────────────────── D · Pila ───────────────────────────
   Lo mínimo: una sola fila. A la izquierda, volver a la que se estaba mirando
   —el toque más común, ancho—; a la derecha, el resto apilado en platos con
   cuántas son, que abre la lista entera en una hoja. Inicio queda casi entero
   para la grilla, y lo abierto está a un toque, no a la vista. */

function Pila({ recientes, seccionDe, plato, mostrar, cerrar }: AbiertasProps) {
  const [hoja, setHoja] = useState(false);
  if (recientes.length === 0) return null;
  const [primera] = recientes;

  return (
    <section className="-mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={() => mostrar(primera)}
        className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-3 pr-2 pl-3 text-left shadow-surface-3"
      >
        {plato(primera, "size-9 rounded-xl")}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] text-muted-foreground">Back to</span>
          <span className="truncate text-[15px] font-semibold">{primera.label}</span>
        </span>
      </button>
      {recientes.length > 1 && (
        <button
          type="button"
          onClick={() => setHoja(true)}
          aria-label={`${recientes.length} open`}
          className="flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-surface-3 px-3 shadow-surface-3"
        >
          <span className="flex">
            {recientes.slice(1, 4).map((t, n) => (
              <span key={t.id} className={cn("rounded-full ring-2 ring-surface-3", n > 0 && "-ml-2.5")}>
                {plato(t, "size-7 rounded-full")}
              </span>
            ))}
          </span>
          <span className="text-[13px] font-semibold">{recientes.length - 1}</span>
          <ChevronRight className="-ml-1 size-4 text-muted-foreground" />
        </button>
      )}
      <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo={`${recientes.length} open`}>
        <ListaCompleta {...{ recientes, seccionDe, plato, cerrar }} mostrar={(t) => (setHoja(false), mostrar(t))} />
      </Hoja>
    </section>
  );
}

/* ─────────────────────────── piezas ─────────────────────────── */

function ListaCompleta({
  recientes,
  seccionDe,
  plato,
  mostrar,
  cerrar,
}: Pick<AbiertasProps, "recientes" | "seccionDe" | "plato" | "mostrar" | "cerrar">) {
  return (
    <ul className="mx-3 mb-3 flex flex-col overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3 [&>li+li]:border-t [&>li+li]:border-border">
      {recientes.map((t, n) => (
        <li key={t.id} className="flex items-center">
          <button type="button" onClick={() => mostrar(t)} className="flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left active:bg-hover">
            {plato(t, "size-8 rounded-lg")}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">{t.label}</span>
              <span className="text-[12px] text-muted-foreground">{n === 0 ? "Viewing" : seccionDe(t.id) ?? " "}</span>
            </span>
          </button>
          <Cerrar tab={t} cerrar={cerrar} />
        </li>
      ))}
    </ul>
  );
}

function Titulo({ nombre, cuenta, children }: { nombre: string; cuenta: number; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="text-[12px] font-medium text-muted-foreground">
        {nombre} <span className="opacity-60">{cuenta}</span>
      </h2>
      {children}
    </div>
  );
}

function Cerrar({ tab, cerrar, chico }: { tab: WorkspaceTab; cerrar: (id: string) => void; chico?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Close ${tab.label}`}
      onClick={() => cerrar(tab.id)}
      data-cuelume-press="droplet"
      className={cn("grid shrink-0 place-items-center rounded-full text-muted-foreground", chico ? "size-9" : "size-11")}
    >
      <X className="size-3.5" />
    </button>
  );
}

function useHace() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (cuando?: number) => {
    if (!cuando) return "";
    const min = Math.floor((ahora - cuando) / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)} h ago`;
  };
}

/* ─────────────────────────── el conmutador ───────────────────────────
   Una píldora oscura abajo, fuera del diseño que se evalúa. Dice qué variante
   se ve y cuántas pestañas hay abiertas —con una o dos, varias variantes se ven
   iguales: conviene abrir cinco o seis antes de juzgar—. */

function Conmutador({ variante, cuantas }: { variante: Variante; cuantas: number }) {
  const i = VARIANTES.findIndex((x) => x.key === variante);
  const mover = (d: number) => poner(VARIANTES[(i + d + VARIANTES.length) % VARIANTES.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "ArrowRight") mover(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="pointer-events-auto flex h-10 items-center rounded-full bg-[#1f1147] px-1 font-mono text-[11px] text-white shadow-lg">
        <button type="button" aria-label="Variante anterior" onClick={() => mover(-1)} className="grid size-9 place-items-center">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-1 whitespace-nowrap">
          PROTOTIPO · {VARIANTES[i].key} {VARIANTES[i].nombre} · {cuantas} abiertas
        </span>
        <button type="button" aria-label="Variante siguiente" onClick={() => mover(1)} className="grid size-9 place-items-center">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
