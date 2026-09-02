"use client";

import { Paperclip } from "lucide-react";

import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import type { Adjunto } from "@/pages/emails";

/**
 * Adjuntos — lo que un correo trae colgado, en una tira de chips.
 *
 * Cada uno dice su nombre y cuánto pesa, y nada más. **No son botones**: no hay
 * de dónde bajarlos, y un botón que no descarga es peor que ninguno. Decir que
 * hay algo colgado y cuánto pesa es todo lo que esta consola puede prometer hoy.
 *
 * Vive acá y no adentro de una pantalla porque lo muestran dos —la sección
 * Emails del perfil y el correo que Email Search abre en el riel— y estaba
 * escrito dos veces, idéntico hasta la última clase. Dos copias son dos maneras
 * de que dejen de ser lo mismo, y ya había pasado: una de las dos cambió de
 * borde y la otra se quedó con el viejo.
 *
 * ── La regla de arriba ────────────────────────────────────────────────────
 *
 * Punteada, y más lavada que la que separa la cabecera del cuerpo. Las dos cosas
 * dicen lo mismo: los adjuntos no son una parte nueva del correo sino lo que el
 * cuerpo venía diciendo. Arriba el corte es entre dos clases de cosa —quién lo
 * manda y qué dice—, y ahí una línea llena está bien; acá el adjunto es la
 * última frase del mismo mensaje, y la línea llena lo cortaba como si empezara
 * otra cosa.
 *
 * Es la misma punteada con la que las fichas del riel parten una hoja —`Corte`,
 * en `ficha.tsx`— y por el mismo motivo: separa partes de la misma hoja, no dos
 * superficies distintas. El lavado sale de `border-border/60`, que ya usan las
 * tarjetas del registry.
 */
export function Adjuntos({ adjuntos }: { adjuntos: Adjunto[] }) {
  const escala = useTypeScale();
  const shape = useShape();

  return (
    <div className="flex flex-wrap gap-2 border-t border-dashed border-border/60 pt-4">
      {adjuntos.map((a) => (
        <span
          key={a.nombre}
          className={cn(
            "flex items-center gap-2 border border-border px-2.5 py-1.5",
            shape.item,
          )}
          style={{ fontSize: escala.caption }}
        >
          <Paperclip
            size={12}
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{a.nombre}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {a.tamano}
          </span>
        </span>
      ))}
    </div>
  );
}
