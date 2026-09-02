import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { sileo } from "sileo";
import {
  CalendarRange,
  Download,
  FileChartColumn,
  FileText,
  Loader,
  Search,
  Tag,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ESTADOS_DE_REPORTE,
  ORDEN_ESTADOS,
  ORDEN_TIPOS,
  TIPOS_DE_REPORTE,
  archivoDeReporte,
  csvDeReporte,
  sePuedeBajar,
  tramoDePeriodo,
  useReportes,
  type Reporte,
} from "@/pages/reportes";
import { fechaDia } from "@/pages/tiempo";
import { useUsuarios, type Usuario } from "@/pages/usuarios";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de Email Reports: las semanas que la casa ya cerró.

   Es el mismo mueble que Policies, Provisioning y Email Search —header con la
   búsqueda y el panel de filtros; la tabla debajo con su cabecera flotando sobre
   el scroller; el pie con el rango y el pager— porque son cuatro maneras de
   mirar el correo de la misma consola, y cambiar de fila del sidebar no debería
   cambiar de mueble.

   Seis columnas, y la sexta no tiene título porque no muestra un dato: es lo que
   se puede hacer con la fila. Una columna de acciones con un rótulo promete un
   dato que no está. Es la misma decisión que toma Policies con su menú.

   Lo que esta tabla tiene y las otras no es que **sus filas se repiten el
   nombre**: dos reportes de julio se llaman los dos "KC-B July 2026 Report". No
   es un error del fixture —el nombre dice de qué mes es— y es la razón de que la
   columna del período exista: es lo único que distingue una fila de la de
   abajo. */

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

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: un
   panel que dice un número y devuelve otro miente sobre lo que va a hacer. */

const opcionesEstado = (filas: Reporte[]): FilterOption[] =>
  ORDEN_ESTADOS.map((value) => ({
    value,
    label: ESTADOS_DE_REPORTE[value].label,
    icon: punto(ESTADOS_DE_REPORTE[value].tinte),
    hint: String(filas.filter((r) => r.estado === value).length),
  }));

const opcionesTipo = (filas: Reporte[]): FilterOption[] =>
  ORDEN_TIPOS.map((value) => ({
    value,
    label: TIPOS_DE_REPORTE[value].label,
    hint: String(filas.filter((r) => r.tipo === value).length),
  }));

/* Los tramos del período. Escritos como tramos y no como un calendario porque
   el panel de esta consola no tiene uno: lo que hay son atributos de lista y de
   texto —ver `filter-menu.tsx`—, y los mismos cuatro cortes los ofrecen Accounts,
   Provisioning y Policies. Un rango con dos fechas exactas es otro control; ver
   la nota al pie de este archivo. */
