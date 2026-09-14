/**
 * PROTOTIPO — se tira. Cómo se muestra un buzón en la lista de Provisioning, en
 * el teléfono.
 *
 * La pregunta: **la fecha de alta arriba a la derecha, y el estado de otra
 * manera en el renglón de abajo.** Eso fija el esqueleto de la fila —dos
 * renglones a la izquierda, dos a la derecha— así que lo que cambia entre
 * variantes no es la planta sino **cuánto habla el estado**: si dice su palabra
 * siempre, sólo cuando algo anda mal, o nada y se lo lee por el color.
 *
 * Cuatro formas sobre la pantalla de verdad —los mismos buzones, los mismos
 * filtros, el mismo scroll—, conmutables con `?buzones=` y la píldora de abajo
 * (← → en el teclado). Sólo en `vite dev`.
 *
 * "actual" es lo que hoy está en la rama, para comparar: sin fecha, y el estado
 * como píldora centrada a la derecha.
 *
 * En todas, el estado sigue abriendo su menú de tres: si una forma no se deja
 * tocar, eso es parte de la respuesta y no se puede ver con texto muerto.
 */

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DropdownContent, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { punto } from "@/components/color-dot";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ESTADOS_BUZON,
  ORDEN_ESTADOS_BUZON,
  cambiarEstadoBuzon,
  type Buzon,
} from "@/pages/buzones";

const VARIANTES = [
  { key: "actual", nombre: "Píldora a la derecha (hoy)" },
  { key: "B", nombre: "Punto y palabra" },
  { key: "C", nombre: "Sólo la excepción" },
  { key: "D", nombre: "Filete bajo la fecha" },
  { key: "E", nombre: "El estado manda" },
] as const;
type Variante = (typeof VARIANTES)[number]["key"];

const EVENTO = "prototipo:buzones";
const leer = (): Variante => {
  const v = new URLSearchParams(location.search).get("buzones");
  return VARIANTES.some((x) => x.key === v) ? (v as Variante) : "B";
};
const poner = (v: Variante) => {
  const u = new URL(location.href);
  u.searchParams.set("buzones", v);
  history.replaceState(history.state, "", u);
  window.dispatchEvent(new Event(EVENTO));
};
const useVariante = () =>
  useSyncExternalStore((cb) => {
    window.addEventListener(EVENTO, cb);
    return () => window.removeEventListener(EVENTO, cb);
  }, leer);

/** Lo que la fila necesita, ya masticado por la pantalla. */
export interface FilaBuzon {
  buzon: Buzon;
  /** El nombre, envuelto en la ficha de la cuenta cuando el buzón es de
   *  alguien. Llega hecho: el prototipo no sabe abrir fichas. */
  nombre: ReactNode;
  /** "Aug 24, 2025" */
  fecha: string;
}

interface Props {
  filas: FilaBuzon[];
  /** El centinela del scroll infinito, que va adentro del scroller. */
  centinela: ReactNode;
  /** La lista que hoy está en la rama. */
  actual: ReactNode;
}

const SCROLLER = "scroll-fade scrollbar-hide";
const LISTA = "flex flex-col [&>li+li]:border-t [&>li+li]:border-border/35";
/* 56px de alto y la sangría de la casa: las cuatro comparten la caja, o lo que
   se estaría comparando es el aire. */
const FILA = "flex min-h-14 w-full items-center gap-3 px-4 py-2";

export function BuzonesPrototipo({ filas, centinela, actual }: Props) {
  const v = useVariante();
  const comun = { filas, centinela };

  return (
    <>
      {v === "actual" && actual}
      {v === "B" && <PuntoYPalabra {...comun} />}
      {v === "C" && <SoloLaExcepcion {...comun} />}
      {v === "D" && <FileteBajoLaFecha {...comun} />}
      {v === "E" && <ElEstadoManda {...comun} />}
      <Conmutador variante={v} cuantas={filas.length} />
    </>
  );
}

type Lista = Omit<Props, "actual">;

/* El menú de los tres estados, con el disparador que le pase cada variante. Es
   el mismo de la pantalla, copiado acá para que el prototipo pueda darle
   cualquier forma sin tocar el de verdad. */
