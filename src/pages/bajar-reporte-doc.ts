import { useState } from "react";
import { sileo } from "sileo";

import { descargar } from "@/lib/descargar";
import type { CuentaDOC } from "@/pages/cuentas-doc";
import { useCuentasDOC } from "@/pages/cuentas-doc";
import {
  TIPOS_DE_REPORTE_DOC,
  archivoDeReporteDOC,
  csvDeReporteDOC,
  formatoDeReporteDOC,
  pdfDeReporteDOC,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/**
 * Bajar un reporte pedido.
 *
 * En un módulo propio por lo mismo que su gemelo de Email › Reports: desde que
 * un reporte también se abre en el visor son dos los lugares que lo bajan —el
 * ícono de la fila y la cabecera del archivo abierto—, y dos copias del mismo
 * `sileo.promise` son dos textos que un día dejan de decir lo mismo.
 *
 * Tampoco adentro de `AdminReports.tsx`: ese archivo exporta un componente, y un
 * módulo que exporta componentes y funciones le rompe el refresco en caliente.
 */

/** Cuánto tarda en prepararse un archivo.
 *
 *  No hay servidor detrás, y sin demora la bajada sería instantánea: se toca el
 *  botón y el archivo ya está. Eso no es lo que va a pasar el día que haya una
 *  API, y una pantalla diseñada contra una bajada instantánea no tiene dónde
 *  poner lo que pasa mientras. Es la misma decisión, con el mismo número, que la
 *  bajada de Email › Reports y las altas de políticas, buzones y cuentas. */
const DEMORA_MS = 900;

async function bajar(
  reporte: ReporteDOC,
  usuarios: Usuario[],
  cuentas: CuentaDOC[],
) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  /* Cada formato con lo suyo, y con su tipo MIME: el nombre del archivo ya dice
     `.pdf`, y entregar un PDF anunciado como `text/csv` es la misma mentira del
     otro lado. */
  if (formatoDeReporteDOC(reporte.tipo) === "pdf") {
    descargar(
      archivoDeReporteDOC(reporte),
      pdfDeReporteDOC(reporte, usuarios, cuentas),
      "application/pdf",
    );
    return;
  }

  descargar(
    archivoDeReporteDOC(reporte),
    csvDeReporteDOC(reporte, usuarios, cuentas),
  );
}

/** El estado de la bajada y el gesto que la dispara. Acepta que no haya reporte
 *  —`undefined`— para el que lo llama antes de saber si lo tiene: los hooks van
 *  antes de cualquier salida temprana, así que el visor lo pide igual mientras
 *  averigua si el reporte sigue existiendo. */
export function useBajadaDOC(reporte: ReporteDOC | undefined) {
  const usuarios = useUsuarios();
  const cuentas = useCuentasDOC();
  /* Vive en quien lo dispara y no en la pantalla: bajar un reporte no apaga nada
     más que ese control, y dos se pueden estar bajando a la vez. */
  const [bajando, setBajando] = useState(false);

  const alTocar = async () => {
    if (bajando || !reporte) return;
    setBajando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está preparando, quedó bajado, no se pudo. */
      await sileo.promise(bajar(reporte, usuarios, cuentas), {
        /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
           "Preparing the report…" sale "Preparing The Report…". */
        loading: { title: "Preparing report…" },
        success: () => ({
          title: "Report downloaded",
          /* Qué trae, que es lo que el nombre del archivo no dice hasta abrirlo.
             Sale del tipo, que es lo que decide sus columnas. */
          description: TIPOS_DE_REPORTE_DOC[reporte.tipo].ayuda,
        }),
        error: () => ({
          title: "Nothing was downloaded",
          description: "The report couldn't be prepared — try again.",
        }),
      });
    } catch {
      /* El toast ya lo contó. */
    } finally {
      setBajando(false);
    }
  };

  return { bajando, alTocar };
}

/**
 * BajarReporte — lo único que se puede hacer con una fila.
 *
 * Un botón suelto y no un menú, igual que en Email › Reports y al revés que en
 * Policies: allá son dos acciones —corregir y sacar— y esconder una sola detrás
 * de un menú es pedir dos clics para lo mismo. Un reporte pedido no se corrige:
 * lo que se pidió, se pidió.
 *
 * Aparece con el hover de la fila y se queda mientras se está bajando y con el
 * foco de teclado: si no, tabular hasta acá sería tabular hacia algo invisible.
 *
 * Y no aparece cuando no hay nada que bajar. Un reporte que está en la cola
 * todavía no tiene archivo y uno que falló no lo va a tener: el botón
 * deshabilitado diría "esto se puede hacer, pero no ahora", y lo que pasa es que
 * no hay qué bajar. El estado de la fila ya lo explica.
 */