const OPCIONES_PERIODO: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: Reporte[]): FilterGroup[] => [
  {
    label: "The report",
    attributes: [
      { id: "name", label: "Report", icon: FileText, type: "text" },
      /* De qué es. Hoy hay un solo tipo, así que elegirlo no saca ninguna fila:
         el atributo está para el día que haya dos, y para que quien mire el
         panel sepa que esa dimensión existe. */
      {
        id: "type",
        label: "Type",
        icon: Tag,
        options: opcionesTipo(filas),
      },
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
      /* `single`, como los tramos de Accounts, Provisioning y Policies: "este
         mes o este año" es "este año". Elegir uno reemplaza al anterior.

         Y uno solo, aunque la fila tenga dos fechas: el período y el alta son el
         mismo hecho —un reporte se arma el día que su ventana cierra—, así que
         dos filtros de fecha serían dos maneras de preguntar lo mismo con la
         posibilidad de contradecirse. Manda la ventana, que es lo que el reporte
         dice cubrir. */
      {
        id: "period",
        label: "Period",
        icon: CalendarRange,
        options: OPCIONES_PERIODO,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada reporte para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (r: Reporte) => string[]> = {
  type: (r) => [r.tipo],
  status: (r) => [r.estado],
  period: (r) => [tramoDePeriodo(r)],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(reporte: Reporte, busqueda: string, filtros: FilterSelection) {
  const texto = busqueda.trim().toLowerCase();
  /* La barra busca en lo que se lee: el nombre, el estado y las dos fechas del
     período **escritas como se ven**. Buscar "Jul 23" es lo que uno escribe
     antes de acordarse de que hay un panel, y contra el día suelto —`2026-07-23`—
     no encontraría nada. */
  if (
    texto &&
    !contiene(
      [
        reporte.nombre,
        TIPOS_DE_REPORTE[reporte.tipo].label,
        ESTADOS_DE_REPORTE[reporte.estado].label,
        fechaDia(reporte.desde),
        fechaDia(reporte.hasta),
      ],
      texto,
    )
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    /* El único atributo de texto del panel es el nombre, y busca contra el
       nombre: es la misma pregunta que la barra pero acotada a una columna. */
    if (id === "name") return valores.some((v) => contiene([reporte.nombre], v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(reporte);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El período se lleva más que el nombre aunque el nombre vaya primero: son dos
   fechas enteras con un guión en el medio —"Jul 23, 2026 – Jul 30, 2026"— y
   apretado eso se parte en dos renglones o se recorta justo en el año, que es la
   parte que lo desambigua. El nombre, en cambio, se repite entre filas y se lee
   de un vistazo.

   La de acciones va en píxeles y no en porcentaje: es lo único de la tabla que
   no muestra un dato sino un botón, y un botón mide lo que mide en cualquier
   ancho de ventana. Son los 28 del botón más la sangría del borde. */
const COLUMNAS = [
  { id: "name", ancho: "26%" },
  { id: "accounts", ancho: "11%" },
  { id: "period", ancho: "28%" },
  { id: "status", ancho: "14%" },
  { id: "created", ancho: "16%" },
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

/**
 * Cuentas — cuántas cubre el reporte.
 *
 * El dígito adentro de una baldosita gris, del alto exacto del badge de Status.
 * Es lo que le da cuerpo: un número solo, alineado a la izquierda de una celda
 * de cien píxeles, deja noventa vacíos —y eso, y no el número, es lo que hacía
 * que la columna se leyera plana entre dos bloques—.
 *
 * La baldosa **no** es un badge, y las dos diferencias son a propósito: el radio
 * es el chico —`rounded-md` contra el `rounded-lg` del badge— y no lleva color
 * nunca. Un badge dice en qué estado está algo; esto dice cuántos son, y las dos
 * cosas viven en la misma fila a dos columnas de distancia.
 *
 * El cero no cambia de forma, sólo se vacía de tinta: la baldosa sigue ahí y el
 * número se apaga. Diez de cada cuarenta semanas no tuvieron altas, y una fila
 * que pierde su baldosa se lee como una fila a la que le falta un dato.
 */
function Cuentas({ reporte }: { reporte: Reporte }) {
  const escala = useTypeScale();
  const cuantas = reporte.cuentas.length;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 tabular-nums",
        cuantas > 0
          ? "bg-muted text-foreground"
          : "bg-muted/50 text-muted-foreground",
      )}
      style={{ fontSize: escala.caption }}
    >
      {cuantas}
    </span>
  );
}

/** Cuántos reportes entran en una página. Los mismos que políticas, buzones y
 *  correos: es el mismo mueble mirado con otros ojos, y dos largos de página
 *  distintos harían que el pager cambie de significado al cambiar de sección. */
const POR_PAGINA = 40;

/* ─────────────────────────── La bajada ─────────────────────────── */

/** Cuánto tarda en prepararse un archivo.
 *
 *  No hay servidor detrás, y sin demora la bajada sería instantánea: se toca el
 *  botón y el archivo ya está. Eso no es lo que va a pasar el día que haya una
 *  API —un reporte de un año son varios megas— y una pantalla diseñada contra
 *  una bajada instantánea no tiene dónde poner lo que pasa mientras. Es la misma
 *  decisión, con el mismo número, que el alta de políticas y la de anuncios. */
const DEMORA_MS = 900;

/**
 * Entregar el archivo.
 *
 * El CSV lo arma el modelo —ver `csvDeReporte`—; lo de acá es lo que el
 * navegador necesita para que eso termine en la carpeta de descargas: un blob,
 * un anchor y la URL revocada después, que si no queda el archivo entero colgado
 * en memoria hasta que se recargue la página.
 *
 * Es una bajada de verdad y no un aviso de que se bajó algo: la fila promete un
 * archivo con lo que dice la fila, y un toast de éxito sobre una carpeta vacía
 * es lo peor que puede hacer una pantalla que se llama Reports.
 */
async function bajar(reporte: Reporte, usuarios: Usuario[]) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  const blob = new Blob([csvDeReporte(reporte, usuarios)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivoDeReporte(reporte);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * BajarReporte — lo único que se puede hacer con una fila.
 *
 * Un botón suelto y no un menú, al revés que en Policies: allá son dos acciones
 * —corregir y sacar— y dos íconos por fila en cuarenta filas son una columna de
 * ruido. Acá es una sola, y esconder una acción única detrás de un menú es
 * pedir dos clics para lo mismo.
 *
 * Aparece con el hover de la fila y se queda mientras se está bajando y con el
 * foco de teclado: si no, tabular hasta acá sería tabular hacia algo invisible.
 *
 * Y no aparece cuando no hay nada que bajar. Un reporte que se está armando
 * todavía no tiene archivo y uno que falló no lo va a tener: el botón
 * deshabilitado diría "esto se puede hacer, pero no ahora", y lo que pasa es que
 * no hay qué bajar. El estado de la fila ya lo explica.
 */
function BajarReporte({ reporte }: { reporte: Reporte }) {
  const usuarios = useUsuarios();
  /* Vive en el botón y no en la pantalla, al revés que el alta de una política:
     bajar un reporte no apaga nada más que este botón, y dos filas se pueden
     estar bajando a la vez. */
  const [bajando, setBajando] = useState(false);

  if (!sePuedeBajar(reporte)) return null;

  const alTocar = async () => {
    if (bajando) return;
    setBajando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está preparando, quedó bajado, no se pudo. Es lo que hace
         `sileo` con `promise`, y es donde va este relato —la fila no tiene lugar
         para contarlo y un cartel adentro de la tabla taparía la lista—. */
      await sileo.promise(bajar(reporte, usuarios), {
        /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
           "Preparing the report…" sale "Preparing The Report…". */
        loading: { title: "Preparing report…" },
        success: () => ({
          title: "Report downloaded",
          /* Qué ventana bajó, que es lo que no dice el nombre del archivo hasta
             abrirlo —y lo que distingue este reporte del otro del mismo mes—. */
          description: `${fechaDia(reporte.desde)} – ${fechaDia(reporte.hasta)}, ${
            reporte.cuentas.length
          } account${reporte.cuentas.length === 1 ? "" : "s"}.`,
        }),
        error: () => ({
          title: "Nothing was downloaded",
          description: "The report couldn't be prepared — try again.",
        }),
      });
    } catch {
      /* El toast ya lo contó. */
    } finally {
      setBajando(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-compact"
      aria-label={`Download ${reporte.nombre}`}
      loading={bajando}
      onClick={alTocar}
      className={cn(
        "opacity-0 transition-opacity duration-80",
        "group-[.is-active]/row:opacity-100",
        bajando && "opacity-100",
        "focus-visible:opacity-100",
      )}
    >
      <Download />
    </Button>
  );
}

/* ─────────────────────────── La pantalla ─────────────────────────── */

export function EmailReports() {
  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size="compact">
      <Pantalla />
    </SizeProvider>
  );
}

function Pantalla() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const escala = useTypeScale();
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const todos = useReportes();

  const encontrados = useMemo(
    () => todos.filter((reporte) => pasa(reporte, busqueda, filtros)),
    [todos, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Es el mismo hook que usan Email Search, Provisioning y Policies. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const { pagina, paginas, desde, filas, dir, ancla, irA } = usePaginacion(
    encontrados,
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
            Email Reports
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Every week the house closed &mdash; and the accounts it opened in it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search reports"
              labelHidden
              icon={Search}
              placeholder="Search reports"
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

          {/* Sin acción propia, a diferencia de Policies: un reporte no se
              escribe, se cierra solo cuando la semana termina. Un botón que
              dijera "New report" prometería elegir una ventana, y las ventanas
              no se eligen. */}
        </div>
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <FileChartColumn />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No reports</AnimatedEmptyTitle>
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
                  <TableHead>Report</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Period covered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {/* Sin rótulo a la vista, pero con nombre para quien la lee
                      de a una celda: una columna anónima en un lector de
                      pantalla es una celda que no se sabe qué contesta. */}
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
                {filas.map((reporte, i) => {
                  const estado = ESTADOS_DE_REPORTE[reporte.estado];

                  return (
                    <TableRow key={reporte.id} index={i}>
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={reporte.nombre}
                        >
                          {reporte.nombre}
                        </motion.span>
                      </TableCell>

                      {/* Cuántas cuentas cubre. El número y nada más: la columna
                          contesta "¿esta semana tuvo altas?" —que es lo que se
                          recorre— y quiénes fueron está en el archivo, que es
                          para lo que está el botón del final. */}
                      <TableCell>
                        <motion.span variants={entraCelda} className="block">
                          <Cuentas reporte={reporte} />
                        </motion.span>
                      </TableCell>

                      {/* Qué semana cubre. Las dos fechas enteras con año: es lo
                          único que distingue esta fila de la de abajo, que se
                          llama igual, así que acá no se abrevia nada. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                        >
                          {fechaDia(reporte.desde)} &ndash;{" "}
                          {fechaDia(reporte.hasta)}
                        </motion.span>
                      </TableCell>

                      {/* `variant="dot"`, el mismo de la Communication Status
                          de Accounts Search: el contorno y el punto de color, y
                          no una pastilla pintada. Son dos tablas de la misma
                          consola diciendo en qué anda algo, y dos maneras de
                          escribir un estado se leen como dos clases de dato. El
                          color queda donde importa —el punto— y la etiqueta va
                          en la tinta del texto, que es lo que la deja legible
                          también cuando el estado es el rojo de "Failed". */}
                      <TableCell>
                        <motion.span variants={entraCelda} className="block">
                          <Badge variant="dot" color={estado.color}>
                            {estado.label}
                          </Badge>
                        </motion.span>
                      </TableCell>

                      {/* Cuándo se armó, con el día entero y no en relativo: es
                          la misma fecha, escrita igual, que la Date Added de
                          Accounts y la Created on de Policies. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                        >
                          {fechaDia(reporte.creadoEl)}
                        </motion.span>
                      </TableCell>

                      {/* Qué se puede hacer con él. Va a la derecha del todo
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
                          <BajarReporte reporte={reporte} />
                        </motion.span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántos se está viendo cuáles, y por dónde se pasa a los que
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
            total={encontrados.length}
            dir={dir}
          />

          <Pagination total={paginas} value={pagina} onValueChange={irA} />
        </motion.footer>
      )}
    </motion.div>
  );
}

/* ─────────────────────────── Lo que falta ───────────────────────────

   El período se pregunta por tramos —"los últimos 30 días"— y no eligiendo dos
   fechas en un calendario. No es una simplificación de esta pantalla: el panel
   de filtros de esta consola sabe hacer dos cosas, elegir de una lista y escribir
   texto, y un rango de fechas es una tercera. Ponerlo acá es agregarle una clase
   de atributo a `filter-menu.tsx`, que lo comparten cuatro pantallas, y un
   calendario, que esta app todavía no tiene.

   Los cuatro tramos son los mismos que ofrecen Accounts, Provisioning y Policies,
   así que mientras tanto la pregunta se hace igual en todas. */
