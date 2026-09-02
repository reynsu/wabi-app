"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { sileo } from "sileo";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, Check, ChevronDown, IdCard, Search, X } from "lucide-react";

import { DateTimePicker } from "@/components/calendar";
import { AIRE, CAMPO_PUESTO, Campo, Corte, Segmentado } from "@/components/ficha";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { useMeasuredWidth } from "@/hooks/use-measured-width";
import { MenuItem } from "@/components/ui/menu-item";
import type { WidgetDefinition } from "@/components/widget";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  ESTADOS_DOC,
  ORDEN_ESTADOS_DOC,
  ORDEN_ROLES,
  ORGANIZACIONES,
  ROLES_DOC,
  crearCuentaDOC,
  editarCuentaDOC,
  type CuentaDOC,
  type EstadoDOC,
  type Organizacion,
  type RolDOC,
} from "@/pages/cuentas-doc";
import { HOY } from "@/pages/usuarios";
import { useBoards } from "@/stores/board";

/**
 * NuevaCuentaDOC — dar de alta a quien va a usar la consola, en el board y no en
 * un diálogo.
 *
 * El mismo mueble que el alta de políticas y la de anuncios, y por la misma
 * razón: un diálogo tapa la tabla justo cuando hace falta mirarla —para no
 * repetir un correo, para copiarle el rol a alguien que hace lo mismo—, y es
 * todo o nada. La ficha vive en el riel, al costado de la tabla, y mientras está
 * abierta la lista sigue ahí para leerla y buscarla.
 *
 * La celda que la sostiene se pinta **cruda** —sin plano, sin cabecera y sin la
 * capa que abre un widget, y con el alto que el contenido pida—: ver `crudo` en
 * `widget.tsx`. Lo único que se ve en el riel es la hoja blanca.
 *
 * Lo que esta ficha tiene y las otras dos no son **pares de campos**. Nombre y
 * apellido van juntos, y rol y fecha también: son campos cortos, y apilados de a
 * uno la hoja se va a mil píxeles de alto por cuatro palabras. Cada par es una
 * sola pregunta —cómo se llama, qué puede hacer y desde cuándo—.
 *
 * El correo no entra en ningún par: se lleva el renglón entero porque es el más
 * largo y porque es la identidad de la fila —lo único que el alta no deja
 * repetir—, así que tiene que poder leerse completo antes de crear la cuenta.
 */

/* El hook y las piezas que dibuja viven en el mismo archivo a propósito: son una
   sola cosa leída de una vez —lo que se está escribiendo, y los lugares donde
   eso se muestra o se toca—, y partirlo para contentar al fast refresh lo
   dejaría en dos. Es la misma decisión que toman las otras dos altas. */
/* oxlint-disable react/only-export-components */

/* ─────────────────────────── El borrador ─────────────────────────── */

interface Borrador {
  nombre: string;
  apellido: string;
  email: string;
  /** Sin elegir todavía. Es `null` y no un rol por defecto: cuál es el más común
   *  depende de la casa, y arrancar en uno hace que se den de alta cuentas con
   *  un permiso que nadie eligió. */
  rol: RolDOC | null;
  organizaciones: Organizacion[];
  desde: string;
  /** Si puede entrar. Sólo se ve corrigiendo: una cuenta que se da de alta nace
   *  activa —dar de alta a alguien es dejarlo entrar—, y un campo que en el alta
   *  tiene siempre el mismo valor es un campo que no pregunta nada. */
  estado: EstadoDOC;
}

/** Hoy, como día suelto. Sale del `HOY` fijo del fixture y no de un `new Date()`
 *  de verdad: con el reloj real, la cuenta que se da de alta hoy tendría una
 *  fecha y todo lo demás —que cuelga de `HOY`— otra, y la tabla mostraría un
 *  acceso que empieza después de mañana. */
const DIA_DE_HOY = HOY.toISOString().slice(0, 10);

const VACIO: Borrador = {
  nombre: "",
  apellido: "",
  email: "",
  rol: null,
  organizaciones: [],
  estado: "active",
  /* Arranca hoy, que es cuando alguien entra. Es el único campo de la ficha que
     nace con algo: los otros no tienen un valor que se pueda adivinar, y éste sí
     —el noventa por ciento de las altas son para hoy—. */
  desde: DIA_DE_HOY,
};

/** Cuánto dura el destello de la fila recién creada. Lo mismo que en las otras
 *  altas: lo suficiente para encontrarla con la vista, no tanto como para que
 *  quede distinta del resto. */
const DESTELLO_MS = 2000;

