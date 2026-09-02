"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

import { TableRow } from "@/components/ui/table";

/**
 * FilaDestellante — la fila de una tabla que se enciende cuando acaba de pasarle
 * algo.
 *
 * Se prende con un violeta muy lavado, aguanta un cuarto de segundo y se apaga
 * sola. Es lo que cierra un alta: la ficha se fue, y sin esto hay que buscar con
 * la vista cuál de las cuarenta filas es la que uno acaba de crear —que además
 * casi nunca cae arriba de todo, porque estas tablas se ordenan por otra cosa—.
 * Vale igual para una corrección: una fila que se acaba de tocar se busca con la
 * vista lo mismo que una nueva.
 *
 * Vive acá y no adentro de una pantalla porque lo usan cuatro —Policies,
 * Announcements, DOC Accounts y Admin › Reports— y van a ser más. Estaba escrito
 * cuatro veces, y cuatro copias son cuatro maneras de que dejen de ser el mismo
 * destello: alcanza con que alguien afine un tiempo para que crear algo en una
 * sección se vea distinto de crearlo en otra.
 *
 * ── Por qué son fotogramas y no dos variantes ─────────────────────────────
 *
 * Las cuatro copias tenían el mismo agujero, y por eso **el destello no se veía
 * en ninguna**: estaban escritas como `initial: "encendida"` /
 * `animate: "apagada"`, que se apoya en que la fila *monte* ya señalada.
 *
 * Y no monta así. La fila nace cuando la tienda la escribe —adentro de la
 * promesa del alta— y quién es la recién llegada se sabe un render después,
 * cuando la promesa vuelve y el hook lo anota. Al mount `destella` todavía es
 * `false`, así que `initial` nunca se aplica; lo que después pasa a "apagada"
 * parte de transparente y se apaga algo que nunca se prendió. En una corrección
 * es todavía más claro: la fila ya estaba montada desde antes.
 *
 * Como fotogramas de una sola variante, el disparo es que `destella` pase a
 * `true` —que es cuando efectivamente se sabe— y no el montaje de la fila. Los
 * tres tiempos son los que tenía escritos el original: encendida hasta 0.24 de
 * 1.45s (los 0.35s de espera) y apagándose el resto (1.1s).
 *
 * Sin destello no va ningún `animate`, así que la fila no lleva color propio y
 * la banda del hover —que va detrás, ver `table.tsx`— se ve como en las demás.
 */
const DESTELLO: Variants = {
  destella: {
    backgroundColor: [
      "oklch(0.966 0.022 292)",
      "oklch(0.966 0.022 292)",
      "oklch(0.966 0.022 292 / 0)",
    ],
    transition: { duration: 1.45, times: [0, 0.24, 1] },
  },
};

const FilaAnimada = motion.create(TableRow);

export function FilaDestellante({
  /** El índice de la fila en el cuerpo. Es lo que `TableRow` usa para el hover
   *  de proximidad, así que viaja tal cual. */
  index,
  /** Si esta fila es la que se acaba de tocar. */
  destella,
  children,
}: {
  index: number;
  destella: boolean;
  children: ReactNode;
}) {
  return (
    <FilaAnimada
      index={index}
      /* Sin `initial`: la fila entra con la cara que le da la tabla, y el
         destello lo dispara `animate` al cambiar. */
      initial={false}
      animate={destella ? "destella" : undefined}
      variants={DESTELLO}
    >
      {children}
    </FilaAnimada>
  );
}
