"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CreditCard, ScrollText, ShoppingBag } from "lucide-react";

import { Badge, type BadgeColor } from "@/components/ui/badge";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  comoPlata,
  comprasDe,
  registrosDe,
  transaccionesDe,
  type EstadoDeCobro,
  type EstadoDeProducto,
} from "@/pages/actividad";
import { fechaLarga, haceCuanto } from "@/pages/tiempo";
import type { Usuario } from "@/pages/usuarios";

/**
 * ActivityPreview — qué le pasó a una cuenta, en tres pestañas.
 *
 * Las tres contestan preguntas distintas sobre lo mismo, y por eso son pestañas
 * y no tres bloques uno abajo del otro: quien viene a revisar un cobro no está
 * mirando el registro de la consola, y apilarlas obliga a scrollear a través de
 * lo que no se vino a ver.
 *
 * El mueble de las tres es el mismo —a la izquierda qué pasó, debajo en chico
 * de qué se trata y cuándo fue, y a la derecha lo que lo distingue: el importe
 * con su estado, o nada—. Que no cambie de forma entre pestañas es lo que deja
 * cambiar de una a otra sin volver a aprender a leerla.
 */

/* El estado de un cobro con su color, en un solo lugar: la etiqueta que se lee y
   el color con el que se la distingue son dos vistas del mismo dato. */
const COBROS = {
  approved: { label: "Approved", color: "green" },
  declined: { label: "Declined", color: "rose" },
  refunded: { label: "Refunded", color: "violet" },
  pending: { label: "Pending", color: "amber" },
} as const satisfies Record<EstadoDeCobro, { label: string; color: BadgeColor }>;

/* Y el de un producto contratado. Mismo criterio: la palabra que se lee y el
   color con que se la distingue, en el mismo lugar. */
const PRODUCTOS = {
  active: { label: "Active", color: "green" },
  expired: { label: "Expired", color: "gray" },
  refunded: { label: "Refunded", color: "violet" },
} as const satisfies Record<
  EstadoDeProducto,
  { label: string; color: BadgeColor }
>;

/* ─────────────────────────── La fila ─────────────────────────── */

/** Una fila de cualquiera de las tres. `derecha` es lo único que cambia entre
 *  ellas —el importe en dos, nada en la tercera—, así que es lo único que
 *  entra por props. */
function Fila({
  que,
  clave,
  porQuien,
  cuando,
  cuandoADerecha,
  detalle,
  derecha,
  extra,
}: {
  que: string;
  /** El identificador de lo que sea que diga `que`, pegado abajo del nombre.
   *  Es un dato que no se lee sino que se copia —una clave de producto—, así
   *  que va entero en el `title` y truncado en pantalla: el renglón no puede
   *  crecer treinta caracteres porque la clave los tenga. */
  clave?: string;
  /** Quién lo hizo. Va en su propio renglón y con el nombre resaltado: en un
   *  registro, la pregunta que sigue a "qué pasó" es siempre "quién", y es lo
   *  único de la fila que no se puede deducir de ningún otro lado. */
  porQuien?: string;
  cuando: string;
  /** Dónde va el "hace cuánto". Abajo con el resto de los datos chicos, salvo
   *  que la fila no tenga un importe que ocupe la esquina: ahí sube a la
   *  derecha, que es donde se lo busca al recorrer una columna de fechas. */
  cuandoADerecha?: boolean;
  /** El renglón chico debajo: dónde fue, de qué tipo es, por qué tienda entró. */
  detalle?: string;
  derecha?: ReactNode;
  /** Lo que cuelga de la fila cuando la fila lo tiene: el vencimiento y la
   *  contraseña temporal de un reseteo. Entra como nodo porque es lo único de
   *  la fila que no es texto sino algo con lo que se interactúa. */
  extra?: ReactNode;
}) {
  const escala = useTypeScale();

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        {/* El título de las tres pestañas se escribe igual: la fila que hay que
            mirar se marca con su insignia y no engordando la letra. Dos señales
            para lo mismo hacen que las filas sin insignia parezcan apagadas en
            vez de normales. */}
        <span className="min-w-0" style={{ fontSize: escala.body }}>
          {que}
        </span>
        {clave && (
          <span
            className="min-w-0 truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
            title={clave}
          >
            {clave}
          </span>
        )}
        {porQuien && (
          <span
            className="min-w-0 truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            by <span className="font-medium text-foreground">{porQuien}</span>
          </span>
        )}
        {/* Hace cuánto y no la fecha: lo que se quiere saber de un renglón de
            actividad es cuán reciente es. La fecha entera va en el `title`, que
            es la misma regla que usan las tablas de búsqueda. */}
        {(!cuandoADerecha || detalle) && (
          <span
            className="min-w-0 text-muted-foreground"
            style={{ fontSize: escala.caption }}
            title={fechaLarga(cuando)}
          >
            {cuandoADerecha ? detalle : haceCuanto(cuando)}
            {!cuandoADerecha && detalle && ` · ${detalle}`}
          </span>
        )}
        {extra}
      </span>

      {(derecha || cuandoADerecha) && (
        <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {cuandoADerecha && (
            <span
              className="text-muted-foreground"
              style={{ fontSize: escala.caption }}
              title={fechaLarga(cuando)}
            >
              {haceCuanto(cuando)}
            </span>
          )}
          {derecha}
        </span>
      )}
    </li>
  );
}

