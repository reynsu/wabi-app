import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { sileo } from "sileo";
import {
  CalendarClock,
  Download,
  FileText,
  Loader,
  Search,
  Tag,
  UserPen,
} from "lucide-react";

import { BotonDeAlta } from "@/components/boton-de-alta";
import { FilaDestellante } from "@/components/fila-destellante";
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
import { descargar } from "@/lib/descargar";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { useCuentasDOC, type CuentaDOC } from "@/pages/cuentas-doc";
import { useAltaDeReporte } from "@/pages/NuevoReporte";
import {
  ESTADOS_DE_REPORTE,
  ORDEN_ESTADOS,
  ORDEN_TIPOS_DOC,
  TIPOS_DE_REPORTE_DOC,
  archivoDeReporteDOC,
  csvDeReporteDOC,
  quienPidio,
  sePuedeBajar,
  tramoDePedido,
  useReportesDOC,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { fechaLarga, haceCuanto } from "@/pages/tiempo";
import { useUsuarios, type Usuario } from "@/pages/usuarios";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de Admin › Reports: lo que se le pidió a esta consola.

   Es el mismo mueble que Policies, DOC Accounts, Provisioning, Email Search y
   Email Reports —header con la búsqueda y el panel de filtros; la tabla debajo
   con su cabecera flotando sobre el scroller; el pie con el rango y el pager—:
   son seis maneras de mirar la misma consola, y cambiar de fila del sidebar no
   debería cambiar de mueble.

   Cinco columnas, y la quinta no tiene título porque no muestra un dato: es lo
   que se puede hacer con la fila. Una columna de acciones con un rótulo promete
   un dato que no está. Es la misma decisión que toman Policies y Email Reports.

   Lo que separa esta tabla de la de Email › Reports —que a primera vista es la
   misma— es de dónde viene la fila. Allá el reporte es una semana que cerró
   sola, así que la tabla se ordena por la ventana que cubre y no hay a quién
   preguntarle por qué existe. Acá cada fila es alguien que entró y pidió algo:
   la tabla se ordena por el pedido, el tipo tiene columna propia —porque es lo
   que se eligió al pedir— y quién lo pidió es una pregunta que el panel sabe
   hacer.

   Y no hay columna de período: un reporte pedido no cubre una ventana, es una
   foto de la casa al momento de pedirla. Una columna que dijera lo mismo que la
   del pedido sería un ancho gastado en repetir. */

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

/* El tipo es lo primero que se pregunta acá, al revés que en Email › Reports:
   allá hay un solo tipo y el atributo está para el día que haya dos; acá los
   tres son lo que se pidió, y "mostrame los de IDs" es la pregunta con la que
   uno abre el panel. Va con el punto de color del tipo, como los estados: el
   panel distingue un valor por el color con el que ese valor ya se distingue. */
const opcionesTipo = (filas: ReporteDOC[]): FilterOption[] =>
  ORDEN_TIPOS_DOC.map((value) => ({
    value,
    label: TIPOS_DE_REPORTE_DOC[value].label,
    icon: punto(TIPOS_DE_REPORTE_DOC[value].tinte),
    hint: String(filas.filter((r) => r.tipo === value).length),
  }));

const opcionesEstado = (filas: ReporteDOC[]): FilterOption[] =>
  ORDEN_ESTADOS.map((value) => ({
    value,
    label: ESTADOS_DE_REPORTE[value].label,
    icon: punto(ESTADOS_DE_REPORTE[value].tinte),
    hint: String(filas.filter((r) => r.estado === value).length),
  }));

/* Quién pidió. Las opciones salen de los pedidos que hay y no del padrón de
   cuentas DOC: la tabla tiene quince cuentas y sólo siete pidieron algo, y ocho
   opciones que devuelven cero son ocho maneras de vaciar la tabla sin querer.

   Ordenadas por cuántos pidió cada uno: la lista de arriba a abajo dice quién
   usa esto, que es la mitad de la pregunta que uno viene a hacer al panel. */
const opcionesQuien = (
  filas: ReporteDOC[],
  cuentas: CuentaDOC[],
): FilterOption[] => {
  const cuantos = new Map<string, number>();
  for (const r of filas) {
    cuantos.set(r.pedidoPor, (cuantos.get(r.pedidoPor) ?? 0) + 1);
  }

  return [...cuantos.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([value, cuantas]) => ({
      value,
      label: quienPidio(value, cuentas),
      hint: String(cuantas),
    }));
};

/* Los tramos del pedido. Los mismos cuatro cortes que ofrecen Accounts,
   Provisioning, Policies y Email › Reports: es la misma pregunta hecha en cinco
   pantallas, y un corte distinto en una sola las volvería incomparables. */
const OPCIONES_PEDIDO: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: ReporteDOC[], cuentas: CuentaDOC[]): FilterGroup[] => [
  {
    label: "The report",
    attributes: [
      { id: "name", label: "Name", icon: FileText, type: "text" },
      { id: "type", label: "Type", icon: Tag, options: opcionesTipo(filas) },
      {
        id: "status",
        label: "Status",
        icon: Loader,
        options: opcionesEstado(filas),
      },
    ],
  },
  {
    label: "The request",
    attributes: [
      /* Quién lo pidió no tiene columna: lo que se recorre con la vista es qué
         se pidió y en qué anda, y una sexta columna con quince nombres repetidos
         le sacaría ancho al nombre, que es lo que se lee. La pregunta existe
         igual —es del panel— y la respuesta está en la celda del pedido, que la
         dice cuando se la señala. Es lo mismo que hace Policies con el creador
         de una regla. */
      {
        id: "requester",
        label: "Requested by",
        icon: UserPen,
        options: opcionesQuien(filas, cuentas),
      },
      /* `single`, como los tramos de las otras cuatro tablas: "este mes o este
         año" es "este año". Elegir uno reemplaza al anterior. */
      {
        id: "requested",
        label: "Requested",
        icon: CalendarClock,
        options: OPCIONES_PEDIDO,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada reporte para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (r: ReporteDOC) => string[]> = {
  type: (r) => [r.tipo],
  status: (r) => [r.estado],
  requester: (r) => [r.pedidoPor],
  requested: (r) => [tramoDePedido(r)],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(
  reporte: ReporteDOC,
  quien: string,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim().toLowerCase();
  /* La barra busca en lo que se lee, más quién lo pidió: "todo lo que pidió
     Sabrina" es algo que uno escribe antes de acordarse de que hay un panel, y
     es la única de las cuatro cosas que no tiene columna. El nombre ya trae el
     tipo y el día, así que buscar "Blocked" o "06/25" cae ahí. */
  if (
    texto &&
    !contiene(
      [reporte.nombre, ESTADOS_DE_REPORTE[reporte.estado].label, quien],
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

   El nombre se lleva la porción más grande: es el tipo y el día juntos —"Blocked
   Communication Report — 09/05/2026"— y es lo que se lee y lo que se busca.

   El tipo va detrás y repite la cabeza del nombre. No es de más: el nombre es
   cómo se llama el archivo cuando cae en la carpeta, y el tipo es la dimensión
   por la que esta tabla se agrupa —lo que el panel pregunta y lo que decide qué
   columnas trae el archivo—. Uno se lee de corrido; el otro se recorre con la
   vista.

   El estado se lleva más ancho del que su badge necesita, y el pedido menos del
   que le sobraba. Es a propósito: el badge no llena su columna —termina donde
   termina la palabra— así que el ancho que le sigue es el aire que separa la
   pastilla de "2 mo ago". Con la columna justa, las dos quedaban pegadas y se
   leían como una sola cosa —"Completed 2 mo ago"— en vez de como dos datos, que
   es lo que son: en qué anda, y de cuándo es. El pedido paga ese aire sin
   sentirlo: "10 mo ago" es lo más largo que escribe.

   La de acciones va en píxeles y no en porcentaje: es lo único de la tabla que
   no muestra un dato sino un botón, y un botón mide lo que mide en cualquier
   ancho de ventana. Son los 28 del botón más la sangría del borde. */
const COLUMNAS = [
  { id: "name", ancho: "38%" },
  { id: "type", ancho: "26%" },
  { id: "status", ancho: "21%" },
  { id: "requested", ancho: "15%" },
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

/** Cuántos reportes entran en una página. Los mismos que políticas, cuentas,
 *  buzones y correos: es el mismo mueble mirado con otros ojos, y dos largos de
 *  página distintos harían que el pager cambie de significado al cambiar de
 *  sección. */
const POR_PAGINA = 40;

/* ─────────────────────────── La bajada ─────────────────────────── */

/** Cuánto tarda en prepararse un archivo.
 *
 *  No hay servidor detrás, y sin demora la bajada sería instantánea: se toca el
 *  botón y el archivo ya está. Eso no es lo que va a pasar el día que haya una
 *  API, y una pantalla diseñada contra una bajada instantánea no tiene dónde
 *  poner lo que pasa mientras. Es la misma decisión, con el mismo número, que la
 *  bajada de Email › Reports y las altas de políticas, buzones y cuentas. */
const DEMORA_MS = 900;

async function bajar(
  reporte: ReporteDOC,
  usuarios: Usuario[],
  cuentas: CuentaDOC[],
) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  descargar(
    archivoDeReporteDOC(reporte),
    csvDeReporteDOC(reporte, usuarios, cuentas),
  );
}

/**
 * BajarReporte — lo único que se puede hacer con una fila.
 *
 * Un botón suelto y no un menú, igual que en Email › Reports y al revés que en
 * Policies: allá son dos acciones —corregir y sacar— y esconder una sola detrás
 * de un menú es pedir dos clics para lo mismo. Un reporte pedido no se corrige:
 * lo que se pidió, se pidió.
 *
 * Aparece con el hover de la fila y se queda mientras se está bajando y con el
 * foco de teclado: si no, tabular hasta acá sería tabular hacia algo invisible.
 *
 * Y no aparece cuando no hay nada que bajar. Un reporte que está en la cola
 * todavía no tiene archivo y uno que falló no lo va a tener: el botón
 * deshabilitado diría "esto se puede hacer, pero no ahora", y lo que pasa es que
 * no hay qué bajar. El estado de la fila ya lo explica.
 */
function BajarReporte({ reporte }: { reporte: ReporteDOC }) {
  const usuarios = useUsuarios();
  const cuentas = useCuentasDOC();
  /* Vive en el botón y no en la pantalla: bajar un reporte no apaga nada más
     que este botón, y dos filas se pueden estar bajando a la vez. */
  const [bajando, setBajando] = useState(false);

  if (!sePuedeBajar(reporte)) return null;

  const alTocar = async () => {
    if (bajando) return;
    setBajando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está preparando, quedó bajado, no se pudo. Es donde va este
         relato —la fila no tiene lugar para contarlo y un cartel adentro de la
         tabla taparía la lista—. */
      await sileo.promise(bajar(reporte, usuarios, cuentas), {
        /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
           "Preparing the report…" sale "Preparing The Report…". */
        loading: { title: "Preparing report…" },
        success: () => ({
          title: "Report downloaded",
          /* Qué trae, que es lo que el nombre del archivo no dice hasta
             abrirlo. Sale del tipo, que es lo que decide sus columnas. */
          description: TIPOS_DE_REPORTE_DOC[reporte.tipo].ayuda,
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

/** `tabId` es el de la pestaña que la monta: la ficha del pedido se pone en
 *  **su** board, no en el de la que esté puesta. Las pestañas que no se miran
 *  siguen montadas, y escribir contra "la activa" le pondría la ficha en la cara
 *  a otra. */
export function AdminReports({ tabId }: { tabId?: string }) {
  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size="compact">
      <Pantalla tabId={tabId} />
    </SizeProvider>
  );
}

function Pantalla({ tabId }: { tabId?: string }) {
  /* El pedido vive en el riel y no en un diálogo: elegir qué pedir es
     justamente cuando hace falta poder mirar los que ya están. Ver
     `NuevoReporte`. */
  const alta = useAltaDeReporte(tabId);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const escala = useTypeScale();
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const todos = useReportesDOC();
  const cuentas = useCuentasDOC();

  /* Quién pidió cada uno se resuelve una vez por fila y se usa tres veces —la
     búsqueda, el `title` de la celda y el panel—: resolverlo adentro de cada uso
     sería recorrer la tabla de cuentas tres veces por fila. Es lo mismo que hace
     Policies con el alcance de una regla. */
  const conQuien = useMemo(
    () =>
      todos.map((reporte) => ({
        reporte,
        quien: quienPidio(reporte.pedidoPor, cuentas),
      })),
    [todos, cuentas],
  );

  const encontrados = useMemo(
    () =>
      conQuien.filter(({ reporte, quien }) =>
        pasa(reporte, quien, busqueda, filtros),
      ),
    [conQuien, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos, cuentas), [todos, cuentas]);

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Es el mismo hook que usan las otras cinco tablas. */
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
            Reports
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            What this console was asked for &mdash; and who asked for it.
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

          {/* La acción de la pantalla, y la única que crea algo: el resto de la
              barra busca y filtra, que es mirar. Va última, contra el borde, que
              es donde este sistema deja la acción.

              Existe acá y no en Email › Reports porque allá un reporte se cierra
              solo cuando la semana termina, y un botón prometería elegir una
              ventana que nadie elige. Un reporte de esta tabla **se pide**: eso
              es lo que separa las dos pantallas, y el botón es dónde se ve.

              De hielo y no `primary`, como el de Announcements y el de DOC
              Accounts: es la misma acción —crear lo que la tabla lista— y el
              negro sólido pesa demasiado en una barra que al lado tiene un campo
              y un panel de filtros. El sustantivo va sin el "New": el `+` ya lo
              dice. */}
          <BotonDeAlta onClick={alta.abrir} disponible={alta.disponible}>
            Report
          </BotonDeAlta>
        </div>
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <FileText />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
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
                {filas.map(({ reporte, quien }, i) => {
                  const estado = ESTADOS_DE_REPORTE[reporte.estado];
                  const tipo = TIPOS_DE_REPORTE_DOC[reporte.tipo];
                  const tocada = reporte.id === alta.recienPedido;

                  return (
                    <FilaDestellante
                      key={reporte.id}
                      index={i}
                      destella={tocada}
                    >
                      {/* Cómo se llama: el tipo y el día del pedido. Es lo que
                          va a decir el archivo cuando esté bajado, y por eso es
                          la primera columna y la más ancha. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={reporte.nombre}
                        >
                          {reporte.nombre}
                        </motion.span>
                      </TableCell>

                      {/* De qué es. Texto y no un badge: el badge de la fila es
                          el del estado, y dos pastillas a dos columnas de
                          distancia se leen como dos estados. Lo que el tipo
                          aporta es por dónde se agrupa la tabla, y para eso
                          alcanza con la palabra. El `title` trae qué contiene,
                          que es lo que no entra en la celda. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={tipo.ayuda}
                        >
                          {tipo.label}
                        </motion.span>
                      </TableCell>

                      {/* `variant="dot"`, el mismo de Email › Reports y de la
                          Communication Status de Accounts: el contorno y el
                          punto de color, y no una pastilla pintada. Son tablas
                          de la misma consola diciendo en qué anda algo, y dos
                          maneras de escribir un estado se leen como dos clases
                          de dato. */}
                      <TableCell>
                        <motion.span variants={entraCelda} className="block">
                          <Badge variant="dot" color={estado.color}>
                            {estado.label}
                          </Badge>
                        </motion.span>
                      </TableCell>

                      {/* Cuándo se lo pidió, en relativo y no con la fecha: el
                          día exacto ya está en el nombre, dos columnas a la
                          izquierda, y repetirlo sería escribir "06/25/2026" dos
                          veces en la misma fila. Lo que le falta al nombre es
                          cuán reciente es, que es justamente lo que esto dice.

                          El `title` trae el momento entero y quién lo pidió:
                          quién no tiene columna —lo pregunta el panel— pero la
                          fila tiene que poder contestarlo cuando se la señala.
                          Es lo mismo que hace Policies con el creador. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                          title={`${fechaLarga(reporte.pedidoEl)} · ${quien}`}
                        >
                          {haceCuanto(reporte.pedidoEl)}
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
                    </FilaDestellante>
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

   **La cola no avanza.** Lo que se pide nace `pending` y se queda ahí: no hay
   nada que lo pase a `processing` y de ahí a `completed`, así que la fila recién
   pedida nunca llega a tener botón de bajar. Es correcto —eso es lo que pasa
   cuando no hay servidor— pero deja el recorrido a medias: se ve entrar el
   pedido y no se ve salir el archivo.

   Fingirlo con un `setTimeout` que lo dé por terminado a los cinco segundos
   sería inventar una cola que no existe, y una pantalla que miente sobre cuánto
   tarda algo es peor que una que no lo cuenta. Cuando haya una API, esto lo
   contesta ella.

   **Pedir sobre algo.** Hoy un pedido es sólo un tipo: la foto es de la casa
   entera y al momento de pedirla. Acotarlo —una ventana, un puñado de cuentas—
   es agregarle campos a la ficha y una columna a esta tabla, y hasta que la casa
   lo pida no se inventan. */
