/**
 * Archivos: de qué clase son, y cómo se leen los que se leen acá.
 *
 * Aparte del visor —`file-viewer.tsx`— y no adentro: ese archivo exporta un
 * componente, y un módulo que exporta componentes y funciones le rompe el
 * refresco en caliente. Es la misma separación que hay entre `UserProfile` y
 * `perfil-tab`.
 *
 * Y de paso queda donde corresponde: partir un CSV no es cosa de una pantalla.
 */

import { File, FileSpreadsheet, FileText } from "lucide-react";

/* ─────────────────────────── Qué clase de archivo es ─────────────────────── */

/** Cómo se muestra un archivo. Sale de la extensión y no de un tipo MIME: lo que
 *  esta consola tiene de un archivo es su nombre. */
export type ClaseDeArchivo = "planilla" | "documento" | "desconocida";

const CLASES: Record<string, ClaseDeArchivo> = {
  csv: "planilla",
  tsv: "planilla",
  xls: "planilla",
  xlsx: "planilla",
  pdf: "documento",
};

export const extensionDe = (nombre: string) =>
  nombre.slice(nombre.lastIndexOf(".") + 1).toLowerCase();

export const claseDeArchivo = (nombre: string): ClaseDeArchivo =>
  CLASES[extensionDe(nombre)] ?? "desconocida";

/* ─────────────────────────── Leer un CSV ─────────────────────────── */

/**
 * Partir un CSV en filas y celdas, según RFC 4180.
 *
 * A mano y no con `split(",")` porque el separador adentro de comillas no
 * separa: los reportes de esta app escriben cada celda entre comillas
 * justamente para que un nombre con una coma no parta la fila en dos —ver
 * `csvDeReporte`—, y partir por comas se comería eso.
 *
 * Las tres reglas del RFC que importan: una comilla adentro de un campo citado
 * se escribe doble; el salto de línea adentro de comillas es contenido y no fin
 * de fila; y `\r\n` cuenta como un solo salto.
 *
 * La fila vacía se conserva como fila vacía. En un CSV un renglón en blanco es
 * parte de la forma del archivo —el de un reporte separa la cabecera de la
 * tabla— y comérselo sería mostrar algo distinto de lo que el archivo dice.
 */
export function leerCsv(texto: string, separador = ","): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let citando = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (citando) {
      if (c === '"') {
        /* Dos comillas seguidas adentro de un campo citado son una comilla. */
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          citando = false;
        }
      } else {
        celda += c;
      }
      continue;
    }

    if (c === '"') {
      citando = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      /* `\r\n` es un salto, no dos. */
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += c;
    }
  }

  /* Lo que quedó sin cerrar. Un archivo que termina con salto de línea no tiene
     una última fila vacía: eso sería una fila que el archivo no dice. */
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  return filas;
}

/* ─────────────────────────── El archivo que se mira ─────────────────────── */

/** El contenido, ya leído por quien lo tiene. Ver la nota de arriba: el visor
 *  dibuja, no abre. */
export type ContenidoDeArchivo =
  /** Un CSV o un TSV, tal cual está escrito. Lo parte el visor. */
  | { clase: "texto"; texto: string }
  /** Una planilla ya leída: filas de celdas. Es por donde entra una hoja de
   *  Excel el día que algo sepa abrirla. */
  | { clase: "filas"; filas: string[][] }
  /** Una dirección —`blob:`, `data:` o una URL— para lo que el navegador
   *  dibuja solo. */
  | { clase: "url"; url: string };

export interface ArchivoParaVer {
  /** Con extensión: de ahí sale cómo se dibuja. */
  nombre: string;
  contenido: ContenidoDeArchivo;
}

/* ─────────────────────────── Con qué se dibuja ─────────────────────────── */

/** El glifo de cada clase.
 *
 *  Vive con `claseDeArchivo` y no adentro del visor porque lo usan tres: el
 *  visor, la baldosa de la grilla y la solapa de la pestaña. Un archivo tiene
 *  que verse igual en los tres lugares —si la baldosa dice "documento" y la
 *  solapa dice "planilla", uno de los dos está mintiendo—, y la única manera de
 *  garantizarlo es que salga del mismo lado.
 *
 *  La planilla lleva la grilla y el documento las líneas de texto, que es la
 *  diferencia que importa: uno se recorre por columnas y el otro se lee. */
export const GLIFOS: Record<ClaseDeArchivo, typeof File> = {
  planilla: FileSpreadsheet,
  documento: FileText,
  desconocida: File,
};

/** Directo desde el nombre, que es lo que casi siempre se tiene a mano. */
export const glifoDeArchivo = (nombre: string) => GLIFOS[claseDeArchivo(nombre)];
