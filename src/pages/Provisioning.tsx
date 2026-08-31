import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AtSign,
  CalendarPlus,
  ChevronDown,
  Contact,
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
import { punto } from "@/components/color-dot";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import { useWorkspace } from "@/components/workspace-context";
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
import { usePaginacion } from "@/hooks/use-paginacion";
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
} from "@/pages/buzones";
import { tabDePerfil } from "@/pages/perfil-tab";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import { TarjetaUsuario } from "@/pages/Users";
import { cambiarEstado, type Usuario } from "@/pages/usuarios";

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

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(buzon: Buzon, busqueda: string, filtros: FilterSelection) {
  const texto = busqueda.trim().toLowerCase();
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
   estado va último y angosto: es un badge de dos palabras, y lo que uno hace con
   esta columna es barrerla de arriba abajo buscando el que no dice "Active". */
const COLUMNAS = [
  { id: "name", ancho: "24%" },
  { id: "address", ancho: "30%" },
  { id: "creator", ancho: "20%" },
  { id: "created", ancho: "13%" },
  { id: "status", ancho: "13%" },
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

/* Las mismas medidas que Accounts y Email Search, por lo mismo: la sangría
   alinea la tabla con el header sin meterle un contenedor con padding, y el aire
   suelta las filas sin sacarlas de la densidad compacta. */
const SANGRIA =
  "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6";

const AIRE_FILA = "[&_td]:py-2";
const AIRE_TITULOS = "[&_th]:py-2.5";

/* La banda de la cabecera, la misma de las otras dos tablas: el violeta lavado
   del sistema, translúcido y con desenfoque detrás, para que se lea como una
   banda apoyada sobre la lista y no como un bloque pintado al lado. */
const BANDA_TITULOS = [
  "bg-[oklch(0.966_0.022_292)]/70",
  "dark:bg-[oklch(0.34_0.03_292)]/70",
  "backdrop-blur-md",
].join(" ");

/** Cuántos buzones entran en una página. */
const POR_PAGINA = 40;

export function Provisioning() {
  return (
    /* Una región densa entera, como las otras dos tablas: el buscador, el panel
       y la tabla leen el escalón de acá y no lo reciben cada uno por su
       cuenta. */
    <SizeProvider size="compact">
      <Pantalla />
    </SizeProvider>
  );
}

function Pantalla() {
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

  const { openTab } = useWorkspace();

  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Las tres decisiones viven en el hook, que es el mismo que usa Email
     Search. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const { pagina, paginas, desde, filas, dir, ancla, irA } = usePaginacion(
    encontrados,
    clave,
    POR_PAGINA,
  );

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
      {/* El aire lateral es del header, no de la pantalla: así la tabla llega a
          los dos bordes y son sus celdas las que se alinean con él. */}
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
        </div>
      </motion.header>

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
            <Table className={cn("table-fixed", SANGRIA, AIRE_FILA)}>
              <Columnas />
              <TableBody>
                {filas.map((buzon, i) => (
                  <TableRow key={buzon.direccion} index={i}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántos se está viendo cuáles, y por dónde se pasa a los que
          siguen. Va afuera del scroller y pegado abajo —es del mueble, no de la
          lista—, así que el pager no se va con el scroll.

          Sólo cuando hay resultados. Un pager sobre una tabla vacía ofrece
          páginas que no existen. */}
      {filas.length > 0 && (
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
