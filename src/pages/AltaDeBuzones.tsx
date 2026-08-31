import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CornerDownLeft, MailPlus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { ESTADOS_BUZON, type EstadoBuzon } from "@/pages/buzones";
import { direccionDe } from "@/pages/emails";
import { fechaDia } from "@/pages/tiempo";
import { HOY, useUsuarios, type Usuario } from "@/pages/usuarios";

/* El alta de buzones, adentro de la tabla que los lista.
 *
 * No abre nada: la tabla crece. Arriba aparece un renglón para escribir —con las
 * cuentas colgando mientras se escribe— y cada una que se elige cae como una
 * **fila borrador**, con la forma exacta que va a tener cuando exista: su
 * dirección derivada, quién la crea, la fecha de hoy, el estado con el que nace.
 *
 * Es lo que decidió elegir esta forma y no un panel al costado: lo que se está
 * creando y lo que ya existe se leen en la misma grilla, una arriba de la otra,
 * sin cambiar de lugar en la ventana. Lo que hay que sostener a cambio es que la
 * tabla deje de ser sólo la lista de lo que hay —de ahí el punteado, el tinte y
 * el badge `Draft`: lo que todavía no es tiene que decirse a simple vista—.
 *
 * Va en dos piezas y no en una porque van en dos lugares: el renglón para
 * escribir se queda quieto arriba —se lo usa todo el tiempo, y no puede irse con
 * el scroll—, y las filas van adentro del scroller, debajo de los títulos y
 * arriba de la primera fila real, que es donde van a estar cuando existan. Las
 * dos leen el mismo estado, que lo tiene la pantalla. */

/* ─────────────────────────── El estado ─────────────────────────── */

/** Con qué estado nace un buzón dado de alta acá. Nace andando: darlo de alta
 *  frenado sería dar de alta un buzón que no funciona, y eso no es un alta. */
const ESTADO_INICIAL: EstadoBuzon = "active";

/** Quién figura creándolo. Hasta que haya sesión, es el que está mirando. */
const CREADOR = "You";

const HOY_DIA = HOY.toISOString().slice(0, 10);

/** El borrador vive en la pantalla y no en el módulo de buzones, a diferencia
 *  del estado de un buzón: esto es de la vista —lo que *esta* pestaña está
 *  escribiendo—, y dos copias de Provisioning tienen que poder estar dando de
 *  alta cosas distintas sin pisarse. Es la misma línea que separa el filtro y la
 *  página de lo que se guarda. */
/* El hook y las dos piezas viven en el mismo archivo a propósito: son una sola
   cosa leída de una vez —el estado y los dos lugares donde se dibuja—, y
   partirlo para contentar al fast refresh lo dejaría en dos. Es la misma
   decisión que toman los contextos del registry. */
// oxlint-disable-next-line react/only-export-components
export function useAltaDeBuzones() {
  const usuarios = useUsuarios();
  const [abierto, setAbierto] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  const elegidos = useMemo(
    () =>
      ids
        .map((id) => usuarios.find((u) => u.id === id))
        .filter((u): u is Usuario => Boolean(u)),
    [ids, usuarios],
  );

  const abrir = useCallback(() => setAbierto(true), []);

  /* Cerrar es descartar: un borrador que sobrevive escondido vuelve a aparecer
     media hora después con gente que ya nadie se acuerda de haber elegido. */
  const cerrar = useCallback(() => {
    setAbierto(false);
    setIds([]);
  }, []);

  const alternar = useCallback(
    (id: string) =>
      setIds((previos) =>
        previos.includes(id)
          ? previos.filter((x) => x !== id)
          : [...previos, id],
      ),
    [],
  );

  const quitar = useCallback(
    (id: string) => setIds((previos) => previos.filter((x) => x !== id)),
    [],
  );

  return { usuarios, abierto, ids, elegidos, abrir, cerrar, alternar, quitar };
}

export type Alta = ReturnType<typeof useAltaDeBuzones>;

/** Lo que se daría de alta: es lo que la fila borrador muestra, y lo que el día
 *  que exista `crearBuzon` hay que mandarle. */
// oxlint-disable-next-line react/only-export-components
export const buzonesABodegar = (alta: Alta) =>
  alta.elegidos.map((u) => ({
    nombre: u.name,
    direccion: direccionDe(u),
    creador: CREADOR,
    creadoEl: HOY_DIA,
    estado: ESTADO_INICIAL,
  }));

