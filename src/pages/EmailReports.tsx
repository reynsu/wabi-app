import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { sileo } from "sileo";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Download,
  FileChartColumn,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
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
import { Segmentado } from "@/components/ficha";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { descargar } from "@/lib/descargar";
import { SizeProvider, useSize, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  ESTADOS_DE_REPORTE,
  ORDEN_ESTADOS,
  ORDEN_TIPOS,
  TIPOS_DE_REPORTE,
  archivoDeReporte,
  csvDeReporte,
  fallidosDelMes,
  porMes,
  sePuedeBajar,
  tramoDePeriodo,
  useReportes,
  type MesDeReportes,
  type Reporte,
} from "@/pages/reportes";
import { diaCorto, fechaDia, haceCuanto } from "@/pages/tiempo";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/* La pantalla de Email Reports: las semanas que la casa ya cerró.

   Comparte con Policies, Provisioning y Email Search el header —la búsqueda y el
   panel de filtros, en el mismo rincón— porque son cuatro maneras de mirar el
   correo de la misma consola. Lo que hay debajo **no** es su tabla, y ésa es la
   única diferencia que importa.

   Las otras tres muestran cosas que existen ahora: buzones, mensajes, reglas.
   Una tabla con su paginador es la forma correcta para eso. Ésta muestra
   ventanas que se cerraron solas, una por semana, para siempre: la lista no
   tiene fin y sus filas se repiten el nombre —dos reportes de julio se llaman
   los dos "KC-B July 2026 Report"—. Un paginador ahí parte por número lo que se
   recorre por fecha, y la columna del nombre repite la misma frase cuarenta
   veces.

   Así que va agrupada por mes, con el mes como encabezado que se pliega, y sin
   pager. Ver "La lista", más abajo. El mueble que sí comparte es el de la
   sección Emails de un perfil, que es la otra lista larga de esta app que se
   recorre por grupos. */

/* ─────────────────────────── El movimiento ───────────────────────────

   Dos repartos y no uno, porque son dos cosas distintas.

   El de la **pantalla** es el mismo de las otras tres: abrir esto es una
   reacción —alguien tocó una fila del sidebar— y sus tres bloques entran
   escalonados una sola vez.

   El del **mes** es de cada mes y corre cada vez que se lo despliega, no sólo al
   montar la pantalla: ver `cascadaMes`. Un mes que se abre no es la pantalla
   apareciendo otra vez, es un bloque que llega. */

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

/* ── El mes que se abre ───────────────────────────────────────────────────
 *
 * Cada mes reparte los turnos de sus propias semanas. Al montarse —la primera
 * vez, y **cada vez que se lo despliega**— arranca en `oculto` y va a
 * `visible`, así que sus filas entran siempre, vengan de un primer pintado o de
 * haber estado plegadas. Sin esto el bloque aparecía de golpe: cinco filas que
 * ya estaban ahí, dibujadas de una vez.
 *
 * El turno es el mismo que reparte la lista de correos de un perfil, y las
 * filas entran desde la izquierda por lo mismo: se despliegan **desde** su
 * encabezado, que está arriba y a la izquierda, así que venir de ahí es venir
 * de donde uno acaba de tocar. Un `y` las traería desde debajo del mes que
 * sigue, que no es de donde salieron.
 *
 * Los ocho píxeles y el escalón `moderate` no son elegidos acá: son los que
 * usa esa lista, y dos maneras de desplegar un grupo en la misma app serían dos
 * cosas que hay que aprender por separado. */
const cascadaMes = {
  oculto: {},
  visible: { transition: { delayChildren: 0.03, staggerChildren: 0.045 } },
} as const;

const entraSemana = {
  oculto: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: spring.moderate },
} as const;

/* El galón que gira. Es la única parte del encabezado que se mueve, y se mueve
   con el escalón corto: es una reacción a un clic, y llegar tarde a la propia
   respuesta la haría ver lenta. */
