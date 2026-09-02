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
 * No sabe de reportes: recibe un nombre y un texto. Es la frontera entre el
 * modelo, que sabe qué dice el archivo, y el navegador, que sabe entregarlo.
 */
export function descargar(
  nombre: string,
  texto: string,
  tipo = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
