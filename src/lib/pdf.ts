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

/** Cuántas filas entran en una página. La primera lleva el título y su aire, y
 *  todas llevan la cabecera si la hay, así que se calcula por página y no una
 *  sola vez. */
const filasQueEntran = (conTitulo: boolean, conCabecera: boolean) =>
  Math.floor(
    (ALTO -
      MARGEN * 2 -
      (conTitulo ? TITULO + RENGLON * 2 : 0) -
      (conCabecera ? RENGLON : 0)) /
      RENGLON,
  );

/**
 * La puntuación tipográfica, en los bytes que le corresponden.
 *
 * `WinAnsiEncoding` —lo que declara la fuente— **no** es Latin-1: en el tramo
 * `0x80`–`0x9F`, donde Latin-1 pone caracteres de control, CP1252 pone comillas
 * curvas, guiones largos y puntos suspensivos. Sus puntos de código Unicode están
 * arriba de 255, así que la regla de "más de un byte, no se puede escribir" los
 * mandaba a `?` cuando la fuente sí sabe dibujarlos.
 *
 * Se notó con el nombre de un reporte pedido —"Blocked Communication Report —
 * 08/03/2026"— que salía con un signo de pregunta en el medio.
 */
const CP1252: Record<string, number> = {
  "\u20AC": 0x80, // €
  "\u201A": 0x82,
  "\u0192": 0x83,
  "\u201E": 0x84,
  "\u2026": 0x85, // …
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02C6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8a,
  "\u2039": 0x8b,
  "\u0152": 0x8c,
  "\u017D": 0x8e,
  "\u2018": 0x91, // ‘
  "\u2019": 0x92, // ’
  "\u201C": 0x93, // “
  "\u201D": 0x94, // ”
  "\u2022": 0x95, // •
  "\u2013": 0x96, // –
  "\u2014": 0x97, // —
  "\u02DC": 0x98,
  "\u2122": 0x99, // ™
  "\u0161": 0x9a,
  "\u203A": 0x9b,
  "\u0153": 0x9c,
  "\u017E": 0x9e,
  "\u0178": 0x9f,
};

/** El texto, como lo espera un PDF: `\`, `(` y `)` se escapan, la puntuación
 *  tipográfica va a su byte de CP1252, y lo que no tiene byte —un ideograma, un
 *  emoji— sale como `?`: es lo que un PDF sin fuente incrustada puede prometer. */
const escapar = (s: string) =>
  [...s]
    .map((c) => {
      const cp1252 = CP1252[c];
      if (cp1252 !== undefined) return String.fromCharCode(cp1252);
      return c.charCodeAt(0) > 255 ? "?" : c;
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

/**
 * Cuánto mide un texto, aproximado.
 *
 * Helvetica trae una tabla de anchos por caracter y no la tenemos: incrustarla
 * son doscientos cincuenta y seis números para una sola cosa. Con un ancho medio
 * la cuenta se equivoca por caracter, pero se equivoca poco y para lo único que
 * se usa —decidir dónde cortar una celda que si no se sale de la hoja— eso
 * alcanza. Cortar de más deja un poco de aire; no cortar deja texto pisando el
 * margen, que es peor.
 */
const anchoAproximado = (texto: string, cuerpo: number) =>
  texto.length * cuerpo * 0.52;

/** El texto que entra en `disponible` puntos, con puntos suspensivos si sobra. */
function recortar(texto: string, disponible: number, cuerpo: number) {
  if (anchoAproximado(texto, cuerpo) <= disponible) return texto;
  const cuantos = Math.max(0, Math.floor(disponible / (cuerpo * 0.52)) - 1);
  return `${texto.slice(0, cuantos).trimEnd()}\u2026`;
}

/**
 * Armar el PDF.
 *
 * Devuelve los bytes. Quien lo llama decide qué hace con ellos —bajarlos,
 * mostrarlos en un `blob:`—: esto no sabe de navegadores.
 */
export function armarPdf({
  titulo,
  columnas,
  preambulo,
  cabecera,
  filas,
}: {
  titulo: string;
  /** Dónde empieza cada columna, en puntos desde el margen izquierdo. */
  columnas: number[];
  /** Lo que va debajo del título y **sólo en la primera hoja**: la ficha del
   *  documento, de qué habla, de cuándo es. No es parte de la tabla, así que no
   *  se reparte entre páginas ni se repite arriba de cada una. */
  preambulo?: FilaDePdf[];
  /** La fila que dice qué es cada columna. Va **arriba de cada página** y no una
   *  sola vez: una tabla que sigue en la hoja siguiente sin repetir sus rótulos
   *  deja la segunda página con números que no dicen de qué son. */
  cabecera?: FilaDePdf;
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
    const primera = paginas.length === 0;
    const cuantas =
      filasQueEntran(primera, cabecera !== undefined) -
      /* El preámbulo le come renglones a la primera hoja, y su renglón de aire
         también. */
      (primera && preambulo ? preambulo.length + 1 : 0);
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

    /* El orden de una hoja: el título, la ficha, los rótulos, y recién ahí la
       tabla. La ficha sólo en la primera; los rótulos en todas. */
    const renglones = [
      ...(primera && preambulo ? [...preambulo, { celdas: [] }] : []),
      ...(cabecera ? [cabecera] : []),
      ...pagina,
    ];

    for (const fila of renglones) {
      partes.push(`/${fila.negrita ? "F2" : "F1"} ${CUERPO} Tf`);
      fila.celdas.forEach((celda, i) => {
        if (!celda) return;
        /* Hasta dónde puede llegar esta celda: hasta donde empieza **la de al
           lado**, y si no hay una al lado, hasta el margen. Sin esto, una celda
           larga —los motivos de un bloqueo, por ejemplo— sigue escribiéndose
           después del borde de la hoja.
           
           El límite es la celda vecina y no la columna vecina, que no es lo
           mismo: un renglón suelto —una línea del preámbulo— ocupa una sola
           celda y tiene toda la hoja para él. Limitándolo contra la columna B lo
           cortaba a un cuarto de ancho una frase que no era una columna. */
        const desde = columnas[i] ?? 0;
        const hayVecina = fila.celdas[i + 1] !== undefined && fila.celdas[i + 1] !== "";
        const hasta = hayVecina
          ? (columnas[i + 1] ?? ANCHO - MARGEN * 2)
          : ANCHO - MARGEN * 2;
        /* Un pelo de aire antes de la columna siguiente, para que dos celdas
           llenas no se toquen. */
        const disponible = hasta - desde - 6;
        partes.push(
          `1 0 0 1 ${MARGEN + desde} ${y - CUERPO} Tm`,
          `(${escapar(recortar(celda, disponible, CUERPO))}) Tj`,
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
