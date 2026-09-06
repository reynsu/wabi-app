/**
 * Escribir un PDF, a mano.
 *
 * Sirve para una cosa y la hace entera: **una tabla de texto**, con un título
 * arriba y tantas páginas como haga falta. No es una biblioteca de PDF y no
 * pretende serlo —no hay imágenes, ni colores, ni tipografías incrustadas— y por
 * eso entra en un archivo en vez de en una dependencia de un mega.
 *
 * **Por qué a mano.** Un PDF es texto plano con una tabla de posiciones al
 * final: un catálogo, un árbol de páginas, una fuente y un flujo de contenido
 * por página. Las catorce fuentes base —Helvetica entre ellas— las trae el
 * lector, así que no hay que incrustar nada. Lo único delicado es el `xref`, que
 * son los desplazamientos **en bytes** de cada objeto.
 *
 * **Y por eso todo se escribe en Latin-1.** Con UTF-8, un nombre como "Martín"
 * ocuparía un byte más de lo que mide el string, y los desplazamientos del
 * `xref` quedarían corridos: el lector abriría un archivo roto justamente en el
 * que tiene un acento. Escribiendo un byte por caracter, `length` **es** el
 * desplazamiento. Da la casualidad de que eso es también lo que espera
 * `WinAnsiEncoding`, que es la codificación que declaramos para la fuente, así
 * que los acentos salen bien por la misma razón por la que las cuentas cierran.
 * Lo que no entra en Latin-1 —un ideograma, un emoji— sale como `?`: es lo que
 * un PDF sin fuente incrustada puede prometer.
 */

/** Una fila de la tabla. Una celda por columna; las que sobran se ignoran. */
export interface FilaDePdf {
  celdas: string[];
  /** En negrita. Para la cabecera de la tabla y poco más. */
  negrita?: boolean;
}

/* La hoja, en puntos: A4, que es lo que sale de cualquier impresora que no esté
   en Estados Unidos. */
const ANCHO = 595;
const ALTO = 842;
const MARGEN = 56;

const CUERPO = 10;
const RENGLON = 16;
const TITULO = 16;

/** Cuántas filas entran en una página. La primera lleva el título y su aire, así
 *  que entran menos: se calcula por página y no una sola vez. */
const filasQueEntran = (conTitulo: boolean) =>
  Math.floor((ALTO - MARGEN * 2 - (conTitulo ? TITULO + RENGLON * 2 : 0)) / RENGLON);

/** El texto, como lo espera un PDF: `\`, `(` y `)` se escapan, y lo que no entra
 *  en un byte no se puede escribir sin incrustar una fuente. */
const escapar = (s: string) =>
  [...s]
    .map((c) => (c.charCodeAt(0) > 255 ? "?" : c))
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

/**
 * Armar el PDF.
 *
 * Devuelve los bytes. Quien lo llama decide qué hace con ellos —bajarlos,
 * mostrarlos en un `blob:`—: esto no sabe de navegadores.
 */
export function armarPdf({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  /** Dónde empieza cada columna, en puntos desde el margen izquierdo. */
  columnas: number[];
  filas: FilaDePdf[];
  /* `Uint8Array<ArrayBuffer>` y no `Uint8Array` a secas: el genérico por defecto
     admite un `SharedArrayBuffer`, y un `Blob` no lo recibe. Decirlo acá evita
     un casteo en cada lugar que use estos bytes. */
}): Uint8Array<ArrayBuffer> {
  /* Repartir las filas en páginas antes de escribir nada: el árbol de páginas
     necesita saber cuántas son. */
  const paginas: FilaDePdf[][] = [];
  let resto = filas;
  while (resto.length > 0 || paginas.length === 0) {
    const cuantas = filasQueEntran(paginas.length === 0);
    paginas.push(resto.slice(0, cuantas));
    resto = resto.slice(cuantas);
  }

  const flujoDe = (pagina: FilaDePdf[], primera: boolean) => {
    const partes: string[] = ["BT"];
    let y = ALTO - MARGEN;

    if (primera) {
      partes.push(
        `/F2 ${TITULO} Tf`,
        `1 0 0 1 ${MARGEN} ${y - TITULO} Tm`,
        `(${escapar(titulo)}) Tj`,
      );
      y -= TITULO + RENGLON * 2;
    }

    for (const fila of pagina) {
      partes.push(`/${fila.negrita ? "F2" : "F1"} ${CUERPO} Tf`);
      fila.celdas.forEach((celda, i) => {
        if (!celda) return;
        partes.push(
          `1 0 0 1 ${MARGEN + (columnas[i] ?? 0)} ${y - CUERPO} Tm`,
          `(${escapar(celda)}) Tj`,
        );
      });
      y -= RENGLON;
    }

    partes.push("ET");
    return partes.join("\n");
  };

  /* Los objetos, en orden. 1 es el catálogo, 2 el árbol de páginas, 3 y 4 las
     dos fuentes; de ahí en más van de a dos por página —la página y su flujo—. */
  const objetos: string[] = [];
  const primerObjetoDePagina = 5;
  const idsDePagina = paginas.map((_, i) => primerObjetoDePagina + i * 2);

  objetos.push("<< /Type /Catalog /Pages 2 0 R >>");
  objetos.push(
    `<< /Type /Pages /Kids [${idsDePagina.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`,
  );
  objetos.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  objetos.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  paginas.forEach((pagina, i) => {
    const flujo = flujoDe(pagina, i === 0);
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${idsDePagina[i] + 1} 0 R >>`,
    );
    objetos.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
  });

  /* Y ahora el archivo, anotando dónde empieza cada objeto. La cuenta es en
     caracteres porque abajo cada caracter va a ocupar un byte: ver la nota de
     arriba. */
  let archivo = "%PDF-1.4\n";
  const donde: number[] = [];

  objetos.forEach((cuerpo, i) => {
    donde.push(archivo.length);
    archivo += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });

  const inicioDelXref = archivo.length;
  archivo += `xref\n0 ${objetos.length + 1}\n`;
  /* La entrada cero es la cabeza de la lista de libres, y se escribe siempre
     así. Las demás llevan el desplazamiento en diez dígitos. */
  archivo += "0000000000 65535 f \n";
  for (const posicion of donde) {
    archivo += `${String(posicion).padStart(10, "0")} 00000 n \n`;
  }
  archivo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;
  archivo += `startxref\n${inicioDelXref}\n%%EOF\n`;

  /* Un byte por caracter, que es lo que hace que los desplazamientos de arriba
     sean ciertos. */
  const bytes = new Uint8Array(archivo.length);
  for (let i = 0; i < archivo.length; i++) bytes[i] = archivo.charCodeAt(i) & 0xff;
  return bytes;
}
