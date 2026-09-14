import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CircleAlert,
  Clock,
  Download,
  FileText,
  Loader,
  LoaderCircle,
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
import { useEsMovil } from "@/hooks/use-es-movil";
import { useListaInfinita } from "@/hooks/use-lista-infinita";
import { usePaginacion } from "@/hooks/use-paginacion";
import { BOTON_EN_PILDORA, CAMPO_EN_PILDORA } from "@/movil/buscador";
import { Deslizable, type AccionDeslizable } from "@/movil/deslizable";
import { ListaMovil } from "@/movil/lista";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { useSurface } from "@/lib/surface-context";
import { SURFACE_BG } from "@/lib/surface-classes";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { contiene } from "@/pages/texto";
import { useCuentasDOC, type CuentaDOC } from "@/pages/cuentas-doc";
import { GLIFOS, claseDeArchivo } from "@/lib/archivos";
import { useBajadaDOC } from "@/pages/bajar-reporte-doc";
import { useWorkspace } from "@/stores/workspace";
import { tabDeReporteDOC } from "@/pages/reporte-doc-tab";
import { useAltaDeReporte } from "@/pages/NuevoReporte";
import {
  ESTADOS_DE_REPORTE,
  ORDEN_ESTADOS,
  ORDEN_TIPOS_DOC,
  TIPOS_DE_REPORTE_DOC,
  quienPidio,
  archivoDeReporteDOC,
  tipoCortoDOC,
  sePuedeBajar,
  tramoDePedido,
  useReportesDOC,
  type EstadoDeReporte,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { fechaLarga, haceCuanto, hora } from "@/pages/tiempo";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";
import { useTecladoDeTabla } from "@/pages/tabla-teclado";

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

function pasa(
  reporte: ReporteDOC,
  quien: string,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim();
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
  /* El nombre se lleva cuatro puntos más desde que la celda lleva el glifo del
     archivo adelante: con los mismos treinta y ocho, los nombres largos
     —"Communication Volume Report — 08/26/2026"— pasaban a cortarse.
     
     Los cuatro salen del estado y no del tipo. Se probaron las dos: sacándoselos
     al tipo, once de veinticinco filas pasaban a mostrar "Communication Volume
     R…", y aunque la frase entera está en el nombre de al lado, once celdas
     cortadas se leen como una columna que no entra. El estado, en cambio, lleva
     una pastilla de una palabra —la más larga es "Processing"— y le sobraba
     lugar. */
  { id: "name", ancho: "42%" },
  { id: "type", ancho: "26%" },
  { id: "status", ancho: "17%" },
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

/** De qué clase es el archivo de un pedido, en un glifo. El de la tabla; el del
 *  teléfono es más grande y lleva el estado colgado —ver `MiniaturaDelReporte`—.
 *
 *  El hueco se reserva aunque no haya glifo: lo que no está listo no tiene
 *  archivo, y sin la reserva los nombres de esas filas arrancarían veinte
 *  píxeles a la izquierda de los otros. */
function GlifoDelArchivo({ reporte }: { reporte: ReporteDOC }) {
  const Glifo = GLIFOS[claseDeArchivo(archivoDeReporteDOC(reporte))];

  return (
    <span className="flex w-4 shrink-0 justify-center">
      {sePuedeBajar(reporte) && (
        <Glifo
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className="text-muted-foreground"
        />
      )}
    </span>
  );
}

function BajarReporte({ reporte }: { reporte: ReporteDOC }) {
  const { bajando, alTocar } = useBajadaDOC(reporte);

  if (!sePuedeBajar(reporte)) return null;

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

/** En qué anda un pedido, en un ícono.
 *
 *  Es para el teléfono, donde el estado no tiene lugar para una pastilla: la
 *  fila lo dijo primero con un punto de color, y un punto sólo distingue tres
 *  estados de quien se sepa el código. El ícono lo dice sin el código —un reloj
 *  espera, una rueda gira, un signo se cayó— y sigue ocupando lo mismo.
 *
 *  **Terminado no tiene ícono.** Veintidós de veinticinco lo están, así que un
 *  ícono ahí es el mismo dibujo veintidós veces; y lo que dice que un reporte
 *  salió ya está en la fila, que es el glifo de su archivo.
 *
 *  El mapa es exhaustivo a propósito —`completed` va con su `null` escrito—:
 *  el día que la cola tenga un quinto estado, esto no compila hasta que alguien
 *  diga con qué se dibuja. Es lo mismo que hace `sePuedeBajar` con la pregunta
 *  de si hay archivo. */
const GLIFOS_DE_ESTADO: Record<EstadoDeReporte, typeof Clock | null> = {
  pending: Clock,
  processing: LoaderCircle,
  completed: null,
  failed: CircleAlert,
};

/** La miniatura de un pedido, en el teléfono: el glifo de su archivo del alto
 *  de los dos renglones, con el estado colgado de la esquina.
 *
 *  Es la misma pieza que la baldosa de Email › Reports —`BaldosaDeArchivo`—, y
 *  por la misma razón: un archivo se reconoce por su forma antes que por su
 *  nombre, y el estado es algo que le pasa *a él*, no otra columna de la fila.
 *  Colgado de la esquina se lee como una insignia sobre el archivo; suelto al
 *  final del renglón se leía como un dato más de la lista.
 *
 *  **El glifo está siempre**, también en los tres que todavía no tienen
 *  archivo: dice de qué clase va a ser —la planilla con su grilla, el documento
 *  con sus líneas— y eso ya está decidido cuando se pide, no cuando termina.
 *  Quién dice si existe es la insignia, que es justamente lo que aparece nada
 *  más que ahí. Lo mismo hace la baldosa de la otra pantalla.
 *
 *  **Los veinticinco van del mismo gris.** Estuvo tintado con el color del
 *  tipo, que en una lista sin columna de tipo parecía gratis: no lo era. El
 *  color es lo que acá dice el estado —y sólo lo dice en tres filas—, así que
 *  veinticinco glifos de colores lo volvían un adorno y la insignia dejaba de
 *  saltar. De qué es cada reporte ya está escrito al lado, con todas las
 *  letras. Gris también en la baldosa de la otra pantalla, y por lo mismo.
 *
 *  El disco de atrás de la insignia es el color de la superficie en la que está
 *  apoyada la fila, leído del contexto: es lo que la despega de las líneas del
 *  glifo sin tener que adivinar sobre qué está puesta la lista. */
const GLIFO_MOVIL = 34;

function MiniaturaDelReporte({ reporte }: { reporte: ReporteDOC }) {
  const nivel = useSurface();
  const estado = ESTADOS_DE_REPORTE[reporte.estado];
  const Glifo = GLIFOS[claseDeArchivo(archivoDeReporteDOC(reporte))];
  const Insignia = GLIFOS_DE_ESTADO[reporte.estado];

  return (
    <span className="relative flex shrink-0 self-center">
      <Glifo
        size={GLIFO_MOVIL}
        strokeWidth={1}
        aria-hidden
        className="text-muted-foreground"
      />
      {Insignia && (
        <>
          {/* La palabra, para quien no ve el ícono ni su color. */}
          <span className="sr-only">{estado.label}</span>
          <span
            className={cn(
              "absolute -right-1 -bottom-0.5 flex rounded-full p-0.5",
              SURFACE_BG[nivel],
            )}
          >
            <Insignia
              size={13}
              strokeWidth={2}
              aria-hidden
              className={cn(
                /* Lo que se está armando gira, y despacio: es el único
                   movimiento perpetuo de la lista. `motion-safe` lo apaga solo
                   para quien pidió menos movimiento. */
                reporte.estado === "processing" &&
                  "motion-safe:animate-spin [animation-duration:1.8s]",
              )}
              style={{ color: estado.tinte }}
            />
          </span>
        </>
      )}
    </span>
  );
}

/* ─────────────────────── La fila del teléfono ───────────────────────

   Cinco columnas no entran en 375px: al nombre le tocaban 122 y quedaba en
   "User ID R…", y la pastilla del estado se dibujaba encima de la fecha. La
   fila se apila en dos renglones:

     ┌──┐  User ID                                          4 d ago
     │📄│  Sabrina Toledo                                 10:52 AM
     └──┘

     ┌──┐  Communication Volume                            2 d ago
     │📄│  Marcela Vidal                                    9:12 AM
     └─⟳┘

   **De las cinco columnas sobrevive el tipo**, y no el nombre. El nombre de un
   reporte es su tipo y el día en que se pidió —"User ID Report — 08/26/2026"—,
   y eso existe porque el nombre es cómo se llama **el archivo** cuando cae en
   la carpeta de descargas, donde no hay columnas alrededor. Acá sí las hay: el
   día lo dice "hace cuánto" —que es lo que se pregunta de un pedido— y la
   palabra "Report" la dice el header de la pantalla. Lo que queda es de qué es.

   **El estado no tiene palabra, tiene un ícono colgado del archivo**, y sólo
   los que no están terminados. Veintidós de veinticinco lo están, así que la
   pastilla decía "Completed" veintidós veces y las tres filas que sí tienen
   algo que contar se perdían entre ellas. Ver `MiniaturaDelReporte`.

   **Y debajo, quién lo pidió y a qué hora.** Quién en la tabla vive en el
   `title` de la fecha —a un hover de distancia— y acá no hay hover: es lo que
   esta pantalla promete en su propia bajada, "y quién lo pidió", así que no
   puede quedar sólo en el panel de filtros. Va sangrado bajo el nombre y no
   bajo el glifo: es su pie, no otra columna.

   La hora está porque sin ella hay ocho filas idénticas: Sabrina Toledo pidió
   el padrón ocho veces en cuatro días de junio, y "User ID · Sabrina Toledo ·
   2 mo ago" las describe a las ocho. Es lo mismo que en la tabla hace la
   columna del pedido, que por eso lleva hora. Va apagada un escalón: sirve
   cuando dos filas se parecen, y ése no es el caso corriente.

   Se probaron tres formas más contra ésta —ver `prototipo/fila-reporte`—: la
   de hoy con menos pastillas, una agrupada por día —siete encabezados para las
   siete primeras filas— y una con el botón de bajar dibujado en cada fila, que
   gasta 44px y le corta el nombre a todas.

   Lo que se toca: **las veinticinco filas abren**, también las tres que
   todavía no tienen archivo. Ésas abren la pestaña con el motivo adentro —en
   qué anda el pedido y de cuándo es— en vez de un archivo: ver `EnQueAnda`, en
   `VistaDeReporteDOC`. Tocar y encontrar la razón cuesta menos que descubrir
   que una fila no responde, que es lo que pasaba antes; y son justo las tres
   filas sobre las que uno tiene una pregunta.

   Bajar, en cambio, sigue siendo sólo de las terminadas: correr una que no lo
   está no muestra nada, que es lo que `Deslizable` hace con una lista de
   acciones vacía. No hay archivo, y un botón que prometa traerlo miente. */
function FilaDeReporte({
  reporte,
  quien,
  onAbrir,
}: {
  reporte: ReporteDOC;
  /** Quién lo pidió. */
  quien: string;
  onAbrir: () => void;
}) {
  const escala = useTypeScale();
  const listo = sePuedeBajar(reporte);
  const { bajando, alTocar } = useBajadaDOC(reporte);

  const acciones: AccionDeslizable[] = listo
    ? [{ label: bajando ? "…" : "Download", icon: Download, onSelect: alTocar }]
    : [];

  const cuerpo = (
    /* La miniatura afuera y los dos renglones al lado, como cualquier fila de
       esta app que tenga plato a la izquierda —ver `FilaMovil`—: así el texto
       arranca todo de la misma columna y no hace falta sangrar el de abajo. */
    <span className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <MiniaturaDelReporte reporte={reporte} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className="min-w-0 flex-1 truncate"
            style={{ fontSize: escala.body }}
          >
            {tipoCortoDOC(reporte.tipo)}
          </span>
          <span
            className="shrink-0 tabular-nums text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {haceCuanto(reporte.pedidoEl)}
          </span>
        </span>

        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {quien}
          </span>
          {/* La hora, más apagada que el "hace cuánto" de arriba: no es cuándo
              se pidió —eso ya está dicho— sino lo único que separa dos pedidos
              del mismo día. Se lee cuando dos filas se parecen, y el resto del
              tiempo no tiene que competir con el renglón de arriba. */}
          <span
            className="shrink-0 tabular-nums text-muted-foreground/70"
            style={{ fontSize: escala.caption }}
          >
            {hora(reporte.pedidoEl)}
          </span>
        </span>
      </span>
    </span>
  );

  return (
    <li>
      <Deslizable id={reporte.id} acciones={acciones}>
        <button
          type="button"
          onClick={onAbrir}
          data-cuelume-press="tick"
          className={cn(
            "w-full cursor-pointer text-left outline-none",
            "active:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          )}
        >
          {cuerpo}
        </button>
      </Deslizable>
    </li>
  );
}

/* ─────────────────────────── La pantalla ─────────────────────────── */

/** `tabId` es el de la pestaña que la monta: la ficha del pedido se pone en
 *  **su** board, no en el de la que esté puesta. Las pestañas que no se miran
 *  siguen montadas, y escribir contra "la activa" le pondría la ficha en la cara
 *  a otra. */
export function AdminReports({ tabId }: { tabId?: string }) {
  /* Compacta en escritorio y normal en el teléfono, como las otras tablas: el
     escalón denso es para cuarenta filas peleando por el alto de una ventana, y
     en un teléfono lo que pelea es el dedo. */
  const esMovil = useEsMovil();

  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size={esMovil ? "default" : "compact"}>
      <Pantalla tabId={tabId} />
    </SizeProvider>
  );
}

function Pantalla({ tabId }: { tabId?: string }) {
  const esMovil = useEsMovil();
  /* Abrir un reporte es abrir una pestaña, igual que abrir un perfil desde una
     tabla de cuentas. */
  const openTab = useWorkspace((w) => w.openTab);
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
  const {
    pagina,
    paginas,
    desde,
    dir,
    ancla,
    irA,
    filas: paginadas,
  } = usePaginacion(encontrados, clave, POR_PAGINA);
  /* Y en el teléfono no hay páginas: la lista se sigue, como en las otras
     siete. Ver `useListaInfinita`. */
  const { filas: seguidas, centinela } = useListaInfinita(encontrados, clave);
  const filas = esMovil ? seguidas : paginadas;

  /* El teclado de la tabla: una sola parada de tabulado —la fila donde
     quedaste— y las flechas adentro. Ver `tabla-teclado`. */
  const teclado = useTecladoDeTabla({
    cuantas: filas.length,
    sangriaSuperior: altoCabecera,
  });

  return (
    <motion.div
      variants={cascadaPantalla}
      initial="oculto"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col"
    >
      {/* En el teléfono el header es el buscador, el filtro y el pedido: el
          título con su bajada se va —el header del shell ya dice "Admin /
          Reports"— y esos dos renglones se los queda la lista. */}
      {esMovil ? (
        <motion.header
          variants={entraBloque}
          className="flex shrink-0 items-center gap-2 px-4 py-3"
        >
          <InputGroup className="min-w-0 flex-1">
            <InputField
              index={0}
              label="Search reports"
              labelHidden
              icon={Search}
              placeholder="Search reports"
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

          <BotonDeAlta onClick={alta.abrir} disponible={alta.disponible}>
            Report
          </BotonDeAlta>
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
      )}

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
      ) : esMovil ? (
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade scrollbar-hide"
        >
          <ListaMovil>
            {filas.map(({ reporte, quien }) => (
              <FilaDeReporte
                key={reporte.id}
                reporte={reporte}
                quien={quien}
                onAbrir={() => openTab(tabDeReporteDOC(reporte))}
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

            <Table
              {...teclado.tabla}
              className={cn("table-fixed", SANGRIA, AIRE_FILA)}
            >
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
                      {...teclado.fila(i)}
                    >
                      {/* Cómo se llama: el tipo y el día del pedido. Es lo que
                          va a decir el archivo cuando esté bajado, y por eso es
                          la primera columna y la más ancha.

                          Y es lo que abre el archivo, cuando hay archivo. El
                          nombre y no la fila entera: adentro está el botón de
                          bajar, y un botón adentro de otro botón no es HTML
                          válido ni se puede tabular. Es lo mismo que hacen la
                          lista de Email › Reports y las tablas de Accounts y
                          Policies, donde lo que lleva al perfil es el nombre y
                          no el renglón; y con la misma raya punteada, que es
                          como esta app escribe "esto abre algo". */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="flex min-w-0 items-center gap-2"
                        >
                          {/* El glifo del archivo, antes del nombre.
                          
                              Es lo que hacía falta para que la fila se lea como
                              un archivo. Sin él, el nombre es texto: la raya
                              punteada que dice "esto abre algo" recién aparece
                              con el puntero encima, así que quien mira la tabla
                              quieta no tiene manera de saber que hay algo para
                              abrir. En la grilla de Email Reports eso lo dice la
                              baldosa —un dibujo de archivo, del tamaño de un
                              archivo— y acá no lo decía nadie.
                          
                              Y de paso dice **de qué clase** es, que es la otra
                              cosa que la tabla no mostraba: la planilla lleva su
                              cuadrícula y el documento sus líneas de texto. Sale
                              de `GLIFOS` contra el nombre del archivo, el mismo
                              lugar del que lo sacan la solapa y la cabecera del
                              visor, así que los tres no pueden discrepar.
                          
                              El hueco se reserva aunque no haya glifo: lo que no
                              está listo no tiene archivo, y sin la reserva los
                              nombres de esas tres filas arrancarían veinte
                              píxeles a la izquierda de los otros veintidós. */}
                          <GlifoDelArchivo reporte={reporte} />

                          {sePuedeBajar(reporte) ? (
                            <button
                              type="button"
                              title={reporte.nombre}
                              onClick={() => openTab(tabDeReporteDOC(reporte))}
                              className={cn(
                                "w-full max-w-full cursor-pointer truncate text-left",
                                "decoration-dotted decoration-muted-foreground underline-offset-2",
                                "outline-none hover:underline focus-visible:underline",
                              )}
                            >
                              {reporte.nombre}
                            </button>
                          ) : (
                            <span className="min-w-0 truncate" title={reporte.nombre}>
                              {reporte.nombre}
                            </span>
                          )}
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
