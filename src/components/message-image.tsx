"use client";

import { fotoDeMensaje, type Foto } from "@/pages/foto";
import { cn } from "@/lib/utils";

/**
 * MessageImage — la foto de un mensaje.
 *
 * Dos tamaños, porque son dos preguntas distintas:
 *
 * - **`full`**, en la burbuja: la foto entera, con su proporción. Es lo que se
 *   vino a mirar, así que se la muestra completa —`object-contain` sobre el
 *   hueco que su propia proporción define— y no recortada a un cuadrado que
 *   decide por su cuenta qué parte importa.
 * - **`thumb`**, en la fila de la tabla: un cuadrado chico. Ahí la foto no se
 *   mira, se reconoce: dice "esto es una imagen" y de qué color es, que es todo
 *   lo que una fila de tabla puede prometer. Recortada, porque un cuadrado con
 *   franjas vacías a los costados es una miniatura que no se decidió.
 *
 * El hueco se reserva con `aspect-ratio` y las medidas del modelo. Sin eso la
 * burbuja nace de alto cero y salta cuando la imagen entra, que en un hilo que
 * ya está corriendo su cascada se lee como algo roto.
 */
export function MessageImage({
  id,
  foto,
  /** El pie del mensaje. No se pinta acá —la burbuja y la fila lo ponen donde
   *  les corresponde—: viaja para el `alt`, que es lo único que un lector de
   *  pantalla tiene de esta imagen. */
  pie,
  variant = "full",
  className,
}: {
  id: string;
  foto: Foto;
  pie?: string;
  variant?: "full" | "thumb";
  className?: string;
}) {
  const thumb = variant === "thumb";

  return (
    <img
      src={fotoDeMensaje(id, foto)}
      /* El pie describe la foto mejor de lo que la describiría un texto
         inventado acá: es lo que la persona escribió sobre ella. Vacío cuando
         no hay pie —una imagen sin descripción es mejor anunciada como
         decorativa que como "imagen"—. */
      alt={pie ?? ""}
      width={foto.ancho}
      height={foto.alto}
      /* `loading="lazy"`: la tabla puede tener quince miniaturas por página y no
         hay razón para decodificarlas antes de que entren en pantalla. */
      loading="lazy"
      draggable={false}
      className={cn(
        "select-none bg-muted",
        thumb
          ? "size-8 shrink-0 rounded-md object-cover"
          : "h-auto w-full rounded-lg object-cover",
        className,
      )}
      style={thumb ? undefined : { aspectRatio: `${foto.ancho} / ${foto.alto}` }}
    />
  );
}
