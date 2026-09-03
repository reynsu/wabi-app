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
 */
interface Sesion {
  /** El correo con el que se entró, o `null` si no entró nadie. */
  email: string | null;
  entrar: (email: string) => void;
  salir: () => void;
}

export const useSesion = create<Sesion>()((set) => ({
  email: null,
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
