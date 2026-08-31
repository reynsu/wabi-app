"use client";

import type { ReactNode } from "react";

import { useTypeScale } from "@/lib/size-context";

/**
 * Una ficha de datos: la etiqueta a la izquierda, el valor a la derecha y,
 * cuando hace falta, la lectura corta debajo.
 *
 * Vive acá y no adentro de una pantalla por lo mismo que `punto`: la usan dos
 * —el vistazo de una cuenta en Accounts y el de un correo en Email Search— y va
 * a usarla el próximo `PeekCard` que muestre cuatro hechos de una cosa. Dos
 * copias de esto son dos jerarquías que un día dejan de coincidir, y las
 * tarjetas de dos pantallas hermanas se ven distintas sin que nadie lo haya
 * decidido.
 */
export function Datos({
  filas,
}: {
  filas: { k: string; v: ReactNode; nota?: string }[];
}) {
  const escala = useTypeScale();

  return (
    <dl className="flex flex-col gap-2.5">
      {filas.map((fila) => (
        <div key={fila.k} className="flex items-start justify-between gap-4">
          <dt
            className="shrink-0 text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {fila.k}
          </dt>
          {/* El valor sale de la escala y no de lo que herede: la tarjeta no
              declara tamaño en su cuerpo, así que sin esto caía en los 16px por
              defecto del navegador y quedaba media cabeza por encima de su
              propia etiqueta. Con `body` contra `caption` la jerarquía es la
              que el sistema define, y el peso lo termina de marcar el color. */}
          <dd
            className="flex min-w-0 flex-col items-end gap-0.5 text-right"
            style={{ fontSize: escala.body }}
          >
            <span className="truncate">{fila.v}</span>
            {fila.nota && (
              <span
                className="text-muted-foreground"
                style={{ fontSize: escala.caption }}
              >
                {fila.nota}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
