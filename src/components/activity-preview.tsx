"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CircleCheck,
  CreditCard,
  KeyRound,
  Package,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  ShoppingBag,
  Tags,
  UserRound,
  X,
} from "lucide-react";

import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { useShape } from "@/lib/shape-context";
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
import type { Compra, Registro, Transaccion } from "@/pages/actividad";
import { fechaLarga, haceCuanto } from "@/pages/tiempo";
import type { IconComponent } from "@/lib/icon-context";
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
   el color con el que se la distingue son dos vistas del mismo dato.

   Todas las insignias de este riel van en `dot`, que es la forma en que esta
   consola dice "estado" desde la tabla de Accounts: el punto de color con el
   texto en la tinta de siempre. Las rellenas son otra cosa —un número que subió
   o bajó— y usarlas acá haría que el mismo dato se leyera de dos maneras según
   en qué pantalla se lo mire. */
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
  /** Quién lo hizo. Va en su propio renglón: en un registro, la pregunta que
   *  sigue a "qué pasó" es siempre "quién", y es lo único de la fila que no se
   *  puede deducir de ningún otro lado. */
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
            {/* El nombre pesa un poco más que el "by" que lo introduce, pero en
                la misma tinta: el renglón es una frase sola —"by Hugo
                Sarmiento"— y partirla en dos colores la lee como dos datos
                puestos uno al lado del otro. */}
            by <span className="font-medium">{porQuien}</span>
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

/** Un importe de la lista. Sale de la fila porque lo escriben dos pestañas y
 *  tiene que salir igual en las dos: el mismo cuerpo, la misma cifra alineada, y
 *  el mismo tachado cuando esa plata no entró. */
function Importe({ centavos, tachado }: { centavos: number; tachado?: boolean }) {
  const escala = useTypeScale();
  return (
    <span
      className={cn(
        "tabular-nums",
        /* Lo que no entró se tacha: es el único importe de la lista que no se
           cobró, y decirlo sólo con la insignia obliga a leer dos cosas para
           entender una. */
        tachado && "text-muted-foreground line-through",
      )}
      style={{ fontSize: escala.body }}
    >
      {comoPlata(centavos)}
    </span>
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

/* ─────────────────────────── Los filtros ─────────────────────────── */

/** Si una fila pasa el filtro de un atributo. Sin nada elegido pasan todas: un
 *  atributo sin valores no está en el mapa, así que filtrar por nada es no
 *  filtrar. */
const cumple = (filtros: FilterSelection, id: string, valor: string) => {
  const elegidos = filtros[id];
  return !elegidos || elegidos.length === 0 || elegidos.includes(valor);
};

/* Los conteos del panel salen de las filas que la pestaña tiene y no de una
   constante: un panel que dice un número y devuelve otro miente sobre lo que va
   a hacer. Es la misma regla que siguen los filtros de las tablas de búsqueda. */
const cuantas = <T,>(filas: T[], prueba: (f: T) => boolean) =>
  String(filas.filter(prueba).length);

/** Las opciones de un atributo cuyos valores salen de los datos —nombres de
 *  producto, operadores— y no de un enum. Se ordenan alfabéticamente y se
 *  cuentan; un valor que no está en ninguna fila no aparece, porque elegirlo
 *  sólo podría vaciar la lista. */
const opcionesDe = <T,>(filas: T[], valor: (f: T) => string): FilterOption[] =>
  [...new Set(filas.map(valor))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: value,
      hint: cuantas(filas, (f) => valor(f) === value),
    }));

/* ─────────────────────────── Las pestañas ─────────────────────────── */

/** Una pestaña del riel: de dónde saca sus filas, por qué se las puede filtrar
 *  y cómo se pinta una. */
interface Pestaña {
  value: string;
  label: string;
  icon: IconComponent;
  /** Qué decir cuando la cuenta no tiene nada de esto. */
  vacio: string;
  datos: (usuario: Usuario) => unknown[];
  grupos: (filas: unknown[]) => FilterGroup[];
  pasa: (fila: unknown, filtros: FilterSelection) => boolean;
  fila: (fila: unknown) => ReactNode;
}

