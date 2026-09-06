import { FileSpreadsheet } from "lucide-react";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { VistaDeReporte } from "@/pages/VistaDeReporte";
import type { Reporte } from "@/pages/reportes";
import { diaCorto, fechaDia } from "@/pages/tiempo";

/* Un reporte abierto, como pestaña del workspace.
 *
 * En un archivo propio por lo mismo que `perfil-tab`: son dos las vistas de
 * Email Reports que abren un reporte —la fila de la lista y la baldosa de la
 * grilla— y dos maneras de armar la misma pestaña son dos ids que un día dejan
 * de coincidir; `openTab`, que deja ganar a la que ya está, terminaría abriendo
 * dos pestañas para el mismo archivo. Y tampoco adentro de `VistaDeReporte`,
 * que exporta un componente.
 */

/** La etiqueta: la ventana que cubre, no el nombre del reporte.
 *
 *  El nombre no distingue nada —los cinco de agosto se llaman todos "KC-B August
 *  2026 Report"— y en una barra de pestañas eso son cinco solapas idénticas. La
 *  ventana sí, y es lo mismo que muestra la fila de la lista.
 *
 *  El año va una sola vez, al final: "Jul 10 – Jul 17, 2026". Escrito en los dos
 *  extremos ocupa el doble para decirlo dos veces, y sin él dos julios de años
 *  distintos serían dos solapas iguales. */
const etiqueta = (reporte: Reporte) =>
  `${diaCorto(reporte.desde)} – ${fechaDia(reporte.hasta)}`;

export const tabDeReporte = (reporte: Reporte): WorkspaceTab => ({
  /* El id lleva el del reporte adentro, así que abrir dos veces el mismo
     archivo no abre dos pestañas. */
  id: `report/${reporte.id}`,
  label: etiqueta(reporte),
  /* El glifo de una planilla, que es el que el visor le pone al archivo: la
     solapa y lo que hay adentro tienen que verse como lo mismo. */
  icon: FileSpreadsheet,
  content: <VistaDeReporte id={reporte.id} />,
});
