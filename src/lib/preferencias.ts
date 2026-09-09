/**
 * Lo que la consola recuerda de una visita a la otra.
 *
 * Un solo renglón en `localStorage` con todo lo que alguien eligió sobre cómo
 * quiere que esto se vea y suene. **Preferencias y nada más**: no hay sesión
 * acá, no hay datos, no hay nada que un servidor haya dicho. Ver
 * `stores/sesion.ts` para por qué la sesión sigue muriendo con la pestaña —
 * guardar un booleano de "entré" sería fingir una autenticación; guardar que
 * alguien prefiere el tema oscuro no le miente a nadie.
 *
 * **Por qué una clave y no una por tienda.** Son la misma decisión tomada dos
 * veces —"cómo quiero la consola"— y separarlas garantiza que en algún momento
 * una se guarde y la otra no. Además así se leen de un saque al arrancar, que
 * es cuando importa: el tema tiene que estar puesto antes del primer píxel.
 *
 * Todo lo de acá es a prueba de que no haya nada. `localStorage` puede tirar
 * —modo privado, cookies bloqueadas, cuota llena—, el JSON puede estar roto y
 * lo guardado puede ser de una versión vieja con otra forma. En todos esos
 * casos se cae a los valores por defecto y la app arranca igual: una
 * preferencia que no se pudo leer es una molestia, no una falla.
 */

const CLAVE = "wabi:preferencias";

export interface Preferencias {
  /** Tema oscuro. */
  oscuro: boolean;
  /** Si la consola suena. */
  sonido: boolean;
  /** Cuánto, de 0 a 1. */
  volumen: number;
}

/* Con qué arranca alguien que nunca eligió nada.
 *
 * El volumen bajo a propósito: esto es una consola de trabajo. Las señales
 * están para que un guardado se note sin mirar, no para anunciarse. */
export const POR_DEFECTO: Preferencias = {
  oscuro: false,
  sonido: true,
  volumen: 0.55,
};

/* Se valida campo por campo en vez de confiar en la forma.
 *
 * Lo que sale de `localStorage` lo escribió otra versión de esta app, y no hay
 * ninguna garantía de que siga siendo lo que era. Un `volumen: "alto"` que
 * entra sin mirar termina en un `NaN` adentro de un `GainNode`, que es la clase
 * de falla que aparece tres pantallas más allá y no se parece en nada a su
 * causa. Cada campo que no convence se reemplaza por el default y los otros
 * sobreviven: media preferencia leída es mejor que ninguna. */
const limpiar = (crudo: unknown): Preferencias => {
  if (typeof crudo !== "object" || crudo === null) return POR_DEFECTO;
  const p = crudo as Record<string, unknown>;
  return {
    oscuro: typeof p.oscuro === "boolean" ? p.oscuro : POR_DEFECTO.oscuro,
    sonido: typeof p.sonido === "boolean" ? p.sonido : POR_DEFECTO.sonido,
    volumen:
      typeof p.volumen === "number" && Number.isFinite(p.volumen)
        ? Math.min(1, Math.max(0, p.volumen))
        : POR_DEFECTO.volumen,
  };
};

/** Lo guardado, o los valores por defecto si no hay nada legible. */
export function leerPreferencias(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo === null ? POR_DEFECTO : limpiar(JSON.parse(crudo));
  } catch {
    /* Sin `localStorage` o con un JSON roto la app arranca en su default. No se
       avisa: quien navega en modo privado no eligió esto por error. */
    return POR_DEFECTO;
  }
}

/**
 * Guarda lo que cambió, sin pisar lo demás.
 *
 * Recibe un parcial y lo funde sobre lo que ya está escrito, así el tema puede
 * guardarse sin saber nada del volumen y al revés. Vuelve a leer del disco en
 * vez de usar una copia en memoria: es una escritura por clic, no vale la pena
 * cachear, y así dos tiendas no se pisan.
 */
export function guardarPreferencias(cambio: Partial<Preferencias>): void {
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ ...leerPreferencias(), ...cambio }),
    );
  } catch {
    /* Si no se puede escribir, la elección igual vale para esta sesión: las
       tiendas ya la tienen en memoria. Lo único que se pierde es el recuerdo. */
  }
}
