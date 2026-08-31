import { useEffect, useRef, useState } from "react";

/* En qué página está una tabla, y qué filas le tocan.
 *
 * Vive acá porque lo usan dos pantallas —Email Search y Provisioning— y lo que
 * comparten no es "cortar un array en pedazos" sino las tres decisiones que
 * tiene alrededor: cambiar el filtro vuelve a la primera página, la página se
 * acota contra el total, y cambiar de página vuelve arriba. Copiadas, alcanza
 * con que una de las dos se olvide de una para que esa tabla mienta.
 */

/* La caja que scrollea, buscada subiendo desde adentro: una pantalla no tiene
   por qué saber quién la está conteniendo, y así funciona igual el día que la
   metan en un diálogo o en el riel del costado. */
function scrollerDe(el: HTMLElement | null) {
  for (let padre = el?.parentElement; padre; padre = padre.parentElement) {
    const desborde = getComputedStyle(padre).overflowY;
    if (desborde === "auto" || desborde === "scroll") return padre;
  }
  return null;
}

/**
 * @param items    Todo lo que hay para paginar, ya filtrado.
 * @param clave    Qué estaba filtrado cuando se eligió la página. Cambiarla
 *                 vuelve a la primera, al derivar y no en un efecto: el ajuste
 *                 pasa en el mismo render, y no después de pintar la página
 *                 siete de un resultado que ahora tiene dos. Es el mismo patrón
 *                 que usa `Pagination` por dentro para saber desde qué dígito
 *                 rueda.
 * @param porPagina Cuántas filas entran en una.
 */
export function usePaginacion<T>(
  items: T[],
  clave: string,
  porPagina: number,
) {
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));

  /* La dirección se guarda con la página y no se deduce al pintar: el render en
     el que la página cambia es también el que monta el texto nuevo, y para
     entonces el anterior ya se perdió. Guardarla en el mismo lugar la deja
     disponible para el que sale y para el que entra. */
  const [elegida, setElegida] = useState({ clave, pagina: 1, dir: 1 });

  /* El `min` contra `paginas` sostiene el caso de al lado: quedarse en la siete
     y que el filtro deje cuatro páginas. Sin él, la tabla quedaría vacía sobre
     un pager que dice "7 of 4". */
  const pagina =
    elegida.clave === clave ? Math.min(elegida.pagina, paginas) : 1;
  if (elegida.clave !== clave) setElegida({ clave, pagina: 1, dir: 1 });

  const desde = (pagina - 1) * porPagina;
  const filas = items.slice(desde, desde + porPagina);

  /* Un ancla adentro de la caja que scrollea, para poder subirla desde acá. La
     pone la pantalla donde empieza la lista. */
  const ancla = useRef<HTMLDivElement>(null);

  /* Cambiar de página —o de filtro— vuelve arriba. Una página nueva que empieza
     a la altura de la fila veinte es una página que parece cortada, y el que la
     pidió ya está mirando el principio. */
  useEffect(() => {
    scrollerDe(ancla.current)?.scrollTo({ top: 0 });
  }, [clave, pagina]);

  return {
    pagina,
    paginas,
    /** El índice de la primera fila de esta página, para escribir el rango. */
    desde,
    filas,
    dir: elegida.dir,
    ancla,
    irA: (proxima: number) =>
      setElegida({ clave, pagina: proxima, dir: proxima >= pagina ? 1 : -1 }),
  };
}
