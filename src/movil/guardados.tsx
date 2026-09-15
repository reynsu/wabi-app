import { FileChartColumn, FileText, UserRound } from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTypeScale } from "@/lib/size-context";
import { ListaMovil, FilaMovil } from "@/movil/lista";
import { useGuardados, type Guardado } from "@/pages/guardados";
import { tabDePerfil } from "@/pages/perfil-tab";
import { tabDeReporte } from "@/pages/reporte-tab";
import { tabDeReporteDOC } from "@/pages/reporte-doc-tab";
import { fechaDia } from "@/pages/tiempo";
import type { WorkspaceTab } from "@/components/workspace-panel";

/**
 * Lo guardado, en una hoja del teléfono: los atajos de quien está mirando.
 *
 * Una lista corta de cosas que ya existen en otro lado —una cuenta, un reporte
 * de la semana, un reporte pedido— con lo único que es de acá: **por qué
 * alguien las dejó a mano**. Esa nota es la fila: sin ella, un marcador a una
 * cuenta dice lo mismo que la fila de esa cuenta en Accounts y no se entiende
 * para qué se guardó.
 *
 * Cada renglón abre lo que apunta, en su pestaña de siempre —la misma que abre
 * la tabla de donde salió—: un marcador es un atajo, no una copia, así que lo
 * que se abre tiene que ser exactamente lo que se abriría por el camino largo.
 *
 * Lo que apuntaba a algo que ya no está no se muestra: ver `guardados`.
 */

/** De qué es cada marcador, en un glifo. Los mismos tres que la app usa para
 *  esas cosas en su navegación y en sus solapas: una silueta para una cuenta y
 *  un archivo para un reporte —el de barras para el semanal, que es de lo que
 *  habla, y el de texto para el pedido—. */
const GLIFOS = {
  cuenta: UserRound,
  reporte: FileChartColumn,
  "reporte-doc": FileText,
} as const;

/** Cómo se llama y qué dice cada clase. Junto, y no repartido en tres ramas
 *  adentro del `map`: son tres maneras de decir lo mismo y separadas se
 *  contradicen. */
function loQueEs(g: Guardado): { titulo: string; que: string; tab: WorkspaceTab } {
  if (g.clase === "cuenta") {
    return {
      titulo: g.usuario.name,
      que: g.usuario.id,
      tab: tabDePerfil(g.usuario),
    };
  }
  if (g.clase === "reporte") {
    return {
      titulo: g.reporte.nombre,
      que: "Email report",
      tab: tabDeReporte(g.reporte),
    };
  }
  return {
    titulo: g.reporte.nombre,
    que: "Requested report",
    tab: tabDeReporteDOC(g.reporte),
  };
}

export function Guardados({
  /** Abrir lo que un marcador señala; lo hace el shell. Ver
   *  `ActividadDeLaConsola`. */
  alAbrir,
}: {
  alAbrir: (tab: WorkspaceTab) => void;
}) {
  const escala = useTypeScale();
  const guardados = useGuardados();

  if (guardados.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <FileText />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>Nothing saved</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              Accounts and reports you keep coming back to end up here.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade scrollbar-hide">
      <ListaMovil>
        {guardados.map((g) => {
          const Glifo = GLIFOS[g.clase];
          const { titulo, que, tab } = loQueEs(g);

          return (
            <FilaMovil
              key={g.ref}
              media={
                <span className="flex w-5 shrink-0 justify-center">
                  <Glifo size={16} strokeWidth={1.5} aria-hidden className="text-muted-foreground" />
                </span>
              }
              titulo={titulo}
              /* La nota de quien lo guardó, y si no la escribió, qué es la
                 cosa. Nunca las dos: el renglón de abajo es uno solo, y la nota
                 —cuando existe— dice más que la clase. */
              detalle={g.nota ?? que}
              extra={
                <span style={{ fontSize: escala.caption }}>
                  {fechaDia(g.guardadoEl.slice(0, 10))}
                </span>
              }
              onClick={() => alAbrir(tab)}
            />
          );
        })}
      </ListaMovil>
    </ScrollArea>
  );
}
