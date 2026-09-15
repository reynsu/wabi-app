/**
 * Que la app no gire con el aparato: se mira siempre de pie.
 *
 * Esta consola está pensada para una mano y para una columna —una lista de
 * filas de dos renglones, un hilo, una hoja que sube—. Acostada no gana nada:
 * las mismas filas con la mitad del alto y el doble de ancho vacío, y el
 * teclado tapando lo que quedaba. Rotar sin querer, con el teléfono en la mano
 * y mirando una conversación, es perder el lugar a cambio de nada.
 *
 * Se pide por los dos caminos que existen, porque ninguno alcanza solo:
 *
 * 1. **El manifiesto** —`"orientation": "portrait"`—, que es lo que el sistema
 *    operativo lee al instalar la app y lo único que decide antes de que corra
 *    una línea de JavaScript.
 * 2. **`screen.orientation.lock`**, acá, para la sesión ya abierta.
 *
 * Y hay que decir hasta dónde llegan, porque no es "siempre":
 *
 * - **Instalada en Android** —el ícono en la pantalla de inicio, `standalone`—:
 *   queda fija. Los dos caminos funcionan.
 * - **En una pestaña del navegador**: `lock()` es un pedido que el navegador
 *   sólo concede a pantalla completa o a una app instalada. En una pestaña
 *   rechaza, y la app gira con el aparato. No hay manera de impedirlo desde una
 *   página, y falsear una con `transform: rotate` rompe el teclado, los gestos
 *   y el aire de las barras del sistema: no se hace.
 * - **En iOS** —pestaña o ícono en la pantalla de inicio—: Safari no implementa
 *   `lock()` y no lee la orientación del manifiesto, así que ahí gira igual.
 *   Es un límite de la plataforma, no algo que falte escribir acá.
 *
 * Por eso el pedido se hace y se deja ir: `lock()` devuelve una promesa que
 * **rechaza** donde no está permitido, y una promesa rechazada sin atrapar es un
 * error en la consola en la mitad de los aparatos. Que no se conceda no es una
 * falla: es la respuesta.
 *
 * "portrait" y no "portrait-primary": lo segundo prohíbe también el revés, que
 * es lo que usa quien tiene el aparato al revés en un soporte. Lo que se quiere
 * es que no se acueste, no elegirle para qué lado va el cable.
 */
export function fijarOrientacion() {
  /* `lock` todavía no está en todos los `lib.dom`, y en Safari no existe aunque
     `screen.orientation` sí. Se pregunta por la función en vez de por el
     navegador. */
  const pantalla = screen.orientation as ScreenOrientation & {
    lock?: (orientacion: "portrait") => Promise<void>;
  };

  void pantalla?.lock?.("portrait").catch(() => {
    /* No se concedió —una pestaña, o iOS—. Ver arriba. */
  });
}
