"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";

/**
 * El rango de una lista paginada: cuánto se está viendo de cuánto.
 *
 * Vive acá y no adentro de una pantalla porque lo usan dos —Email Search y
 * Provisioning— y va a usarlo la próxima tabla que se pagine. Dos copias son dos
 * maneras de decir lo mismo que un día dejan de coincidir.
 *
 * Cambia en el mismo clic que el número del pager que tiene al lado, así que se
 * mueve como él: el que se va sale hacia donde va la página, el que llega entra
 * desde el otro lado, y los dos cruzan apenas desenfocados. Dos textos que
 * cambian por lo mismo y se mueven distinto se leen como dos cosas que no tienen
 * que ver.
 *
 * La dirección viene del número y no del botón —la misma decisión que toma
 * `Pagination` por dentro—: volver a la primera página al filtrar no se hizo con
 * la flecha, y aun así tiene que rodar para el lado que corresponde.
 *
 * El viaje es de ocho píxeles y la caja lo recorta: el corte contra el borde es
 * lo que hace que se lea como un odómetro y no como un texto que se desvanece.
 *
 * Con `prefers-reduced-motion` el texto igual cambia —es el contenido— pero se
 * enciende en vez de viajar. Va explícito y no confiado al `MotionConfig`:
 * `reducedMotion` le saca el `transform`, no el desenfoque.
 */

const VIAJE = 8;
const BORRON = "blur(2px)";

const rueda = {
  entra: (dir: number) => ({
    y: dir >= 0 ? VIAJE : -VIAJE,
    opacity: 0,
    filter: BORRON,
  }),
  quieto: { y: 0, opacity: 1, filter: "blur(0px)", transition: spring.slow },
  sale: (dir: number) => ({
    y: dir >= 0 ? -VIAJE : VIAJE,
    opacity: 0,
    filter: BORRON,
    transition: spring.slow.exit,
  }),
} as const;

const enciende = {
  entra: { opacity: 0 },
  quieto: { opacity: 1, transition: spring.slow },
  sale: { opacity: 0, transition: spring.slow.exit },
} as const;

export function Rango({
  desde,
  hasta,
  total,
  dir,
}: {
  desde: number;
  hasta: number;
  total: number;
  /** 1 si la página avanzó, -1 si volvió. */
  dir: number;
}) {
  const escala = useTypeScale();
  const reducido = useReducedMotion() ?? false;
  const texto = `${desde}–${hasta} of ${total.toLocaleString("en-US")}`;

  return (
    <span
      className="relative inline-flex overflow-hidden text-muted-foreground tabular-nums"
      style={{ fontSize: escala.caption }}
    >
      {/* Lo que se anuncia es la línea entera, una sola vez. Los dos textos
          conviven un cuarto de segundo mientras uno sale y el otro entra, y un
          lector de pantalla no tiene por qué leer los dos. */}
      <span className="sr-only" aria-live="polite">
        {texto}
      </span>

      {/* `popLayout` saca al que se va del flujo, así que el que llega ocupa su
          lugar en vez de empujarlo: los dos viajan sobre la misma línea. */}
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={texto}
          aria-hidden
          custom={dir}
          variants={reducido ? enciende : rueda}
          initial="entra"
          animate="quieto"
          exit="sale"
          className="whitespace-nowrap"
        >
          {texto}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
