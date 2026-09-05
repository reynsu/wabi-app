import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { sileo } from "sileo";
import {
  CalendarRange,
  ChevronDown,
  Download,
  FileChartColumn,
  FileText,
  Folder,
  FolderOpen,
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
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { descargar } from "@/lib/descargar";
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
  fallidosDelMes,
  porMes,
  sePuedeBajar,
  tramoDePeriodo,
  useReportes,
  type Reporte,
} from "@/pages/reportes";
import { fechaDia } from "@/pages/tiempo";
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

   Lo que la fila pierde contra la tabla vieja son tres columnas. El **nombre**
   lo dice el encabezado del mes: adentro de agosto, las cinco filas decían lo
   mismo. La **fecha de armado** es el cierre de la ventana, que ya está en la
   fila —un reporte semanal se firma el día que su semana termina—, así que eran
   dos columnas para un solo hecho. Y **cuántas cuentas cubre**: la fila queda
   contestando una sola pregunta —de cuándo es este archivo y si está listo— y
   el número vive donde importa, adentro del CSV y en el aviso que confirma la
   bajada. */

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

/**
 * Un reporte, como una fila de la lista de su mes.
 *
 * Cuatro cosas y en este orden: qué semana cubre, cuántas cuentas entraron en
 * ella, en qué anda, y qué se puede hacer con él.
 *
 * **Sin el nombre.** Adentro del mes las cinco filas decían la misma frase —"KC-B
 * August 2026 Report"— y esa frase es exactamente lo que el encabezado del mes
 * ya dice. Lo que distingue una semana de la de abajo es la ventana, que ahora
 * es lo primero que se lee.
 *
 * **Y sin la fecha de armado.** Un reporte semanal se firma el día que su semana
 * termina, así que la fecha de armado *es* el cierre de la ventana. La tabla
 * vieja tenía las dos columnas y decían un solo hecho.
 *
 * La sangría de la izquierda la mete el mes: la fila cuelga de su encabezado, y
 * verlo en el margen es lo que hace que se lea como algo adentro de algo y no
 * como una lista más.
 */
function FilaDeReporte({ reporte }: { reporte: Reporte }) {
  const escala = useTypeScale();
  const estado = ESTADOS_DE_REPORTE[reporte.estado];

  return (
    <motion.div
      /* La fila entra con el turno que le reparte su mes —ver `cascadaMes`— y
         no con el de la pantalla: lo que la trae es haber desplegado el mes,
         que puede pasar mil veces después del primer pintado. */
      variants={entraSemana}
      className="group/fila flex min-h-9 items-center gap-3 rounded-lg pr-2 pl-5 transition-colors duration-80 hover:bg-hover"
    >
      {/* Qué semana cubre. Las dos fechas enteras con año: es lo único que
          distingue esta fila de la de abajo, así que acá no se abrevia nada. */}
      <span
        className="min-w-0 flex-1 truncate tabular-nums text-foreground"
        style={{ fontSize: escala.caption }}
      >
        {fechaDia(reporte.desde)} &ndash; {fechaDia(reporte.hasta)}
      </span>

      {/* En qué anda: el punto de su color y la palabra, sin la pastilla.

          Un badge dibuja un recuadro alrededor de una palabra que en cincuenta
          y siete de sesenta filas dice lo mismo, y ese recuadro terminaba siendo
          lo más fuerte de la fila —más que la semana, que es lo que se viene a
          leer—. Sacado el contorno, el color queda donde importa y la palabra
          baja al gris del texto secundario.

          El punto se queda, y no es decorativo: es lo único que se recorre con
          la vista para encontrar la semana que no salió. Sin palabra sería un
          código de colores que hay que aprender; sin punto, sesenta renglones
          grises iguales.

          El tinte sale de `ESTADOS_DE_REPORTE` —el mismo con el que el panel de
          filtros distingue cada estado—, así que el punto de la fila y el de la
          opción del panel son el mismo color por construcción. */}
      <span
        className="flex shrink-0 items-center gap-1.5 text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: estado.tinte }}
        />
        {estado.label}
      </span>

      {/* Contra el borde derecho, que es donde termina la fila: se la lee
          entera y recién entonces se decide. */}
      <BajarReporte reporte={reporte} />
    </motion.div>
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
                      style={{ fontSize: escala.caption }}
                    >
                      {abierto ? (
                        <FolderOpen size={13} strokeWidth={1.5} className="shrink-0" />
                      ) : (
                        <Folder size={13} strokeWidth={1.5} className="shrink-0" />
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
                        {mes.reportes.map((reporte) => (
                          <FilaDeReporte key={reporte.id} reporte={reporte} />
                        ))}
                      </motion.div>
                    )}
                  </section>
                );
              })}
            </div>
          </ScrollArea>
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
          style={{ fontSize: escala.caption }}
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
