import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { sileo } from "sileo";
import {
  AtSign,
  Building2,
  CalendarPlus,
  Copy,
  Ellipsis,
  IdCard,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  UserRound,
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
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { MenuItem } from "@/components/ui/menu-item";
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
  ESTADOS_DOC,
  ORDEN_ESTADOS_DOC,
  ORDEN_ROLES,
  ORGANIZACIONES,
  ROLES_DOC,
  diaDe,
  dondeTrabaja,
  momentoDe,
  useCuentasDOC,
  type CuentaDOC,
} from "@/pages/cuentas-doc";
import { useAltaDeCuenta } from "@/pages/NuevaCuentaDOC";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de DOC Accounts: quiénes usan esta consola.

   Es el mismo mueble que Policies, Provisioning, Email Search y Email Reports
   —header con la búsqueda y el panel de filtros; la tabla debajo con su cabecera
   flotando sobre el scroller; el pie con el rango y el pager—: son cinco maneras
   de mirar la misma consola, y cambiar de fila del sidebar no debería cambiar de
   mueble.

   Siete columnas, y la séptima no tiene título porque no muestra un dato: es lo
   que se puede hacer con la fila. Es el mismo menú de Policies, y por la misma
   razón —dos acciones sobre la fila entera, no sobre un dato de una celda—.

   Lo que esta tabla tiene y las otras no es que **el nombre no alcanza para
   identificar una fila**: hay dos Rubén Ferrari, dos personas distintas en dos
   organizaciones distintas. Por eso el correo tiene su propia columna en vez de
   ir de renglón chico bajo el nombre, como en Accounts: acá es la identidad, no
   un dato de contacto. */

/* ─────────────────────────── El movimiento ───────────────────────────

   El mismo reparto que las otras tablas, y por la misma razón: abrir esto es una
   reacción —alguien tocó una fila del sidebar— y no hay cascada entre filas, que
   contaría un orden de llegada que no existió. */

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

const FilaAnimada = motion.create(TableRow);

/* El destello: la fila que acaba de existir llega encendida y se apaga sola. Es
   lo que cierra el alta —la ficha se fue, y sin esto hay que buscar con la vista
   cuál de las quince filas es la que uno acaba de crear, que además cae ordenada
   por nombre y no arriba de todo—. Es el mismo violeta lavado con el que esta
   consola marca lo suyo. */
const DESTELLO = {
  encendida: { backgroundColor: "oklch(0.966 0.022 292)" },
  apagada: {
    backgroundColor: "oklch(0.966 0.022 292 / 0)",
    transition: { duration: 1.1, delay: 0.35 },
  },
} as const;

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: un
   panel que dice un número y devuelve otro miente sobre lo que va a hacer. */

/* El conteo y no qué puede hacer cada rol. Lo segundo se probó y no entra: el
   `hint` es la columna angosta de la derecha de la fila —está hecha para un
   número—, y una frase ahí le come el ancho al nombre hasta dejarlo en una
   letra. "Limited Access" pasaba a leerse "L.".

   Así que el panel cuenta, como los otros cuatro de esta consola, y qué
   significa cada rol queda sin contestar en esta pantalla. Es una deuda anotada,
   no una decisión: lo que hace falta es un renglón de ayuda debajo del nombre
   —otra cosa que `filter-menu.tsx` todavía no sabe dibujar— o una columna de
   descripción en una pantalla de roles que no existe. */
const opcionesRol = (filas: CuentaDOC[]): FilterOption[] =>
  ORDEN_ROLES.map((value) => ({
    value,
    label: ROLES_DOC[value].label,
    hint: String(filas.filter((c) => c.rol === value).length),
  }));

const opcionesEstado = (filas: CuentaDOC[]): FilterOption[] =>
  ORDEN_ESTADOS_DOC.map((value) => ({
    value,
    label: ESTADOS_DOC[value].label,
    icon: punto(ESTADOS_DOC[value].tinte),
    hint: String(filas.filter((c) => c.estado === value).length),
  }));

const opcionesOrganizacion = (filas: CuentaDOC[]): FilterOption[] =>
  ORGANIZACIONES.map((value) => ({
    value,
    label: value,
    /* Cuenta todas las cuentas que la tocan, no las que la tienen primera: quien
       filtra por "Transition Center" quiere a todos los que trabajan ahí, y
       Marcela trabaja ahí aunque su fila diga "Facility Base". */
    hint: String(
      filas.filter((c) => c.organizaciones.includes(value)).length,
    ),
  }));