const giraElGalon = {
  abierto: { rotate: 0, transition: spring.fast },
  plegado: { rotate: -90, transition: spring.fast },
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

/* ─────────────────────────── La lista ───────────────────────────

   No es una tabla. Los reportes se generan solos, uno por semana, así que la
   lista crece para siempre y todas las filas se parecen: dos de julio se llaman
   igual —"KC-B July 2026 Report"— y lo único que las distingue es la ventana que
   cubren. Una tabla plana de sesenta filas con paginador es la forma equivocada
   para eso: el paginador parte por número lo que se recorre por fecha, y la
   columna del nombre repite la misma frase cuarenta veces.

   Van agrupados por mes, con el mes como encabezado que se pliega. **El mes no
   se inventa: ya estaba en el dato** —el nombre de cada reporte lo lleva—, así
   que agruparlos es mostrar una estructura que el modelo ya tenía escondida.
   Sesenta filas pasan a ser catorce meses de cuatro o cinco.

   Es el mismo mueble que la sección Emails de un perfil, hasta el encabezado
   pegajoso y el plegado: son dos listas largas que se recorren por grupos, y
   dos maneras de plegar un grupo en la misma app serían dos cosas que hay que
   aprender por separado.

   Lo que la fila pierde contra la tabla vieja son dos columnas. El **nombre** lo
   dice el encabezado del mes: adentro de agosto, las cinco filas decían lo
   mismo. Y **cuántas cuentas cubre**, que era un número pelado sin decir de qué;
   el dato vive donde importa, adentro del CSV y en el aviso que confirma la
   bajada.

   La **fecha de armado** sí se quedó, pero escrita en relativo. Es el cierre de
   la ventana —un reporte semanal se firma el día que su semana termina—, así que
   repetirla en absoluto sería la misma frase dos veces; "hace dos meses" es otra
   pregunta que "del 10 al 17 de julio", y es la que uno hace cuando busca el
   archivo más nuevo y no la semana tal. */

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
 * El CSV lo arma el modelo —ver `csvDeReporte`— y el navegador lo recibe por
 * `descargar`, que es lo mismo que hace Admin › Reports: acá adentro sólo queda
 * la espera, que es de esta pantalla.
 *
 * Es una bajada de verdad y no un aviso de que se bajó algo: la fila promete un
 * archivo con lo que dice la fila, y un toast de éxito sobre una carpeta vacía
 * es lo peor que puede hacer una pantalla que se llama Reports.
 */
async function bajar(reporte: Reporte, usuarios: Usuario[]) {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  descargar(archivoDeReporte(reporte), csvDeReporte(reporte, usuarios));
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
/**
 * Bajar un reporte, con lo que se cuenta mientras.
 *
 * En un hook y no adentro del botón porque son dos las cosas que bajan un
 * reporte: el ícono de una fila de la lista y la baldosa entera en la grilla.
 * Dos maneras de tocar lo mismo, y una sola manera de que pase —la misma espera,
 * el mismo aviso, el mismo texto de error—. Copiado en dos lados, el día que el
 * mensaje cambie va a cambiar en uno.
 */
function useBajada(reporte: Reporte) {
  const usuarios = useUsuarios();
  /* Vive en quien lo dispara y no en la pantalla, al revés que el alta de una
     política: bajar un reporte no apaga nada más que ese control, y dos se
     pueden estar bajando a la vez. */
  const [bajando, setBajando] = useState(false);

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

  return { bajando, alTocar };
}

function BajarReporte({ reporte }: { reporte: Reporte }) {
  const { bajando, alTocar } = useBajada(reporte);

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
        /* Con el hover de **su fila**, y no con el `is-active` de una tabla:
           esta pantalla dejó de ser una tabla cuando pasó a carpetas, y
           `is-active` lo pone `<TableRow>`. La clase quedó de entonces y el
           botón no llegaba nunca a aparecer con el puntero —sólo tabulando
           hasta él o mientras se estaba bajando—. El grupo que sí existe acá es
           el de la fila. */
        "group-hover/fila:opacity-100",
        bajando && "opacity-100",
        "focus-visible:opacity-100",
      )}
    >
      <Download />
    </Button>
  );
}

/**
 * Un reporte, como una fila de la lista de su mes.
 *
 * Tres columnas y una acción, en este orden: qué semana cubre, en qué anda, de
 * cuándo es, y qué se puede hacer con él. La forma es la de una línea de un
 * explorador de archivos, que es lo mismo que dice el mueble de afuera: esto es
 * una carpeta con archivos adentro.
 *
 * **Sin el nombre.** Adentro del mes las cinco filas decían la misma frase —"KC-B
 * August 2026 Report"— y esa frase es exactamente lo que el encabezado del mes ya
 * dice. Lo que distingue una semana de la de abajo es la ventana, que es lo
 * primero que se lee.
 *
 * La sangría de la izquierda la mete el mes: la fila cuelga de su encabezado, y
 * verlo en el margen es lo que hace que se lea como algo adentro de algo y no
 * como una lista más.
 */