/** El nombre partido para poder editarlo.
 *
 *  El modelo lo guarda entero —es lo que la casa sabe de una persona—, así que
 *  corregirlo pide volver a partirlo, y no hay manera de hacerlo bien: se corta
 *  en el primer espacio y lo que sigue es el apellido. "Rubén Ferrari" vuelve
 *  bien; "María José Pérez" vuelve como nombre "María" y apellido "José Pérez",
 *  que se ve raro en los campos aunque lo guardado no cambie —los dos se vuelven
 *  a juntar igual—.
 *
 *  Guardar los tres pedazos en el modelo arreglaría la vista y agregaría dos
 *  campos que ninguna pantalla lee. Se elige la vista rara sobre el dato de
 *  más; el día que la casa necesite ordenar por apellido, se da vuelta. */
const partirNombre = (entero: string) => {
  const corte = entero.trim().indexOf(" ");
  return corte === -1
    ? { nombre: entero.trim(), apellido: "" }
    : {
        nombre: entero.slice(0, corte).trim(),
        apellido: entero.slice(corte + 1).trim(),
      };
};

/** El nombre entero, armado con los dos campos. Es lo que la casa guarda de una
 *  persona: la ficha lo pide partido porque así se escribe un nombre, y
 *  guardarlo partido sería guardar la forma del formulario. */
export const nombreCompleto = (b: Borrador) =>
  [b.nombre.trim(), b.apellido.trim()].filter(Boolean).join(" ");

/** Lo que se está escribiendo, y las cosas que se le pueden hacer.
 *
 *  Vive en la pantalla que abre la ficha y no en una tienda: es un borrador, no
 *  un hecho de la casa. Dos pestañas de DOC Accounts tienen que poder estar
 *  escribiendo dos altas distintas, y cerrar la pestaña se lo lleva. */
export function useBorradorDeCuenta() {
  const [b, setB] = useState<Borrador>(VACIO);

  return {
    b,
    limpiar: () => setB(VACIO),
    /* Cargar una cuenta adentro del borrador. Es lo único que separa corregir de
       dar de alta: el mismo formulario, con algo escrito. */
    cargar: (c: CuentaDOC) =>
      setB({
        ...partirNombre(c.nombre),
        email: c.email,
        rol: c.rol,
        organizaciones: [...c.organizaciones],
        desde: c.desde,
        estado: c.estado,
      }),
    escribir: (campo: "nombre" | "apellido" | "email" | "desde") =>
      (valor: string) =>
        setB((x) => ({ ...x, [campo]: valor })),
    elegirRol: (rol: RolDOC) => setB((x) => ({ ...x, rol })),
    elegirEstado: (estado: EstadoDOC) => setB((x) => ({ ...x, estado })),
    /* Una organización se pone y se saca con el mismo gesto: la casilla no tiene
       dos acciones, tiene dos estados. */
    alternarOrganizacion: (org: Organizacion) =>
      setB((x) => ({
        ...x,
        organizaciones: x.organizaciones.includes(org)
          ? x.organizaciones.filter((o) => o !== org)
          : [...x.organizaciones, org],
      })),
  };
}

type Draft = ReturnType<typeof useBorradorDeCuenta>;

/** Lo que la ficha necesita saber del alta: cómo pedirla, cómo descartarla, y si
 *  está en curso. Se lo pasa el hook que la sostiene —ver `useAltaDeCuenta` al
 *  final—, que es quien tiene la promesa. */
interface Curso {
  /** A cuál cuenta le está haciendo esto, o `null` si la está creando. Es lo
   *  único que separa las dos caras de la ficha, y por eso viaja como un dato y
   *  no como un booleano `esEdicion`: el que corrige necesita **cuál**. */
  corrigiendo: CuentaDOC | null;
  guardar: () => void;
  cerrar: () => void;
  enviando: boolean;
}

/* ─────────────────────────── Las piezas ─────────────────────────── */

/** Los dos campos que abren algo —el rol y la fecha— se visten igual: un botón
 *  con borde a lo ancho de la columna, la etiqueta contra el margen izquierdo y
 *  el glifo contra el derecho. Es la cara de un `select`, y es lo que los hace
 *  leerse como campos y no como botones metidos entre campos.
 *
 *  El `justify-between` va sobre el **hijo** y no sobre el botón. El botón tiene
 *  dos: la capa que pinta el fondo, que es absoluta, y una única caja con todo el
 *  contenido adentro. Separar los hijos del botón no separa nada —hay uno solo—,
 *  así que lo que hay que estirar y repartir es esa caja. Con el
 *  `justify-between` puesto arriba, el glifo quedaba pegado a la etiqueta en el
 *  medio del campo. */
const CAMPO_MENU = [
  "w-full",
  "[&>span:last-child]:w-full",
  "[&>span:last-child]:justify-between",
].join(" ");


/** Un campo de una línea. Los tres de arriba son el mismo control con otro
 *  rótulo, así que se escribe una vez: tres `InputGroup` copiados son tres
 *  lugares donde el día de mañana falta un `disabled`. */
