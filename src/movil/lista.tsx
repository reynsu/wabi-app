import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Una tabla, en el teléfono.
 *
 * En 375px una tabla de cuatro columnas no se angosta: se trunca. "Camila
 * Ferreyra" queda en "Camila Fe…" y la fecha en "Mar 4,". Lo que entra no es la
 * misma información más chica sino **menos información**, así que la tabla se
 * deshace en filas apiladas y cada pantalla elige qué sobrevive: lo que
 * identifica al registro arriba, lo que lo ubica abajo, y a la derecha el dato
 * por el que se escanea la lista —un estado, una cifra—.
 *
 * Lo que no entra no se achica: se va a donde ya estaba. En esta app, cada fila
 * abre algo —un perfil, un vistazo, una pestaña— y ahí están las columnas que
 * acá se cayeron.
 *
 * Sin marco ni radio, como la tabla de escritorio: las filas llegan a los dos
 * bordes del plano y el aire lateral lo pone su propio relleno, no una caja.
 */

export function ListaMovil({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("flex flex-col [&>li+li]:border-t [&>li+li]:border-border", className)}>
      {children}
    </ul>
  );
}

interface FilaMovilProps {
  /** El plato de la izquierda: un avatar, un ícono, un color. */
  media?: ReactNode;
  /** Lo que identifica al registro. Una línea, y se trunca. */
  titulo: ReactNode;
  /** Lo que lo ubica: de quién es, cuándo fue, dónde vive. */
  detalle?: ReactNode;
  /** El dato por el que se escanea la lista, contra el borde derecho. */
  extra?: ReactNode;
  /** Qué abre la fila. Sin esto la fila no es un botón: hay listas que sólo se
   *  leen, y una fila que no lleva a ningún lado no tiene por qué responder al
   *  dedo ni pedir una parada de tabulado. */
  onClick?: () => void;
}

export function FilaMovil({ media, titulo, detalle, extra, onClick }: FilaMovilProps) {
  const dentro = (
    <>
      {media}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[15px] font-medium">{titulo}</span>
        {detalle && <span className="truncate text-[12px] text-muted-foreground">{detalle}</span>}
      </span>
      {extra && <span className="flex shrink-0 items-center gap-2">{extra}</span>}
    </>
  );

  /* 56px de alto mínimo: es el escalón táctil de la casa —el mismo de los
     controles del header— y deja respirar dos líneas de texto. */
  const forma = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          data-cuelume-press="tick"
          className={cn(
            forma,
            "outline-none active:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          )}
        >
          {dentro}
        </button>
      ) : (
        <div className={forma}>{dentro}</div>
      )}
    </li>
  );
}
