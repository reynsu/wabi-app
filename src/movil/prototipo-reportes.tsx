/**
 * PROTOTIPO — se tira. Cómo se muestra un reporte pedido en la lista de Admin ›
 * Reports, en el teléfono.
 *
 * La pregunta: **qué le queda a la fila cuando la tabla pierde tres de sus
 * cinco columnas.** Veinticinco pedidos, veintidós terminados: el estado dice
 * "Completed" veintidós veces, el nombre ya lleva adentro el tipo y el día, y
 * quién lo pidió —que en la tabla vive escondido en un `title`— no tiene dónde
 * caer. Las variantes no discuten el layout de a dos renglones sino **qué se
 * imprime en las veinticinco filas y qué se deja para el que abre**.
 *
 * Cuatro formas sobre la pantalla de verdad —los mismos reportes, los mismos
 * filtros, la misma bajada—, conmutables con `?reportes=` y la píldora de abajo
 * (← → en el teclado). Sólo en `vite dev`.
 *
 * "actual" es lo que hoy está sin commitear en la rama, para comparar: dos
 * renglones, con la pastilla del estado, quién y hace cuánto abajo.
 *
 * En todas, bajar funciona de verdad —cae el archivo— y la fila abre el
 * reporte: si una forma esconde la acción hasta que no se encuentra, eso es
 * parte de la respuesta y con botones muertos no se ve.
 */

