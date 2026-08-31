import { azarDesde, semillaDe } from "@/pages/azar";

/* El audio de una nota de voz: lo que suena cuando se toca play, y la onda que
   se dibuja antes de tocarlo.

   No hay archivos. Un fixture que necesita mp3s en `public/` deja de ser un
   fixture —hay que conseguirlos, versionarlos y explicar de dónde salieron— y
   encima serían siempre los mismos tres dando vueltas por doscientas filas,
   con la misma onda repetida. Acá cada nota **fabrica sus propias muestras** a
   partir de su id: suena distinta de la de al lado, y suena igual en cada
   recarga. Es la misma regla que el resto del fixture —el reparto de
   conversaciones sale del número de la cuenta, y no de un `Math.random()`—.

   Lo que se fabrica es un murmullo con forma de habla: sílabas, pausas cortas
   entre ellas y pausas largas entre frases, sobre un tono que cambia de nota
   según quién habla. No es una voz —no hay manera de fabricar una acá— y no
   pretende serlo: pasada por el pasabajos suena a alguien hablando del otro
   lado de una pared, que para una consola donde el audio es un registro y no
   un mensaje es más honesto que un pitido.

   Lo que sí tiene que ser cierto es el gesto, porque es lo que se mira: que la
   onda tenga picos donde alguien habló y valles donde calló, que la nota dure
   lo que dice que dura, y que arrastrar el cursor caiga en otro pedazo.

   El día que las notas vengan de una API, este archivo se borra: la pantalla
   pide una URL y unos picos, y de dónde salen no es asunto suyo. */

/* El azar sale de `azar.ts` y no de acá: es el mismo que usa la foto de un
   mensaje, y dos generadores distintos para la misma idea —"esto tiene que
   salir igual siempre"— es una copia esperando a que la toquen de un solo
   lado. La semilla es el id de la nota: mismo id, mismas muestras, en esta
   pintada y en la próxima. */

/** A cuánto se muestrea. 8 kHz es lo que usa un teléfono para la voz: alcanza
 *  para todo lo que hay acá y hace que una nota de veinte segundos pese lo que
 *  pesa una imagen chica. */
const MUESTREO = 8000;

/** Cuántos puntos de onda por segundo se le pasan al dibujante. Doscientos es
 *  más de lo que cualquier ancho de columna puede mostrar —una barra cada dos
 *  píxeles sobre 300px son 150 barras para diez segundos—, así que la onda no
 *  pierde nada y el arreglo pesa cuarenta veces menos que las muestras. */
const PUNTOS_POR_SEGUNDO = 200;

/** Las muestras de la nota, de -1 a 1.
 *
 *  Se recorre la nota sílaba por sílaba y no muestra por muestra: una sílaba
 *  es un tramo con su propio pico, y entre dos hay un silencio —corto casi
 *  siempre, largo de vez en cuando, que es donde se termina una frase—. Esa
 *  alternancia es todo lo que hace que la onda se lea como habla y no como un
 *  bloque parejo. */
function muestrasDe(id: string, segundos: number): Float32Array {
  const azar = azarDesde(semillaDe(id));
  const total = Math.round(segundos * MUESTREO);
  const salida = new Float32Array(total);

  /* La nota del que habla, fija para toda la nota: es lo que hace que dos
     notas seguidas no suenen a la misma persona. */
  const fundamental = 95 + azar() * 85;

  let i = 0;
  let fase = 0;
  /* El pasabajos, de un polo. Su estado sobrevive entre sílabas a propósito:
     así el sonido no se corta en seco al empezar el silencio, se apaga. */
  let filtrada = 0;

  const escribir = (muestras: number, valor: (t: number) => number) => {
    for (let j = 0; j < muestras && i < total; j++, i++) {
      filtrada += (valor(j / muestras) - filtrada) * 0.35;
      salida[i] = filtrada * 0.55;
    }
  };

  while (i < total) {
    const largo = Math.round((0.09 + azar() * 0.13) * MUESTREO);
    const pico = 0.45 + azar() * 0.55;

    escribir(largo, (t) => {
      /* La envolvente de la sílaba: sube y baja. El exponente la deja
         despegar rápido y apagarse despacio, que es como suena una sílaba y
         no como suena una campana. */
      const envolvente = Math.sin(Math.PI * t) ** 0.8 * pico;
      /* El tono se mueve un poco adentro de la sílaba: quieto, suena a
         teclado. */
      const f = fundamental * (1 + 0.06 * Math.sin(2 * Math.PI * t));
      fase += (2 * Math.PI * f) / MUESTREO;
      /* Fundamental y dos armónicos, más un poco de ruido: los armónicos son
         lo que le da cuerpo y el ruido lo que le da las consonantes. */
      const voz =
        Math.sin(fase) * 0.6 +
        Math.sin(fase * 2) * 0.25 +
        Math.sin(fase * 3) * 0.1;
      return envolvente * (voz * 0.75 + (azar() * 2 - 1) * 0.35);
    });

    /* Una de cada cinco pausas es larga: ahí termina una frase. Sin eso la
       onda queda pareja de punta a punta y se lee como un zumbido cortado a
       intervalos, que es justo lo que no es. */
    const pausa =
      azar() < 0.22 ? 0.18 + azar() * 0.25 : 0.02 + azar() * 0.05;
    escribir(Math.round(pausa * MUESTREO), () => 0);
  }

  return salida;
}