function Vacio({ que }: { que: string }) {
  const escala = useTypeScale();
  return (
    <p
      className="py-6 text-center text-muted-foreground"
      style={{ fontSize: escala.caption }}
    >
      {que}
    </p>
  );
}

/* ─────────────────────────── Las pestañas ─────────────────────────── */

function Transacciones({ usuario }: { usuario: Usuario }) {
  const escala = useTypeScale();
  const filas = useMemo(() => transaccionesDe(usuario), [usuario]);
  if (filas.length === 0) return <Vacio que="Nothing has been charged yet." />;

  return (
    <ul className="flex flex-col">
      {filas.map((t) => {
        const cobro = COBROS[t.estado];
        return (
          <Fila
            key={t.id}
            que={t.producto}
            /* Qué es el producto, debajo del nombre. En la tabla ancha esto va
               pegado con un punto en la misma celda; en un riel angosto, pegarlo
               sólo consigue que el nombre —lo único por lo que se busca un
               renglón— arranque cortado a la mitad. */
            clave={t.resumen}
            cuando={t.cuando}
            /* Cuándo, por dónde y qué pasó, en el renglón chico. Son los tres
               datos que no cambian el sentido de la fila: la contestan el
               importe y el estado, que están a la derecha y en negrita. */
            detalle={`${t.fuente} · ${t.movimiento}`}
            derecha={
              <span className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "tabular-nums",
                    /* Lo que no entró se tacha: el importe de un cobro rechazado
                       o devuelto es el único de la lista que no se cobró, y
                       decirlo sólo con el badge obliga a leer dos cosas para
                       entender una. */
                    t.estado !== "approved" &&
                      t.estado !== "pending" &&
                      "text-muted-foreground line-through",
                  )}
                  style={{ fontSize: escala.body }}
                >
                  {comoPlata(t.centavos)}
                </span>
                <Badge size="compact" color={cobro.color}>
                  {cobro.label}
                </Badge>
              </span>
            }
          />
        );
      })}
    </ul>
  );
}

function Compras({ usuario }: { usuario: Usuario }) {
  const escala = useTypeScale();
  const filas = useMemo(() => comprasDe(usuario), [usuario]);
  if (filas.length === 0) return <Vacio que="Nothing bought in the app yet." />;

  return (
    <ul className="flex flex-col">
      {filas.map((c) => {
        const estado = PRODUCTOS[c.estado];
        return (
          <Fila
            key={c.id}
            que={c.nombre}
            clave={c.id}
            cuando={c.cuando}
            /* El tipo va pegado al cuándo y no en su propia columna: en un riel
               de trescientos píxeles, cinco columnas son cinco palabras
               cortadas. La pregunta que contesta —¿esto se sigue cobrando?— se
               lee igual de bien en el mismo renglón que el último movimiento. */
            detalle={c.suscripcion ? "Subscription" : "One-time"}
            derecha={
              /* El precio arriba y el estado abajo, y no los dos en fila: el
                 nombre del producto es lo que más lugar necesita, y dos cosas
                 apiladas a la derecha le dejan el ancho que dos en fila le
                 sacan. */
              <span className="flex flex-col items-end gap-1">
                <span className="tabular-nums" style={{ fontSize: escala.body }}>
                  {comoPlata(c.centavos)}
                </span>
                {/* Acá sí lleva insignia todo, al revés que los cobros: entre
                    "Active" y "Expired" no hay uno que sea el caso normal, y el
                    que no la lleve se leería como que le falta el dato. */}
                <Badge size="compact" color={estado.color}>
                  {estado.label}
                </Badge>
              </span>
            }
          />
        );
      })}
    </ul>
  );
}

