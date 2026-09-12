/**
 * PROTOTIPO — se tira. Cómo se muestra una cuenta en la lista de Accounts, en
 * el teléfono.
 *
 * Cinco formas de la misma fila sobre la pantalla de verdad —los mismos datos,
 * los mismos filtros, el mismo scroll infinito—, conmutables con `?cuentas=` y
 * la píldora de abajo (← → en el teclado). Sólo en `vite dev`.
 *
 * Todas scrollean con el sistema: `ScrollArea` con `scroll-fade` en el viewport
 * —la lista se disuelve contra el borde que todavía tiene contenido— y la barra
 * escondida, como en Inicio: en un táctil el indicador lo pone el aparato.
 *
 * "actual" es lo que hoy está en `main`, para comparar.
 */

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VARIANTES = [
  { key: "actual", nombre: "Fila con badge (hoy)" },
  { key: "B", nombre: "Riel de estado" },
  { key: "C", nombre: "Tarjetas" },
  { key: "D", nombre: "Agrupada por estado" },
  { key: "E", nombre: "Bandeja" },
  { key: "F", nombre: "Contactos" },
  { key: "G", nombre: "Índice A–Z" },
  { key: "H", nombre: "Con actividad" },
  { key: "I", nombre: "Moderación" },
  { key: "J", nombre: "Una línea" },
] as const;
type Variante = (typeof VARIANTES)[number]["key"];

const EVENTO = "prototipo:cuentas";
const leer = (): Variante => {
  const v = new URLSearchParams(location.search).get("cuentas");
  return VARIANTES.some((x) => x.key === v) ? (v as Variante) : "B";
};
const poner = (v: Variante) => {
  const u = new URL(location.href);
  u.searchParams.set("cuentas", v);
  history.replaceState(history.state, "", u);
  window.dispatchEvent(new Event(EVENTO));
};
const useVariante = () =>
  useSyncExternalStore((cb) => {
    window.addEventListener(EVENTO, cb);
    return () => window.removeEventListener(EVENTO, cb);
  }, leer);

/** Lo que la fila necesita saber de una cuenta, ya masticado por la pantalla:
 *  el prototipo no conoce el modelo. */
export interface FilaCuenta {
  id: string;
  nombre: string;
  estado: { label: string; color: string; tinte: string };
  tipo: string;
  /** "2 h ago" */
  cuando: string;
  /** "Mar 4, 2026" */
  alta: string;
  /** El plato de la izquierda, el de verdad. */
  media: ReactNode;
  /** Las dos letras del nombre, como en el header del perfil. */
  iniciales: string;
  /** Mensajes de los últimos 30 días y de los 30 anteriores. */
  last30: number;
  prev30: number;
  /** Cuántos mensajes frenó la moderación, de cuántos en total. */
  bloqueados: number;
  mensajes: number;
}

interface Props {
  filas: FilaCuenta[];
  onAbrir: (id: string) => void;
  /** El centinela del scroll infinito, que va adentro del scroller. */
  centinela: ReactNode;
  /** La lista que hoy está en `main`. */
  actual: ReactNode;
}

const SCROLLER = "scroll-fade scrollbar-hide";

export function CuentasPrototipo({ filas, onAbrir, centinela, actual }: Props) {
  const v = useVariante();
  const comun = { filas, onAbrir, centinela };
  return (
    <>
      {v === "actual" && actual}
      {v === "B" && <Riel {...comun} />}
      {v === "C" && <Tarjetas {...comun} />}
      {v === "D" && <PorEstado {...comun} />}
      {v === "E" && <Bandeja {...comun} />}
      {v === "F" && <Contactos {...comun} />}
      {v === "G" && <Indice {...comun} />}
      {v === "H" && <ConActividad {...comun} />}
      {v === "I" && <Moderacion {...comun} />}
      {v === "J" && <UnaLinea {...comun} />}
      <Conmutador variante={v} cuantas={filas.length} />
    </>
  );
}