function Texto({
  rotulo,
  valor,
  onChange,
  placeholder,
  enviando,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  enviando: boolean;
}) {
  return (
    <InputGroup size="compact">
      <InputField
        index={0}
        className={CAMPO_PUESTO}
        label={rotulo}
        labelHidden
        placeholder={placeholder}
        value={valor}
        onChange={onChange}
        disabled={enviando}
      />
    </InputGroup>
  );
}

/** El rol: un menú y no cuatro botones segmentados.
 *
 *  El segmentado que usa la ficha de políticas sirve para dos o tres valores de
 *  una palabra —Allow/Block, In/Out/Both—. Acá son cuatro y uno se llama
 *  "Limited Access": en una columna de trescientos píxeles eso son cuatro
 *  etiquetas recortadas a la mitad. El disparador dice el que está puesto, que
 *  es lo que un segmentado da gratis y un menú tiene que decir a propósito. */
function Rol({ d, enviando }: { d: Draft; enviando: boolean }) {
  const puesto = d.b.rol;

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button
            variant="tertiary"
            size="compact"
            trailingIcon={ChevronDown}
            disabled={enviando}
            className={cn(
              CAMPO_MENU,
              /* Sin elegir, la etiqueta va en el gris de un placeholder: es lo
                 mismo que hace un campo vacío al lado, y sin eso "Select role"
                 se lee como un rol que existe. */
              !puesto && "text-muted-foreground",
            )}
          />
        }
      >
        {puesto ? ROLES_DOC[puesto].label : "Select role"}
      </DropdownTrigger>

      <DropdownContent side="bottom" align="start" className="w-auto min-w-52">
        {ORDEN_ROLES.map((rol, i) => (
          <MenuItem
            key={rol}
            index={i}
            /* El tilde marca el puesto. Va como ícono y no al final: es la misma
               columna en la que los otros tres tienen su lugar vacío, así que
               las cuatro filas siguen alineadas. */
            icon={puesto === rol ? Check : undefined}
            label={ROLES_DOC[rol].label}
            onSelect={() => d.elegirRol(rol)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

/* ── Desde cuándo ──────────────────────────────────────────────────────

   El momento se guarda como texto y no como `Date`: el borrador es un dato
   plano, y el modelo guarda `2026-08-28T14:30`. Estas dos funciones son el
   puente con el `DateTimePicker`, que trabaja con `Date`s a medianoche local.

   La medianoche exacta es la única ambigüedad que el componente declara: un
   valor a las 00:00 se lee como una hora todavía no elegida. Acá eso no
   molesta —un acceso que empieza a la medianoche del día que se eligió es
   exactamente lo que quiere decir un campo sin hora—, y por eso la vuelta
   guarda el día solo cuando el reloj está en cero. */

const aMomento = (texto: string): Date | null => {
  if (!texto) return null;
  const [dia, hora] = texto.split("T");
  const [a, m, d] = dia.split("-").map(Number);
  const [hh, mm] = (hora ?? "00:00").split(":").map(Number);
  return new Date(a, m - 1, d, hh, mm);
};

const dosDigitos = (n: number) => String(n).padStart(2, "0");

const aTexto = (d: Date) => {
  const dia = `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  /* Sin hora cuando no la hay: así el campo que nadie tocó guarda lo mismo que
     guardaban las cuentas de antes, y la tabla no tiene dos formatos de fecha
     según quién dio de alta la cuenta. */
  return d.getHours() === 0 && d.getMinutes() === 0
    ? dia
    : `${dia}T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
};

/** Cómo se lee el momento en el disparador: el día siempre, y la hora sólo si
 *  se eligió una. Un "12:00 AM" pegado a un día que nadie fechó a esa hora es
 *  una precisión inventada.
 *
 *  **Sin año**, al revés que la columna de la tabla. No es una inconsistencia:
 *  una columna de altas cruza diciembre y ahí el año desambigua, pero acá el año
 *  está a la vista dos veces —en la cabecera del calendario que se acaba de
 *  cerrar y en el mes que sigue abierto detrás— y el campo es sobre el que se
 *  vuelve mientras se escribe el resto de la ficha. Lo que uno chequea de vuelta
 *  es el día, no el año. */
const COMO_SE_LEE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const COMO_SE_LEE_LA_HORA = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const seLee = (texto: string) => {
  const cuando = aMomento(texto);
  if (!cuando) return null;
  const dia = COMO_SE_LEE.format(cuando);
  return texto.includes("T")
    ? `${dia}, ${COMO_SE_LEE_LA_HORA.format(cuando)}`
    : dia;
};

/* Los atajos del pie. Los cuatro que trae el componente son de una reserva
   —"el lunes que viene", "en una semana"—; acá lo que se fecha es cuándo empieza
   un acceso, y eso es hoy o mañana. Los otros dos daban una fecha a una semana
   vista que nadie va a elegir, y un atajo que no se usa es un botón que hay que
   leer para descartarlo. */
const ATAJOS = [
  { label: "Today", date: (desde: Date) => desde },
  {
    label: "Tomorrow",
    date: (desde: Date) =>
      new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 1),
  },
];

/**
 * Desde cuándo: el `DateTimePicker` del registry, adentro de un popover.
 *
 * El componente se pinta como una tarjeta con su mes, sus campos y sus atajos
 * —trescientos y pico de píxeles de alto—, así que puesto en la hoja se comería
 * la ficha entera. Va donde su propia documentación dice que va: "lo que queda
 * es un mes para meter en un popover".
 *
 * El disparador es el campo. Dice el momento elegido con el glifo del
 * calendario a la derecha, que es lo que la referencia pone ahí, y en el gris de
 * un placeholder mientras no haya nada.
 *
 * `minDate={null}`: el componente arranca en hoy porque lo común es algo que
 * todavía no pasó, y acá es al revés —a alguien que ya viene trabajando se le da
 * de alta la cuenta con la fecha en que empezó—.
 */
function Desde({
  d,
  enviando,
  /** La hoja: de dónde cuelga el calendario y hasta dónde puede crecer.
   *
   *  Se ancla a la hoja y no al campo, que es lo natural en un popover. El campo
   *  vive en la columna derecha del par, así que un calendario colgado de él
   *  nace a mitad de la hoja y no entra: Base UI lo corre para que quepa en la
   *  **ventana**, que es lo único que conoce, y termina flotando sobre la tabla.
   *  Anclado a la hoja, el borde izquierdo del calendario es el de la hoja y el
   *  ancho es el suyo, así que cae exactamente encima y no hay nada que correr.
   *
   *  El ancho llega medido porque el riel se arrastra —no hay un número que
   *  escribir— y porque el popup va portalado al `body`: no hereda nada de la
   *  hoja ni por CSS ni por layout. */
  hoja,
  ancho,
}: {
  d: Draft;
  enviando: boolean;
  hoja: RefObject<HTMLDivElement | null>;
  ancho: number | null;
}) {
  const puesto = seLee(d.b.desde);

  /* El ancla: **el borde de arriba de la hoja**, sin alto.
     
     No es el campo, que sería lo natural, y hubo que llegar hasta acá. Colgado
     del campo, el calendario mide más de lo que queda debajo de él —son 477px
     contra los 450 que sobran en una ventana normal—, así que Base UI busca
     dónde ponerlo, no encuentra ni arriba ni abajo y termina abriéndolo **al
     costado**: flotando sobre la tabla, que es lo que la ficha del riel existe
     para no tapar. Colgado de la hoja entera pasa lo mismo por la misma razón.
     
     Con un ancla de alto cero pegada al tope de los campos, "debajo del ancla"
     es el principio de la hoja: el calendario cae sobre ella, con su ancho, y no
     hay caso en que se salga del board. Tapa los campos mientras está abierto,
     que es lo que hace cualquier popover y lo que uno espera de algo que se
     cierra al elegir.
     
     Base UI acepta cualquier cosa que sepa dar su rectángulo. */
  const ancla = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const h = hoja.current?.getBoundingClientRect();
        if (!h) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(h.x, h.y, h.width, 0);
      },
    }),
    [hoja],
  );

  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        render={
          <Button
            variant="tertiary"
            size="compact"
            trailingIcon={CalendarDays}
            disabled={enviando}
            className={cn(CAMPO_MENU, !puesto && "text-muted-foreground")}
          />
        }
      >
        {puesto ?? "Select date"}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          anchor={ancla}
          side="bottom"
          align="start"
          sideOffset={0}
          collisionPadding={8}
          className="z-50 outline-none"
        >
          {/* El calendario se pinta `w-full max-w-md`, así que llena lo que se
              le dé: acotando el popup se acota él. Sin esto sale en sus 448 y se
              sale del riel por la izquierda —sobre la tabla que la ficha está
              justamente para no tapar—. El mínimo es lo que necesita un mes de
              siete columnas antes de que los días se toquen. */}
          <Popover.Popup
            className="outline-none"
            style={ancho ? { width: Math.max(ancho, 260) } : undefined}
          >
            {/* En el escalón compacto, como el resto de la ficha. El calendario
                se pinta afuera —el popover va portalado al body, así que no
                hereda nada de acá— y en el escalón normal se sale del ancho del
                riel: un mes que sobresale del board es un mes que tapa la tabla
                que la ficha está justamente para no tapar. */}
            <SizeProvider size="compact">
              <DateTimePicker
                title="Effective date"
                label="Day"
                minDate={null}
                presets={ATAJOS}
                value={aMomento(d.b.desde)}
                onValueChange={(cuando) =>
                  d.escribir("desde")(cuando ? aTexto(cuando) : "")
                }
              />
            </SizeProvider>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Dónde va a trabajar: un menú con la lista adentro, y lo elegido en fichas
 * debajo.
 *
 * El disparador tiene la cara del campo de Role, que está justo arriba —el mismo
 * `CAMPO_MENU`—, así que los dos campos que abren algo se leen como el mismo
 * tipo de control. Dice cuántas hay puestas y no cuáles: las cuáles están en las
 * fichas de abajo, donde además se sacan de a una.
 *
 * Lo que esto compra contra una grilla de casillas es **que la hoja no cambie de
 * alto mientras se elige**: lo que crece está adentro del menú. La ficha vive en
 * un riel y ya tiene siete campos; con las casillas, cada organización de más
 * empujaba el botón de crear fuera de la pantalla. Lo que cuesta es un clic, y
 * con tres organizaciones ese clic es peaje —el día que sean veinte, es lo único
 * que hace que la ficha siga entrando—.
 *
 * El buscador adentro del menú filtra tres cosas que se leen de un vistazo, y
 * eso también es para más adelante: lo que hace desde el primer día es dejar
 * escribir en vez de recorrer.
 */