/* ─────────────────────────── El movimiento ───────────────────────────

   Entrar y salir es lo mismo acá: **la tabla se abre y se cierra**. La banda y
   las filas crecen desde cero hasta lo que miden, y se van encogiéndose; nada
   entra desde un costado ni se acerca desde el fondo, porque nada viene de otro
   lado: aparece lugar donde no había.

   Los escalones son los de `lib/springs`. `moderate` para la banda —es el que
   este sistema usa para paneles que tienen que asentarse exactos, y una banda
   que rebota deja la tabla temblando debajo— y `slow` para las filas, que son lo
   que uno está mirando cuando las agrega.

   Las filas no entran en cascada: se agregan de a una, con un clic cada una, así
   que cada una es su propio evento. Cuando se van, en cambio, se van todas
   juntas —se creó el lote, o se descartó— y son una cosa sola: el lote. Un
   escalonado ahí contaría un orden que no existe.

   Con `prefers-reduced-motion` no crecen: aparecen. Va explícito y no confiado
   al `MotionConfig` de `main.tsx`, que le saca el `transform` a una animación y
   no el alto —y un alto que se anima es movimiento igual—. Es la misma decisión
   que toma el rango del pie del paginador. */

const abre = {
  oculto: { height: 0, opacity: 0, transition: spring.moderate.exit },
  visible: { height: "auto", opacity: 1, transition: spring.moderate },
} as const;

const abreFila = {
  oculto: { height: 0, opacity: 0, transition: spring.slow.exit },
  visible: { height: "auto", opacity: 1, transition: spring.slow },
} as const;

const enciende = {
  oculto: { opacity: 0, transition: spring.moderate.exit },
  visible: { opacity: 1, transition: spring.moderate },
} as const;

/** Las sugerencias: son un panel que cuelga de un campo, así que se comportan
 *  como cualquier popup del sistema —se encienden y se acercan— y no como la
 *  banda, que abre un hueco. */
const entraPanel = {
  oculto: { opacity: 0, y: -4, transition: spring.fast.exit },
  visible: { opacity: 1, y: 0, transition: spring.fast },
} as const;

/* ─────────────────────────── La grilla ─────────────────────────── */

/* Las filas borrador no son de la `Table` del registry: son una grilla con los
   mismos anchos. Una fila de tabla no se puede abrir de alto —las celdas no
   colapsan con ella y el navegador reparte lo que quiere—, y lo que esta pieza
   tiene que hacer es justamente crecer. Con la grilla el alto es del `div`, que
   sí se anima.

   Los anchos son los de `COLUMNAS` en `Provisioning`, y la sangría es la misma:
   es lo que las deja alineadas con las filas de abajo. Si allá cambian, acá hay
   que cambiarlos —el precio de no ser la misma tabla—. */
export const REJILLA = "23% 28% 18% 15% 16%";

const CELDA = "min-w-0 truncate px-2.5 py-2";

/* ─────────────────────────── El renglón ─────────────────────────── */

/** La barra: dónde se escribe, cuántas van, y las dos salidas. Se queda quieta
 *  arriba de la tabla —se la usa todo el tiempo, y con el scroll se iría—. */