function MenuDeEstado({ buzon, children }: { buzon: Buzon; children: ReactNode }) {
  const estado = ESTADOS_BUZON[buzon.estado];

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <button
            type="button"
            aria-label={`Status: ${estado.label} — change it`}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 outline-none"
          />
        }
      >
        {children}
      </DropdownTrigger>
      <DropdownContent side="bottom" align="end" className="w-auto">
        {ORDEN_ESTADOS_BUZON.map((valor, i) => (
          <MenuItem
            key={valor}
            index={i}
            icon={punto(ESTADOS_BUZON[valor].tinte)}
            label={ESTADOS_BUZON[valor].label}
            checked={valor === buzon.estado}
            onSelect={() => cambiarEstadoBuzon(buzon, valor)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

/** La columna de la izquierda, igual en las cuatro: nombre y dirección. */
function Identidad({ fila }: { fila: FilaBuzon }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[13px]">{fila.nombre}</span>
      <span className="truncate text-[12px] text-muted-foreground">
        {fila.buzon.direccion}
      </span>
    </span>
  );
}

/* ─────────────────────── B · Punto y palabra ───────────────────────
   La lectura literal del pedido: arriba la fecha, abajo el estado con su punto
   de color y su palabra, los dos en el gris secundario y alineados a la
   derecha. La columna derecha queda pareja —dos renglones del mismo peso— y la
   fila se lee de una: quién, dónde, desde cuándo, cómo está.

   Lo que cuesta: el estado deja de ser una píldora, así que pierde el fondo que
   lo hacía saltar. Barrer cuarenta filas buscando el que no anda pasa a ser
   leer cuarenta palabras grises, y el color del punto es lo único que ayuda. */
function PuntoYPalabra({ filas, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className={LISTA}>
        {filas.map((f) => {
          const estado = ESTADOS_BUZON[f.buzon.estado];
          return (
            <li key={f.buzon.direccion}>
              <div className={FILA}>
                <Identidad fila={f} />
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {f.fecha}
                  </span>
                  <MenuDeEstado buzon={f.buzon}>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: estado.tinte }}
                    />
                    <span className="text-[12px] text-muted-foreground">
                      {estado.label}
                    </span>
                  </MenuDeEstado>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────── C · Sólo la excepción ───────────────────────
   El estado habla nada más cuando hay algo que decir: Suspended y Inactive se
   escriben en su color, y Active se calla. Es lo mismo que hace la fila de
   Accounts con el punto de estado, y lo que hace cualquier consola que se mira
   de reojo: lo normal no ocupa lugar.

   Treinta y siete de los cuarenta y un buzones andan, así que la columna queda
   casi vacía y los cuatro que no andan saltan sin buscarlos. Lo que se pierde:
   confirmar que uno *sí* anda pasa a ser deducirlo del silencio, y el que no
   conoce la regla puede leer el vacío como "no se sabe". El menú, además, sólo
   está donde hay palabra —en las filas activas hay que abrir otra cosa. */
function SoloLaExcepcion({ filas, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className={LISTA}>
        {filas.map((f) => {
          const estado = ESTADOS_BUZON[f.buzon.estado];
          const anda = f.buzon.estado === "active";
          return (
            <li key={f.buzon.direccion}>
              <div className={FILA}>
                <Identidad fila={f} />
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {f.fecha}
                  </span>
                  <MenuDeEstado buzon={f.buzon}>
                    {anda ? (
                      <span className="text-[12px] text-muted-foreground/40">
                        &mdash;
                      </span>
                    ) : (
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: estado.tinte }}
                      >
                        {estado.label}
                      </span>
                    )}
                  </MenuDeEstado>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────── D · Filete bajo la fecha ───────────────────
   El estado sin palabra: una barra de color del ancho de la fecha, pegada
   debajo. La fila queda con dos renglones a cada lado y ninguno de texto
   repetido, y la lista se escanea por color puro —cuatro barras ámbar entre
   treinta y siete verdes se ven de un metro—.

   Es la más callada y la más rápida de barrer, y la que más pide saberse el
   código: sin la palabra, "ámbar" no es "suspendido" para nadie que llegue
   nuevo. La palabra sigue estando para el lector de pantalla, que es lo mínimo,
   pero un `sr-only` no le enseña a nadie con los ojos. */
function FileteBajoLaFecha({ filas, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className={LISTA}>
        {filas.map((f) => {
          const estado = ESTADOS_BUZON[f.buzon.estado];
          return (
            <li key={f.buzon.direccion}>
              <div className={FILA}>
                <Identidad fila={f} />
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {f.fecha}
                  </span>
                  <MenuDeEstado buzon={f.buzon}>
                    <span className="sr-only">{estado.label}</span>
                    <span
                      aria-hidden
                      className="h-[3px] w-14 rounded-full"
                      style={{ background: estado.tinte }}
                    />
                  </MenuDeEstado>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────── E · El estado manda ───────────────────────
   Se da vuelta el peso de la columna: el estado va en su color y en el escalón
   del cuerpo, y la fecha queda arriba, chiquita y gris, acompañando. Dice que
   de un buzón lo que importa es si anda, y que la fecha es el dato de archivo
   que uno mira una vez.

   Es la que mejor contesta "¿cuáles no andan?" sin perder la palabra, y la que
   peor queda cuando todos andan: cuarenta "Active" en verde son cuarenta cosas
   gritando lo mismo, y el ojo deja de verlas a las tres filas. */
function ElEstadoManda({ filas, centinela }: Lista) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className={LISTA}>
        {filas.map((f) => {
          const estado = ESTADOS_BUZON[f.buzon.estado];
          return (
            <li key={f.buzon.direccion}>
              <div className={FILA}>
                <Identidad fila={f} />
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">
                    {f.fecha}
                  </span>
                  <MenuDeEstado buzon={f.buzon}>
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: estado.tinte }}
                    >
                      {estado.label}
                    </span>
                  </MenuDeEstado>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── El conmutador ─────────────────────────── */

function Conmutador({ variante, cuantas }: { variante: Variante; cuantas: number }) {
  const i = VARIANTES.findIndex((x) => x.key === variante);
  const mover = (d: number) =>
    poner(VARIANTES[(i + d + VARIANTES.length) % VARIANTES.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "ArrowRight") mover(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Que un merge distraído no lo publique.
  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="pointer-events-auto flex h-10 max-w-[95vw] items-center rounded-full bg-[#1f1147] px-1 font-mono text-[11px] text-white shadow-lg">
        <button
          type="button"
          aria-label="Variante anterior"
          onClick={() => mover(-1)}
          className="grid size-9 shrink-0 place-items-center"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className={cn("truncate px-1")}>
          PROTOTIPO · {VARIANTES[i].key} {VARIANTES[i].nombre} · {cuantas} a la vista
        </span>
        <button
          type="button"
          aria-label="Variante siguiente"
          onClick={() => mover(1)}
          className="grid size-9 shrink-0 place-items-center"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