function Organizaciones({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  const [texto, setTexto] = useState("");
  const puestas = d.b.organizaciones;

  const encontradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return ORGANIZACIONES.filter((o) => o.toLowerCase().includes(q));
  }, [texto]);

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownTrigger
          render={
            <Button
              variant="tertiary"
              size="compact"
              trailingIcon={ChevronDown}
              disabled={enviando}
              className={cn(
                CAMPO_MENU,
                /* Sin ninguna, la etiqueta va en el gris de un placeholder, como
                   el campo de Role: sin eso "Select organizations" se lee como
                   una organización que existe. */
                puestas.length === 0 && "text-muted-foreground",
              )}
            />
          }
        >
          {puestas.length === 0
            ? "Select organizations"
            : `${puestas.length} selected`}
        </DropdownTrigger>

        <DropdownContent side="bottom" align="start" className="w-auto min-w-64">
          <div className="flex items-center gap-1.5 border-b border-border px-2 pb-1">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Search organizations…"
              aria-label="Search organizations"
              className="h-7 w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              style={{ fontSize: escala.body }}
              /* El menú de Base UI mueve el foco con las teclas: escribe una
                 letra y salta a la fila que empieza con ella. Sin esto, tipear en
                 el buscador saca el cursor del buscador. */
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex flex-col pt-1">
            {encontradas.length === 0 ? (
              /* Lo que no está se dice y no se deja en blanco: un menú vacío se
                 lee como que se rompió. */
              <p
                className="px-2 py-1.5 text-muted-foreground"
                style={{ fontSize: escala.caption }}
              >
                No organizations by that name.
              </p>
            ) : (
              encontradas.map((org) => (
                /* Un `button` y no un `MenuItem`: el del registry cierra el menú
                   al elegir, y acá se eligen varias de una sentada. */
                <button
                  key={org}
                  type="button"
                  role="checkbox"
                  aria-checked={puestas.includes(org)}
                  onClick={() => d.alternarOrganizacion(org)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
                  style={{ fontSize: escala.caption }}
                >
                  <span className="min-w-0 flex-1 truncate">{org}</span>
                  {puestas.includes(org) && (
                    <Check className="size-3.5 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </DropdownContent>
      </DropdownMenu>

      {/* Sin hueco cuando no hay ninguna: lo que falta ya lo dice el disparador,
          y una caja vacía debajo de un campo vacío es un borde de más en una
          ficha que todavía no tiene nada adentro. */}
      {puestas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {puestas.map((org) => (
            <button
              key={org}
              type="button"
              onClick={() => d.alternarOrganizacion(org)}
              disabled={enviando}
              aria-label={`Remove ${org}`}
              className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-muted py-1 pr-1.5 pl-2 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              style={{ fontSize: escala.caption }}
            >
              <span className="min-w-0 truncate">{org}</span>
              <X className="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Si puede entrar. Un segmentado y no un menú: son dos valores de una palabra,
 *  que es exactamente para lo que este control existe en esta consola —el
 *  Allow/Block de una política—. Y no lleva color: quitar un acceso es una
 *  decisión, no un peligro, y el rojo acá haría que "Deactivated" se lea como un
 *  error de la cuenta y no como algo que alguien decidió. */
function Estado({ d }: { d: Draft }) {
  return (
    <Segmentado
      className="w-full"
      valor={d.b.estado}
      onElegir={d.elegirEstado}
      opciones={ORDEN_ESTADOS_DOC.map((value) => ({
        value,
        label: ESTADOS_DOC[value].label,
      }))}
    />
  );
}

/* ─────────────────────────── La ficha ─────────────────────────── */

/** Los seis campos cortos, de a dos. El rótulo lo pone `Campo`, así que acá sólo
 *  vive de qué lado va cada uno. */
const PAR = "grid grid-cols-2 gap-x-3 gap-y-5";

function FichaDeCuenta({ d, curso }: { d: Draft; curso: Curso }) {
  const corrigiendo = curso.corrigiendo;
  const escala = useTypeScale();
  /* La caja de los campos: de ella cuelga el calendario y de ella saca su ancho.
     El calendario se abre afuera del árbol del DOM, así que las dos cosas —de
     dónde colgar y hasta dónde crecer— tienen que viajar a mano.

     Dos refs sobre el mismo nodo: uno mide y el otro guarda el nodo para
     dárselo al popover. `medir` es estable entre renders, así que el combinado
     también lo es y React no lo desmonta en cada tecla. */
  const [medir, ancho] = useMeasuredWidth<HTMLDivElement>();
  const hoja = useRef<HTMLDivElement>(null);
  const anclar = useCallback(
    (nodo: HTMLDivElement | null) => {
      hoja.current = nodo;
      medir(nodo);
    },
    [medir],
  );
  /* Qué hace falta para que esto sea una cuenta: cómo se llama, cómo se lo
     encuentra, y qué puede hacer. El segundo nombre es opcional —la ficha lo
     dice— y las organizaciones también: alguien puede entrar sin estar asignado
     todavía, y obligar a elegir una sería inventarle un lugar de trabajo. */
  const listo =
    d.b.nombre.trim().length > 0 &&
    d.b.apellido.trim().length > 0 &&
    d.b.email.trim().length > 0 &&
    d.b.rol !== null &&
    !curso.enviando;

  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-5", AIRE.corte)}>
      {/* El encabezado: qué es esto y para qué. Dos renglones, y nada más: un
          ícono acá competiría con los de los campos. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="font-medium tracking-tight"
          style={{ fontSize: escala.title }}
        >
          {corrigiendo ? "Edit account" : "New account"}
        </h2>
        {/* Corrigiendo, el subtítulo dice **a quién**: la hoja llega llena y sin
            eso no hay nada que diga cuál de las quince filas se está tocando —el
            nombre está en un campo, que es donde uno escribe, no donde uno
            lee—. */}
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          {corrigiendo
            ? corrigiendo.email
            : "Who gets in, what they can do, and from when."}
        </p>
      </div>

      <Corte />

      <div ref={anclar} className={cn("flex min-w-0 flex-col", AIRE.campos)}>
        <div className={PAR}>
          <Campo rotulo="First name">
            <Texto
              rotulo="First name"
              placeholder="John"
              valor={d.b.nombre}
              onChange={d.escribir("nombre")}
              enviando={curso.enviando}
            />
          </Campo>
          <Campo rotulo="Last name">
            <Texto
              rotulo="Last name"
              placeholder="Smith"
              valor={d.b.apellido}
              onChange={d.escribir("apellido")}
              enviando={curso.enviando}
            />
          </Campo>

          {/* El correo se queda con el renglón entero. Es el más largo de los
              cuatro —"julian.retamar@facilitybase.org" son treinta y dos
              caracteres— y en media hoja se recortaba justo donde deja de
              identificar a alguien: en el dominio. Y es el que más importa que
              se lea entero antes de crear la cuenta, porque es la identidad de
              la fila y lo único que el alta no deja repetir. */}
          <Campo rotulo="Email" className="col-span-2">
            <Texto
              rotulo="Email"
              placeholder="e.g. john.smith@doc.gov"
              valor={d.b.email}
              onChange={d.escribir("email")}
              enviando={curso.enviando}
            />
          </Campo>

          <Campo rotulo="Role">
            <Rol d={d} enviando={curso.enviando} />
          </Campo>
          <Campo rotulo="Effective date">
            <Desde
              d={d}
              enviando={curso.enviando}
              hoja={hoja}
              ancho={ancho}
            />
          </Campo>
        </div>

        {/* A lo ancho y no en el par: son tres casillas y un buscador, y metido
            en media hoja el buscador queda del tamaño de una palabra. */}
        <Campo rotulo="Organizations">
          <Organizaciones d={d} enviando={curso.enviando} />
        </Campo>

        {/* Sólo al corregir: una cuenta que se da de alta nace activa, y un
            campo que en el alta tiene siempre el mismo valor es un campo que no
            pregunta nada. Acá vive lo que el menú de la fila no hace —sacar y
            devolver el acceso—: es un campo de la cuenta y no una acción
            suelta. */}
        {corrigiendo && (
          <Campo rotulo="Status">
            <Estado d={d} />
          </Campo>
        )}
      </div>

      <Corte />

      {/* El pie: la acción, y lo que descarta. El mismo de las otras dos fichas,
          hasta el orden —lo que crea primero, lo que descarta después, los dos
          contra el margen izquierdo—. */}
      <div className="flex items-center gap-1.5">
        {/* El `loading` del registry deja la etiqueta de fondo invisible y pone
            el spinner encima, así que el botón no cambia de ancho al salir. Y
            deshabilitado mientras dura, que es lo que evita dar de alta la misma
            cuenta dos veces. */}
        <Button
          variant="primary"
          size="compact"
          disabled={!listo}
          loading={curso.enviando}
          onClick={curso.guardar}
        >
          {corrigiendo ? "Save changes" : "Create account"}
        </Button>
        <Button
          variant="ghost"
          size="compact"
          disabled={curso.enviando}
          onClick={curso.cerrar}
        >
          {/* "Discard" descarta un borrador; corrigiendo no hay borrador que
              descartar sino cambios que no se guardan. */}
          {corrigiendo ? "Cancel" : "Discard"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── El alta ─────────────────────────── */

/** El id de la celda. Lo usan el widget y el selector que pregunta si la ficha
 *  está puesta, así que se escribe una vez. */
const CELDA = "doc-accounts/nueva";

/** La celda del board: una sola, cruda. El board no pinta nada alrededor —ni
 *  plano, ni cabecera, ni sombra— y la fila mide lo que la ficha pida. */
const celdaDeAlta = (d: Draft, curso: Curso): WidgetDefinition[] => [
  {
    id: CELDA,
    label: curso.corrigiendo ? "Edit account" : "New account",
    icon: IdCard,
    crudo: true,
    glance: () => <FichaDeCuenta d={d} curso={curso} />,
    full: () => <FichaDeCuenta d={d} curso={curso} />,
  },
];

/**
 * Abrir y cerrar el alta desde la pantalla.
 *
 * Los widgets se vuelven a armar con cada tecla —el board guarda nodos, no
 * estado— y se empujan **con el id de la pestaña**: las que no se miran siguen
 * montadas, y escribir contra "la activa" le pondría la ficha en la cara a otra
 * pestaña.
 */
export function useAltaDeCuenta(tabId?: string) {
  const d = useBorradorDeCuenta();
  /* A cuál cuenta se le está corrigiendo, o `null` si se está creando una.
     Vive acá y no en el borrador: el borrador es lo que se escribió, y esto es
     contra qué se va a guardar. */
  const [corrigiendo, setCorrigiendo] = useState<CuentaDOC | null>(null);

  /* **Si la ficha está abierta lo sabe el board, no este hook.** Una copia en un
     `useState` de acá se desincroniza en cuanto el riel se cierra por otro lado
     —su ×, que va directo a la tienda—: el board queda cerrado y el hook
     creyendo que sigue abierto, así que el siguiente clic pide abrir algo que
     para él ya está abierto y el botón deja de responder. Es un bug que el alta
     de políticas ya pagó; derivado no puede pasar. */
  const abierta = useBoards((b) => {
    const board = tabId ? b.porPestaña[tabId] : undefined;
    return Boolean(board?.open && board.widgets.some((w) => w.id === CELDA));
  });

  const [enviando, setEnviando] = useState(false);
  /* La que se acaba de tocar, para que la tabla pueda señalarla. Vale para las
     dos: una fila corregida se busca con la vista igual que una nueva, y más
     todavía acá, donde la tabla se ordena por una fecha que la corrección pudo
     haber movido. Se limpia sola: es un destello, no un estado. */
  const [recienCreada, setRecienCreada] = useState<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current);
    },
    [],
  );

  const mostrarWidgets = useBoards((b) => b.mostrarWidgets);
  const abrirBoard = useBoards((b) => b.abrirBoard);
  const editarBoard = useBoards((b) => b.editarBoard);

  /* Cerrar es sacar la ficha del board. La tienda no tiene `cerrarBoard` a
     propósito —cerrarlo es de quien lo está mirando—, y ésta es la excepción que
     esa regla deja pasar: lo que hay adentro lo pusimos nosotros y lo estamos
     sacando. */
  const cerrar = useCallback(() => {
    if (!tabId) return;
    editarBoard(tabId, (b) => ({ ...b, open: false, widgets: [] }));
  }, [tabId, editarBoard]);

  /**
   * Guardar, de punta a punta.
   *
   * Una sola función para las dos cosas: lo que cambia es contra qué se escribe
   * y qué dice el aviso. Partirla en dos sería copiar el mismo `try` con los
   * mismos tres estados y las mismas dos maneras de salir mal.
   *
   * La ficha no se cierra antes de tiempo: se cierra cuando la cuenta quedó. Si
   * falla, lo escrito sigue ahí —volver a tipear un nombre y un correo porque el
   * servidor dijo que no es el peor final posible para esta pantalla—.
   */
  const guardar = useCallback(async () => {
    const nombre = nombreCompleto(d.b);
    if (!nombre || !d.b.email.trim() || !d.b.rol || enviando) return;

    const datos = {
      nombre,
      email: d.b.email,
      rol: d.b.rol,
      organizaciones: d.b.organizaciones,
      desde: d.b.desde,
    };

    setEnviando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está guardando, quedó guardada, no se pudo. */
      const quedo = await sileo.promise(
        corrigiendo
          ? editarCuentaDOC(corrigiendo.id, { ...datos, estado: d.b.estado })
          : crearCuentaDOC(datos),
        {
          /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
             "Saving the account…" sale "Saving The Account…". */
          loading: { title: corrigiendo ? "Saving account…" : "Creating account…" },
          success: (hecha) => ({
            title: corrigiendo ? "Account saved" : "Account created",
            /* Qué puede hacer, que es lo que no se ve desde la tabla sin ir a
               buscar la fila: el título ya dijo que quedó. Corrigiendo, además,
               es lo que uno acaba de cambiar nueve de cada diez veces. */
            description:
              hecha.estado === "deactivated"
                ? `${hecha.email} can no longer sign in.`
                : `${hecha.email} can sign in as ${ROLES_DOC[hecha.rol].label}.`,
          }),
          error: (falla) => ({
            title: corrigiendo ? "Nothing was saved" : "Nothing was created",
            description:
              falla instanceof Error
                ? falla.message
                : "The account couldn't be saved — try again.",
          }),
        },
      );

      cerrar();
      setRecienCreada(quedo.id);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setRecienCreada(null), DESTELLO_MS);
    } catch {
      /* El toast ya lo contó. Lo que importa acá es lo que **no** pasa: el
         borrador no se toca. */
    } finally {
      setEnviando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.b, enviando, cerrar, corrigiendo]);

  /* Mientras está abierta, la ficha se vuelve a armar con cada tecla: el board
     guarda nodos, no estado. */
  useEffect(() => {
    if (!tabId || !abierta) return;
    mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, guardar, enviando, corrigiendo }));
  }, [tabId, abierta, d, cerrar, guardar, enviando, corrigiendo, mostrarWidgets]);

  /* Y cuando se cierra —por la ×, por Discard, o porque el alta terminó— el
     borrador se limpia. Un borrador que sobrevive escondido vuelve a aparecer
     media hora después con una cuenta que ya nadie se acuerda de haber
     empezado. */
  useEffect(() => {
    if (abierta) return;
    d.limpiar();
    /* Y se olvida contra qué estaba guardando. Sin esto, el siguiente clic en
       "+ Account" abriría una hoja vacía que al guardar pisaría la cuenta que se
       estaba corrigiendo hace media hora. */
    setCorrigiendo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  /** Abrir es poner la ficha y abrir el riel, en ese orden: si el riel se abre
   *  antes, hay un cuadro con el board vacío.
   *
   *  Con una cuenta, la ficha llega llena y guarda contra ella; sin ella, vacía.
   *  Es la misma ficha: dar de alta y corregir son el mismo formulario con el
   *  mismo contenido, uno vacío y el otro lleno. */
  const abrirCon = useCallback(
    (cuenta: CuentaDOC | null) => {
      if (!tabId) return;
      /* El orden importa: primero se dice contra qué se guarda y qué hay
         escrito, y recién después se pone la ficha. Al revés, el primer cuadro
         mostraría la hoja vacía y los campos aparecerían un instante después. */
      setCorrigiendo(cuenta);
      if (cuenta) d.cargar(cuenta);
      else d.limpiar();
      mostrarWidgets(
        tabId,
        celdaDeAlta(d, { cerrar, guardar, enviando, corrigiendo: cuenta }),
      );
      abrirBoard(tabId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabId, d, cerrar, guardar, enviando, mostrarWidgets, abrirBoard],
  );

  return {
    abierta,
    enviando,
    recienCreada,
    /** Abrir la ficha vacía, para dar de alta.
     *
     *  No toma parámetros y `abrirCon` no se exporta, a propósito: colgada
     *  directo de un `onClick`, una función que acepta una cuenta recibe el
     *  evento del clic y trata de leerle el nombre. Eso pasó, y el síntoma no
     *  se parece a la causa —el botón deja de abrir nada, sin que la fila ni el
     *  formulario tengan nada raro—. La firma es lo que lo hace imposible. */
    abrir: () => abrirCon(null),
    /** Abrir la ficha sobre una cuenta que ya existe, para corregirla. Es la
     *  misma ficha: quien la llama —el menú de una fila— no tiene por qué saber
     *  que es el mismo formulario. */
    editar: (cuenta: CuentaDOC) => abrirCon(cuenta),
    /* Para la pantalla que no tiene board —una copia sin `tabId`—: sin lugar
       donde poner la ficha, el botón no promete algo que no va a pasar. */
    disponible: tabId !== undefined,
  };
}