/** Declara una pestaña con el tipo de sus filas y la devuelve con ese tipo
 *  borrado.
 *
 *  El borrado es a propósito: las tres listas son de tres tipos distintos y el
 *  mueble que las muestra es uno solo, así que o el mueble las conoce a las tres
 *  —y agregar una cuarta es tocar tres lugares— o las pestañas se guardan
 *  juntas y el tipo se pierde en la puerta. Los `as` viven acá adentro y en
 *  ningún otro lado: en cada declaración de abajo, `datos`, `pasa` y `fila`
 *  hablan del mismo tipo y el compilador lo verifica. */
function pestaña<T>(p: {
  value: string;
  label: string;
  icon: IconComponent;
  vacio: string;
  datos: (usuario: Usuario) => T[];
  grupos: (filas: T[]) => FilterGroup[];
  pasa: (fila: T, filtros: FilterSelection) => boolean;
  fila: (fila: T) => ReactNode;
}): Pestaña {
  return {
    ...p,
    grupos: (filas) => p.grupos(filas as T[]),
    pasa: (fila, filtros) => p.pasa(fila as T, filtros),
    fila: (fila) => p.fila(fila as T),
  };
}

/* Los movimientos que puede tener un cobro, para el filtro. La lista se escribe
   y no se deduce de las filas: que "Refunded" no aparezca en una cuenta es
   justamente lo que se quiere poder ver al abrir el panel. */
const MOVIMIENTOS = ["Purchased", "Renewed", "Refunded"] as const;

/* Y de qué habla un renglón del registro. Las cuatro clases con su rótulo, en el
   mismo lugar donde se las nombra. */
const CLASES = {
  provisioning: "Provisioning",
  access: "Access",
  password: "Password",
  moderation: "Moderation",
} as const;

const Transacciones = pestaña<Transaccion>({
  value: "transaction",
  label: "Transaction",
  icon: CreditCard,
  vacio: "Nothing has been charged yet.",
  datos: transaccionesDe,
  grupos: (filas) => [
    {
      label: "The charge",
      attributes: [
        {
          id: "estado",
          label: "Status",
          icon: CircleCheck,
          options: (Object.keys(COBROS) as EstadoDeCobro[]).map((value) => ({
            value,
            label: COBROS[value].label,
            hint: cuantas(filas, (t) => t.estado === value),
          })),
        },
        {
          id: "movimiento",
          label: "Activity",
          icon: RefreshCcw,
          options: MOVIMIENTOS.map((value) => ({
            value,
            label: value,
            hint: cuantas(filas, (t) => t.movimiento === value),
          })),
        },
      ],
    },
    {
      label: "The product",
      attributes: [
        {
          id: "producto",
          label: "Product",
          icon: Package,
          options: opcionesDe(filas, (t) => t.producto),
        },
      ],
    },
  ],
  pasa: (t, f) =>
    cumple(f, "estado", t.estado) &&
    cumple(f, "movimiento", t.movimiento) &&
    cumple(f, "producto", t.producto),
  fila: (t) => (
    <Fila
      key={t.id}
      que={t.producto}
      /* Qué es el producto, debajo del nombre. En la tabla ancha esto va pegado
         con un punto en la misma celda; en un riel angosto, pegarlo sólo
         consigue que el nombre —lo único por lo que se busca un renglón—
         arranque cortado a la mitad. */
      clave={t.resumen}
      cuando={t.cuando}
      /* Cuándo, por dónde y qué pasó, en el renglón chico. Son los tres datos
         que no cambian el sentido de la fila: eso lo dicen el importe y el
         estado, que están a la derecha. */
      detalle={`${t.fuente} · ${t.movimiento}`}
      derecha={
        <span className="flex flex-col items-end gap-1">
          <Importe
            centavos={t.centavos}
            tachado={t.estado !== "approved" && t.estado !== "pending"}
          />
          <Badge variant="dot" size="compact" color={COBROS[t.estado].color}>
            {COBROS[t.estado].label}
          </Badge>
        </span>
      }
    />
  ),
});

