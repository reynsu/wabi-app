import { useState } from "react";
import { sileo } from "sileo";

import { descargar } from "@/lib/descargar";
import {
  archivoDeReporte,
  csvDeReporte,
  type Reporte,
} from "@/pages/reportes";
import { fechaDia } from "@/pages/tiempo";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/**
 * Bajar un reporte.
 *
 * En un módulo propio y no adentro de la pantalla que lo pedía, porque desde que
 * un reporte también se abre en el visor son **tres** los lugares que lo bajan:
 * el ícono de una fila de la lista, la cabecera del archivo abierto, y mañana lo
 * que venga. Tres copias del mismo `sileo.promise` son tres textos que un día
 * dejan de decir lo mismo.
 *
 * Tampoco adentro de `EmailReports.tsx`: ese archivo exporta un componente, y un
 * módulo que exporta componentes y funciones le rompe el refresco en caliente.
 */

/** Cuánto tarda en prepararse un archivo.
 *
 *  No hay servidor detrás, y sin demora la bajada sería instantánea: se toca el
 *  botón y el archivo ya está. Eso no es lo que va a pasar el día que haya una
 *  API —un reporte de un año son varios megas— y una pantalla diseñada contra
 *  una bajada instantánea no tiene dónde poner lo que pasa mientras. Es la misma
 *  decisión, con el mismo número, que el alta de políticas y la de anuncios. */
const DEMORA_MS = 900;

/**
 * Entregar el archivo.
 *
 * El CSV lo arma el modelo —ver `csvDeReporte`— y el navegador lo recibe por
 * `descargar`, que es lo mismo que hace Admin › Reports: acá adentro sólo queda
 * la espera, que es de esta pantalla.
 *
 * Es una bajada de verdad y no un aviso de que se bajó algo: la fila promete un
 * archivo con lo que dice la fila, y un toast de éxito sobre una carpeta vacía
 * es lo peor que puede hacer una pantalla que se llama Reports.
 */
async function bajar(reporte: Reporte, usuarios: Usuario[]) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  descargar(archivoDeReporte(reporte), csvDeReporte(reporte, usuarios));
}

/**
 * BajarReporte — lo único que se puede hacer con una fila.
 *
 * Un botón suelto y no un menú, al revés que en Policies: allá son dos acciones
 * —corregir y sacar— y dos íconos por fila en cuarenta filas son una columna de
 * ruido. Acá es una sola, y esconder una acción única detrás de un menú es
 * pedir dos clics para lo mismo.
 *
 * Aparece con el hover de la fila y se queda mientras se está bajando y con el
 * foco de teclado: si no, tabular hasta acá sería tabular hacia algo invisible.
 *
 * Y no aparece cuando no hay nada que bajar. Un reporte que se está armando
 * todavía no tiene archivo y uno que falló no lo va a tener: el botón
 * deshabilitado diría "esto se puede hacer, pero no ahora", y lo que pasa es que
 * no hay qué bajar. El estado de la fila ya lo explica.
 */
/**
 * Bajar un reporte, con lo que se cuenta mientras.
 *
 * En un hook y no adentro del botón porque son dos las cosas que bajan un
 * reporte: el ícono de una fila de la lista y la baldosa entera en la grilla.
 * Dos maneras de tocar lo mismo, y una sola manera de que pase —la misma espera,
 * el mismo aviso, el mismo texto de error—. Copiado en dos lados, el día que el
 * mensaje cambie va a cambiar en uno.
 */
/** El estado de la bajada y el gesto que la dispara.
 *
 *  Acepta que no haya reporte —`undefined`— para el que lo llama antes de saber
 *  si lo tiene: los hooks van antes de cualquier salida temprana, así que el
 *  visor lo pide igual mientras averigua si el reporte sigue existiendo. Sin
 *  reporte no hace nada. */
export function useBajada(reporte: Reporte | undefined) {
  const usuarios = useUsuarios();
  /* Vive en quien lo dispara y no en la pantalla, al revés que el alta de una
     política: bajar un reporte no apaga nada más que ese control, y dos se
     pueden estar bajando a la vez. */
  const [bajando, setBajando] = useState(false);

  const alTocar = async () => {
    if (bajando || !reporte) return;
    setBajando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está preparando, quedó bajado, no se pudo. Es lo que hace
         `sileo` con `promise`, y es donde va este relato —la fila no tiene lugar
         para contarlo y un cartel adentro de la tabla taparía la lista—. */
      await sileo.promise(bajar(reporte, usuarios), {
        /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
           "Preparing the report…" sale "Preparing The Report…". */
        loading: { title: "Preparing report…" },
        success: () => ({
          title: "Report downloaded",
          /* Qué ventana bajó, que es lo que no dice el nombre del archivo hasta
             abrirlo —y lo que distingue este reporte del otro del mismo mes—. */
          description: `${fechaDia(reporte.desde)} – ${fechaDia(reporte.hasta)}, ${
            reporte.cuentas.length
          } account${reporte.cuentas.length === 1 ? "" : "s"}.`,
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
