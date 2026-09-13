import { useState } from "react";

import { useEsMovil } from "@/hooks/use-es-movil";

/**
 * Qué fila queda pintada como elegida en la lista.
 *
 * En escritorio siempre hay una: la lista abre con la primera puesta para que
 * el panel de al lado no nazca vacío, y el resalte es lo que ata las dos
 * mitades de lo que se ve —ésta es la fila de eso que estás leyendo—.
 *
 * En el teléfono no hay mitad de al lado. Al llegar a la lista, la primera fila
 * aparecía resaltada sin que nadie la hubiera tocado: no señala nada, y un
 * fondo gris debajo de un dedo que no hizo nada se lee como un botón que quedó
 * apretado.
 *
 * Así que acá no hay nada pintado hasta que se abra algo. Después sí, y no se
 * apaga al volver: encontrar dónde estabas es la otra mitad de para qué sirve
 * el resalte, y ésa sí sirve en un teléfono.
 */
export function useMarcada(elegida: string, abierto: boolean) {
  const esMovil = useEsMovil();
  const [visitada, setVisitada] = useState(abierto);

  /* Se ajusta al pintar y no en un efecto: no hay nada afuera con qué
     sincronizarse, es esta misma pintada la que ya sabe que se abrió algo.
     React rehace el render con el valor nuevo antes de tocar el DOM, así que no
     hay un cuadro con la marca vieja. */
  if (abierto && !visitada) setVisitada(true);

  return !esMovil || visitada ? elegida : "";
}