type Lista = Omit<Props, "actual">;

/* ─────────────────────── B · Riel de estado ───────────────────────
   El estado deja de ser una píldora y pasa a ser un filete de color pegado al
   borde izquierdo. Gana el ancho entero para el nombre —ninguna cuenta se
   trunca— y la lista se escanea por color, que es más rápido que leer
   "Deactivated" cuarenta veces. Lo que se pierde: el nombre del estado, que
   pasa a haber que saberlo. */

function Riel({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onAbrir(f.id)}
              data-cuelume-press="tick"
              className="relative flex min-h-14 w-full items-center gap-3 py-2 pr-4 pl-4 text-left outline-none active:bg-hover"
            >
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
                style={{ background: f.estado.tinte }}
              />
              {f.media}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {f.id} · {f.tipo}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">{f.cuando}</span>
            </button>
          </li>
        ))}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── C · Tarjetas ───────────────────────────
   Cada cuenta en su propia tarjeta, con aire y con todo lo que la tabla tenía:
   tipo, estado, última actividad y alta, como fichas abajo del nombre. Entran
   cuatro en una pantalla en vez de doce. Es la que mejor se lee de una y la
   peor para recorrer cuarenta y ocho. */

function Tarjetas({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {filas.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onAbrir(f.id)}
            data-cuelume-press="tick"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface-4 p-3 text-left shadow-surface-4 outline-none active:scale-[0.995]"
          >
            <span className="flex items-center gap-2.5">
              {f.media}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                <span className="truncate text-[12px] text-muted-foreground">{f.id}</span>
              </span>
              <Badge variant="dot" color={f.estado.color as never}>
                {f.estado.label}
              </Badge>
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{f.tipo}</span>
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5">Seen {f.cuando}</span>
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5">Added {f.alta}</span>
            </span>
          </button>
        ))}
      </div>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────── D · Agrupada por estado ───────────────────
   Las cuentas van en bloques —Active, Deactivated, Blocked— con la cabecera
   pegada arriba mientras dura el bloque. Ninguna fila repite su estado: lo dice
   el grupo, y lo que queda en la fila es el nombre entero y cuándo se movió.
   Contesta de un vistazo "cuántas bloqueadas hay", que es una pregunta que la
   lista plana no contesta nunca. A cambio pierde el orden por actividad. */

const ORDEN = ["Active", "Deactivated", "Blocked"];