import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  Loader,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GLIFOS, claseDeArchivo } from "@/lib/archivos";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { Deslizable, GrupoDeslizable, type AccionDeslizable } from "@/movil/deslizable";
import { useBajadaDOC } from "@/pages/bajar-reporte-doc";
import {
  ESTADOS_DE_REPORTE,
  TIPOS_DE_REPORTE_DOC,
  archivoDeReporteDOC,
  sePuedeBajar,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { diaLargo, haceCuanto, hora } from "@/pages/tiempo";

const VARIANTES = [
  { key: "actual", nombre: "Dos renglones (hoy)" },
  { key: "B", nombre: "Sólo la excepción" },
  { key: "C", nombre: "Por día" },
  { key: "D", nombre: "El botón a la vista" },
  { key: "E", nombre: "Un renglón" },
] as const;
type Variante = (typeof VARIANTES)[number]["key"];

const EVENTO = "prototipo:reportes";
const leer = (): Variante => {
  const v = new URLSearchParams(location.search).get("reportes");
  return VARIANTES.some((x) => x.key === v) ? (v as Variante) : "actual";
};
const poner = (v: Variante) => {
  const u = new URL(location.href);
  u.searchParams.set("reportes", v);
  history.replaceState(history.state, "", u);
  window.dispatchEvent(new Event(EVENTO));
};
const useVariante = () =>
  useSyncExternalStore((cb) => {
    window.addEventListener(EVENTO, cb);
    return () => window.removeEventListener(EVENTO, cb);
  }, leer);

/** Lo que la fila necesita, ya masticado por la pantalla. */
export interface FilaReporte {
  reporte: ReporteDOC;
  /** Quién lo pidió, ya resuelto contra la tabla de cuentas DOC. */
  quien: string;
}

interface Props {
  filas: FilaReporte[];
  /** El centinela del scroll infinito, que va adentro del scroller. */
  centinela: ReactNode;
  onAbrir: (reporte: ReporteDOC) => void;
  /** La lista que hoy está en la rama. */
  actual: ReactNode;
}

const SCROLLER = "scroll-fade scrollbar-hide";
const LISTA = "flex flex-col [&>li+li]:border-t [&>li+li]:border-border/35";
/* La caja, compartida por las cuatro: 56px de alto y la sangría de la casa, o
   lo que se estaría comparando es el aire. E la pisa a propósito. */
const FILA = "flex min-h-14 w-full flex-col justify-center gap-1 px-4 py-2.5";
const ABRIBLE =
  "w-full cursor-pointer text-left outline-none active:bg-hover " +
  "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]";

export function ReportesPrototipo({ filas, centinela, onAbrir, actual }: Props) {
  const v = useVariante();
  const comun = { filas, centinela, onAbrir };

  return (
    <>
      {v === "actual" && actual}
      {v === "B" && <SoloLaExcepcion {...comun} />}
      {v === "C" && <PorDia {...comun} />}
      {v === "D" && <BotonALaVista {...comun} />}
      {v === "E" && <UnRenglon {...comun} />}
      <Conmutador variante={v} cuantas={filas.length} />
    </>
  );
}

type Lista = Omit<Props, "actual">;

/* De qué clase es el archivo, en un glifo, con el hueco reservado: lo que no
   está listo no tiene archivo, y sin la reserva esos nombres arrancarían veinte
   píxeles a la izquierda. Es el de la pantalla, copiado para poder tintarlo. */
function Glifo({ reporte, tinte }: { reporte: ReporteDOC; tinte?: string }) {
  const G = GLIFOS[claseDeArchivo(archivoDeReporteDOC(reporte))];

  return (
    <span className="flex w-4 shrink-0 justify-center">
      {sePuedeBajar(reporte) && (
        <G
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className={tinte ? undefined : "text-muted-foreground"}
          style={tinte ? { color: tinte } : undefined}
        />
      )}
    </span>
  );
}

/* La fila que se corre para bajar y se toca para abrir. La comparten B, C y E:
   lo que cambia entre ellas es lo que va adentro, no cómo se toca. D no la usa,
   que es justamente lo que D discute. */
function Corrible({
  reporte,
  onAbrir,
  children,
}: {
  reporte: ReporteDOC;
  onAbrir: (reporte: ReporteDOC) => void;
  children: ReactNode;
}) {
  const listo = sePuedeBajar(reporte);
  const { bajando, alTocar } = useBajadaDOC(reporte);

  const acciones: AccionDeslizable[] = listo
    ? [{ label: bajando ? "…" : "Download", icon: Download, onSelect: alTocar }]
    : [];

  return (
    <li>
      <Deslizable id={reporte.id} acciones={acciones}>
        {listo ? (
          <button type="button" onClick={() => onAbrir(reporte)} className={ABRIBLE}>
            {children}
          </button>
        ) : (
          children
        )}
      </Deslizable>
    </li>
  );
}

/* ─────────────────────── B · Sólo la excepción ───────────────────────
   El veredicto de la fila del buzón, traído acá: veintidós de veinticinco están
   terminados, así que "Completed" es lo que dicen casi todas y por eso no dice
   nada. El estado se calla cuando no hay noticia y el renglón de abajo queda
   para quién lo pidió; los tres que esperan, se arman o se cayeron ponen su
   pastilla y son los únicos que la tienen.

   Lo que cuesta: confirmar que uno *sí* salió pasa a ser leer el silencio —o el
   glifo del archivo, que es la otra manera de decir que hay algo—. */
function SoloLaExcepcion({ filas, centinela, onAbrir }: Lista) {
  const escala = useTypeScale();

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <GrupoDeslizable>
        <ul className={LISTA}>
          {filas.map(({ reporte, quien }) => {
            const estado = ESTADOS_DE_REPORTE[reporte.estado];

            return (
              <Corrible key={reporte.id} reporte={reporte} onAbrir={onAbrir}>
                <span className={FILA}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Glifo reporte={reporte} />
                    <span className="min-w-0 truncate" style={{ fontSize: escala.body }}>
                      {reporte.nombre}
                    </span>
                  </span>

                  <span className="flex min-w-0 items-center gap-2">
                    {!sePuedeBajar(reporte) && (
                      <Badge variant="dot" size="compact" color={estado.color}>
                        {estado.label}
                      </Badge>
                    )}
                    <span
                      className="min-w-0 flex-1 truncate text-muted-foreground"
                      style={{ fontSize: escala.caption }}
                    >
                      {quien}
                    </span>
                    <span
                      className="shrink-0 tabular-nums text-muted-foreground"
                      style={{ fontSize: escala.caption }}
                    >
                      {haceCuanto(reporte.pedidoEl)}
                    </span>
                  </span>
                </span>
              </Corrible>
            );
          })}
        </ul>
      </GrupoDeslizable>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────────── C · Por día ───────────────────────────
   El nombre de un reporte es su tipo y el día en que se pidió, y esta lista
   está ordenada por ese día: escribirlo en cada fila es escribir veinticinco
   veces algo que se repite de a racimos —ocho pedidos de Sabrina Toledo en
   cuatro días de junio—. Sube a un encabezado que se queda pegado arriba, la
   fila se queda con el tipo solo, y a la derecha va la hora, que es lo único
   que distingue dos pedidos del mismo día.

   Lo que cuesta: la lista deja de ser plana, y en el teléfono eso ya se probó y
   se sacó una vez —los correos del perfil no se agrupan por carpeta—. */
function PorDia({ filas, centinela, onAbrir }: Lista) {
  const escala = useTypeScale();

  /* Los días, armados antes de dibujar: la lista ya viene ordenada por el
     pedido, así que un día es un tramo de filas seguidas. */
  const dias: { dia: string; filas: FilaReporte[] }[] = [];
  for (const fila of filas) {
    const dia = diaLargo(fila.reporte.pedidoEl);
    const ultimo = dias.at(-1);
    if (ultimo?.dia === dia) ultimo.filas.push(fila);
    else dias.push({ dia, filas: [fila] });
  }

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <GrupoDeslizable>
        <ul className={LISTA}>
          {dias.map(({ dia, filas: delDia }) => (
            <Fragment key={dia}>
              <li
                className="sticky top-0 z-10 bg-surface-1/95 px-4 py-1.5 font-medium text-muted-foreground backdrop-blur-sm"
                style={{ fontSize: escala.caption }}
              >
                {dia}
              </li>
              {delDia.map(({ reporte, quien }) => {
                const estado = ESTADOS_DE_REPORTE[reporte.estado];

                return (
                  <Corrible key={reporte.id} reporte={reporte} onAbrir={onAbrir}>
                    <span className={FILA}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Glifo reporte={reporte} />
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={{ fontSize: escala.body }}
                        >
                          {TIPOS_DE_REPORTE_DOC[reporte.tipo].label}
                        </span>
                        <span
                          className="shrink-0 tabular-nums text-muted-foreground"
                          style={{ fontSize: escala.caption }}
                        >
                          {hora(reporte.pedidoEl)}
                        </span>
                      </span>

                      <span className="flex min-w-0 items-center gap-2">
                        {!sePuedeBajar(reporte) && (
                          <Badge variant="dot" size="compact" color={estado.color}>
                            {estado.label}
                          </Badge>
                        )}
                        <span
                          className="min-w-0 truncate text-muted-foreground"
                          style={{ fontSize: escala.caption }}
                        >
                          {quien}
                        </span>
                      </span>
                    </span>
                  </Corrible>
                );
              })}
            </Fragment>
          ))}
        </ul>
      </GrupoDeslizable>
      {centinela}
    </ScrollArea>
  );
}

/* ─────────────────────── D · El botón a la vista ───────────────────────
   Sin gesto: la única acción de la pantalla se dibuja. Y la columna de la
   derecha se lleva también el estado, porque acá son la misma pregunta —¿hay
   archivo?—: terminado da el botón de bajar, esperando un reloj, armándose la
   rueda, caído la alerta. Así el renglón de abajo no lleva pastilla y queda
   entero para quién lo pidió y cuándo.

   Lo que cuesta: 44px de fila por el blanco táctil, y un botón que en
   veintidós filas de veinticinco dice lo mismo. Lo que compra: nadie tiene que
   descubrir un gesto para bajar un reporte, que es a lo que se entra acá. */
function BotonALaVista({ filas, centinela, onAbrir }: Lista) {
  const escala = useTypeScale();

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <ul className={LISTA}>
        {filas.map(({ reporte, quien }) => (
          <li key={reporte.id} className="flex items-center gap-1 pr-2">
            <button
              type="button"
              onClick={() => sePuedeBajar(reporte) && onAbrir(reporte)}
              disabled={!sePuedeBajar(reporte)}
              className={cn(ABRIBLE, "min-w-0 flex-1 disabled:cursor-default")}
            >
              <span className={cn(FILA, "pr-0")}>
                <span className="flex min-w-0 items-center gap-2">
                  <Glifo reporte={reporte} />
                  <span className="min-w-0 truncate" style={{ fontSize: escala.body }}>
                    {reporte.nombre}
                  </span>
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="min-w-0 flex-1 truncate text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {quien}
                  </span>
                  <span
                    className="shrink-0 tabular-nums text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {haceCuanto(reporte.pedidoEl)}
                  </span>
                </span>
              </span>
            </button>

            <EnLaDerecha reporte={reporte} />
          </li>
        ))}
      </ul>
      {centinela}
    </ScrollArea>
  );
}

