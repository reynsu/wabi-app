import { create } from "zustand";
import { bind, play, setEnabled, setVolume, type SoundName } from "cuelume";

import { guardarPreferencias, leerPreferencias } from "@/lib/preferencias";

/**
 * Cómo suena la consola.
 *
 * El sonido lo sintetiza `cuelume` —diecisiete señales hechas con Web Audio, sin
 * archivos y sin dependencias—. Lo que vive acá no es el motor sino **quién lo
 * manda**: si está encendido y a qué volumen.
 *
 * Es la misma forma que `tema`: la tienda es la fuente y el motor es la salida.
 * `cuelume` guarda su propio `enabled` y su propio `volume` adentro, pero nadie
 * los toca directamente —se los escribe `aplicar`, igual que `tema` es el único
 * que escribe la clase del `<html>`—. Preguntar por el sonido y oírlo no pueden
 * contradecirse.
 *
 * **Se recuerda**, en el mismo renglón que el tema —ver `lib/preferencias`—.
 * Un mute que se olvida en cada refresco es un mute a medias: quien apagó el
 * sonido lo apagó porque está en una oficina con gente, y esa oficina sigue
 * ahí mañana. La sesión no se guarda y eso no cambia: guardar que alguien
 * prefiere el silencio no le miente a nadie, guardar que entró sí.
 */
interface Sonido {
  /** Si la consola suena. */
  activo: boolean;
  /** Cuánto, de 0 a 1. */
  volumen: number;
  alternar: () => void;
  ajustar: (volumen: number) => void;
}

/* El motor lo configura la tienda y nadie más. */
const aplicar = (activo: boolean, volumen: number) => {
  setEnabled(activo);
  setVolume(volumen);
};

const GUARDADO = leerPreferencias();

export const useSonido = create<Sonido>()((set) => ({
  activo: GUARDADO.sonido,
  volumen: GUARDADO.volumen,
  alternar: () =>
    set((s) => {
      const activo = !s.activo;
      aplicar(activo, s.volumen);
      guardarPreferencias({ sonido: activo });
      return { activo };
    }),
  ajustar: (volumen) =>
    set((s) => {
      const acotado = Math.min(1, Math.max(0, volumen));
      aplicar(s.activo, acotado);
      guardarPreferencias({ volumen: acotado });
      return { volumen: acotado };
    }),
}));

/**
 * Enciende el sonido de la app. Se llama una sola vez, en `main`.
 *
 * `bind()` engancha un puñado de listeners delegados en el documento y de ahí
 * en más cualquier elemento con un `data-cuelume-*` suena —incluidos los que
 * React monte después—. Por eso va una vez al arranque y no en cada pantalla:
 * no hay nada que volver a atar cuando cambia la pestaña o se abre un menú.
 *
 * No suena nada por sí solo. La primera señal la dispara siempre algo que hizo
 * quien está del otro lado, que es lo que el navegador pide antes de dejar
 * abrir el `AudioContext` —y lo que corresponde igual.
 */
export function iniciarSonido() {
  bind();
  const { activo, volumen } = useSonido.getState();
  aplicar(activo, volumen);
}

/**
 * Para un control que no es un botón sino un interruptor.
 *
 * `Button` suena al bajar el dedo, que es lo correcto para un botón que hace
 * algo. Un control que **alterna** cuenta otra historia: no hizo algo, quedó de
 * otra manera. `toggle` es un click-clack mecánico y dice eso solo.
 *
 * **Suena en el `pointerdown`, no en el `click`.** Es el mismo cuidado que el
 * botón: `data-cuelume-toggle` se dispara con el `click`, y el navegador emite
 * el `click` recién en el `pointerup` —o sea, tan tarde como haya durado el
 * apretón, distinto en cada uno—. Pidiendo el sonido `toggle` desde el atributo
 * `press` se conserva el click-clack y se lo ancla al instante en que el dedo
 * baja, que no varía.
 *
 * Lo que se pierde: el teclado. `toggle` sonaba también con Enter y Espacio
 * porque escucha la activación nativa; `press` escucha el puntero y nada más.
 * Es un cambio de sonido y no de función —el control hace lo mismo— y se elige
 * así porque el puntero es por donde pasa el gesto en esta consola.
 */
export const COMO_INTERRUPTOR = {
  "data-cuelume-press": "toggle",
};

/**
 * Tocar una señal a mano, para lo que no es un gesto sino un resultado.
 *
 * Los gestos —pasar por encima, apretar, soltar, tildar— se marcan en el markup
 * con `data-cuelume-*` y no pasan por acá. Esto es para lo otro: se guardó, no
 * se pudo, terminó de cargar. Cosas que no ocurren cuando el dedo baja sino un
 * rato después, cuando el servidor contestó.
 *
 * Existe para que el resto de la app no importe `cuelume` en diez archivos: la
 * tienda es la única que habla con el motor. Si mañana esto se muta o se cambia
 * de librería, se cambia en un lugar.
 */
export const sonar = (senal: SoundName) => play(senal);