const Compras = pestaña<Compra>({
  value: "purchases",
  label: "Purchases",
  icon: ShoppingBag,
  vacio: "Nothing bought in the app yet.",
  datos: comprasDe,
  grupos: (filas) => [
    {
      label: "The product",
      attributes: [
        {
          id: "estado",
          label: "Status",
          icon: CircleCheck,
          options: (Object.keys(PRODUCTOS) as EstadoDeProducto[]).map(
            (value) => ({
              value,
              label: PRODUCTOS[value].label,
              hint: cuantas(filas, (c) => c.estado === value),
            }),
          ),
        },
        {
          id: "tipo",
          label: "Type",
          icon: Tags,
          options: [
            { value: "subscription", label: "Subscription" },
            { value: "one-time", label: "One-time" },
          ].map((o) => ({
            ...o,
            hint: cuantas(
              filas,
              (c) => c.suscripcion === (o.value === "subscription"),
            ),
          })),
        },
        {
          id: "nombre",
          label: "Product",
          icon: Package,
          options: opcionesDe(filas, (c) => c.nombre),
        },
      ],
    },
  ],
  pasa: (c, f) =>
    cumple(f, "estado", c.estado) &&
    cumple(f, "tipo", c.suscripcion ? "subscription" : "one-time") &&
    cumple(f, "nombre", c.nombre),
  fila: (c) => (
    <Fila
      key={c.id}
      que={c.nombre}
      clave={c.id}
      cuando={c.cuando}
      /* El tipo va pegado al cuándo y no en su propia columna: en un riel de
         trescientos píxeles, cinco columnas son cinco palabras cortadas. La
         pregunta que contesta —¿esto se sigue cobrando?— se lee igual de bien en
         el mismo renglón que el último movimiento. */
      detalle={c.suscripcion ? "Subscription" : "One-time"}
      derecha={
        /* El precio arriba y el estado abajo, y no los dos en fila: el nombre
           del producto es lo que más lugar necesita, y dos cosas apiladas a la
           derecha le dejan el ancho que dos en fila le sacan. */
        <span className="flex flex-col items-end gap-1">
          <Importe centavos={c.centavos} />
          {/* Acá sí lleva insignia todo, al revés que los cobros: entre "Active"
              y "Expired" no hay uno que sea el caso normal, y el que no la lleve
              se leería como que le falta el dato. */}
          <Badge variant="dot" size="compact" color={PRODUCTOS[c.estado].color}>
            {PRODUCTOS[c.estado].label}
          </Badge>
        </span>
      }
    />
  ),
});

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

const Registros = pestaña<Registro>({
  value: "logs",
  label: "Logs",
  icon: ScrollText,
  vacio: "Nothing recorded yet.",
  datos: registrosDe,
  grupos: (filas) => [
    {
      label: "The entry",
      attributes: [
        {
          id: "clase",
          label: "Event",
          icon: KeyRound,
          options: (Object.keys(CLASES) as (keyof typeof CLASES)[]).map(
            (value) => ({
              value,
              label: CLASES[value],
              hint: cuantas(filas, (r) => r.clase === value),
            }),
          ),
        },
        {
          id: "quien",
          label: "By",
          icon: UserRound,
          options: opcionesDe(filas, (r) => r.quien),
        },
        {
          id: "atencion",
          label: "Attention",
          icon: ShieldAlert,
          options: [
            {
              value: "review",
              label: "Needs review",
              hint: cuantas(filas, (r) => Boolean(r.atencion)),
            },
            {
              value: "routine",
              label: "Routine",
              hint: cuantas(filas, (r) => !r.atencion),
            },
          ],
        },
      ],
    },
  ],
  pasa: (r, f) =>
    cumple(f, "clase", r.clase) &&
    cumple(f, "quien", r.quien) &&
    cumple(f, "atencion", r.atencion ? "review" : "routine"),
  fila: (r) => (
    <Fila
      key={r.id}
      que={r.que}
      porQuien={r.quien}
      cuando={r.cuando}
      /* Acá arriba a la derecha y no abajo: la fila del registro ya tiene tres
         renglones a la izquierda —qué, quién, y a veces el vencimiento—, y la
         fecha metida entre ellos deja de ser la columna que se recorre para
         encontrar cuándo pasó algo. */
      cuandoADerecha
      extra={r.reseteo && <Reseteo {...r.reseteo} />}
      /* Sólo lo que hay que mirar lleva marca. Un registro donde cada renglón
         está señalado es un registro sin señales. */
      derecha={
        r.atencion ? (
          <Badge variant="dot" size="compact" color="rose">
            Review
          </Badge>
        ) : undefined
      }
    />
  ),
});

