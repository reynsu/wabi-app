"use client";

import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";

/**
 * Un punto de color como ícono de un valor.
 *
 * `FilterOption.icon` es un componente y no un color justamente para esto: el
 * atributo decide con qué se distingue cada uno de sus valores. Para un estado
 * —de una cuenta, de un ticket— lo que lo distingue es el color con el que ya
 * se lo pinta en su badge, así que el ícono es ese color y nada más.
 *
 * Vive acá y no adentro de una pantalla porque lo usan dos —Accounts y
 * Tickets— y va a usarlo la próxima que filtre por un estado.
 *
 * La caja es `flex` y no `inline-flex`, que es lo que la alinea con la etiqueta
 * que tiene al lado. Siendo inline se alineaba por la línea de base del renglón
 * —y no por el medio de la fila—, así que el punto caía dos píxeles abajo del
 * texto en el panel de filtros y cinco arriba adentro de un `MenuItem`, que lo
 * mete en una celda de grilla. Un ícono de este sistema es un bloque —así deja
 * el preflight de Tailwind a un `svg`, y por eso los de lucide sí caen
 * centrados—, y esto es un ícono: que se comporte como los otros es lo que hace
 * que se alinee con ellos.
 */
export const punto =
  (color: string): IconComponent =>
  ({ size = 16, className }) => (
    <span
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
    </span>
  );