function FilaDeReporte({ reporte, indice }: { reporte: Reporte; indice: number }) {
  const escala = useTypeScale();
  const estado = ESTADOS_DE_REPORTE[reporte.estado];
  /* Lo terminado no se anuncia. Es el caso normal —cincuenta y siete de sesenta
     semanas— y una palabra que aparece en casi todas las filas no informa: lo
     que informa es su ausencia. Con el estado callado, las tres semanas que no
     salieron son lo único escrito en esa columna. */
  const hayQueDecirlo = reporte.estado !== "completed";

  return (
    <motion.div
      /* La fila entra con el turno que le reparte su mes —ver `cascadaMes`— y
         no con el de la pantalla: lo que la trae es haber desplegado el mes,
         que puede pasar mil veces después del primer pintado. */
      variants={entraSemana}
      /* Una grilla y no una hilera de `flex` con anchos. Dos de las cuatro
         celdas se vacían solas —el estado se calla en cincuenta y siete de
         sesenta filas, y el botón de bajar no existe en lo que no está listo—, y
         en flex una celda vacía no ocupa nada: desaparece y arrastra a las de al
         lado, así que la fila con estado se corría contra la que no lo tiene. En
         una grilla la columna existe aunque esté vacía, y las cuatro caen
         siempre en el mismo lugar.

         La primera es la que cede: `minmax(0,1fr)` y no `auto`, porque un `1fr`
         a secas no baja de su contenido y una ventana larga empujaría las tres
         fijas fuera del panel en vez de recortarse. */
      style={{ gridTemplateColumns: "minmax(0,1fr) 5.5rem 5rem 1.75rem" }}
      className={cn(
        "group/fila grid min-h-9 items-center gap-3 rounded-lg pr-2 pl-5",
        "transition-colors duration-80 hover:bg-hover",
        /* Las bandas intercaladas. Sesenta renglones de texto suelto sobre un
           plano blanco no tienen dónde empezar ni dónde terminar: la fila existe
           recién cuando se la toca. La banda le da un borde sin dibujar una
           línea, que es lo que deja recorrerla de izquierda a derecha —tres
           columnas separadas por aire— sin saltar al renglón de al lado.

           El tinte es `--hover` al 40%, y no un gris elegido acá. En claro las
           superficies 3 a 8 son todas `#FFFFFF` —no hay un escalón que sirva de
           banda— y en oscuro el escalón de al lado es un salto enorme, así que
           ningún token de superficie funciona en los dos temas. `--hover` sí: es
           el "una pizca de tinta sobre lo que haya debajo" de esta app, negro en
           claro y blanco en oscuro.

           Al 40% y no entero porque el hover usa ese mismo tinte al 100%: si la
           banda pesara lo mismo, pasar el puntero por una fila impar no haría
           nada. Así, tocar cualquier fila la lleva al mismo lugar —el patrón se
           deshace bajo el cursor y la que se está mirando queda como la única
           sin banda—.

           El índice es el de adentro del mes y no el de la lista: cada carpeta
           arranca de nuevo. Con un contador corrido, que la primera semana de
           agosto tuviera banda dependería de cuántas filas hubo antes, que es
           una razón que no tiene nada que ver con agosto. Y arranca sin banda,
           para que el renglón pegado al encabezado del mes quede en el plano del
           panel. */
        indice % 2 === 1 && "bg-hover/40",
      )}
    >
      {/* Qué semana cubre. Las dos fechas enteras con año: es lo único que
          distingue esta fila de la de abajo, así que acá no se abrevia nada. */}
      <span
        className="min-w-0 truncate tabular-nums text-foreground"
        style={{ fontSize: escala.body }}
      >
        {fechaDia(reporte.desde)} &ndash; {fechaDia(reporte.hasta)}
      </span>

      {/* En qué anda, **cuando hay algo que decir**: el punto de su color y la
          palabra, sin la pastilla.

          Se calla en las terminadas y habla en las otras tres. Un reporte que
          salió es lo que se espera de un reporte, y decirlo en cincuenta y siete
          filas no agrega nada: lo que se busca acá es la semana que se cayó, la
          que todavía está en la cola y la que se está armando, y esas tres se
          encuentran solas cuando son lo único escrito en esta columna.

          Que la fila terminada quede muda no la deja sin contestar nada: el
          botón de bajar aparece con el puntero justamente en ésas, así que "está
          lista" se dice ofreciendo el archivo en vez de escribiendo una palabra.

          Sin la pastilla del badge, además: un recuadro alrededor de una palabra
          es lo más fuerte que puede tener una fila, y acá lo más fuerte tiene
          que ser la semana. Queda el punto —que es lo que se recorre con la
          vista— y la palabra en el gris del texto secundario.

          Alineado a la izquierda de su columna, al revés que la fecha que sigue:
          así los puntos caen todos en la misma x y forman una línea vertical,
          que es lo que hace legible una columna que se llena en tres filas de
          sesenta. Alineados a la derecha, cada punto quedaría a distinta altura
          horizontal según el largo de la palabra.

          El tinte sale de `ESTADOS_DE_REPORTE` —el mismo con el que el panel de
          filtros distingue cada estado—, así que el punto de la fila y el de la
          opción del panel son el mismo color por construcción. */}
      <span className="min-w-0">
        {hayQueDecirlo && (
          <span
            className="flex items-center gap-1.5 text-muted-foreground"
            style={{ fontSize: escala.body }}
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: estado.tinte }}
            />
            {estado.label}
          </span>
        )}
      </span>

      {/* De cuándo es, en relativo. `creadoEl` **es** el cierre de la ventana
          —un reporte semanal se firma el día que su semana termina—, así que
          escribirlo en absoluto sería repetir lo que ya dice la primera columna.
          En relativo contesta otra pregunta: cuál es el archivo más nuevo, que
          es la que uno hace cuando no viene por una semana en particular.

          El mediodía en UTC no es decoración: `creadoEl` es un día pelado y
          `new Date("2026-08-28")` cae en la medianoche UTC, que del otro lado
          del meridiano es el día anterior y devuelve un "hace" corrido en uno.

          A la derecha y con `tabular-nums`, que es como se compara una columna
          de cantidades: las unidades quedan una debajo de la otra y los dígitos
          no bailan entre filas. */}
      <span
        className="text-right tabular-nums text-muted-foreground"
        style={{ fontSize: escala.body }}
      >
        {haceCuanto(`${reporte.creadoEl}T12:00:00Z`)}
      </span>

      {/* Contra el borde derecho, que es donde termina la fila: se la lee entera
          y recién entonces se decide. Es una columna de la grilla y no un
          agregado al final, así que el hueco queda reservado también en las
          filas donde `BajarReporte` no dibuja nada. */}
      <span className="flex justify-end">
        <BajarReporte reporte={reporte} />
      </span>
    </motion.div>
  );
}

