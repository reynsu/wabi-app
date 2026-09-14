import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Ban,
  CalendarPlus,
  ChevronDown,
  CircleCheck,
  CirclePause,
  Contact,
  KeyRound,
  Loader,
  MailX,
  Search,
  UserPen,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { BotonDeAlta } from "@/components/boton-de-alta";
import { punto } from "@/components/color-dot";
import {
  BarraDeAlta,
  FilasBorrador,
  useAltaDeBuzones,
} from "@/pages/AltaDeBuzones";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import { useWorkspace } from "@/stores/workspace";
import { Badge } from "@/components/ui/badge";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useEsMovil } from "@/hooks/use-es-movil";
import { useListaInfinita } from "@/hooks/use-lista-infinita";
import { usePaginacion } from "@/hooks/use-paginacion";
import { BOTON_EN_PILDORA, CAMPO_EN_PILDORA } from "@/movil/buscador";
import { Deslizable, type AccionDeslizable } from "@/movil/deslizable";
import { ListaMovil } from "@/movil/lista";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  CREADORES,
  ESTADOS_BUZON,
  ORDEN_ESTADOS_BUZON,
  cambiarEstadoBuzon,
  useBuzones,
  type Buzon,
  type EstadoBuzon,
} from "@/pages/buzones";
import { contiene } from "@/pages/texto";
import { tabDePerfil } from "@/pages/perfil-tab";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import { TarjetaUsuario } from "@/pages/Users";
import {
  ORGANIZACION_DE_LA_CASA,
  cambiarEstado,
  organizacionDe,
  type Usuario,
} from "@/pages/usuarios";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";
import { useTecladoDeTabla } from "@/pages/tabla-teclado";

/* La pantalla de Provisioning: los buzones que la casa dio de alta.

   Es el mismo mueble que Email Search —header con la búsqueda y el `FilterMenu`,
   la tabla debajo, la densidad declarada una vez, la cabecera flotando sobre el
   scroller, y el pie con el rango y el pager— porque son dos maneras de mirar el
   correo de la misma consola y cambiar de fila del sidebar no debería cambiar de
   mueble. Y se pagina por lo mismo que allá: son filas que se recorren de arriba
   abajo buscando una, no una bandeja por la que uno se deja caer.

   Cinco columnas, y ninguna es el asunto de nada: acá no hay mensajes. Un buzón
   es una dirección, de quién es, quién se la dio, cuándo, y si anda. */

/* ─────────────────────────── El movimiento ───────────────────────────

   El mismo reparto que Email Search, y por la misma razón: los escalones salen
   de `lib/springs` —abrir esto es una reacción, alguien tocó una fila del
   sidebar— y no hay cascada entre filas. Una cascada cuenta un orden que en una
   tabla de búsqueda es mentira: los resultados no llegaron en fila india,
   estaban todos ahí. Lo que entra es el texto de cada celda, desenfocado y
   enfocándose, todo al mismo tiempo. */

const cascadaPantalla = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.04 } },
} as const;

const entraBloque = {
  oculto: { opacity: 0, scale: 0.99 },
  visible: { opacity: 1, scale: 1, transition: spring.moderate },
} as const;

const entraTabla = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: spring.moderate },
} as const;

const entraCelda = {
  oculto: { opacity: 0, filter: "blur(5px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: spring.slow },
} as const;

/** El badge del estado: llega con un zoom más marcado que el resto. Es chico y
 *  es una insignia —algo que aparece creciendo se lee como algo que se le puso
 *  encima a la fila, que es exactamente lo que es—. */
const entraMarca = {
  oculto: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: spring.slow },
} as const;

/* Se envuelve el componente del registry en vez de escribir un `motion.span`: es
   el que sigue el escalón de tamaños y la figura del sistema, y perder eso para
   ganar una animación sería cambiar una cosa por otra. */
const MarcaAnimada = motion.create(Badge);

/* La fila, animada. Se envuelve la del registry por lo mismo que el badge: es la
   que trae el borde, la banda del hover y el registro en la grilla de
   proximidad, y perder eso para ganar una animación sería cambiar una cosa por
   otra.

   Sólo la usa lo que se acaba de crear —ver `DESTELLO`—; el resto de las filas
   no necesitan ser componentes de movimiento, y hacerlas todas motion es pagar
   un envoltorio por fila para animar tres. */
