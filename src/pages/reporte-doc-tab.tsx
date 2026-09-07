import type { WorkspaceTab } from "@/components/workspace-panel";
import { glifoDeArchivo } from "@/lib/archivos";
import { VistaDeReporteDOC } from "@/pages/VistaDeReporteDOC";
import {
  TIPOS_DE_REPORTE_DOC,
  archivoDeReporteDOC,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { fechaDia } from "@/pages/tiempo";

/* Un reporte pedido, como pestaña del workspace.
 *
 * En un archivo propio por lo mismo que `perfil-tab` y `reporte-tab`: dos
 * maneras de armar la misma pestaña son dos ids que un día dejan de coincidir, y
 * `openTab` —que deja ganar a la que ya está— terminaría abriendo dos pestañas
 * para el mismo archivo. Y tampoco adentro de `VistaDeReporteDOC`, que exporta
 * un componente.
 */

/** La etiqueta: el tipo, abreviado, y el día del pedido.
 *
 *  El nombre del reporte no entra en una solapa —"Blocked Communication Report —
 *  06/26/2026" son cuarenta caracteres— y las solapas compiten por el ancho. La
 *  primera palabra del tipo alcanza para distinguir los tres que hay, y la fecha
 *  distingue dos pedidos del mismo tipo.
 *
 *  El día y no la hora, aunque dos pedidos del mismo día existan: la solapa
 *  identifica, y para desempatar está el nombre completo adentro. */
const etiqueta = (reporte: ReporteDOC) =>
  `${TIPOS_DE_REPORTE_DOC[reporte.tipo].label.split(" ")[0]} · ${fechaDia(
    reporte.pedidoEl.slice(0, 10),
  )}`;

export const tabDeReporteDOC = (reporte: ReporteDOC): WorkspaceTab => ({
  /* El id lleva el del reporte adentro, así que abrir dos veces el mismo archivo
     no abre dos pestañas. Con prefijo propio para no chocar con los de Email ›
     Reports: son dos numeraciones distintas y un día se van a cruzar. */
  id: `doc-report/${reporte.id}`,
  label: etiqueta(reporte),
  /* El glifo del archivo, el mismo que va a poner el visor: la solapa y lo que
     hay adentro tienen que verse como lo mismo. */
  icon: glifoDeArchivo(archivoDeReporteDOC(reporte)),
  content: <VistaDeReporteDOC id={reporte.id} />,
});