/* ─────────────────────────── La grilla ───────────────────────────
 *
 * La otra manera de ver lo mismo: un explorador de archivos. Arriba están los
 * meses como carpetas, se toca uno y el mismo lienzo pasa a ser el de adentro,
 * con una miga de pan para volver.
 *
 * **Se entra, no se despliega**, y ésa es la única diferencia de fondo con la
 * lista. La lista puede tener los catorce meses abiertos a la vez porque una
 * fila ocupa un renglón; una baldosa ocupa cien píxeles de alto, así que
 * mostrarlos todos abiertos serían casi cuatro pantallas de scroll —medido—
 * contra las dos de la lista. Entrando, en cambio, los catorce meses caben
 * juntos sin scroll, que es algo que la lista nunca logró.
 *
 * Las dos vistas se eligen con el par de botones de la barra y comparten todo lo
 * demás: la búsqueda, el panel de filtros, el vacío y el pie. Lo único que cambia
 * es el dibujo.
 */

/** El ancho de una baldosa. `auto-fill` y no un número de columnas: el panel
 *  cambia de ancho con el sidebar y con la pestaña, y un `grid-cols-6` fijo deja
 *  una franja vacía a la derecha en el ancho que no le tocó. */
const BALDOSAS =
  "grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]";

/** El glifo de una baldosa.
 *
 *  Cuarenta, y no el `icon` del escalón —catorce—, porque acá el ícono no es la
 *  marquita al costado de un rótulo: **es el objeto**. En una grilla lo que se
 *  recorre son los dibujos, y el rótulo se lee recién cuando uno se detuvo en
 *  uno; con un glifo del tamaño de un ícono de control habría que leer las
 *  catorce etiquetas para encontrar un mes, que es lo que la lista ya hace
 *  mejor.
 *
 *  El trazo va en 1 y no en el 1.5 del resto de la app: el grosor de línea de
 *  lucide no escala con el `size`, así que el mismo trazo que a catorce píxeles
 *  se ve fino, a cuarenta se ve como un contorno grueso y el glifo termina
 *  pesando más que el texto de al lado. */
const GLIFO = 40;

/* Las baldosas entran escalonadas, con el mismo reparto que las filas de un mes
   en la lista y por la misma razón: entrar a una carpeta no es la pantalla
   apareciendo de nuevo, es un bloque que llega. El turno es más corto que el de
   la lista —veinte milisegundos contra cuarenta y cinco— porque son hasta
   catorce baldosas y no cinco filas: con el escalón largo, la última carpeta
   llegaría más de medio segundo después de la primera.

   Y entran creciendo, no desde un costado. Las filas de la lista vienen desde la
   izquierda porque se despliegan desde su encabezado, que está arriba a la
   izquierda; una grilla no se despliega desde ningún lado, así que la baldosa
   aparece donde va a quedarse. */
const cascadaBaldosas = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.02 } },
} as const;

