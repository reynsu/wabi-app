"use client";

import { PeekCard } from "@/components/peek-card";
import { fotoDeMensaje, type Foto } from "@/pages/foto";
import { cn } from "@/lib/utils";

/**
 * MessageImage — la foto de un mensaje.
 *
 * Dos tamaños, porque son dos preguntas distintas:
 *
 * - **`full`**, en la burbuja: la foto entera, con su proporción. Es lo que se
 *   vino a mirar, así que se la muestra completa sobre el hueco que su propia
 *   proporción define, y no recortada a un cuadrado que decide por su cuenta
 *   qué parte importa.
 * - **`thumb`**, en la fila de la tabla: un cuadrado chico. Ahí la foto no se
 *   mira, se reconoce: dice "esto es una imagen" y de qué color es, que es todo
 *   lo que una fila de tabla puede prometer. Recortada, porque un cuadrado con
 *   franjas vacías a los costados es una miniatura que no se decidió.
 *
 * Y la miniatura, además, **se asoma**: el puntero encima abre una tarjeta con
 * la foto entera y nada más. Es el paso que faltaba entre reconocerla y abrir
 * la conversación para verla — treinta y dos píxeles no alcanzan para decidir
 * si una foto importa, y abrir un hilo para descubrir que no importaba es el
 * viaje que esta consola tiene que ahorrar.
 *
 * La miniatura se queda donde está. La tarjeta entra con la animación que
 * `PeekCard` ya trae —se enciende y se acerca, anclada al elemento que la
 * disparó— y con eso alcanza: el ancla ya dice de dónde salió, y una foto que
 * además viaja de la fila a la tarjeta deja la fila con un hueco durante todo
 * el hover.
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
   *  pantalla tiene de esta imagen, y para nombrar la tarjeta que abre la
   *  miniatura. */
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

  const comun = {
    src: fotoDeMensaje(id, foto),
    /* El pie describe la foto mejor de lo que la describiría un texto inventado
       acá: es lo que la persona escribió sobre ella. Vacío cuando no hay pie
       —una imagen sin descripción es mejor anunciada como decorativa que como
       "imagen"—. */
    alt: pie ?? "",
    width: foto.ancho,
    height: foto.alto,
    /* `loading="lazy"`: la tabla puede tener quince miniaturas por página y no
       hay razón para decodificarlas antes de que entren en pantalla. */
    loading: "lazy" as const,
    draggable: false,
  };

  if (!thumb) {
    return (
      <img
        {...comun}
        className={cn(
          "h-auto w-full select-none rounded-lg bg-muted object-cover",
          className,
        )}
        style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}
      />
    );
  }

  return (
    <PeekCard
      openOn="hover"
      /* La tarjeta la nombra el pie; sin pie, lo que es. El header no se ve
         —abajo se lo manda a `sr-only`— pero el nombre tiene que seguir estando:
         es lo que el popup usa para anunciarse. */
      title={pie || "Photo"}
      align="start"
      side="right"
      width={320}
      /* La tarjeta es la foto y nada más. El header se va a `sr-only` en vez de
         a `hidden` porque el popup lo apunta con `aria-labelledby`, y un título
         con `display:none` sale del árbol de accesibilidad y deja esa flecha
         apuntando a la nada. El resto de los rellenos se van a cero: lo único
         que queda entre la foto y el borde es el filete del plato. */
      className={cn(
        "rounded-[18px] p-1",
        "[&_[data-slot=card-header]]:sr-only",
        "[&_[data-slot=card-content]]:p-0",
        "[&_[data-slot=card]]:pb-0",
      )}
      tabs={[
        {
          label: "Photo",
          content: (
            <img
              {...comun}
              className="h-auto w-full select-none rounded-[14px] bg-muted object-cover"
              style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}
            />
          ),
        },
      ]}
    >
      {/* El disparador es el `span` y no la imagen: es el que toma los
          handlers, y una caja alrededor da un blanco más grande que treinta y
          dos píxeles para llegar con el puntero. */}
      <span className="flex shrink-0 cursor-zoom-in">
        <img
          {...comun}
          className={cn(
            "size-8 shrink-0 select-none rounded-md bg-muted object-cover",
            className,
          )}
        />
      </span>
    </PeekCard>
  );
}
