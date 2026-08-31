/* El azar del fixture: siempre el mismo.

   Las dos cosas que este fixture fabrica —el audio de una nota de voz y la
   imagen de una foto— tienen que salir iguales en cada pintada: un `Math.random()`
   daría una onda distinta cada vez que se scrollea la tabla, y la misma foto
   cambiaría de color al volver a la página anterior. Lo que las hace estables es
   arrancar siempre del mismo lugar, y ese lugar es el id del mensaje.

   Vive aparte porque lo usan los dos. Una copia en cada archivo es una copia que
   un día se toca de un lado nada más. */

/** Un número estable a partir de un texto (FNV-1a). */
export function semillaDe(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Un generador que siempre da la misma secuencia para la misma semilla
 *  (mulberry32). */
export function azarDesde(semilla: number) {
  let s = semilla || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