const entraBaldosa = {
  oculto: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.moderate },
} as const;

/**
 * Un reporte, como un archivo.
 *
 * Lleva la ventana y no el nombre: los cinco de agosto se llaman todos "KC-B
 * August 2026 Report", y lo que distingue una baldosa de la de al lado es la
 * semana. El nombre del archivo entero va en el `title`, que es donde un
 * explorador lo pone.
 *
 * **Y el ícono lleva el estado.** En un explorador de verdad el glifo dice de qué
 * tipo es el archivo; acá los sesenta son el mismo CSV, así que el tipo no
 * informa y lo único que varía es en qué anda. Por eso el punto de color va
 * pegado al glifo como una insignia, y se calla en las terminadas por lo mismo
 * que en la lista: lo que informa es su ausencia.
 *
 * La baldosa entera es el botón de bajar, al revés que en la lista —donde el
 * botón es un ícono aparte que aparece con el puntero—. En una grilla no hay
 * dónde poner ese ícono sin taparle la cara al archivo, y una baldosa de archivo
 * que no se puede tocar es un dibujo. Cuando no hay nada que bajar deja de ser
 * botón: un reporte que se está armando todavía no tiene archivo y uno que falló
 * no lo va a tener, y la insignia ya lo explica.
 */
function BaldosaDeArchivo({
  reporte,
  /** El mes al que pertenece, sólo cuando la grilla está mostrando lo encontrado
   *  y no una carpeta. Ver `GrillaDeReportes`: sin carpeta alrededor, "Jul 10 –
   *  Jul 17" no dice de qué año es ni de dónde salió. */
  carpeta,
}: {
  reporte: Reporte;
  carpeta?: string;
}) {
  const escala = useTypeScale();
  const estado = ESTADOS_DE_REPORTE[reporte.estado];
  const hayQueDecirlo = reporte.estado !== "completed";
  const { bajando, alTocar } = useBajada(reporte);
  const sePuede = sePuedeBajar(reporte);

  const adentro = (
    <>
      <span className="relative flex">
        <FileText size={GLIFO} strokeWidth={1} className="text-muted-foreground" />
        {hayQueDecirlo && (
          <span
            aria-label={estado.label}
            className="absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-surface-5"
            style={{ background: estado.tinte }}
          />
        )}
      </span>

      {/* La ventana en un renglón, sin el año: lo dice la carpeta que está
          alrededor. Medido con esta misma tipografía, el rótulo más largo
          posible —"Sep 26 – Sep 30"— mide ochenta y seis píxeles y la columna
          garantiza ciento veinte, así que entero no cuesta ninguna baldosa por
          fila. `whitespace-nowrap` para que el día que alguien toque el
          `minmax` el rótulo desborde a la vista y no se parta en silencio. */}
      <span
        className="whitespace-nowrap text-center text-foreground tabular-nums"
        style={{ fontSize: escala.caption, lineHeight: 1.35 }}
      >
        {diaCorto(reporte.desde)} &ndash; {diaCorto(reporte.hasta)}
        {carpeta && (
          <>
            <br />
            <span className="text-muted-foreground">{carpeta}</span>
          </>
        )}
      </span>
    </>
  );

  const pinta = cn(
    "flex flex-col items-center gap-1.5 rounded-lg px-2 py-3",
    "transition-colors duration-80",
    bajando && "opacity-60",
  );

  if (!sePuede) {
    return (
      <span title={archivoDeReporte(reporte)} className={pinta}>
        {adentro}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={archivoDeReporte(reporte)}
      aria-label={`Download ${reporte.nombre}, ${fechaDia(reporte.desde)} to ${fechaDia(reporte.hasta)}`}
      aria-busy={bajando}
      onClick={alTocar}
      className={cn(
        pinta,
        "cursor-pointer outline-none hover:bg-hover focus-visible:bg-hover",
      )}
    >
      {adentro}
    </button>
  );
}

/**
 * Un mes, como una carpeta.
 *
 * Dice cuántos guarda y si alguno falló, que es lo mismo que dice el encabezado
 * de un mes plegado en la lista: cuatro reportes que salieron no son noticia,
 * uno que no salió sí, y sin eso habría que entrar a las catorce para
 * encontrarlo.
 */
function BaldosaDeMes({ mes, onAbrir }: { mes: MesDeReportes; onAbrir: () => void }) {
  const escala = useTypeScale();
  const fallidos = fallidosDelMes(mes);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg px-2 py-3",
        "text-left transition-colors duration-80 outline-none",
        "hover:bg-hover focus-visible:bg-hover",
      )}
    >
      <span className="relative flex">
        <Folder size={GLIFO} strokeWidth={1} className="text-muted-foreground" />
        {fallidos > 0 && (
          <span
            aria-label={`${fallidos} failed`}
            className="absolute right-0 bottom-0 size-2.5 rounded-full bg-[oklch(0.62_0.2_18)] ring-2 ring-surface-5"
          />
        )}
      </span>

      <span
        className="text-center text-foreground"
        style={{ fontSize: escala.caption, lineHeight: 1.35 }}
      >
        {mes.nombre}
        <br />
        <span className="text-muted-foreground tabular-nums">
          {mes.reportes.length} {mes.reportes.length === 1 ? "file" : "files"}
        </span>
      </span>
    </button>
  );
}