const FilaAnimada = motion.create(TableRow);

/* El destello: la fila que acaba de existir llega encendida y se apaga sola.
   Es lo que cierra el alta —el renglón de arriba se cerró, la lista se
   reacomodó, y sin esto hay que ir a buscar con la vista cuál de las cincuenta
   filas es la que uno pidió—.

   Se apaga y no se queda: lo que se busca es que la fila diga "acá estoy", no
   que quede distinta del resto. Y es color y no movimiento: la fila ya está en
   su lugar, moverla otra vez sería decir que todavía está llegando.

   `oklch(... 292)` es el mismo violeta lavado de la banda de los títulos: es el
   color con el que este sistema marca lo suyo. */
const DESTELLO = {
  encendida: { backgroundColor: "oklch(0.966 0.022 292)" },
  apagada: {
    backgroundColor: "oklch(0.966 0.022 292 / 0)",
    transition: { duration: 1.1, delay: 0.35 },
  },
} as const;

/* ─────────────────────────── El estado ─────────────────────────── */

/* La celda de estado no muestra el estado: lo edita. Suspender un buzón es lo
   que se viene a hacer a esta pantalla —dar de alta es lo otro—, y mandar a
   alguien a abrir una ficha para cambiar una palabra que ya está en la fila es
   hacerle dar una vuelta alrededor de la mesa.

   El disparador es el badge mismo, sin caja ni control alrededor: en reposo la
   columna se sigue leyendo como una columna. Lo que dice que se puede tocar es
   el chevron, que aparece con el hover de la fila y se queda mientras el menú
   está abierto —el mismo trato que la fila del sidebar le da a su `+`—. Un
   chevron pintado en las cincuenta filas sería ruido; ninguno, un secreto.

   Las opciones son las tres, siempre, con la actual marcada: es un estado de
   tres valores y no un interruptor, así que no hay una acción que lo dé vuelta
   —lo que hay es adónde llevarlo—. El punto de color de cada una es el mismo que
   usa el panel de filtros y el mismo que tiene el badge, porque son el mismo
   dato. */
