import { create } from "zustand";

/**
 * Quién entró.
 *
 * Lo único que la app necesita saber de la sesión: si hay alguien adentro y con
 * qué correo entró. No hay usuario, ni token, ni permisos —esta consola no tiene
 * backend— y agregarlos ahora sería inventar la forma de algo que la API va a
 * decidir.
 *
 * **En memoria y sin persistir, a propósito.** Recargar vuelve a la pantalla de
 * entrada. Guardarlo en `localStorage` sería fingir una sesión que ningún
 * servidor emitió, y el día que haya uno lo que se guarda es su token con su
 * vencimiento, no un booleano nuestro. Es la misma decisión que toman las
 * tiendas de esta app: lo que la consola hizo vive mientras la pestaña viva.
 *
 * Mientras se trabaja en la app, eso molesta: cada refresco pide entrar de
 * nuevo. Para eso está `SALTAR_LOGIN` acá abajo —la sesión arranca abierta y
 * la puerta no aparece—. La pantalla sigue montada y viva: se llega a ella
 * cerrando sesión desde el menú de la marca, o poniendo la bandera en `false`.
 */
interface Sesion {
  /** El correo con el que se entró, o `null` si no entró nadie. */
  email: string | null;
  entrar: (email: string) => void;
  salir: () => void;
}

/** Entrar sin pasar por la puerta, mientras se desarrolla.
 *
 *  En `true` la app abre con la sesión ya iniciada: refrescar no vuelve a pedir
 *  el correo. Es una comodidad del desarrollo y nada más —no hay nada que
 *  proteger todavía, la consola no tiene backend—, así que vive acá, en una
 *  sola línea, y se apaga poniéndola en `false` para volver a ver el login.
 *
 *  Cuando haya API esto se borra: la sesión la va a abrir un token, no una
 *  constante. */
const SALTAR_LOGIN = true;

/** Con quién entra la app cuando se saltea la puerta. */
const CUENTA_DEMO = "demo@wabi.app";

export const useSesion = create<Sesion>()((set) => ({
  email: SALTAR_LOGIN ? CUENTA_DEMO : null,
  entrar: (email) => set({ email: email.trim() }),
  salir: () => set({ email: null }),
}));

/** Cuánto tarda en entrar.
 *
 *  No hay servidor detrás, y sin demora entrar sería instantáneo: se toca el
 *  botón y ya está adentro. Eso no es lo que va a pasar el día que haya una API
 *  —una autenticación es un viaje de ida y vuelta— y una pantalla diseñada
 *  contra un login instantáneo no tiene dónde poner lo que pasa mientras. Es la
 *  misma decisión, con el mismo número, que las altas de esta consola. */
const DEMORA_MS = 900;

/**
 * Entrar. Devuelve cuando la sesión quedó abierta.
 *
 * Acepta a cualquiera: no hay a quién preguntarle. Lo que sí hace es tardar y
 * poder fallar, que es lo que la pantalla necesita para tener sus tres momentos
 * —está entrando, entró, no se pudo— escritos de verdad y no simulados.
 *
 * Falla con una contraseña de menos de cuatro caracteres. Es una regla inventada
 * y se nota, pero es la única manera de que el cartel de error del bloque exista
 * en la app y no sólo en el showcase: una pantalla de login cuyo error nadie vio
 * nunca es una pantalla a medias. Cuando haya API, esto se borra entero.
 */
export async function entrar(email: string, password: string) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  if (password.trim().length < 4) {
    throw new Error("That password doesn't match. Check it and try again.");
  }

  useSesion.getState().entrar(email);
}