/**
 * La grilla: carpetas, o los archivos de una.
 *
 * **Cuando hay algo buscado, no hay carpetas.** Lo encontrado se muestra plano,
 * como hace cualquier explorador con los resultados de una búsqueda, y por una
 * razón medida: buscando "Jul 10" la pantalla decía "2 reports" y dibujaba una
 * carpeta cerrada. Hacer entrar a una carpeta para ver lo que la búsqueda ya
 * encontró deshace la búsqueda.
 *
 * Sin carpeta alrededor, la baldosa se queda sin el año —que era la carpeta la
 * que lo decía—, así que en ese modo cada una escribe abajo de qué mes salió.
 * Es lo mismo que hace un explorador cuando muestra resultados de varias
 * carpetas, y de paso contesta la pregunta que uno hace al ver un resultado:
 * dónde estaba.
 */
function GrillaDeReportes({
  meses,
  buscando,
}: {
  meses: MesDeReportes[];
  buscando: boolean;
}) {
  const escala = useTypeScale();
  const medidas = useSize();
  /* La clave del mes abierto, o nada si se está en la raíz. Se guarda aunque
     haya una búsqueda puesta: al borrarla, se vuelve a la carpeta que se estaba
     mirando en vez de a la raíz. */
  const [adentro, setAdentro] = useState<string | null>(null);
  const mes = buscando ? undefined : meses.find((m) => m.clave === adentro);

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade">
      <div className="flex flex-col gap-1 px-6 pb-6">
        {/* La miga de pan. Ocupa el lugar también en la raíz —con "Reports"
            solo— para que entrar a una carpeta no empuje la grilla hacia abajo.
            Pegajosa, como el encabezado de un mes en la lista: es lo que evita
            perder de vista en qué carpeta se está cuando se la recorre. */}
        <div
          className="sticky top-0 z-10 flex items-center gap-1 bg-surface-5 pt-4 pb-2 text-muted-foreground"
          style={{ fontSize: escala.body }}
        >
          <button
            type="button"
            onClick={() => setAdentro(null)}
            disabled={!mes}
            className={cn(
              "rounded px-1 outline-none",
              mes
                ? "cursor-pointer hover:text-foreground focus-visible:text-foreground"
                : "text-foreground",
            )}
          >
            Reports
          </button>
          {mes && (
            <>
              <ChevronRight size={medidas.icon} strokeWidth={1.5} aria-hidden />
              <span className="px-1 text-foreground">{mes.nombre}</span>
            </>
          )}
        </div>

        {/* La `key` hace que el bloque se vuelva a montar al entrar, al salir y
            al cambiar lo buscado, que es lo que reparte los turnos de nuevo. Sin
            ella, entrar a una carpeta cambiaría el contenido de las baldosas sin
            que ninguna llegue. */}
        <motion.div
          key={buscando ? "buscado" : (adentro ?? "raiz")}
          variants={cascadaBaldosas}
          initial="oculto"
          animate="visible"
          className={BALDOSAS}
        >
          {buscando
            ? meses.flatMap((m) =>
                m.reportes.map((r) => (
                  <motion.div key={r.id} variants={entraBaldosa}>
                    <BaldosaDeArchivo reporte={r} carpeta={m.nombre} />
                  </motion.div>
                )),
              )
            : mes
              ? mes.reportes.map((r) => (
                  <motion.div key={r.id} variants={entraBaldosa}>
                    <BaldosaDeArchivo reporte={r} />
                  </motion.div>
                ))
              : meses.map((m) => (
                  <motion.div key={m.clave} variants={entraBaldosa}>
                    <BaldosaDeMes mes={m} onAbrir={() => setAdentro(m.clave)} />
                  </motion.div>
                ))}
        </motion.div>
      </div>
    </ScrollArea>
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

/** Cómo se ven los resultados. */
type Vista = "lista" | "grilla";

function Pantalla() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  /* Lista, que es la que contesta la pregunta de todos los días —qué semana es
     ésta y si está lista—. La grilla es para recorrer el archivo, que es lo que
     uno hace de vez en cuando. */
  const [vista, setVista] = useState<Vista>("lista");
  const escala = useTypeScale();
  /* Las medidas del escalón. De acá sale el tamaño del glifo de la carpeta, que
     es el mismo que el de cualquier ícono de control en esta densidad. */
  const medidas = useSize();
  /* Qué meses están plegados. Se guardan los plegados y no los abiertos: lo
     normal es que estén todos abiertos, así que el estado inicial es "ninguno"
     en vez de una lista que hay que mantener al día cuando cierre un mes nuevo.
     Es lo mismo que hace la lista de correos de un perfil. */
  const [plegados, setPlegados] = useState<Set<string>>(new Set());
  /* Los ids que atan cada encabezado con lo que abre. De `useId` porque dos
     pestañas de esta pantalla son dos listas en la misma página. */
  const idLista = useId();

  const plegar = (clave: string) =>
    setPlegados((previos) => {
      const proximos = new Set(previos);
      if (proximos.has(clave)) proximos.delete(clave);
      else proximos.add(clave);
      return proximos;
    });

  const todos = useReportes();

  const encontrados = useMemo(
    () => todos.filter((reporte) => pasa(reporte, busqueda, filtros)),
    [todos, busqueda, filtros],
  );

  /* Agrupados **después** de filtrar, que es lo que hace que el filtro y las
     carpetas no se peleen: lo encontrado se muestra en su mes y los meses que
     quedan sin nada no dibujan un encabezado para decir que ahí no hay nada. */
  const meses = useMemo(() => porMes(encontrados), [encontrados]);

  /* Si se está buscando algo. La lista no lo necesita —los meses se encogen
     solos— pero la grilla sí: con algo buscado deja de mostrar carpetas y
     muestra lo encontrado plano. Ver `GrillaDeReportes`.

     Un atributo del panel con la lista vacía no cuenta: el panel deja el id
     puesto al sacarle todos los valores, y eso no filtra nada. */
  const hayBusqueda =
    busqueda.trim().length > 0 ||
    Object.values(filtros).some((valores) => valores.length > 0);

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

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
            Every week the house closed, filed by the month it closed in.
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

          {/* Cómo se ven los resultados. Va después del panel de filtros y no
              antes: primero se elige qué se mira y recién después cómo.

              Sin rótulos porque son dos y son los dos de siempre —las rayas y
              los cuadraditos—: "List" y "Grid" escritos al lado de un botón que
              ya dice "Filters" son tres palabras en una barra que tiene que
              leerse de un vistazo. El nombre sigue estando, en el
              `aria-label`. */}
          <Segmentado
            valor={vista}
            onElegir={setVista}
            rotuloOculto
            opciones={[
              {
                value: "lista",
                label: "List view",
                icon: <List size={medidas.icon} strokeWidth={1.5} />,
              },
              {
                value: "grilla",
                label: "Grid view",
                icon: <LayoutGrid size={medidas.icon} strokeWidth={1.5} />,
              },
            ]}
          />

          {/* Sin acción propia, a diferencia de Policies: un reporte no se
              escribe, se cierra solo cuando la semana termina. Un botón que
              dijera "New report" prometería elegir una ventana, y las ventanas
              no se eligen. */}
        </div>
      </motion.header>

      {meses.length === 0 ? (
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
        <motion.div variants={entraTabla} className="min-h-0 flex-1">
          {vista === "grilla" ? (
            <GrillaDeReportes meses={meses} buscando={hayBusqueda} />
          ) : (
          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            <div className="flex flex-col px-6 pb-6" role="list">
              {meses.map((mes) => {
                const abierto = !plegados.has(mes.clave);
                const fallidos = fallidosDelMes(mes);
                const idContenido = `${idLista}-${mes.clave}`;

                return (
                  <section key={mes.clave} role="listitem">
                    {/* El encabezado del mes, pegajoso. Se queda arriba mientras
                        se recorren sus semanas, que es lo que evita perder de
                        vista en cuál se está: sin eso, a la cuarta fila el mes
                        ya se fue y las cinco ventanas se parecen entre sí.

                        Lleva el mismo plano que el panel —no una banda propia—
                        porque no es una cabecera de tabla sino un renglón de la
                        lista que se queda quieto. */}
                    <button
                      type="button"
                      aria-expanded={abierto}
                      aria-controls={idContenido}
                      onClick={() => plegar(mes.clave)}
                      className={cn(
                        "group/mes sticky top-0 z-10 flex w-full cursor-pointer items-center gap-2",
                        "bg-surface-5 px-2 pt-4 pb-1.5 text-left text-muted-foreground outline-none",
                        "hover:text-foreground focus-visible:text-foreground",
                      )}
                      style={{ fontSize: escala.body }}
                    >
                      {/* El glifo sale del escalón —14px en compacto— y no de
                          un número escrito acá: es el mismo tamaño que tiene
                          cualquier ícono de control en esta densidad, así que
                          la carpeta pesa lo que pesa un ícono de esta app y no
                          lo que a esta pantalla le pareció. */}
                      {abierto ? (
                        <FolderOpen
                          size={medidas.icon}
                          strokeWidth={1.5}
                          className="shrink-0"
                        />
                      ) : (
                        <Folder
                          size={medidas.icon}
                          strokeWidth={1.5}
                          className="shrink-0"
                        />
                      )}

                      <span className="min-w-0 flex-1 truncate">{mes.nombre}</span>

                      {/* Lo único que un mes plegado dice de lo que esconde:
                          cuántos hay, y si alguno falló. Cuatro reportes que
                          salieron no son noticia; uno que no salió sí, y sin
                          esto habría que abrir los catorce para encontrarlo. */}
                      {fallidos > 0 && (
                        <span
                          aria-label={`${fallidos} failed`}
                          className="size-1.5 shrink-0 rounded-full bg-[oklch(0.62_0.2_18)]"
                        />
                      )}
                      <span className="shrink-0 tabular-nums">
                        {mes.reportes.length}
                      </span>

                      {/* El galón gira entre abierto y plegado —ver
                          `giraElGalon`—, que es lo que ata el gesto con lo que
                          pasa debajo: se toca acá y el bloque sale de acá.

                          Aparece con el puntero mientras el mes está abierto y
                          se queda puesto cuando está plegado: en reposo la fila
                          abierta ya se lee como un encabezado y catorce galones
                          serían una columna de ruido, pero un mes plegado no
                          tiene nada debajo que lo explique y el galón de costado
                          es lo único que dice que ahí hay algo guardado. Es la
                          misma regla que la lista de correos de un perfil. */}
                      <motion.span
                        aria-hidden
                        variants={giraElGalon}
                        animate={abierto ? "abierto" : "plegado"}
                        className={cn(
                          "flex shrink-0 transition-opacity duration-80",
                          abierto
                            ? "opacity-0 group-hover/mes:opacity-100 group-focus-visible/mes:opacity-100"
                            : "opacity-100",
                        )}
                      >
                        <ChevronDown size={12} strokeWidth={1.5} />
                      </motion.span>
                    </button>

                    {/* El cuerpo se monta y se desmonta, **sin
                        `AnimatePresence`**. Lo tuvo la lista de correos de un
                        perfil, animando la altura de `auto` a cero, y traía un
                        bug que no vale la pena volver a pagar: `AnimatePresence`
                        deja montado al que se va hasta que termine su salida, y
                        volver a abrir el grupo mientras eso pasa le pide a
                        framer resucitar un hijo con la misma clave que se está
                        encogiendo. La medida del `height: "auto"` sale de ahí y
                        el grupo aterriza en cero con las filas adentro: espacio
                        reservado, contenido invisible.

                        Así que sólo se anima la entrada. Plegar es instantáneo
                        —lo que se pliega deja de estar, que es lo que uno
                        pidió— y desplegar trae las semanas una detrás de otra.
                        Sin salida no hay a quién resucitar. */}
                    {abierto && (
                      <motion.div
                        id={idContenido}
                        variants={cascadaMes}
                        initial="oculto"
                        animate="visible"
                        className="flex flex-col"
                      >
                        {mes.reportes.map((reporte, indice) => (
                          <FilaDeReporte
                            key={reporte.id}
                            reporte={reporte}
                            indice={indice}
                          />
                        ))}
                      </motion.div>
                    )}
                  </section>
                );
              })}
            </div>
          </ScrollArea>
          )}
        </motion.div>
      )}

      {/* El pie dice cuántos quedaron y en cuántos meses. Sin pager: la lista se
          recorre por fecha y partirla en páginas de cuarenta corta un mes al
          medio por una razón que no tiene nada que ver con el mes. Lo que el
          pager contestaba —"¿cuánto hay?"— lo contesta este renglón, que además
          no se va con el scroll. */}
      {meses.length > 0 && (
        <motion.footer
          variants={entraBloque}
          className="flex shrink-0 items-center gap-1.5 border-t border-border px-6 py-3 text-muted-foreground"
          style={{ fontSize: escala.body }}
        >
          <span className="tabular-nums">{encontrados.length}</span>
          {encontrados.length === 1 ? "report" : "reports"}
          <span aria-hidden>·</span>
          <span className="tabular-nums">{meses.length}</span>
          {meses.length === 1 ? "month" : "months"}
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
