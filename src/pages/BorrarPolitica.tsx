import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TIPOS_DE_POLITICA,
  borrarPolitica,
  type Politica,
} from "@/pages/politicas";

/* Sacar una política.
 *
 * Escribir una y corregirla no pasan por acá: las dos son la ficha del riel
 * —ver `NuevaPolitica`—, que puede quedarse abierta al costado de la tabla
 * porque escribir o retocar una regla es cuando más falta hace mirar las que ya
 * existen. Acá vivía también un diálogo que corregía, con otros tres campos que
 * los de la ficha; eran dos formularios sin una sola idea de qué es editable en
 * una regla, y se fue.
 *
 * Borrar sí es un diálogo, y no por costumbre: es lo único de esta pantalla que
 * no se puede deshacer, así que no se hace de paso. Se abre sobre la fila, se
 * pregunta, y se cierra.
 */

/* ─────────────────────────── El borrado ─────────────────────────── */

/** Preguntar antes de sacar una.
 *
 *  Con la regla escrita adentro de la pregunta y no un "¿estás seguro?" pelado:
 *  lo que hay que confirmar no es que se apretó el botón, es **cuál** de las
 *  cuarenta filas se está por sacar, y eso sólo se puede contestar leyéndola. */
export function BorrarPolitica({
  politica,
  alcance,
  onListo,
  onCancelar,
}: {
  politica: Politica;
  /** El alcance ya escrito. Lo resuelve la tabla, que tiene el padrón a mano. */
  alcance: string;
  onListo: () => void;
  onCancelar: () => void;
}) {
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCancelar()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            Delete policy
          </DialogTitle>
          <DialogDescription>
            Mail covered by this rule stops being handled by it. Nothing already
            delivered changes.
          </DialogDescription>
        </DialogHeader>

        {/* La regla, escrita como se la lee en la tabla: el mismo renglón y el
            mismo orden, para que reconocerla no sea un ejercicio de memoria. */}
        <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
          <span className="min-w-0 truncate">{politica.nombre}</span>
          <span className="min-w-0 truncate text-muted-foreground text-[12px]">
            {TIPOS_DE_POLITICA[politica.tipo].label} · {alcance}
          </span>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancelar}>
            Cancel
          </Button>
          {/* Sin color propio: este sistema no tiene un botón destructivo, y
              pintarle uno acá sería inventar un token que no existe —el fondo de
              un `primary` se pinta en una capa interna con su propia variable, y
              taparla desde afuera es un parche que se rompe con el próximo
              cambio del registry—. Lo que lo separa de cualquier otro botón que
              acepta es el glifo, y el rojo vive donde se elige entre las dos
              acciones: el renglón "Delete" del menú de la fila. */}
          <Button
            variant="primary"
            leadingIcon={Trash2}
            onClick={() => {
              borrarPolitica(politica.id);
              onListo();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
