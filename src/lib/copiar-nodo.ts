import { toBlob } from "html-to-image";

/* Copiar un pedazo de la pantalla como imagen.
 *
 * Lo que se copia no es el gráfico solo: es el diálogo entero —su título, de
 * quién es, el tramo, el gráfico y su leyenda—. Un `<svg>` suelto pegado en un
 * informe es un dibujo sin nombre: no dice de qué cuenta es, ni de qué meses, y
 * quien lo reciba tiene que preguntarlo. Lo que sirve pegado es lo mismo que
 * sirve en pantalla, que es por lo que el diálogo tiene esas cuatro cosas
 * juntas.
 *
 * Lo hace `html-to-image`, y no a mano. Rasterizar HTML es meterlo adentro de un
 * `<foreignObject>`, y para que eso salga igual a lo que se ve hay que
 * congelarle a cada nodo el estilo calculado **y** embeber las tipografías en
 * base64 —adentro de un `<img>` no hay red, así que un `@font-face` que apunta a
 * un archivo no carga y el texto sale en otra fuente, con otras métricas y otro
 * largo—. Es un problema resuelto y con casos borde de sobra; escribirlo nosotros
 * sería reescribirlo peor.
 *
 * Lo que sí decide este archivo es **qué queda afuera**: los controles del marco.
 * Ver `OMITIR`.
 */

/** El atributo que marca lo que no entra en la foto. Va sobre los controles del
 *  diálogo —el cierre y el botón de copiar—: son del marco y no del contenido, y
 *  una × pegada en un informe no cierra nada. Es un atributo y no una clase para
 *  que se lea como lo que es —"a esto no le saques la foto"— desde el lugar
 *  donde se lo pone. */
export const OMITIR = "data-sin-captura";

/** A cuánto se rasteriza. Dos veces el tamaño en pantalla: lo copiado termina
 *  pegado en un documento o en un chat, donde se lo mira más grande de lo que
 *  estaba. */
const ESCALA = 2;

/** El fondo de la imagen. Se lee del propio nodo en vez de escribirlo: el
 *  diálogo se pinta sobre `--popover`, que en tema oscuro es casi negro, así que
 *  una imagen con el blanco escrito a mano saldría al revés de lo que se estaba
 *  mirando. Sube por los ancestros —los del medio son transparentes— y si no
 *  encuentra ninguno cae en blanco, que es lo que hay detrás de todo. */
function fondoDe(nodo: Element | null): string {
  let actual: Element | null = nodo;
  while (actual) {
    const color = getComputedStyle(actual).backgroundColor;
    if (color && color !== "transparent" && !color.endsWith(", 0)")) return color;
    actual = actual.parentElement;
  }
  return "#ffffff";
}

export async function comoPng(nodo: HTMLElement): Promise<Blob> {
  const blob = await toBlob(nodo, {
    pixelRatio: ESCALA,
    backgroundColor: fondoDe(nodo),
    /* La ubicación se desarma antes de la foto. Un diálogo se centra
       corriéndose media pantalla y después media caja para atrás, y el clon que
       se rasteriza no vive en la pantalla: ahí no hay contra qué centrarse, así
       que el `50%` no significa nada y el corrimiento de vuelta sí, y saca al
       contenido del recuadro. Sale una imagen casi vacía con un pedazo asomando
       por un borde.

       `translate` **y** `transform`, las dos: Tailwind v4 usa la propiedad
       `translate` —no la función adentro de `transform`—, así que apagar sólo
       `transform` no apaga nada. Es la clase de detalle que sólo se ve
       midiendo, porque la foto sale mal de una manera que parece un problema de
       escala.

       Lo que **no** se le pasa es `width`/`height`: fijándolos, la librería deja
       de escalar por `pixelRatio` y dibuja a 1× adentro de un lienzo de 2×. El
       tamaño lo saca del nodo, que es el correcto. */
    style: {
      position: "static",
      translate: "none",
      transform: "none",
      scale: "none",
      top: "auto",
      left: "auto",
      margin: "0",
      maxWidth: "none",
      maxHeight: "none",
    },
    /* `filter` corta el nodo y todo lo que cuelga de él, que es justo lo que
       hace falta: el botón entero se va, no sólo su glifo. */
    filter: (n) => !(n instanceof Element) || !n.hasAttribute(OMITIR),
  });
  if (!blob) throw new Error("No se pudo dibujar");
  return blob;
}

/** Lo copia al portapapeles.
 *
 *  `ClipboardItem` con la promesa adentro y no con el blob ya resuelto: Safari
 *  invalida el gesto del usuario en cuanto hay un `await` antes de escribir, y
 *  pasándole la promesa el navegador se queda esperando él. Chrome acepta las
 *  dos formas. */
export async function copiarImagen(nodo: HTMLElement) {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": comoPng(nodo) }),
  ]);
}

