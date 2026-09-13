/**
 * El renglón de buscar, en el teléfono: el campo y el botón que lo acompaña, en
 * píldora.
 *
 * El radio de la casa —8px, la escalera de figuras— es el de un control apoyado
 * sobre una pantalla llena de controles. Arriba de una lista hay dos y nada
 * más, flotando sobre filas sin marco: redondeados del todo se leen como una
 * barra de búsqueda y no como la primera fila de un formulario, que es lo que
 * un teléfono espera ahí.
 *
 * Vive acá porque son varios los lugares que hacen esto —Accounts, las tres
 * secciones del perfil y la cabecera del hilo abierto— y la decisión es una
 * sola. Y va como clase en el call site y no adentro de los componentes: los
 * dos son del registry, así que una desviación adentro se la lleva puesta la
 * próxima instalación.
 *
 * En escritorio los dos siguen con el radio del sistema: `esMovil ? ... : ""`.
 */

/** Para el `InputField`. El radio va en la caja que tiene el input adentro
 *  —la que dibuja el marco—, no en la raíz del campo. */
export const CAMPO_EN_PILDORA = "[&>div:has(>input)]:rounded-full";

/** Para el `FilterMenu` —cuyo `className` cae en su botón, que es lo único que
 *  deja en el layout— y para cualquier botón que comparta el renglón: en el
 *  hilo, el de ícono de las acciones, que redondo entero acompaña a la píldora
 *  del campo en vez de pelearle la forma. */
export const BOTON_EN_PILDORA = "rounded-full";