function PorEstado({ filas, onAbrir, centinela }: Lista) {
  const grupos = ORDEN.map((label) => ({
    label,
    tinte: filas.find((f) => f.estado.label === label)?.estado.tinte,
    filas: filas.filter((f) => f.estado.label === label),
  })).filter((g) => g.filas.length > 0);

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      {grupos.map((g) => (
        <section key={g.label}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-surface-3/85 px-4 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-md">
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: g.tinte }} />
            {g.label}
            <span className="opacity-60">{g.filas.length}</span>
          </h3>
          <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
            {g.filas.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(f.id)}
                  data-cuelume-press="tick"
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-hover"
                >
                  {f.media}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{f.id}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">{f.cuando}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── E · Bandeja ───────────────────────────
   La forma de una bandeja de correo: a la izquierda quién es, a la derecha
   cuándo fue, y el estado como un punto al lado de la hora. Sin plato: lo que
   ordena la columna es el nombre, y cuarenta y ocho platos iguales son ruido.
   La más densa —quince filas por pantalla— y la que menos dice de cada una. */

function Bandeja({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onAbrir(f.id)}
              data-cuelume-press="tick"
              className="flex min-h-12 w-full items-start gap-3 px-4 py-2.5 text-left outline-none active:bg-hover"
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {f.id} · {f.tipo}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] text-muted-foreground">
                {f.cuando}
                <span
                  aria-label={f.estado.label}
                  className="size-2 rounded-full"
                  style={{ background: f.estado.tinte }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── F · Contactos ───────────────────────────
   La forma de una agenda: el plato con las iniciales —las mismas del header del
   perfil, que es a donde lleva la fila— y debajo del nombre, en una sola línea,
   qué es y cómo está, con el estado escrito **en su color**. Ni píldora ni
   filete: el estado es una palabra más, teñida.

   Es la que menos se parece a una tabla y la que más se parece a lo que la
   pantalla hace: encontrar a una persona. Lo que se pierde es la hora: cuándo
   se movió no entra sin volver a partir la fila en dos columnas. */

function Contactos({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onAbrir(f.id)}
              data-cuelume-press="tick"
              className="flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-hover"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-medium text-muted-foreground">
                {f.iniciales}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[16px] font-medium">{f.nombre}</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {f.tipo} ·{" "}
                  <span style={{ color: f.estado.tinte }} className="font-medium">
                    {f.estado.label}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── G · Índice A–Z ───────────────────────────
   Ordenada por apellido, con la letra pegada arriba y un riel de letras contra
   el borde derecho para saltar. Es la agenda del teléfono, y contesta la
   pregunta que trae al que abre esta pantalla sabiendo a quién busca: "llevame
   a la P".

   A cambio tira el orden por actividad, que es lo que contesta la otra
   pregunta —"qué pasó hoy"—. Las dos no entran en una lista. */

const apellido = (nombre: string) => nombre.split(" ").at(-1) ?? nombre;

function Indice({ filas, onAbrir, centinela }: Lista) {
  const ordenadas = [...filas].sort((a, b) => apellido(a.nombre).localeCompare(apellido(b.nombre), "es"));
  const letra = (f: FilaCuenta) => apellido(f.nombre)[0]?.toUpperCase() ?? "#";
  const letras = [...new Set(ordenadas.map(letra))];

  const saltar = (l: string) => {
    document.getElementById(`proto-letra-${l}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea className="h-full" viewportClassName={SCROLLER}>
        <ul className="flex flex-col pr-7 [&>li+li]:border-t [&>li+li]:border-border">
          {ordenadas.map((f, i) => (
            <li key={f.id}>
              {letra(f) !== (ordenadas[i - 1] && letra(ordenadas[i - 1])) && (
                <h3
                  id={`proto-letra-${letra(f)}`}
                  className="sticky top-0 z-10 bg-surface-3/85 px-4 py-1 text-[12px] font-semibold text-muted-foreground backdrop-blur-md"
                >
                  {letra(f)}
                </h3>
              )}
              <button
                type="button"
                onClick={() => onAbrir(f.id)}
                data-cuelume-press="tick"
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-hover"
              >
                {f.media}
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{f.id}</span>
                </span>
                <span
                  aria-label={f.estado.label}
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: f.estado.tinte }}
                />
              </button>
            </li>
          ))}
        </ul>
        {centinela}
      </ScrollArea>

      {/* El riel: pegado al borde, del alto de la lista y con blancos de 16px,
          que es lo mínimo que un pulgar acierta arrastrando. */}
      <nav className="absolute inset-y-2 right-0 z-20 flex w-7 flex-col items-center justify-center">
        {letras.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => saltar(l)}
            className="flex h-4 w-full items-center justify-center text-[10px] font-medium text-muted-foreground active:text-foreground"
          >
            {l}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─────────────────────────── H · Con actividad ───────────────────────────
   La lista deja de ser un directorio y pasa a ser un tablero: cada fila lleva
   cuántos mensajes cruzó en treinta días y cómo viene contra los treinta
   anteriores. Es el dato que hoy hay que abrir el perfil para ver, y el que
   contesta "quién se apagó" sin entrar a ninguna cuenta.

   Cuesta el tipo de cuenta y el id, que se van de la fila. */

const variacion = (last30: number, prev30: number) =>
  prev30 === 0 ? null : Math.round(((last30 - prev30) / prev30) * 100);

function ConActividad({ filas, onAbrir, centinela }: Lista) {
  const tope = Math.max(...filas.map((f) => f.last30), 1);

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => {
          const delta = variacion(f.last30, f.prev30);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onAbrir(f.id)}
                data-cuelume-press="tick"
                className="flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-hover"
              >
                {f.media}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.nombre}</span>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums">{f.last30}</span>
                    {delta !== null && (
                      <span
                        className="shrink-0 text-[11px] tabular-nums"
                        style={{ color: delta < 0 ? "#f43f5e" : "#22c55e" }}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </span>
                    )}
                  </span>
                  {/* La barra dice lo mismo que el número, en el largo: dos
                      filas se comparan sin leer. */}
                  <span className="flex h-1 w-full overflow-hidden rounded-full bg-foreground/8">
                    <span
                      className="h-full rounded-full"
                      style={{ width: `${(f.last30 / tope) * 100}%`, background: f.estado.tinte }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── I · Moderación ───────────────────────────
   Lo que esta consola hace con una cuenta es mirar lo que escribe, así que la
   fila lleva lo único que pide atención: cuántos mensajes le frenó la
   moderación. Con cero, la fila está callada —gris, sin nada—; con más, lo dice
   en rojo y con el peso al lado, así la lista se lee de un saque.

   Es la más opinada de todas: convierte un directorio en una cola de trabajo, y
   ordena la atención por algo que la pantalla hasta ahora no decía. */

function Moderacion({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => {
          const tasa = f.mensajes === 0 ? 0 : Math.round((f.bloqueados / f.mensajes) * 100);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onAbrir(f.id)}
                data-cuelume-press="tick"
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-hover"
              >
                {f.media}
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[15px] font-medium">{f.nombre}</span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {f.tipo} · {f.cuando}
                  </span>
                </span>
                {f.bloqueados > 0 ? (
                  <span className="flex shrink-0 flex-col items-end leading-tight">
                    <span className="text-[14px] font-semibold tabular-nums text-[#f43f5e]">
                      {f.bloqueados}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{tasa}% held</span>
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] text-muted-foreground/60">clear</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── J · Una línea ───────────────────────────
   Una fila, una línea, 44px: el punto del estado, el nombre y la hora. El id se
   va —está en el perfil, y en el buscador, que es donde se lo pega—. Entran
   dieciocho cuentas en una pantalla contra las doce de hoy.

   Es la que más rinde por pantalla y la que menos tolera un nombre largo: sin
   segunda línea, lo que no entra se corta. */

function UnaLinea({ filas, onAbrir, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {filas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onAbrir(f.id)}
              data-cuelume-press="tick"
              className="flex h-11 w-full items-center gap-2.5 px-4 text-left outline-none active:bg-hover"
            >
              <span
                aria-label={f.estado.label}
                className="size-2 shrink-0 rounded-full"
                style={{ background: f.estado.tinte }}
              />
              <span className="min-w-0 flex-1 truncate text-[15px]">{f.nombre}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{f.cuando}</span>
            </button>
          </li>
        ))}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── el conmutador ─────────────────────────── */

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
      <div className="pointer-events-auto flex h-10 max-w-[95vw] items-center rounded-full bg-[#1f1147] px-1 font-mono text-[11px] text-white shadow-lg">
        <button type="button" aria-label="Variante anterior" onClick={() => mover(-1)} className="grid size-9 shrink-0 place-items-center">
          <ChevronLeft className="size-4" />
        </button>
        <span className={cn("truncate px-1")}>
          PROTOTIPO · {VARIANTES[i].key} {VARIANTES[i].nombre} · {cuantas} a la vista
        </span>
        <button type="button" aria-label="Variante siguiente" onClick={() => mover(1)} className="grid size-9 shrink-0 place-items-center">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
