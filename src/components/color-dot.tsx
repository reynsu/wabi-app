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
 */
export const punto =
  (color: string): IconComponent =>
  ({ size = 16, className }) => (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
    </span>
  );