/** El vencimiento de una contraseña temporal, y la contraseña.
 *
 *  Tapada hasta que alguien la descubre a propósito. No es seguridad —quien ve
 *  esta pantalla puede ver la clave— sino cortesía con quien la tiene abierta:
 *  el registro se lee de a ratos, y una contraseña impresa en él es un secreto
 *  a la vista de cualquiera que pase por detrás. Descubrirla es un click, y se
 *  vuelve a tapar sola al cerrar el riel. */
function Reseteo({ valida, temporal }: { valida: string; temporal: string }) {
  const escala = useTypeScale();
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="flex min-w-0 flex-col items-start gap-1 pt-1"
      style={{ fontSize: escala.caption }}
    >
      {/* Acá sí la fecha entera y no "hace un mes": lo que se pregunta de un
          vencimiento es si ya pasó, y para eso hay que poder compararlo con el
          reloj de la pared. */}
      <span className="text-muted-foreground">Valid until: {fechaLarga(valida)}</span>
      {visible ? (
        <code className="font-mono tracking-wide select-all">{temporal}</code>
      ) : (
        <button
          type="button"
          onClick={() => setVisible(true)}
          /* El violeta 292 del sistema —el de las burbujas, el de la banda de
             las tablas— en su versión legible sobre fondo claro y sobre oscuro.
             Es lo único de la fila con lo que se puede hacer algo, así que es lo
             único que no va en la tinta del texto; y el subrayado cortado lo
             dice otra vez sin depender del color, para quien no distingue ese
             violeta del gris de al lado.

             El valor va escrito acá y no como token por lo mismo que la burbuja
             y la onda: `index.css` es copia byte a byte del showcase. */
          className="w-fit cursor-pointer text-left text-[oklch(0.55_0.19_292)] underline decoration-dashed underline-offset-2 hover:decoration-solid dark:text-[oklch(0.72_0.16_292)]"
        >
          Click to reveal temporary password
        </button>
      )}
    </span>
  );
}

function Registros({ usuario }: { usuario: Usuario }) {
  const filas = useMemo(() => registrosDe(usuario), [usuario]);
  if (filas.length === 0) return <Vacio que="Nothing recorded yet." />;

  return (
    <ul className="flex flex-col">
      {filas.map((r) => (
        <Fila
          key={r.id}
          que={r.que}
          porQuien={r.quien}
          cuando={r.cuando}
          /* Acá arriba a la derecha y no abajo: la fila del registro ya tiene
             tres renglones a la izquierda —qué, quién, y a veces el
             vencimiento—, y la fecha metida entre ellos deja de ser la columna
             que se recorre para encontrar cuándo pasó algo. */
          cuandoADerecha
          extra={r.reseteo && <Reseteo {...r.reseteo} />}
          /* Sólo lo que hay que mirar lleva marca. Un registro donde cada
             renglón está señalado es un registro sin señales. */
          derecha={
            r.atencion ? (
              <Badge size="compact" color="rose">
                Review
              </Badge>
            ) : undefined
          }
        />
      ))}
    </ul>
  );
}

/* ─────────────────────────── El mueble ─────────────────────────── */

/* Las tres, declaradas una vez. El riel las pinta desde acá, así que agregar una
   cuarta es una línea y no tocar el `switch` de tres lugares distintos.

   Los rótulos son los que se pidieron —"Transaction" en singular al lado de dos
   plurales—: si tienen que quedar parejos, es acá. */
const PESTAÑAS = [
  { value: "transaction", label: "Transaction", icon: CreditCard, Panel: Transacciones },
  { value: "purchases", label: "Purchases", icon: ShoppingBag, Panel: Compras },
  { value: "logs", label: "Logs", icon: ScrollText, Panel: Registros },
] as const;

export function ActivityPreview({ usuario }: { usuario: Usuario }) {
  const [activa, setActiva] = useState<string>(PESTAÑAS[0].value);
  const puesta = PESTAÑAS.find((p) => p.value === activa) ?? PESTAÑAS[0];
  const Panel = puesta.Panel;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs value={activa} onValueChange={setActiva}>
        {/* El riel a lo ancho: tres pestañas repartiendo la columna se leen
            como un control, y apretadas a la izquierda como tres botones que
            sobraron. */}
        <TabsList aria-label="Activity" className="w-full">
          {PESTAÑAS.map((p) => (
            <TabItem
              key={p.value}
              value={p.value}
              label={p.label}
              icon={p.icon}
              className="flex-1 justify-center"
            />
          ))}
        </TabsList>
      </Tabs>

      {/* El panel lo pinta esta pantalla y no `TabPanel`: los tres montan y
          desmontan enteros, así que el que no se está mirando no existe —y no
          hay tres listas calculadas para mostrar una—. */}
      <Panel usuario={usuario} />
    </div>
  );
}
