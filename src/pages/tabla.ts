/* Las medidas de las tablas de la consola, en un solo lugar.
 *
 * Accounts, Messages Search, Email Search, Provisioning y Policies son la misma
 * tabla mirando cosas distintas: la misma sangría, el mismo aire, la misma
 * banda en la cabecera y la misma altura de fila. Estaban escritas cinco veces
 * —cinco copias idénticas, una por pantalla—, y cinco copias son cinco maneras
 * de que dejen de ser iguales: alcanza con que alguien afine una para que
 * cambiar de fila del sidebar empiece a cambiar de mueble.
 *
 * Acá viven una vez. Si una pantalla necesita otra medida, que la escriba al
 * lado y diga por qué; lo que no puede pasar es que se separen sin que nadie lo
 * haya decidido.
 */

/** La sangría de las columnas de los extremos: es lo que alinea la tabla con el
 *  header sin meterle un contenedor con padding, que le sacaría los bordes. */
export const SANGRIA =
  "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6";

/** El aire de las filas, arriba del que trae el escalón compacto —que las deja
 *  en 5px de padding, y eso con una celda de dos líneas y un avatar de 32px es
 *  una lista apretada—. 8px las sueltan sin sacarlas de la densidad: el texto
 *  sigue en el escalón compacto, lo que cambia es cuánto respiran.
 *
 *  **Y un alto mínimo de 44px.** Sin él, la altura de la fila la decide lo que
 *  cada pantalla haya puesto adentro: una fila de texto suelto mide 37 y una que
 *  tiene un botón de 28px mide 45, así que dos tablas del mismo mueble se leían
 *  con dos ritmos distintos según qué controles tuviera cada una. Es un mínimo y
 *  no un alto fijo: una celda de dos líneas sigue pudiendo empujar la fila —lo
 *  que no puede es que una fila de una línea quede más apretada que la de al
 *  lado—. */
export const AIRE_FILA = "[&_td]:py-2 [&_tr]:h-11";

/** El aire de los títulos. 10px los lleva a 36px de alto, que es el escalón
 *  normal de la escalera de tamaños: la cabecera queda en la altura de un
 *  control y no aplastada contra la primera fila. */
export const AIRE_TITULOS = "[&_th]:py-2.5";

/* La banda de la cabecera. No sale de la escalera de superficies: en el modo
   claro la escalera es plana en blanco de la tercera para arriba, así que un
   escalón no la separaría ni de las filas ni del header de la pestaña, que están
   sobre el mismo plano.

   Es un violeta muy lavado, en el tono del violeta de los badges —hue 292— para
   que sea el mismo púrpura del sistema y no otro traído de afuera. En el modo
   claro va a la altura del `--muted` que reemplaza, apenas 0.022 de croma sobre
   el blanco; en el oscuro sube un poco por encima del plano, porque una banda
   más oscura que lo que la rodea se lee como un hueco y no como una cabecera.

   Translúcida y con desenfoque detrás: es lo que la vuelve una banda apoyada
   sobre la lista y no un bloque pintado al lado. Para que el desenfoque tenga
   algo que desenfocar, la cabecera va por encima del scroller y no antes, y las
   filas le pasan por debajo.

   Va acá y no como token en `index.css` a propósito: ese archivo es copia byte a
   byte del showcase y una variable de más lo desalinea. Si el violeta le sirve a
   algo que no sea una tabla, el lugar es el registry. */
export const BANDA_TITULOS = [
  "bg-[oklch(0.966_0.022_292)]/70",
  "dark:bg-[oklch(0.34_0.03_292)]/70",
  "backdrop-blur-md",
].join(" ");
