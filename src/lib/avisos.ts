import { sileo as crudo } from "sileo";
import { sonar } from "@/stores/sonido";

/**
 * Los avisos de la consola, con su señal.
 *
 * Es `sileo` tal cual —la misma API, los mismos argumentos, el mismo valor de
 * vuelta— con una sola cosa agregada: un aviso también suena.
 *
 * **Por qué un envoltorio y no una llamada a `sonar` en cada lugar.** Los
 * resultados de esta app —se creó el buzón, no se pudo bajar el reporte, se
 * copió el gráfico— ya pasan todos por acá: la pantalla no cuenta el final, lo
 * cuenta el toast. Eso los vuelve el único lugar de la app donde ya está escrito
 * qué salió bien y qué salió mal. Repartir un `sonar("success")` al lado de cada
 * `sileo.success` sería decir dos veces lo mismo y garantizar que en seis meses
 * haya un aviso mudo porque alguien agregó el toast y se olvidó del sonido.
 *
 * Quien llama no se entera y no tiene que acordarse. Importa `sileo` de acá en
 * vez de del paquete y ya suena.
 *
 * Lo que **no** hace: sonar solo. Un aviso que aparece porque terminó algo que
 * nadie pidió no toca nada —no hay ninguno hoy, y el día que lo haya se le pasa
 * el toast sin señal—. Las señales son para lo que alguien provocó.
 */

/* Qué señal le toca a cada tipo de aviso.
 *
 * `success` y `error` son las dos que `cuelume` hizo para esto y no hay nada que
 * decidir. Las otras tres sí:
 *
 *  warning — la misma que el error, y a propósito. Un warning en esta consola es
 *            algo que no se hizo (una política que bloquea, un alta que no
 *            corresponde), y para el oído eso es un rechazo. `error` es "soft
 *            knock, descending refusal": un no, no un accidente.
 *  info    — `whisper`, la más callada de las diecisiete. Un dato que aparece
 *            sin que nadie lo pidiera no merece más que eso.
 *  action  — `chime`, que es la que llama a mirar. Es el único aviso que espera
 *            que alguien haga algo con él —trae un botón—, así que es el único
 *            que puede permitirse pedir atención. */
const SEÑALES = {
  success: "success",
  error: "error",
  warning: "error",
  info: "whisper",
  action: "chime",
} as const;

export const sileo = {
  ...crudo,

  success: (opts: Parameters<typeof crudo.success>[0]) => {
    sonar(SEÑALES.success);
    return crudo.success(opts);
  },
  error: (opts: Parameters<typeof crudo.error>[0]) => {
    sonar(SEÑALES.error);
    return crudo.error(opts);
  },
  warning: (opts: Parameters<typeof crudo.warning>[0]) => {
    sonar(SEÑALES.warning);
    return crudo.warning(opts);
  },
  info: (opts: Parameters<typeof crudo.info>[0]) => {
    sonar(SEÑALES.info);
    return crudo.info(opts);
  },
  action: (opts: Parameters<typeof crudo.action>[0]) => {
    sonar(SEÑALES.action);
    return crudo.action(opts);
  },

  /* `show` no suena. Es el genérico —el que se usa cuando ninguno de los cinco
     tipos es el que va— y no hay de dónde sacar qué señal le toca. Adivinar acá
     sería ponerle un sonido a cualquier cosa. */

  /**
   * Los tres momentos, sonando.
   *
   * El toast de una promesa ya cuenta el relato entero —está pasando, salió,
   * no salió— y el sonido lo acompaña con las mismas tres marcas: `loading`
   * cuando arranca, y `success` o `error` cuando el servidor contestó.
   *
   * El `loading` importa más de lo que parece. Es la única señal que se escucha
   * *antes* de saber el final, y es la que le dice a quien apretó que el pedido
   * salió —que es justo lo que uno duda en el segundo en que no pasó nada
   * todavía—.
   *
   * El sonido se cuelga de la promesa por afuera y se devuelve la de `sileo`,
   * no una nueva: quien encadena algo después sigue recibiendo lo mismo que
   * recibía, incluida la falla.
   */
  promise: <T>(
    promesa: Parameters<typeof crudo.promise<T>>[0],
    opts: Parameters<typeof crudo.promise<T>>[1],
  ) => {
    sonar("loading");
    const contado = crudo.promise(promesa, opts);
    contado.then(
      () => sonar(SEÑALES.success),
      () => sonar(SEÑALES.error),
    );
    return contado;
  },
};