/* Las muestras, empaquetadas como WAV: cabecera de 44 bytes y PCM de 16 bits,
   mono. Se arma a mano y no con un encoder porque un WAV sin comprimir *es*
   eso —no hay nada que codificar— y traer una dependencia para escribir
   cuarenta y cuatro bytes sería peor que escribirlos. */
function comoWav(muestras: Float32Array): Blob {
  const bytes = new ArrayBuffer(44 + muestras.length * 2);
  const vista = new DataView(bytes);
  const marca = (donde: number, texto: string) => {
    for (let i = 0; i < texto.length; i++)
      vista.setUint8(donde + i, texto.charCodeAt(i));
  };

  marca(0, "RIFF");
  vista.setUint32(4, 36 + muestras.length * 2, true);
  marca(8, "WAVE");
  marca(12, "fmt ");
  vista.setUint32(16, 16, true); // lo que mide este bloque
  vista.setUint16(20, 1, true); // PCM sin comprimir
  vista.setUint16(22, 1, true); // un canal
  vista.setUint32(24, MUESTREO, true);
  vista.setUint32(28, MUESTREO * 2, true); // bytes por segundo
  vista.setUint16(32, 2, true); // bytes por muestra
  vista.setUint16(34, 16, true); // bits por muestra
  marca(36, "data");
  vista.setUint32(40, muestras.length * 2, true);

  for (let i = 0; i < muestras.length; i++) {
    const m = Math.max(-1, Math.min(1, muestras[i]));
    vista.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }

  return new Blob([bytes], { type: "audio/wav" });
}

/** La onda que se dibuja: una muestra por cada tramito, la más alta del tramo
 *  y con su signo.
 *
 *  Se queda con el pico y no con el promedio ni con la primera: promediar
 *  aplana justamente lo que hay que ver, y quedarse con una al azar hace que
 *  la misma nota se dibuje distinta según cuántos puntos se pidan. El signo
 *  viaja porque el dibujante quiere una onda —arriba y abajo del eje—, no un
 *  contorno. */
function ondaDe(muestras: Float32Array, segundos: number): Float32Array {
  const puntos = Math.max(1, Math.round(segundos * PUNTOS_POR_SEGUNDO));
  const tramo = Math.max(1, Math.floor(muestras.length / puntos));
  const onda = new Float32Array(puntos);

  for (let p = 0; p < puntos; p++) {
    let mayor = 0;
    const desde = p * tramo;
    const hasta = Math.min(desde + tramo, muestras.length);
    for (let i = desde; i < hasta; i++) {
      if (Math.abs(muestras[i]) > Math.abs(mayor)) mayor = muestras[i];
    }
    onda[p] = mayor;
  }

  return onda;
}

/** Lo que el reproductor necesita: de dónde sale el sonido y cómo se dibuja.
 *  Los dos salen de las mismas muestras, así que la onda que se ve es la del
 *  audio que suena y no una decoración al lado. */
export interface Nota {
  /** Un blob URL: se le pasa al `<audio>` que hay adentro del reproductor. */
  url: string;
  /** Los picos ya calculados. Dárselos al dibujante le ahorra bajar el archivo
   *  y decodificarlo —no hay nada que bajar, y decodificar abre un
   *  `AudioContext` por nota—: la onda aparece dibujada de entrada. */
  onda: Float32Array;
}

/* Fabricada una vez por nota y guardada. No es por velocidad: el blob URL vive
   mientras alguien lo tenga anotado, y fabricar uno nuevo en cada render sería
   dejar uno colgado en cada scroll. Se guarda por id, que es lo que la nota
   tiene de único.

   No se revocan. Duran lo que dura la pestaña, y son las notas que el que está
   mirando ya miró: revocar la que se fue de pantalla obligaría a rehacerla
   —con su síntesis— cada vez que se scrollea para atrás. */
const memoria = new Map<string, Nota>();

export function notaDeVoz(id: string, segundos: number): Nota {
  const guardada = memoria.get(id);
  if (guardada) return guardada;

  const muestras = muestrasDe(id, segundos);
  const armada: Nota = {
    url: URL.createObjectURL(comoWav(muestras)),
    onda: ondaDe(muestras, segundos),
  };
  memoria.set(id, armada);
  return armada;
}

/** El reloj de una nota: `0:07`, `1:04`. Los segundos siempre con dos cifras —
 *  `1:4` no es un tiempo— y los minutos sin rellenar. */
export function reloj(segundos: number) {
  const enteros = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(enteros / 60);
  return `${minutos}:${String(enteros % 60).padStart(2, "0")}`;
}
