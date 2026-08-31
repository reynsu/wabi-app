import { azarDesde, semillaDe } from "@/pages/azar";

/* La imagen de un mensaje: los píxeles que se ven en la burbuja y en la
   miniatura de la tabla.

   No hay archivos, por lo mismo que no hay mp3s —ver `nota-de-voz.ts`—: un
   fixture que necesita fotos en `public/` hay que conseguirlas, versionarlas y
   explicar de dónde salieron, y encima serían las mismas tres dando vueltas por
   cien burbujas. Acá cada foto **se dibuja a partir de su id**: es distinta de
   la de al lado y es la misma en cada recarga.

   Lo que se dibuja es una foto **fuera de foco**: manchas de color superpuestas
   y desenfocadas, más claras arriba y más oscuras abajo. No es una foto y no
   pretende serlo —no hay manera de fabricar una acá—; es lo que queda de una
   cuando se la mira a través de un vidrio esmerilado, que es la contracara
   exacta del murmullo de las notas de voz.

   Y es más honesto que un rectángulo gris con un ícono en el medio: lo que esta
   pantalla tiene que probar es cómo se ve una burbuja con una foto adentro y
   cómo se lee una tabla con miniaturas —qué proporciones entran, cuánto pesa el
   color al lado del texto—, y de eso un placeholder no dice nada.

   El día que las fotos vengan de una API, este archivo se borra: la burbuja
   pide una URL y unas medidas, y de dónde salen no es asunto suyo. */

/** Las proporciones que puede tener. Tres y no una: una tabla donde todas las
 *  miniaturas son cuadradas no prueba nada, y una burbuja tiene que poder
 *  aguantar tanto un apaisado como un vertical de teléfono. Las medidas son las
 *  intrínsecas —las que un `<img>` declararía—, así que quien la muestra puede
 *  reservar el hueco antes de que llegue y la burbuja no salta. */
const FORMAS = [
  { ancho: 1200, alto: 900 }, // apaisada
  { ancho: 900, alto: 1200 }, // vertical, la del teléfono
  { ancho: 1000, alto: 1000 }, // cuadrada
] as const;

export interface Foto {
  ancho: number;
  alto: number;
}

/** Qué forma le toca a esta foto. Sale del id, como todo lo demás. */
export const formaDe = (id: string): Foto =>
  FORMAS[semillaDe(id) % FORMAS.length];

/* Cuántas manchas tiene una foto. Siete: menos se lee como un degradado de dos
   colores, y muchas más se promedian entre ellas y vuelven al mismo gris del
   que las manchas venían a sacarla. */
const MANCHAS = 7;

/* Cuánto se desenfoca, como fracción del ancho. El número importa más de lo que
   parece: pasado de la vigésima parte, siete manchas se promedian en un solo
   tono plano y la foto deja de tener adentro, que era todo el punto. Acá tiene
   que quedar fuera de foco, no borrada. */
const DESENFOQUE = 20;

/** El SVG de la foto, como texto.
 *
 *  Un `<svg>` y no un `<canvas>`: lo que hay acá son cinco elipses y un
 *  desenfoque, que es exactamente lo que un SVG dice en dos líneas y un canvas
 *  necesita un contexto, un tamaño en píxeles y un `toDataURL` para decir. Y
 *  como va adentro de un `<img>`, escala sola: la misma foto sirve de miniatura
 *  de 32px y de imagen de burbuja sin fabricar dos.
 *
 *  Los colores en `hsl` y no en `oklch`: el SVG lo pinta el motor del navegador
 *  con su propio parser de color, y `hsl` es el que no depende de qué versión
 *  sea. */
function svgDe(id: string, { ancho, alto }: Foto) {
  const azar = azarDesde(semillaDe(id));

  /* El tono de la foto entera, y una vuelta de tuerca por mancha. Todas las
     manchas caen cerca del mismo tono porque una foto tiene una luz sola: cinco
     colores del otro lado de la rueda se leen como un logo, no como una
     imagen. */
  const base = Math.floor(azar() * 360);
  const tono = (giro: number) => (base + giro + 360) % 360;

  const fondo = `hsl(${tono(0)} ${28 + azar() * 22}% ${52 + azar() * 16}%)`;

  const manchas = Array.from({ length: MANCHAS }, (_, i) => {
    /* Repartidas de arriba abajo y no al azar: así siempre hay algo en cada
       franja de la foto y no quedan tres apiladas en una esquina. */
    const cy = ((i + 0.5) / MANCHAS) * alto + (azar() - 0.5) * (alto / MANCHAS);
    const cx = (0.1 + azar() * 0.8) * ancho;
    /* Chicas y de tamaños distintos: todas grandes se pisan y se promedian, y
       lo que queda es un degradado. Las chicas son las que, desenfocadas,
       parecen cosas. */
    const rx = (0.1 + azar() * 0.26) * ancho;
    const ry = (0.1 + azar() * 0.24) * alto;
    /* Más claro arriba, más oscuro abajo. Es la luz de casi cualquier foto
       —cielo o lámpara arriba, suelo abajo— y es lo que la salva de leerse como
       un fondo de pantalla. */
    const altura = 1 - cy / alto;
    const luz = 24 + altura * 52 + azar() * 18;
    const color = `hsl(${tono((azar() - 0.5) * 110)} ${34 + azar() * 44}% ${luz}%)`;
    return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${color}"/>`;
  }).join("");

  /* Proporcional al ancho: fijo en píxeles, una foto vertical saldría más
     nítida que una apaisada sin que nadie lo haya pedido. */
  const desenfoque = (ancho / DESENFOQUE).toFixed(0);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">`,
    `<filter id="d" x="-25%" y="-25%" width="150%" height="150%">`,
    `<feGaussianBlur stdDeviation="${desenfoque}"/></filter>`,
    `<rect width="${ancho}" height="${alto}" fill="${fondo}"/>`,
    `<g filter="url(#d)">${manchas}</g>`,
    `</svg>`,
  ].join("");
}

/* Fabricada una vez por mensaje y guardada. La data URL de un SVG es un string
   largo, y rehacerlo en cada render es rehacer el `encodeURIComponent` de dos
   mil caracteres cada vez que la tabla se repinta. */
const memoria = new Map<string, string>();

/** La foto de un mensaje, lista para el `src` de un `<img>`. */
export function fotoDeMensaje(id: string, forma: Foto): string {
  const guardada = memoria.get(id);
  if (guardada) return guardada;
  /* Data URL y no blob: un SVG es texto, así que no hay nada que envolver en un
     `Blob` ni un `URL` que revocar después. */
  const url = `data:image/svg+xml,${encodeURIComponent(svgDe(id, forma))}`;
  memoria.set(id, url);
  return url;
}
