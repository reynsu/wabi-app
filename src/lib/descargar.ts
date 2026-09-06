/* Entregar un archivo al navegador.
 *
 * Lo que arma el contenido es el modelo —`csvDeReporte`, `csvDeReporteDOC`—; lo
 * de acá es lo único que el navegador necesita para que eso termine en la
 * carpeta de descargas: un blob, un anchor y la URL revocada después, que si no
 * queda el archivo entero colgado en memoria hasta que se recargue la página.
 *
 * Vive acá y no adentro de una pantalla porque lo usan dos —Email › Reports y
 * Admin › Reports— y va a usarlo la próxima que baje algo. Dos copias de estas
 * ocho líneas son dos maneras de que una se olvide de revocar la URL.
 *
 * No sabe de reportes: recibe un nombre y un contenido. Es la frontera entre el
 * modelo, que sabe qué dice el archivo, y el navegador, que sabe entregarlo.
 *
 * El contenido puede ser texto o bytes: desde que los reportes viejos son PDF,
 * lo que se baja no siempre es una cadena. Un `Blob` recibe las dos cosas igual,
 * así que lo único que cambia es el tipo de este parámetro.
 */
export function descargar(
  nombre: string,
  contenido: string | Uint8Array<ArrayBuffer>,
  tipo = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
