import { useTemaOscuro } from "@/stores/tema";

/* La paleta de las tarjetas de papel: un fondo apenas gris con un panel más
   claro flotando adentro, el título casi negro y todo lo demás en dos grises.
 *
 * Vino con la tarjeta de la transcripción y la usa también la de los objetivos
 * de una política. Vive acá y no en una de las dos porque es una sola paleta:
 * dos copias son dos maneras de que el mismo papel salga de dos tonos distintos
 * el día que alguien afine uno.
 *
 * Se escribe en vez de salir de los tokens porque la relación que importa acá
 * —**el panel más claro que su fondo**— es la contraria a la que arma el sistema
 * de superficies, donde lo que flota sube de tono sobre un sustrato que ya es
 * blanco. Con tokens saldrían dos blancos y no habría panel.
 *
 * El tema oscuro no está en el diseño y hubo que derivarlo: los mismos papeles
 * con los mismos saltos entre sí, dados vuelta. Sin eso la tarjeta sale como un
 * bloque blanco encima de una app oscura.
 *
 * Opacos los dos, y sin sombra ninguno: lo único que separa al panel de su plato
 * es que es más claro que él. */
export const PAPEL = {
  claro: {
    fondo: "#f2f2f2",
    panel: "#ffffff",
    titulo: "#1a1a1a",
    texto: "#3d3d3d",
    apagado: "#9e9e9e",
    chip: "#e9e9e9",
    chipTexto: "#6b6b6b",
  },
  oscuro: {
    fondo: "#1c1c1c",
    panel: "#303030",
    titulo: "#f5f5f5",
    texto: "#d4d4d4",
    apagado: "#8a8a8a",
    chip: "#333333",
    chipTexto: "#a3a3a3",
  },
} as const;

/** La paleta del tema puesto. Lo mismo que leer `PAPEL` y elegir, escrito una
 *  vez para que las dos tarjetas pregunten igual. */
export function usePapel() {
  return useTemaOscuro() ? PAPEL.oscuro : PAPEL.claro;
}