const OPCIONES_FECHA: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: CuentaDOC[]): FilterGroup[] => [
  {
    label: "The person",
    attributes: [
      { id: "name", label: "Name", icon: UserRound, type: "text" },
      { id: "email", label: "Email", icon: AtSign, type: "text" },
    ],
  },
  {
    label: "The access",
    attributes: [
      {
        id: "role",
        label: "Role",
        icon: ShieldCheck,
        options: opcionesRol(filas),
      },
      {
        id: "org",
        label: "Organization",
        icon: Building2,
        options: opcionesOrganizacion(filas),
      },
      {
        id: "status",
        label: "Status",
        icon: KeyRound,
        options: opcionesEstado(filas),
      },
      /* `single`, como los tramos de Accounts, Provisioning, Policies y Email
         Reports: "este mes o este año" es "este año". */
      {
        id: "effective",
        label: "Effective date",
        icon: CalendarPlus,
        options: OPCIONES_FECHA,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada cuenta para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (c: CuentaDOC) => string[]> = {
  role: (c) => [c.rol],
  /* Todas, no la primera: la fila escribe una y el filtro pregunta por
     cualquiera de las que toca. */
  org: (c) => [...c.organizaciones],
  status: (c) => [c.estado],
  effective: (c) => [tramoAlta(diaDe(c.desde))],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(cuenta: CuentaDOC, busqueda: string, filtros: FilterSelection) {
  const texto = busqueda.trim().toLowerCase();
  /* La barra busca en lo que identifica a la fila: el nombre, el correo y dónde
     trabaja. El correo primero en importancia aunque vaya segundo en la tabla:
     con dos personas del mismo nombre, es lo único que separa una fila de la
     otra, y pegar un correo en el buscador es lo que uno hace cuando lo tiene. */
  if (
    texto &&
    !contiene([cuenta.nombre, cuenta.email, ...cuenta.organizaciones], texto)
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    if (id === "name") return valores.some((v) => contiene([cuenta.nombre], v));
    if (id === "email") return valores.some((v) => contiene([cuenta.email], v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(cuenta);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El correo se lleva la porción más grande, más que el nombre: es la columna que
   identifica la fila —hay dos personas con el mismo nombre— y un correo
   recortado a la mitad no identifica a nadie. El nombre, en cambio, se recorta
   sin perder de quién es.

   La de acciones va en píxeles y no en porcentaje: es lo único de la tabla que
   no muestra un dato sino un botón, y un botón mide lo que mide en cualquier
   ancho de ventana. Son los 28 del botón más la sangría del borde. */
const COLUMNAS = [
  { id: "name", ancho: "17%" },
  { id: "email", ancho: "23%" },
  { id: "org", ancho: "21%" },
  { id: "role", ancho: "13%" },
  { id: "effective", ancho: "14%" },
  { id: "status", ancho: "12%" },
  { id: "acciones", ancho: "60px" },
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

/** Cuántas cuentas entran en una página. Las mismas que en el resto de la
 *  consola: es el mismo mueble mirado con otros ojos, y dos largos de página
 *  distintos harían que el pager cambie de significado al cambiar de sección. */
const POR_PAGINA = 40;

/* ─────────────────────────── El menú de la fila ─────────────────────────── */

/**
 * Las dos cosas que se le pueden hacer a una cuenta desde la tabla.
 *
 * Van en un menú y no como dos botones sueltos, igual que en Policies: son
 * acciones sobre la fila entera —no sobre un dato de una celda— y dos íconos por
 * fila en cuarenta filas son una columna de ruido.
 *
 * Lo que **no** está es borrar, y no va a estar: lo que una cuenta hizo sigue
 * firmado con su nombre en las otras tablas —una política, un buzón, un
 * anuncio—, y una fila que desaparece deja esas firmas sin dueño. A una cuenta
 * se le saca el acceso, no se la borra.
 *
 * Sacarle el acceso tampoco es un ítem: es un campo de la cuenta —activa o
 * desactivada—, así que vive adentro de la ficha de edición que abre el ítem de
 * abajo, al lado del rol y de las organizaciones. Un tercer ítem acá sería la
 * misma decisión tomada desde dos lugares.
 */
function AccionesDeCuenta({
  cuenta,
  onEditar,
}: {
  cuenta: CuentaDOC;
  onEditar: (cuenta: CuentaDOC) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button
            variant="ghost"
            size="icon-compact"
            aria-label={`Actions for ${cuenta.email}`}
            className={cn(
              "opacity-0 transition-opacity duration-80",
              "group-[.is-active]/row:opacity-100",
              "aria-expanded:opacity-100 focus-visible:opacity-100",
            )}
          />
        }
      >
        <Ellipsis />
      </DropdownTrigger>

      {/* Ancho propio, como en Policies: los 288px que trae el panel son para un
          menú de navegación, y `w-auto` a secas lo encoge hasta las dos palabras
          que tiene adentro. Un piso de 176px le da el ancho de un menú —acá las
          etiquetas son más largas que las de una política—.

          `align="end"`, porque el botón vive contra el borde derecho de la tabla
          y un menú alineado a la izquierda se saldría. */}
      <DropdownContent side="bottom" align="end" className="w-auto min-w-44">
        <MenuItem
          index={0}
          icon={Copy}
          label="Copy email"
          onSelect={() => {
            /* La escritura al portapapeles puede fallar —el permiso, un
               contexto sin `navigator.clipboard`— y por eso se cuentan las dos
               puntas. Un "copiado" sobre un portapapeles vacío es peor que no
               decir nada: uno se va a pegar algo que no está. */
            navigator.clipboard
              .writeText(cuenta.email)
              .then(() =>
                sileo.success({
                  title: "Email copied",
                  description: cuenta.email,
                }),
              )
              .catch(() =>
                sileo.error({
                  title: "Nothing was copied",
                  description: "The clipboard isn't available here.",
                }),
              );
          }}
        />
        {/* Abre la misma ficha que "+ Account", con la cuenta adentro. No es
            una pantalla parecida: es el mismo formulario con el mismo contenido,
            uno vacío y el otro lleno. */}
        <MenuItem
          index={1}
          icon={Pencil}
          label="Edit account"
          onSelect={() => onEditar(cuenta)}
        />
      </DropdownContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────── La pantalla ─────────────────────────── */

/** `tabId` es el de la pestaña que la monta: la ficha de alta se pone en **su**
 *  board, no en el de la que esté puesta. Las pestañas que no se miran siguen
 *  montadas, y escribir contra "la activa" le pondría la ficha en la cara a
 *  otra. */
export function DocAccounts({ tabId }: { tabId?: string }) {
  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size="compact">
      <Pantalla tabId={tabId} />
    </SizeProvider>
  );
}

function Pantalla({ tabId }: { tabId?: string }) {
  /* El alta vive en el riel y no en un diálogo: dar de alta a alguien es
     justamente cuando hace falta poder mirar las cuentas que ya están. Ver
     `NuevaCuentaDOC`. */
  const alta = useAltaDeCuenta(tabId);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const escala = useTypeScale();
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const todas = useCuentasDOC();

  const encontradas = useMemo(
    () => todas.filter((cuenta) => pasa(cuenta, busqueda, filtros)),
    [todas, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todas), [todas]);

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Es el mismo hook que usan las otras cuatro tablas. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const { pagina, paginas, desde, filas, dir, ancla, irA } = usePaginacion(
    encontradas,
    clave,
    POR_PAGINA,
  );

  return (
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
            DOC Accounts
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Who gets into this console &mdash; and how much of it they get.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search accounts"
              labelHidden
              icon={Search}
              placeholder="Search accounts"
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

          {/* La acción de la pantalla, y la única que crearía algo: el resto de
              la barra busca y filtra, que es mirar. Va última, contra el borde,
              que es donde este sistema deja la acción, y es el mismo botón de
              hielo con el que Announcements crea el suyo.

              Todavía no hace nada: lo que falta es dónde se da de alta una
              cuenta —quién es, con qué rol, en qué organizaciones—, y eso es una
              ficha entera, no un handler. Es la misma que va a abrir el "Edit
              account" del menú de la fila: dar de alta y corregir son el mismo
              formulario con el mismo contenido, uno vacío y el otro lleno. El
              `onClick` se engancha acá cuando exista. */}
          <BotonDeAlta onClick={alta.abrir} disponible={alta.disponible}>
            Account
          </BotonDeAlta>
        </div>
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <IdCard />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No accounts</AnimatedEmptyTitle>
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
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Status</TableHead>
                  {/* Sin rótulo a la vista, pero con nombre para quien la lee de
                      a una celda: una columna anónima en un lector de pantalla
                      es una celda que no se sabe qué contesta. */}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
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
                {filas.map((cuenta, i) => {
                  const estado = ESTADOS_DOC[cuenta.estado];
                  const donde = dondeTrabaja(cuenta);

                  /* Sin destello, `initial`/`animate` en el mismo valor: la
                     fila no anima nada y el envoltorio no cuesta nada. */
                  const tocada = cuenta.id === alta.recienCreada;

                  return (
                    <FilaAnimada
                      key={cuenta.id}
                      index={i}
                      initial={tocada ? "encendida" : false}
                      animate={tocada ? "apagada" : undefined}
                      variants={DESTELLO}
                    >
                      {/* Quién es. En la tinta del texto y con algo de peso: es
                          la primera columna y es por donde se recorre la lista
                          buscando a alguien. */}
                      <TableCell className="font-medium text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={cuenta.nombre}
                        >
                          {cuenta.nombre}
                        </motion.span>
                      </TableCell>

                      {/* Cuál de todas es. Es la identidad de la fila —hay dos
                          personas con el mismo nombre— y por eso tiene columna
                          propia en vez de ir de renglón chico bajo el nombre. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={cuenta.email}
                        >
                          {cuenta.email}
                        </motion.span>
                      </TableCell>

                      {/* Dónde trabaja: la primera y cuántas más. El "+2 more"
                          va en el gris del texto secundario porque no es una
                          organización sino una cuenta de las que faltan, y la
                          lista entera va en el `title` —dos nombres de
                          organización no entran en una celda, y abrir algo para
                          leer dos nombres es dar una vuelta alrededor de la
                          mesa—. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="flex min-w-0 items-baseline gap-1.5"
                          title={cuenta.organizaciones.join(" · ")}
                        >
                          <span className="min-w-0 truncate">
                            {donde.primera}
                          </span>
                          {donde.mas > 0 && (
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              +{donde.mas} more
                            </span>
                          )}
                        </motion.span>
                      </TableCell>

                      {/* Qué puede hacer. Texto y no un badge: el badge de la
                          fila es el estado, y dos pastillas en la misma fila
                          compiten por decir cuál es "la" condición de la
                          cuenta. Qué significa cada rol lo dice el panel de
                          filtros, que es donde uno va a buscar eso. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                        >
                          {ROLES_DOC[cuenta.rol].label}
                        </motion.span>
                      </TableCell>

                      {/* Desde cuándo. Con el día entero y no en relativo: es la
                          misma fecha, escrita igual, que la Date Added de
                          Accounts y la Created on de Policies.

                          La hora, cuando el acceso tiene una, va en el `title` y
                          no en la celda: es una precisión del acceso y no algo
                          que se recorra en una tabla, y puesta acá sería la
                          única columna con dos formatos según quién dio de alta
                          la cuenta. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                          title={momentoDe(cuenta.desde) ?? undefined}
                        >
                          {fechaDia(diaDe(cuenta.desde))}
                        </motion.span>
                      </TableCell>

                      <TableCell>
                        <motion.span variants={entraCelda} className="block">
                          <Badge variant="dot" color={estado.color}>
                            {estado.label}
                          </Badge>
                        </motion.span>
                      </TableCell>

                      {/* Qué se puede hacer con ella. Va a la derecha del todo
                          porque es donde termina la fila: se la lee entera y
                          recién entonces se decide. */}
                      {/* Sin el relleno vertical de las otras celdas —de ahí el
                          `!`, que le gana al `[&_td]:py-2` compartido—: el botón
                          mide 28 y el alto de la fila lo pone la tabla, no esta
                          celda. */}
                      <TableCell className="py-0!">
                        {/* `flex` y no `inline-flex`: un inline abre una caja de
                            línea, y su descendente vuelve a empujar el alto. */}
                        <motion.span
                          variants={entraCelda}
                          className="flex justify-end"
                        >
                          <AccionesDeCuenta
                            cuenta={cuenta}
                            onEditar={alta.editar}
                          />
                        </motion.span>
                      </TableCell>
                    </FilaAnimada>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántas se está viendo cuáles, y por dónde se pasa a las que
          siguen. Va afuera del scroller y pegado abajo —es del mueble, no de la
          lista—, así que el pager no se va con el scroll. */}
      {filas.length > 0 && (
        <motion.footer
          variants={entraBloque}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3"
        >
          <Rango
            desde={desde + 1}
            hasta={desde + filas.length}
            total={encontradas.length}
            dir={dir}
          />

          <Pagination total={paginas} value={pagina} onValueChange={irA} />
        </motion.footer>
      )}
    </motion.div>
  );
}