function EstadoDelBuzon({ buzon }: { buzon: Buzon }) {
  const estado = ESTADOS_BUZON[buzon.estado];

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <button
            type="button"
            /* Lo que se anuncia es qué es y qué hace: el badge dice "Active" y
               nada más, y suelto en un menú eso no dice de qué es el menú. */
            aria-label={`Status: ${estado.label} — change it`}
            className={cn(
              "group/estado flex cursor-pointer items-center gap-1 outline-none",
              /* El anillo del sistema, el mismo del `Button`: el badge no es
                 un control del registry, así que el foco de teclado hay que
                 ponérselo —sin esto, tabular hasta acá no se ve—. */
              "rounded-[inherit] focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
            )}
          />
        }
      >
        <MarcaAnimada
          /* El estado como `key`: cambiarlo vuelve a montar el badge, y un
             badge que monta adentro de una tabla que ya está en `visible`
             hereda el `oculto` de la pantalla y entra con su zoom. Es el beat
             que dice que **eso** fue lo que cambió —el menú se cerró y la fila
             sigue igual salvo por esta palabra—, y sale gratis: es la misma
             variante con la que la marca llegó la primera vez. */
          key={buzon.estado}
          variants={entraMarca}
          variant="dot"
          color={estado.color}
          className="shrink-0"
        >
          {estado.label}
        </MarcaAnimada>

        <ChevronDown
          size={12}
          strokeWidth={1.5}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground opacity-0 transition-opacity duration-80",
            /* Con el hover de la fila —`is-active` es lo que le pone la tabla
               al pasarle por encima, y es de lo que ya cuelga el color de sus
               celdas— y mientras el menú esté abierto, que es cuando el puntero
               se fue de la fila a elegir. */
            "group-[.is-active]/row:opacity-100",
            "group-aria-expanded/estado:opacity-100",
          )}
        />
      </DropdownTrigger>

      {/* `w-auto`: los 288px que trae el panel son para un menú de navegación,
          y acá son tres palabras. `align="start"`, para que el menú caiga
          alineado con el badge del que sale. */}
      <DropdownContent
        side="bottom"
        align="start"
        className="w-auto"
        checkedIndex={ORDEN_ESTADOS_BUZON.indexOf(buzon.estado)}
      >
        {ORDEN_ESTADOS_BUZON.map((valor, i) => (
          <MenuItem
            key={valor}
            index={i}
            icon={punto(ESTADOS_BUZON[valor].tinte)}
            label={ESTADOS_BUZON[valor].label}
            /* `checked` lo vuelve una opción de un grupo —`menuitemradio`— y no
               una acción suelta: son tres maneras de estar, y elegir una
               reemplaza a la que había. */
            checked={valor === buzon.estado}
            onSelect={() => cambiarEstadoBuzon(buzon, valor)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

/* Lo que se le puede hacer a un buzón desde la lista del teléfono, según cómo
   esté. Son las mismas tres maneras de estar del menú de la tabla, dichas como
   verbos: al menú se le elige un estado, y acá se le pide un cambio.

   **No están las tres siempre.** Elegir "Active" estando activo es una opción
   que no hace nada, y en un menú de radio eso se entiende —es la que está
   marcada— pero como botón sería un botón muerto. Así que cada estado ofrece
   las salidas que tiene: el que anda se puede suspender o dar de baja, el
   suspendido volver o darse de baja, y el de baja sólo volver. Suspender uno
   que ya está de baja es pasar por un estado intermedio para llegar al mismo
   lado.

   Reset password va primero y en todas: no depende del estado —una casilla de
   baja igual tiene una contraseña que rotar— y es lo que más se pide. Todavía
   no hace nada, igual que en Accounts y en el perfil: no hay backend detrás.

   Dar de baja va en rojo porque es la que saca algo de circulación; las otras
   dos, calladas. Si las tres gritan, ninguna grita. */
function accionesDe(buzon: Buzon): AccionDeslizable[] {
  const mover = (estado: EstadoBuzon) => () => cambiarEstadoBuzon(buzon, estado);
  const reset = { label: "Reset", icon: KeyRound, onSelect: () => {} };
  const baja = {
    label: "Deactivate",
    icon: Ban,
    onSelect: mover("inactive"),
    tono: "peligro" as const,
  };
  const volver = { label: "Reactivate", icon: CircleCheck, onSelect: mover("active") };

  if (buzon.estado === "active")
    return [reset, { label: "Suspend", icon: CirclePause, onSelect: mover("suspended") }, baja];
  if (buzon.estado === "suspended") return [reset, volver, baja];
  return [reset, volver];
}

/* ─────────────────────── La fila del teléfono ───────────────────────

   Cinco columnas no entran en 375px, así que la fila se apila, y no en la forma
   genérica de `FilaMovil`: son **tres renglones, y dos de ellos tienen su
   propio dato contra el borde derecho**.

     Nahuel Vidal                      Aug 26, 2026
     nahuel.vidal@wabihouse.example
     Kitchen                                      —

   El alta va arriba, en el renglón del nombre: es el dato por el que se recorre
   una tabla de provisioning —qué se dio de alta y cuándo— y ahí arma su propia
   columna, con `tabular-nums`, que es lo que la hace barrible.

   El estado va abajo, en el renglón de la organización. Los dos son de la misma
   clase de dato —a qué pertenece y cómo está, lo que se mira *después* de
   saber cuál es— y puestos en el mismo renglón el bloque del medio queda para
   la dirección sola, que es lo más largo de la fila y lo que más necesita el
   ancho entero.

   **Y el estado sólo habla cuando hay algo que decir**, en el color de su
   estado: Suspended e Inactive se escriben, y Active se calla y deja un guion.
   Treinta y siete de los cuarenta y un buzones andan, así que la columna queda
   casi vacía y los cuatro que no saltan sin buscarlos —que es justo lo que uno
   viene a hacer acá—. La píldora que había antes decía "Active" cuarenta veces
   con un fondo verde, y cuarenta cosas gritando lo mismo se dejan de ver a las
   tres filas.

   Lo que cuesta: confirmar que uno *sí* anda pasa a ser leer el silencio. Por
   eso el guion y no la nada —hay un lugar donde el estado se dice, y está
   vacío— y por eso el menú cuelga igual de él: se toca el guion y se elige.

   La fila no es un botón: lo que se toca es el nombre —que abre la ficha de la
   cuenta— y el estado. Un botón adentro de otro no existe. */
function FilaDeBuzon({
  buzon,
  onPerfil,
}: {
  buzon: Buzon;
  onPerfil: (usuario: Usuario) => void;
}) {
  const escala = useTypeScale();
  const estado = ESTADOS_BUZON[buzon.estado];
  const anda = buzon.estado === "active";

  return (
    /* Correr la fila muestra lo que se le puede hacer —ver `Deslizable`—. Es el
       mismo gesto que en Accounts y por el mismo motivo: en escritorio esto
       cuelga de un menú que se abre con el puntero sobre la celda del estado, y
       en un táctil no hay puntero ni celda. La fila la envuelve entera, así que
       lo que se corre son los tres renglones. */
    <li>
      <Deslizable id={buzon.direccion} acciones={accionesDe(buzon)}>
        <span className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2.5">
      {/* Quién es, y de cuándo data. `items-baseline` y no `items-center`: son
          dos cuerpos distintos —13 y 12— y lo que tiene que quedar alineado es
          el renglón sobre el que se apoyan, no sus cajas. */}
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: escala.body }}>
          {buzon.usuario ? (
            <TarjetaUsuario
              usuario={buzon.usuario}
              onEstado={cambiarEstado}
              onPerfil={onPerfil}
            >
              {buzon.nombre}
            </TarjetaUsuario>
          ) : (
            buzon.nombre
          )}
        </span>
        <span
          className="shrink-0 tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {fechaDia(buzon.creadoEl)}
        </span>
      </span>

      {/* La dirección, con el renglón entero: es lo más largo de la fila. */}
      <span
        className="truncate text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        {buzon.direccion}
      </span>

      {/* De qué unidad de la casa es —los buzones que no son de nadie son de la
          casa misma, ver `organizacionDe`— y cómo está.

          **Y si anda, no dice nada.** Tuvo un guion en el lugar del estado, que
          existía para dos cosas: decir "acá se dice el estado, y está en el
          normal" y ser el blanco del menú. Lo segundo se lo lleva el gesto —las
          acciones están al correr la fila— y lo primero no hacía falta: un
          renglón vacío en la columna del estado, en una lista donde cuatro
          filas sí dicen algo, se lee como lo que es. */}
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className="min-w-0 flex-1 truncate text-muted-foreground/70"
          style={{ fontSize: escala.caption }}
        >
          {buzon.usuario
            ? organizacionDe(buzon.usuario)
            : ORGANIZACION_DE_LA_CASA}
        </span>
        {!anda && (
          <span
            className="shrink-0 font-medium"
            style={{ color: estado.tinte, fontSize: escala.caption }}
          >
            {estado.label}
          </span>
        )}
        </span>
        </span>
      </Deslizable>
    </li>
  );
}

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: un
   panel que dice un número y devuelve otro miente sobre lo que va a hacer. */

const opcionesEstado = (filas: Buzon[]): FilterOption[] =>
  ORDEN_ESTADOS_BUZON.map((value) => ({
    value,
    label: ESTADOS_BUZON[value].label,
    icon: punto(ESTADOS_BUZON[value].tinte),
    hint: String(filas.filter((b) => b.estado === value).length),
  }));

/* Los creadores salen de la lista de gente que provisiona y no de los buzones
   que hay: alguien que todavía no dio de alta ninguno igual tiene que poder
   elegirse, aunque sea para ver que no dio de alta ninguno. */
const opcionesCreador = (filas: Buzon[]): FilterOption[] =>
  CREADORES.map((value) => ({
    value,
    label: value,
    hint: String(filas.filter((b) => b.creador === value).length),
  }));

const OPCIONES_ALTA: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: Buzon[]): FilterGroup[] => [
  {
    label: "The mailbox",
    attributes: [
      { id: "name", label: "Name", icon: Contact, type: "text" },
      { id: "address", label: "Email address", icon: AtSign, type: "text" },
      {
        id: "status",
        label: "Status",
        icon: Loader,
        options: opcionesEstado(filas),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      {
        id: "creator",
        label: "Creator",
        icon: UserPen,
        options: opcionesCreador(filas),
      },
      // `single`, como los tramos de Accounts: "este mes o este año" es "este
      // año". Elegir uno reemplaza al anterior.
      {
        id: "created",
        label: "Created at",
        icon: CalendarPlus,
        options: OPCIONES_ALTA,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada buzón para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (b: Buzon) => string[]> = {
  status: (b) => [b.estado],
  creator: (b) => [b.creador],
  created: (b) => [tramoAlta(b.creadoEl)],
};

/** Los atributos de texto: los del panel que no tienen lista, y también contra
 *  qué busca la barra de arriba. Es la misma pregunta escrita dos veces, así que
 *  se contesta en un solo lugar. */
const TEXTOS: Record<string, (b: Buzon) => string[]> = {
  name: (b) => [b.nombre],
  address: (b) => [b.direccion],
};

function pasa(buzon: Buzon, busqueda: string, filtros: FilterSelection) {
  const texto = busqueda.trim();
  /* La barra de arriba busca en las tres columnas que se leen: el nombre, la
     dirección y quién lo creó. El creador tiene su propio atributo en el panel,
     pero "todo lo que dio de alta Irene" es algo que uno escribe antes de
     acordarse de que hay un panel. */
  if (
    texto &&
    !contiene([buzon.nombre, buzon.direccion, buzon.creador], texto)
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    const libre = TEXTOS[id];
    if (libre) return valores.some((v) => contiene(libre(buzon), v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(buzon);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   La dirección se lleva la porción más grande: es lo largo de la fila —un
   `guadalupe.caceres@wabihouse.example` no se abrevia— y es lo que se busca. El
   estado va último, y lo que uno hace con esa columna es barrerla de arriba
   abajo buscando el que no dice "Active".

   Las dos de la derecha no se aprietan más de lo que miden lo que muestran: una
   dirección cortada sigue diciendo de quién es, pero un badge cortado —"Suspende"
   con el borde comiéndose el resto— deja de ser una palabra. El ancho que les
   sobra sale de la dirección y del creador, que sí se pueden truncar. */
const COLUMNAS = [
  { id: "name", ancho: "23%" },
  { id: "address", ancho: "28%" },
  { id: "creator", ancho: "18%" },
  { id: "created", ancho: "15%" },
  { id: "status", ancho: "16%" },
];

function Columnas() {
  return (
    <colgroup>
      {COLUMNAS.map((c) => (
        <col key={c.id} style={{ width: c.ancho }} />
      ))}
    </colgroup>
  );
}

/** Cuántos buzones entran en una página. */
const POR_PAGINA = 40;

export function Provisioning() {
  /* Compacta en escritorio y normal en el teléfono, como las otras tablas: el
     escalón denso existe porque son cuarenta filas peleando por el alto de una
     ventana, y en un teléfono lo que pelea no es el alto sino el dedo. */
  const esMovil = useEsMovil();

  return (
    /* Una región densa entera, como las otras dos tablas: el buscador, el panel
       y la tabla leen el escalón de acá y no lo reciben cada uno por su
       cuenta. */
    <SizeProvider size={esMovil ? "default" : "compact"}>
      <Pantalla />
    </SizeProvider>
  );
}

function Pantalla() {
  const esMovil = useEsMovil();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  /* La lista viva, de la tienda del módulo: los buzones salen de las cuentas
     que existen ahora —dar de baja a alguien se lleva su buzón— y se vuelven a
     pintar cuando alguien cambia un estado desde la celda, sea en esta pestaña
     o en otra copia de esta pantalla. */
  const todos = useBuzones();
  const escala = useTypeScale();
  /* Lo que mide la cabecera, para que el scroller reserve ese alto arriba: la
     cabecera flota encima, así que sin la reserva las primeras filas nacerían
     tapadas. */
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const encontrados = useMemo(
    () => todos.filter((b) => pasa(b, busqueda, filtros)),
    [todos, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

  /* El alta: qué se está por dar de alta en *esta* pestaña. Es estado de la
     vista —como el filtro y la página—, así que vive acá y no en la tienda de
     buzones: dos copias de esta pantalla tienen que poder estar escribiendo
     cosas distintas. */
  const alta = useAltaDeBuzones();

  const openTab = useWorkspace((w) => w.openTab);

  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Las tres decisiones viven en el hook, que es el mismo que usa Email
     Search. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const {
    pagina,
    paginas,
    desde,
    dir,
    ancla,
    irA,
    filas: paginadas,
  } = usePaginacion(encontrados, clave, POR_PAGINA);
  /* Y en el teléfono no hay páginas: la lista se sigue, como en Accounts y en
     Chat Search. Ver `useListaInfinita`. */
  const { filas: seguidas, centinela } = useListaInfinita(encontrados, clave);
  const filas = esMovil ? seguidas : paginadas;

  /* El teclado de la tabla: una sola parada de tabulado —la fila donde
     quedaste— y las flechas adentro. Ver `tabla-teclado`. */
  const teclado = useTecladoDeTabla({
    cuantas: filas.length,
    sangriaSuperior: altoCabecera,
  });

  return (
    /* La pantalla reparte los turnos y sus piezas los toman: el header, la tabla
       y el pie son sus hijos, y las celdas los hijos de la tabla. El estado
       viaja por el contexto de Framer, así que el `ScrollArea` y la `Table` que
       hay en el medio no lo cortan. */
    <motion.div
      variants={cascadaPantalla}
      initial="oculto"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col"
    >
      {/* En el teléfono el header es el buscador, el filtro y el alta: el título
          con su bajada se va —el header del shell ya dice "Email /
          Provisioning"— y esos dos renglones se los queda la tabla.

          El botón del alta se queda sin la palabra solo: lo decide él, que es
          quien sabe cómo se ve —ver `BotonDeAlta`—. Acá se le sigue pasando el
          sustantivo, que allá va al `aria-label`. */}
      {esMovil ? (
        <motion.header
          variants={entraBloque}
          className="flex shrink-0 items-center gap-2 px-4 py-3"
        >
          <InputGroup className="min-w-0 flex-1">
            <InputField
              index={0}
              label="Search mailboxes"
              labelHidden
              icon={Search}
              placeholder="Search mailboxes"
              value={busqueda}
              onChange={setBusqueda}
              className={cn(
                "[&>div:has(>input)]:bg-card [&>div:has(>input)]:ring-border",
                CAMPO_EN_PILDORA,
              )}
            />
          </InputGroup>

          <FilterMenu
            groups={GRUPOS}
            align="end"
            variant="secondary"
            labelHidden
            value={filtros}
            onValueChange={setFiltros}
            className={BOTON_EN_PILDORA}
          />

          <BotonDeAlta onClick={alta.abrir}>Mailbox</BotonDeAlta>
        </motion.header>
      ) : (
      /* El aire lateral es del header, no de la pantalla: así la tabla llega a
          los dos bordes y son sus celdas las que se alinean con él. */
      <motion.header
        variants={entraBloque}
        className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-6 py-4"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: escala.title }}
          >
            Email Provisioning
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Every mailbox the house has issued &mdash; who created it, and where
            it stands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search mailboxes"
              labelHidden
              icon={Search}
              placeholder="Search mailboxes"
              value={busqueda}
              onChange={setBusqueda}
              className="[&>div:has(>input)]:bg-card [&>div:has(>input)]:ring-border"
            />
          </InputGroup>

          <FilterMenu
            groups={GRUPOS}
            align="end"
            variant="secondary"
            value={filtros}
            onValueChange={setFiltros}
          />

          {/* La acción de la pantalla, y la única: dar de alta un buzón es lo
              que "provisioning" quiere decir. Va última, contra el borde: es
              donde este sistema deja la acción, después de los controles que la
              preceden —el resto de la barra busca y filtra, que es mirar—.

              De hielo y no `primary`: es la misma acción que en Announcements,
              DOC Accounts, Policies y Reports —crear lo que la tabla lista— y el
              negro sólido pesa demasiado en una barra que al lado tiene un campo
              y un panel de filtros. El glifo es el `+` y no el sobre de la
              sección: el de la sección ya está a la vista dos veces —la fila del
              sidebar y la pestaña— y lo que el botón tiene que decir es qué
              hace. Con el signo delante, el "New" delante del sustantivo sería
              la misma palabra escrita dos veces.

              Sin `disponible`: esta alta no vive en el riel —el buzón se crea
              desde adentro de la tabla— así que no depende de que haya un board
              donde poner una ficha. */}
          <BotonDeAlta onClick={alta.abrir}>Mailbox</BotonDeAlta>
        </div>
      </motion.header>
      )}

      {/* El renglón donde se escribe, entre el header y la tabla. Va afuera del
          scroller —se lo usa todo el tiempo y con el scroll se iría— y adentro
          de un `AnimatePresence`, que es lo que le da su salida: sin él,
          descartar lo haría desaparecer de un cuadro al otro. */}
      <AnimatePresence initial={false}>
        {alta.abierto && <BarraDeAlta alta={alta} />}
      </AnimatePresence>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <MailX />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No mailboxes</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              Nothing matches what you&rsquo;re looking for. Try fewer letters,
              or drop a filter.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      ) : esMovil ? (
        /* En el teléfono la tabla se deshace en filas apiladas —ver
           `movil/lista`—. De las cinco columnas sobreviven tres: cómo se llama
           el buzón, cuál es la dirección y si anda.

           **Se caen el creador y la fecha de alta.** Son las dos columnas del
           registro y no del buzón: contestan "quién lo dio de alta y cuándo",
           que es una auditoría y no lo que uno viene a mirar acá. Y no
           desaparecen del todo, que es lo que las hace prescindibles en la
           fila: el panel de filtros sigue preguntando por las dos —los buzones
           de un creador, los del último mes— así que la pregunta se puede
           hacer, sólo que no está impresa en las cuarenta y una filas.

           La fila no es un botón: acá no hay adónde llevar. Lo que se toca es
           el nombre —que abre la ficha de la cuenta, cuando el buzón es de
           alguien— y el estado, que abre su menú. Los dos son botones de
           verdad, y por eso la fila no puede serlo: un botón adentro de otro no
           existe. Es lo mismo que pasa en escritorio, donde la fila tampoco
           lleva a ningún lado. */
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade scrollbar-hide"
        >
          {/* Lo que se está por crear, arriba de la primera fila real: ahí es
              donde van a estar cuando existan. */}
          {alta.abierto && <FilasBorrador alta={alta} />}

          <ListaMovil>
            {filas.map((buzon) => (
              <FilaDeBuzon
                key={buzon.direccion}
                buzon={buzon}
                onPerfil={abrirCuenta}
              />
            ))}
          </ListaMovil>

          {/* El final de la lista: cuando se acerca, entra el próximo tramo. */}
          <div ref={centinela} aria-hidden className="h-px" />
        </ScrollArea>
      ) : (
        <motion.div variants={entraTabla} className="relative min-h-0 flex-1">
          {/* Los títulos van afuera del scroller y flotando encima: adentro,
              `scroll-fade` los desvanecería cada vez que hay filas por arriba.
              Las dos tablas se alinean porque comparten `Columnas` y van las dos
              en `table-fixed`. */}
          <div ref={medirCabecera} className="absolute inset-x-0 top-0 z-10">
            <Table
              className={cn("table-fixed", BANDA_TITULOS, SANGRIA, AIRE_TITULOS)}
            >
              <Columnas />
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            {/* La reserva para la cabecera que flota encima. Lleva el ancla: es
                lo que el hook de la paginación usa para encontrar la caja que
                scrollea y subirla cuando cambia de página. */}
            <div ref={ancla} style={{ paddingTop: altoCabecera ?? 0 }} />

            {/* Lo que se está por crear, debajo de los títulos y arriba de la
                primera fila real: ahí es donde van a estar cuando existan. */}
            {alta.abierto && <FilasBorrador alta={alta} />}

            <Table
              {...teclado.tabla}
              className={cn("table-fixed", SANGRIA, AIRE_FILA)}
            >
              <Columnas />
              <TableBody>
                {filas.map((buzon, i) => {
                  const recien = alta.recienCreados.includes(buzon.direccion);

                  return (
                  <FilaAnimada
                    key={buzon.direccion}
                    index={i}
                    /* Sin destello, `initial`/`animate` en el mismo valor: la
                       fila no anima nada y el envoltorio no cuesta nada. */
                    initial={recien ? "encendida" : false}
                    animate={recien ? "apagada" : undefined}
                    variants={DESTELLO}
                    {...teclado.fila(i)}
                  >
                    {/* El nombre. Cuando el buzón es de alguien, es también el
                        disparador de la ficha de esa cuenta —la misma que abre
                        el nombre en Accounts y la dirección en Email Search—:
                        la cuenta es la misma cosa se la mire desde donde se la
                        mire.

                        Los buzones de la casa no son de nadie, así que ahí no
                        hay ficha que abrir y el nombre es texto. No se inventa
                        un residente detrás de `reception@` para que las filas
                        se vean todas iguales: se ven distintas porque no son
                        lo mismo. */}
                    <TableCell className="text-foreground">
                      {/* La caja flex no es decoración: el disparador de la
                          ficha es un `span` —inline—, y a un inline el
                          `max-w-full` que lo recortaría no le aplica. Adentro
                          de un flex se convierte en ítem, y ahí sí se corta en
                          vez de meterse en la columna de al lado. */}
                      <motion.span
                        variants={entraCelda}
                        className="flex w-fit max-w-full min-w-0"
                      >
                        {buzon.usuario ? (
                          <TarjetaUsuario
                            usuario={buzon.usuario}
                            onEstado={cambiarEstado}
                            onPerfil={abrirCuenta}
                          >
                            {buzon.nombre}
                          </TarjetaUsuario>
                        ) : (
                          <span className="min-w-0 truncate">
                            {buzon.nombre}
                          </span>
                        )}
                      </motion.span>
                    </TableCell>

                    {/* La dirección, entera y sin adornos. Es lo que se busca
                        y lo que se pega en la barra de arriba. */}
                    <TableCell className="text-foreground">
                      <motion.span
                        variants={entraCelda}
                        className="block truncate"
                        title={buzon.direccion}
                      >
                        {buzon.direccion}
                      </motion.span>
                    </TableCell>

                    {/* Quién lo dio de alta. En el gris de la fila: es del
                        registro, no del buzón, y compite con el nombre de la
                        izquierda si se lo pinta igual. */}
                    <TableCell>
                      <motion.span
                        variants={entraCelda}
                        className="block truncate"
                      >
                        {buzon.creador}
                      </motion.span>
                    </TableCell>

                    {/* Cuándo, con el día entero y no en relativo. Un alta no
                        se lee como un correo: lo que se pregunta acá no es
                        cuán reciente es —casi ninguno lo es— sino de cuándo
                        data, y "hace 11 meses" no ubica a nadie en un
                        calendario. Es la misma fecha, escrita igual, que la
                        columna Date Added de Accounts. */}
                    <TableCell>
                      <motion.span
                        variants={entraCelda}
                        className="block truncate tabular-nums"
                        /* La fecha entera a un hover, para el panel angosto
                           donde la columna la corta y se lleva el año —que es
                           justo la parte que hace falta—. Es lo mismo que hace
                           la columna de fecha de Email Search. */
                        title={fechaDia(buzon.creadoEl)}
                      >
                        {fechaDia(buzon.creadoEl)}
                      </motion.span>
                    </TableCell>

                    {/* Si anda, y por dónde se lo cambia. Va en badge y con
                        punto —no en texto pelado— porque es la columna que uno
                        barre buscando el que no dice "Active", y el color es lo
                        que la hace barrible. Acá sí se pinta el estado normal:
                        son tres estados y ninguno es el silencio, a diferencia
                        del tipo de un correo. */}
                    <TableCell>
                      <EstadoDelBuzon buzon={buzon} />
                    </TableCell>
                  </FilaAnimada>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántos se está viendo cuáles, y por dónde se pasa a los que
          siguen. Va afuera del scroller y pegado abajo —es del mueble, no de la
          lista—, así que el pager no se va con el scroll.

          Sólo cuando hay resultados, y sólo en escritorio: en el teléfono la
          lista se sigue y no hay páginas por las que pasar. */}
      {!esMovil && filas.length > 0 && (
        <motion.footer
          variants={entraBloque}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3"
        >
          <Rango
            desde={desde + 1}
            hasta={desde + filas.length}
            total={encontrados.length}
            dir={dir}
          />

          <Pagination total={paginas} value={pagina} onValueChange={irA} />
        </motion.footer>
      )}
    </motion.div>
  );
}