/* ─────────────────────────── Lo filtrado ─────────────────────────── */

/** Los filtros puestos, escritos y con su salida.
 *
 *  Es lo que hace que el conteo signifique algo. "2 of 9" solo obliga a abrir el
 *  panel para saber qué se recortó —y a abrirlo de nuevo la próxima vez que la
 *  pregunta vuelva—; con los valores escritos al lado, la lista dice por qué es
 *  corta sin que haya que preguntarle.
 *
 *  Y sacarlos es un click: el camino de vuelta desde "esto no era lo que
 *  buscaba" es el que más se recorre de un filtro, y meterlo adentro del panel
 *  lo hace tres clicks. */
function Puestos({
  filtros,
  grupos,
  onChange,
}: {
  filtros: FilterSelection;
  grupos: FilterGroup[];
  onChange: (filtros: FilterSelection) => void;
}) {
  const escala = useTypeScale();
  const shape = useShape();

  const puestos = Object.entries(filtros).flatMap(([id, valores]) =>
    valores.map((value) => ({ id, value })),
  );
  if (puestos.length === 0) return null;

  const atributos = grupos.flatMap((g) => g.attributes);

  /* El rótulo que el panel le da al valor, no el valor. Un chip que dice
     "one-time" al lado de un panel que dice "One-time" son dos nombres para lo
     mismo, y el segundo se lee como otra cosa. */
  const comoSeLlama = (id: string, value: string) =>
    atributos.find((a) => a.id === id)?.options?.find((o) => o.value === value)
      ?.label ?? value;

  const sacar = (id: string, value: string) => {
    const quedan = (filtros[id] ?? []).filter((v) => v !== value);
    const proximo = { ...filtros };
    /* El atributo vacío se borra en vez de quedar como lista vacía: es lo que
       `FilterSelection` promete, y de lo que depende el contador del botón. */
    if (quedan.length === 0) delete proximo[id];
    else proximo[id] = quedan;
    onChange(proximo);
  };

  return (
    <div className="flex flex-wrap gap-1 bg-muted px-3 pb-2">
      {puestos.map(({ id, value }) => {
        const nombre = comoSeLlama(id, value);
        return (
          <button
            key={`${id}/${value}`}
            type="button"
            onClick={() => sacar(id, value)}
            /* Sobre la barra gris, el chip va en el papel de la lista: es lo
               que lo hace leerse como algo puesto encima y no como parte del
               fondo. */
            className={cn(
              "group inline-flex cursor-pointer items-center gap-1 bg-card py-0.5 pr-1 pl-2 transition-colors hover:bg-hover",
              shape.item,
            )}
            style={{ fontSize: escala.caption }}
            aria-label={`Remove filter ${nombre}`}
          >
            {nombre}
            <X className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── El mueble ─────────────────────────── */

/* Las tres, declaradas una vez. El riel las pinta desde acá, así que agregar una
   cuarta es una línea y no tocar el `switch` de tres lugares distintos.

   Los rótulos son los que se pidieron —"Transaction" en singular al lado de dos
   plurales—: si tienen que quedar parejos, es acá. */
const PESTAÑAS: Pestaña[] = [Transacciones, Compras, Registros];

/* El "no hay nada filtrado" de una pestaña, uno solo y compartido: un `{}`
   nuevo en cada render es una dependencia nueva en cada render, y la lista se
   volvería a filtrar aunque no se haya tocado nada. */
const SIN_FILTRO: FilterSelection = {};

export function ActivityPreview({ usuario }: { usuario: Usuario }) {
  const escala = useTypeScale();
  const shape = useShape();
  const [activa, setActiva] = useState<string>(PESTAÑAS[0].value);
  /* Un filtro por pestaña y no uno solo compartido: los atributos de las tres no
     son los mismos —"Activity" no existe en el registro—, así que uno compartido
     filtraría por algo que la pestaña de al lado no puede ni mostrar ni sacar.
     Guardados por separado, además, volver a una pestaña la encuentra como se la
     dejó. */
  const [filtros, setFiltros] = useState<Record<string, FilterSelection>>({});

  const puesta = PESTAÑAS.find((p) => p.value === activa) ?? PESTAÑAS[0];
  const puestos = filtros[puesta.value] ?? SIN_FILTRO;

  /* Las filas de la pestaña que se está mirando, y nada más: las otras dos ni se
     calculan. */
  const todas = useMemo(() => puesta.datos(usuario), [puesta, usuario]);
  const filas = useMemo(
    () => todas.filter((f) => puesta.pasa(f, puestos)),
    [todas, puesta, puestos],
  );
  const grupos = useMemo(() => puesta.grupos(todas), [puesta, todas]);

  /* Uno solo para los dos lugares que lo tocan —el panel y los chips—: dos
     escrituras del mismo estado son dos maneras de dejarlo distinto. */
  const ponerFiltros = (v: FilterSelection) =>
    setFiltros((antes) => ({ ...antes, [puesta.value]: v }));

  return (
    /* El riel entero deja de correr y corre sólo la lista.
       
       El cuerpo del riel scrollea todo lo que le pongan adentro, y con eso las
       pestañas y la barra se iban para arriba en cuanto la lista era larga: se
       perdía de vista con qué se está mirando justo cuando hay tanto que hay que
       filtrar. Tomando el alto —`h-full`— nada desborda al riel, y el único que
       se pasa es el bloque de filas.

       Es la misma decisión que ya toma `LateralPreview` con su cabecera, un
       nivel más adentro. */
    <div className="flex h-full min-w-0 flex-col gap-3">
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

      {/* La lista tiene caja, y la barra de arriba es de la caja.
          
          Suelta entre las pestañas y las filas, esa barra no era de nadie: a esa
          altura de la columna el conteo podía leerse como algo de las pestañas y
          el botón como algo de la lista. Adentro del marco la pregunta no se
          hace: lo que la barra dice y lo que el filtro recorta son las filas que
          tiene abajo, encerradas con ella.

          El total es el de la pestaña, no el de la cuenta: son tres listas
          distintas y "8 of 244" con 8 filas de registro sería un número que no
          es de nadie. */}
      {/* El marco no crece: se achica. Con pocas filas mide lo que miden, y
          cuando no entran es el único que cede —las pestañas no—, así que lo que
          sobra queda adentro de la lista y no abajo del riel. */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden border border-border",
          shape.container,
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 bg-muted py-1 pr-1 pl-3">
          <span
            className="text-muted-foreground tabular-nums"
            style={{ fontSize: escala.caption }}
          >
            {filas.length} of {todas.length.toLocaleString("en-US")}
          </span>

          <FilterMenu
            groups={grupos}
            align="end"
            variant="ghost"
            size="compact"
            value={puestos}
            onValueChange={ponerFiltros}
          />
        </div>

        <Puestos filtros={puestos} grupos={grupos} onChange={ponerFiltros} />

        {/* La barra de scroll es la del sistema y no la del navegador, como en
            los paneles y en la barra lateral; en un teléfono se devuelve sola al
            scroll nativo. El relleno va adentro del viewport para que la barra
            corra pegada al borde del marco y no a tres píxeles de las filas, y
            el desvanecido es corto: sobre una lista de doscientos píxeles, los
            cuarenta y ocho de siempre son el borde comiéndose el contenido. */}
        <ScrollArea
          className="min-h-0"
          viewportClassName="scroll-fade [--scroll-fade-size:24px]!"
        >
          <div className="px-3">
            {todas.length === 0 ? (
              <Vacio que={puesta.vacio} />
            ) : filas.length === 0 ? (
              /* Que no haya nada porque se filtró no es lo mismo que no haya
                 nada: una dice qué hacer —soltar un filtro— y la otra dice que
                 no hay más que ver. */
              <Vacio que="Nothing matches these filters." />
            ) : (
              <ul className="flex flex-col">{filas.map((f) => puesta.fila(f))}</ul>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
