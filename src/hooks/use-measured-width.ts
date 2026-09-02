"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Mide el ancho del nodo montado. Devuelve un ref estable y el ancho en px.
 *
 *  Es el gemelo de `useMeasuredHeight`, y existe por lo mismo que él: hay
 *  medidas que no se pueden escribir en CSS porque el que las necesita no está
 *  adentro del que las tiene. El caso de acá es un popover portalado al `body`
 *  —un calendario— que no puede pasarse del ancho de la hoja que lo abrió: la
 *  hoja vive en un riel que se arrastra, así que su ancho no es un número que se
 *  pueda escribir, y el popup no es descendiente suyo en el DOM, así que tampoco
 *  lo hereda.
 *
 *  Los dos detalles que parecen de más son los mismos, y por las mismas razones:
 *
 *  - **El ref es el mismo callback en cada render.** Uno nuevo por render hace
 *    que React lo desmonte y lo vuelva a montar, y cada vuelta invalida la
 *    medición.
 *
 *  - **No suelta el observer cuando lo llaman con `null`.** Durante un cruce hay
 *    dos contenidos montados, y el que se va llama al ref con `null` después de
 *    que el que llega ya se anotó: soltarlo ahí borraría la medida del que se
 *    queda.
 *
 *  `offsetWidth` y no `getBoundingClientRect`: bajo un ancestro escalado —un
 *  popup entrando con un resorte— el rect devuelve el ancho visual, y el que lo
 *  lee terminaría acomodándose a un número que deja de ser cierto en cuanto la
 *  escala llega a 1. */
export function useMeasuredWidth<T extends HTMLElement = HTMLDivElement>() {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (!node) return;
    observer.current?.disconnect();
    const next = new ResizeObserver(() => setWidth(node.offsetWidth));
    next.observe(node);
    observer.current = next;
    setWidth(node.offsetWidth);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, width] as const;
}