export function BarraDeAlta({
  alta,
  onCrear,
}: {
  alta: Alta;
  /** Qué hacer con lo que se dio de alta. La barra no lo guarda: junta y avisa. */
  onCrear: () => void;
}) {
  const escala = useTypeScale();
  const shape = useShape();
  const reducido = useReducedMotion() ?? false;
  const [texto, setTexto] = useState("");

  const t = texto.trim().toLowerCase();
  /* Los candidatos: las cuentas que matchean y que no están ya en el borrador.
     Una cuenta elegida sale de la lista en vez de quedar tildada: acá no se
     destilda desde la lista, se saca la fila, y una opción que no hace nada al
     tocarla es peor que no estar. */
  const candidatos = alta.usuarios.filter(
    (u) =>
      !alta.ids.includes(u.id) &&
      (u.name.toLowerCase().includes(t) || u.id.toLowerCase().includes(t)),
  );

  const elegir = (id: string) => {
    alta.alternar(id);
    setTexto("");
  };

  return (
    <motion.div
      variants={reducido ? enciende : abre}
      initial="oculto"
      animate="visible"
      exit="oculto"
      /* El recorte es lo que hace que el alto animado se lea como un hueco que
         se abre: sin esto el contenido asoma entero desde el primer cuadro. */
      className="shrink-0 overflow-hidden border-b border-dashed border-border bg-accent/30"
    >
      <div className="flex flex-wrap items-center gap-3 px-6 py-2.5">
        <div className="relative w-72">
          <InputGroup>
            <InputField
              index={0}
              label="Search accounts to provision"
              labelHidden
              icon={Search}
              placeholder="Add an account…"
              value={texto}
              onChange={setTexto}
              className="[&>div:has(>input)]:bg-card [&>div:has(>input)]:ring-border"
            />
          </InputGroup>

          {/* Las cuentas, sólo mientras se escribe. Una lista siempre abierta
              arriba de la tabla la empuja media pantalla para abajo y tapa
              justamente contra lo que uno quiere comparar. */}
          <AnimatePresence>
            {texto.trim() !== "" && (
              <motion.div
                variants={entraPanel}
                initial="oculto"
                animate="visible"
                exit="oculto"
                className={cn(
                  "absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-border bg-card p-1 shadow-lg",
                  shape.container,
                )}
              >
                {candidatos.length === 0 ? (
                  <p
                    className="px-2 py-3 text-center text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    No accounts left matching &ldquo;{texto}&rdquo;.
                  </p>
                ) : (
                  candidatos.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => elegir(u.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left hover:bg-hover",
                        shape.item,
                      )}
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ fontSize: escala.body }}
                      >
                        {u.name}
                      </span>
                      <span
                        className="shrink-0 truncate text-muted-foreground"
                        style={{ fontSize: escala.caption }}
                      >
                        {direccionDe(u)}
                      </span>
                      <CornerDownLeft
                        size={12}
                        strokeWidth={1.5}
                        className="shrink-0 text-muted-foreground"
                      />
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span
          className="text-muted-foreground tabular-nums"
          style={{ fontSize: escala.caption }}
        >
          {alta.elegidos.length === 0
            ? "Nothing drafted yet"
            : `${alta.elegidos.length} drafted`}
        </span>

        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={alta.cerrar}>
            Discard
          </Button>
          <Button
            leadingIcon={MailPlus}
            disabled={alta.elegidos.length === 0}
            onClick={onCrear}
          >
            {alta.elegidos.length > 1
              ? `Create ${alta.elegidos.length} mailboxes`
              : "Create mailbox"}
          </Button>
        </span>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Las filas ─────────────────────────── */

/** Lo que se va a crear, con la forma que va a tener. Va adentro del scroller,
 *  debajo de los títulos y arriba de la primera fila real: ahí es donde van a
 *  estar cuando existan. */
export function FilasBorrador({ alta }: { alta: Alta }) {
  const escala = useTypeScale();
  const reducido = useReducedMotion() ?? false;
  const estado = ESTADOS_BUZON[ESTADO_INICIAL];

  return (
    <AnimatePresence initial={false}>
      {alta.elegidos.map((u) => (
        <motion.div
          key={u.id}
          variants={reducido ? enciende : abreFila}
          initial="oculto"
          animate="visible"
          exit="oculto"
          className="overflow-hidden border-b border-dashed border-border bg-accent/30 text-muted-foreground"
          style={{ fontSize: escala.body }}
        >
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: REJILLA }}
          >
            <span className={cn(CELDA, "pl-6 text-foreground")}>{u.name}</span>
            <span className={CELDA}>{direccionDe(u)}</span>
            <span className={CELDA}>{CREADOR}</span>
            <span className={cn(CELDA, "tabular-nums")}>
              {fechaDia(HOY_DIA)}
            </span>
            <span className={cn(CELDA, "flex items-center gap-1.5 pr-6")}>
              <Badge variant="dot" color={estado.color}>
                {estado.label}
              </Badge>
              {/* Lo que dice que todavía no es. El punteado y el tinte lo
                  sugieren; la palabra lo dice, que es lo que hace falta cuando
                  la fila de abajo se ve igual salvo por eso. */}
              <Badge color="gray">Draft</Badge>
              <button
                type="button"
                aria-label={`Drop ${u.name}`}
                onClick={() => alta.quitar(u.id)}
                className="ml-auto shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
