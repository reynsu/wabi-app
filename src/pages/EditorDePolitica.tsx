import { useState } from "react";
import { ChevronDown, ScrollText, ShieldCheck, Trash2 } from "lucide-react";

import { punto } from "@/components/color-dot";
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
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { MenuItem } from "@/components/ui/menu-item";
import { useTypeScale } from "@/lib/size-context";
import {
  ALCANCES,
  ORDEN_TIPOS,
  TIPOS_DE_POLITICA,
  borrarPolitica,
  claveDeAlcance,
  editarPolitica,
  type Alcance,
  type ClaveDeAlcance,
  type Politica,
  type TipoDePolitica,
} from "@/pages/politicas";

/* Corregir una política, y sacarla.
 *
 * Escribir una nueva no pasa por acá: eso es la ficha del riel —ver
 * `NuevaPolitica`—, que puede quedarse abierta al costado de la tabla porque
 * escribir una regla es cuando más falta hace mirar las que ya existen.
 * Corregir es lo contrario: se abre sobre la fila que se quiere tocar, se toca y
 * se cierra, y para eso un diálogo es exactamente la forma.
 *
 * Nada se guarda hasta aceptar. El diálogo trabaja sobre su propia copia; si se
 * cancela, no pasó nada. Es lo que hace que "Edit" se pueda abrir para mirar
 * qué dice una regla sin miedo a tocarla.
 */

/* ─────────────────────────── A quién se le aplica ─────────────────────────── */

/* Los grupos que se pueden elegir. Las cuentas sueltas no están en esta lista a
   propósito: son cuarenta y ocho nombres, y un menú de cuarenta y ocho no es un
   selector sino una tabla mal puesta. Una excepción para una persona se escribe
   desde su ficha, que es donde uno está cuando se le ocurre.

   Lo que sí se muestra es la cuenta que la política **ya** tiene: corregir el
   nombre de una excepción no puede obligar a mudarla de alcance. */
const GRUPOS: ClaveDeAlcance[] = ["todas", "resident", "friends", "casa"];

const alcanceDe = (clave: ClaveDeAlcance, original?: Alcance): Alcance => {
  switch (clave) {
    case "todas":
      return { clase: "todas" };
    case "casa":
      return { clase: "casa" };
    case "resident":
      return { clase: "tipo", tipo: "resident" };
    case "friends":
      return { clase: "tipo", tipo: "friends" };
    case "cuenta":
    case "objetivos":
      /* Ni la cuenta ni la lista de objetivos se eligen acá: se conserva lo que
         la política traía. Una regla escrita nombre por nombre se corrige en su
         ficha, no mudándola de grupo desde un desplegable. */
      return original ?? { clase: "todas" };
  }
};

/** Un desplegable de una sola elección: el rótulo puesto, el chevron, y las
 *  opciones marcando cuál está. Es el mismo mueble que la celda de estado de
 *  Provisioning —un `DropdownTrigger` con `checked`—, sin un `Select` propio que
 *  este registry no tiene. */
function Elegir({
  etiqueta,
  valor,
  opciones,
  onElegir,
}: {
  etiqueta: string;
  valor: string;
  opciones: { value: string; label: string; icon?: ReturnType<typeof punto> }[];
  onElegir: (value: string) => void;
}) {
  const escala = useTypeScale();
  const puesta = opciones.find((o) => o.value === valor);

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground" style={{ fontSize: escala.caption }}>
        {etiqueta}
      </span>

      <DropdownMenu>
        <DropdownTrigger
          render={
            <Button
              variant="secondary"
              className="w-full justify-between"
              aria-label={`${etiqueta}: ${puesta?.label ?? ""}`}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {puesta?.icon && <puesta.icon size={12} aria-hidden />}
            <span className="min-w-0 truncate">{puesta?.label}</span>
          </span>
          <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
        </DropdownTrigger>

        <DropdownContent
          side="bottom"
          align="start"
          className="w-auto min-w-[--anchor-width]"
          checkedIndex={opciones.findIndex((o) => o.value === valor)}
        >
          {opciones.map((o, i) => (
            <MenuItem
              key={o.value}
              index={i}
              icon={o.icon}
              label={o.label}
              /* `checked` lo vuelve una opción de un grupo —`menuitemradio`— y
                 no una acción suelta: elegir una reemplaza a la que había. */
              checked={o.value === valor}
              onSelect={() => onElegir(o.value)}
            />
          ))}
        </DropdownContent>
      </DropdownMenu>
    </label>
  );
}

/* ─────────────────────────── El editor ─────────────────────────── */

export function EditorDePolitica({
  politica,
  onListo,
  onCancelar,
}: {
  /** La que se está corrigiendo. Siempre hay una: escribir de cero es la ficha
   *  del riel. */
  politica: Politica;
  /** Se cerró aceptando. Devuelve el id de la fila que quedó, que es lo que la
   *  tabla usa para señalarla. */
  onListo: (id: string) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(politica.nombre);
  const [tipo, setTipo] = useState<TipoDePolitica>(politica.tipo);
  const [alcance, setAlcance] = useState<ClaveDeAlcance>(
    claveDeAlcance(politica),
  );

  /* Una regla sin texto no dice nada, y guardarla dejaría una fila en blanco en
     una tabla que se lee por su primera columna. */
  const listo = nombre.trim().length > 0;

  const puesto = claveDeAlcance(politica);
  const opcionesDeAlcance = [
    ...GRUPOS.map((value) => ({ value, label: ALCANCES[value] })),
    /* Lo que la política ya es, cuando no es un grupo: se puede dejar donde
       está, no elegir uno nuevo. */
    ...(puesto === "cuenta" || puesto === "objetivos"
      ? [{ value: puesto, label: ALCANCES[puesto] }]
      : []),
  ];

  const guardar = () => {
    if (!listo) return;
    editarPolitica(politica.id, {
      nombre: nombre.trim(),
      tipo,
      alcance: alcanceDe(alcance, politica.alcance),
    });
    onListo(politica.id);
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCancelar()}>
      <DialogContent
        className="sm:max-w-md"
        /* El cierre del marco se va: abajo están las dos salidas escritas
           —cancelar y guardar—, y una × arriba sería una tercera que no dice
           cuál de las dos hace. */
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
            Edit policy
          </DialogTitle>
          <DialogDescription>
            Rewrite what the rule says, or move who it covers. When it was
            written stays.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <InputGroup>
            <InputField
              index={0}
              label="Name"
              icon={ScrollText}
              placeholder="Hold attachments over 25 MB"
              value={nombre}
              onChange={setNombre}
            />
          </InputGroup>

          <div className="grid grid-cols-2 gap-3">
            <Elegir
              etiqueta="Type"
              valor={tipo}
              opciones={ORDEN_TIPOS.map((value) => ({
                value,
                label: TIPOS_DE_POLITICA[value].label,
                icon: punto(TIPOS_DE_POLITICA[value].tinte),
              }))}
              onElegir={(v) => setTipo(v as TipoDePolitica)}
            />

            <Elegir
              etiqueta="Applies to"
              valor={alcance}
              opciones={opcionesDeAlcance}
              onElegir={(v) => setAlcance(v as ClaveDeAlcance)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancelar}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!listo} onClick={guardar}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
              cambio del registry—. Lo que separa a este botón del "Save changes"
              del diálogo de al lado es el glifo, y el rojo vive donde se elige
              entre las dos acciones: el renglón "Delete" del menú de la fila. */}
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
