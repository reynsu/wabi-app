/**
 * Comparar lo que alguien escribió en un buscador con lo que ya estaba.
 *
 * **Sin tildes y sin mayúsculas, de los dos lados.** "lucia" tiene que
 * encontrar a Lucía Otero: nadie escribe los acentos en un buscador —menos
 * todavía en un teléfono, donde poner la tilde es mantener apretada la vocal— y
 * los nombres de esta casa están llenos de ellos: Lucía, Martín, Sofía, Iván,
 * Andrés. Buscar y no encontrar lo que está tres filas más abajo no se lee como
 * "escribiste distinto", se lee como que el dato no está.
 *
 * Los dos lados y no sólo el que se escribe: normalizando únicamente la
 * búsqueda, "Lucía" seguiría sin coincidir con nada. `NFD` parte cada letra
 * acentuada en letra más marca, y la marca se tira.
 *
 * Eso aplana también la ñ, y en un buscador es lo que se quiere: "manana"
 * encuentra "mañana". No cambia ningún dato —lo que se muestra sigue siendo el
 * original—, sólo cómo se comparan.
 *
 * Vive acá, en una sola copia, porque seis pantallas hacían la misma pregunta
 * con seis funciones iguales: el día que esto tenga que ignorar también los
 * guiones de un id, se cambia en un lugar.
 */

const plano = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Si alguno de esos textos contiene lo buscado. */
export const contiene = (donde: string[], que: string) => {
  const busca = plano(que);
  return donde.some((d) => plano(d).includes(busca));
};