/* El estado y la acción, en el mismo lugar: son la misma pregunta. */
function EnLaDerecha({ reporte }: { reporte: ReporteDOC }) {
  const estado = ESTADOS_DE_REPORTE[reporte.estado];
  const { bajando, alTocar } = useBajadaDOC(reporte);

  if (sePuedeBajar(reporte)) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Download ${reporte.nombre}`}
        loading={bajando}
        onClick={alTocar}
      >
        <Download />
      </Button>
    );
  }

  const Icono =
    reporte.estado === "processing"
      ? Loader
      : reporte.estado === "failed"
        ? CircleAlert
        : Clock;

  return (
    <span className="grid size-9 shrink-0 place-items-center">
      <span className="sr-only">{estado.label}</span>
      <Icono
        size={16}
        strokeWidth={1.5}
        aria-hidden
        className={cn(reporte.estado === "processing" && "animate-spin")}
        style={{ color: estado.tinte }}
      />
    </span>
  );
}

/* ─────────────────────────── E · Un renglón ───────────────────────────
   Al otro extremo: de la fila sobrevive lo que uno busca cuando entra a
   buscar un archivo —de qué es y de cuándo—, y nada más. Quién lo pidió se va
   a la ficha, el estado vuelve a ser un punto de color, y el tipo se pinta en
   el glifo del archivo. Entran veinte pedidos en una pantalla en vez de once.

   Lo que cuesta: la promesa de la pantalla —"y quién lo pidió"— deja de estar
   impresa en la lista y queda sólo en el panel de filtros. */
function UnRenglon({ filas, centinela, onAbrir }: Lista) {
  const escala = useTypeScale();

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName={SCROLLER}>
      <GrupoDeslizable>
        <ul className={LISTA}>
          {filas.map(({ reporte }) => {
            const estado = ESTADOS_DE_REPORTE[reporte.estado];
            const tipo = TIPOS_DE_REPORTE_DOC[reporte.tipo];

            return (
              <Corrible key={reporte.id} reporte={reporte} onAbrir={onAbrir}>
                <span className="flex min-h-11 w-full items-center gap-2 px-4 py-2">
                  <Glifo reporte={reporte} tinte={tipo.tinte} />
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: escala.body }}>
                    {tipo.label.replace(/ Report$/, "")}
                  </span>
                  {!sePuedeBajar(reporte) && (
                    <>
                      <span className="sr-only">{estado.label}</span>
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: estado.tinte }}
                      />
                    </>
                  )}
                  <span
                    className="shrink-0 tabular-nums text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {haceCuanto(reporte.pedidoEl)}
                  </span>
                </span>
              </Corrible>
            );
          })}
        </ul>
      </GrupoDeslizable>
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
        <span className="truncate px-1">
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
