import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Eye,
  MegaphoneOff,
  Search,
  Type,
  UserPen,
  UsersRound,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { AnnouncementRecipients } from "@/components/announcement-recipients";
import { BotonDeAlta } from "@/components/boton-de-alta";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
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
import { useAltaDeAnuncio } from "@/pages/NuevoAnuncio";
import {
  AUDIENCIAS,
  LECTURA,
  ORDEN_AUDIENCIAS,
  ORDEN_LECTURA,
  REMITENTES,
  aQuienesLlego,
  claveDeAudiencia,
  cuantosRecibieron,
  tasaDeLectura,
  tramoDeLectura,
  useAnuncios,
  type Anuncio,
} from "@/pages/anuncios";
import { tabDePerfil } from "@/pages/perfil-tab";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import { TarjetaUsuario } from "@/pages/Users";
import { cambiarEstado, type Usuario } from "@/pages/usuarios";
import { useWorkspace } from "@/stores/workspace";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de Announcements: lo que la casa dijo, y cuánto de eso se leyó.

   Es el mismo mueble que Policies, Provisioning y Email Search —header con la
   búsqueda y el panel de filtros; la tabla debajo con su cabecera flotando sobre
   el scroller; el pie con el rango y el pager— porque son cuatro maneras de
   mirar la misma consola, y cambiar de fila del sidebar no debería cambiar de
   mueble.

   Lo que cambia es la tabla, que es lo único que tiene por qué cambiar. Cinco
   columnas, y la que no tiene ninguna de las otras pantallas es Engagement.
   Una política se escribe y rige; un anuncio se manda y **puede no haber llegado
   a nadie**, así que la fila no está completa hasta que dice cuántos lo
   abrieron de cuántos lo recibieron. Es el dato por el que se entra acá.

   Y no hay columna de acciones, a diferencia de Policies. Un anuncio ya salió:
   no se lo edita —el que lo recibió lo leyó como estaba— y borrarlo de la tabla
   sería borrar que ocurrió. Una columna de acciones vacía promete algo que la
   pantalla no puede cumplir. */

/* ─────────────────────────── El movimiento ───────────────────────────

   El mismo reparto que las otras tablas, y por la misma razón: abrir esto es
   una reacción —alguien tocó una fila del sidebar— y no hay cascada entre filas,
   que contaría un orden de llegada que no existió. */

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

/* El destello: la fila que acaba de salir llega encendida y se apaga sola. Es lo
   que cierra el envío: la ficha se fue, y sin esto hay que buscar con la vista
   cuál de las veinticinco filas es la que uno acaba de mandar. Es el mismo
   violeta lavado con el que esta consola marca lo suyo, y el mismo que usa
   Policies. */
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

const opcionesAudiencia = (filas: Anuncio[]): FilterOption[] =>
  ORDEN_AUDIENCIAS.map((value) => ({
    value,
    label: AUDIENCIAS[value],
    hint: String(filas.filter((a) => claveDeAudiencia(a) === value).length),
  }));

const opcionesLectura = (filas: Anuncio[]): FilterOption[] =>
  ORDEN_LECTURA.map((value) => ({
    value,
    label: LECTURA[value],
    hint: String(filas.filter((a) => tramoDeLectura(a) === value).length),
  }));

const opcionesRemitente = (filas: Anuncio[]): FilterOption[] =>
  REMITENTES.map((value) => ({
    value,
    label: value,
    hint: String(filas.filter((a) => a.remitente === value).length),
  }));

const OPCIONES_FECHA: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: Anuncio[]): FilterGroup[] => [
  {
    label: "The announcement",
    attributes: [
      { id: "title", label: "Title", icon: Type, type: "text" },
      {
        id: "audience",
        label: "Recipients",
        icon: UsersRound,
        options: opcionesAudiencia(filas),
      },
      /* La lectura entra en tramos y no como un número: nadie busca "los que
         están en el 62%". Lo que se busca es lo que hay que empujar —lo que no
         abrió nadie— y lo que ya está resuelto. */
      {
        id: "engagement",
        label: "Engagement",
        icon: Eye,
        options: opcionesLectura(filas),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      {
        id: "sender",
        label: "Sender",
        icon: UserPen,
        options: opcionesRemitente(filas),
      },
      /* `single`, como los tramos de Accounts, Provisioning y Policies: "este
         mes o este año" es "este año". Elegir uno reemplaza al anterior. */
      {
        id: "sent",
        label: "Sent on",
        icon: CalendarCheck,
        options: OPCIONES_FECHA,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada anuncio para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (a: Anuncio) => string[]> = {
  audience: (a) => [claveDeAudiencia(a)],
  engagement: (a) => [tramoDeLectura(a)],
  sender: (a) => [a.remitente],
  sent: (a) => [tramoAlta(a.enviadoEl)],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

/** Contra qué busca la barra de arriba: lo que el anuncio dice, a quiénes salió
 *  y quién lo mandó.
 *
 *  Los nombres de los destinatarios entran **sólo cuando el anuncio salió a
 *  cuentas elegidas**. Es la diferencia entre "buscá el anuncio que le mandaron
 *  a Camila" —que es una pregunta— y hacer que "Camila" devuelva los catorce
 *  anuncios que salieron a toda la casa, que es no filtrar nada. Al que salió a
 *  un grupo se lo encuentra por el grupo, que es lo que la fila dice. */
const buscable = (anuncio: Anuncio, aQuienes: string) => [
  anuncio.titulo,
  aQuienes,
  anuncio.remitente,
  ...(anuncio.audiencia.clase === "cuentas"
    ? anuncio.destinatarios.map((u) => u.name)
    : []),
];

function pasa(
  anuncio: Anuncio,
  aQuienes: string,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim().toLowerCase();
  if (texto && !contiene(buscable(anuncio, aQuienes), texto)) return false;

  return Object.entries(filtros).every(([id, valores]) => {
    /* El único atributo de texto del panel es el título, y busca contra el
       título: es la misma pregunta que la barra pero acotada a una columna. */
    if (id === "title") return valores.some((v) => contiene([anuncio.titulo], v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(anuncio);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El título se lleva la porción más grande: es una oración entera —"Water will
   be off Tuesday from 9 to 12"— y es lo que se lee y lo que se busca.

   Engagement no es la más ancha pero tampoco puede ser la más angosta: adentro
   van dos números, un porcentaje y una barra, y apretada los tres primeros se
   pisan. La fecha es la más chica porque mide lo que mide —"Aug 13, 2026"— en
   cualquier ancho de ventana. */
const COLUMNAS = [
  { id: "title", ancho: "33%" },
  { id: "recipients", ancho: "20%" },
  /* Un punto más que lo que su contenido pide: esta columna se lleva una
     sangría más ancha a la derecha —ver su celda— y ese aire sale de acá. Sin
     el punto, en una ventana angosta el gutter se lo come al texto y "20 reads
     of 47" empieza a recortarse. */
  { id: "engagement", ancho: "18%" },
  { id: "sender", ancho: "17%" },
  { id: "sent", ancho: "12%" },
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

/** Cuántos anuncios entran en una página. Los mismos que políticas, buzones y
 *  correos: es el mismo mueble mirado con otros ojos, y dos largos de página
 *  distintos harían que el pager cambie de significado al cambiar de sección. */
const POR_PAGINA = 40;

/* ─────────────────────────── La lectura ─────────────────────────── */

/* El violeta de la casa —hue 292, el mismo de la banda de la cabecera y el del
   destello de una fila recién tocada— y no un verde de "todo bien": la barra no
   dice que algo esté bien o mal, dice cuánto de esto pasó. Un verde y un rojo
   convertirían un 60% en una nota, y a un anuncio de un corte de agua nadie lo
   aprueba ni lo desaprueba.

   En el modo oscuro sube de luminosidad: el mismo violeta sobre un fondo oscuro
   se hunde hasta perder la barra contra su carril. */
const RELLENO = "bg-[oklch(0.62_0.16_292)] dark:bg-[oklch(0.74_0.14_292)]";


/** Hasta dónde crece el contenido de la celda: 176px.
 *
 *  El ancho de la columna sale de un porcentaje de la tabla, y eso es lo que la
 *  mantiene proporcionada en una ventana normal. En un monitor ancho el
 *  porcentaje deja de servir: la columna se va a los 300 y pico, la barra se
 *  estira hasta parecer un separador y el porcentaje se despega tanto de los
 *  números que dejan de leerse como una sola cosa.
 *
 *  Así que la celda crece con la tabla hasta acá y después se planta. La frase
 *  más larga que puede caer adentro —"20 reads of 47" con un "100%" al final—
 *  mide unos 115, así que 176 la deja entera con aire de sobra y sigue siendo
 *  una medida de dato y no de columna. El sobrante queda a la derecha, del lado
 *  de la columna que sigue, y no entre el número y su porcentaje.
 *
 *  Por debajo de 160 la cosa cambia de naturaleza: la barra deja de tener
 *  resolución —a 120px, un 43% y un 47% son el mismo dibujo— y lo que hoy es
 *  una referencia pasa a ser un adorno. */
const TECHO = "max-w-44";

/**
 * Engagement — cuántos lo abrieron, de cuántos lo recibieron.
 *
 * Tres cosas en una celda, y en este orden: los dos números, el porcentaje y la
 * barra. Los números son la respuesta —"1 read of 2" es un hecho, y de dos
 * destinatarios el porcentaje es una manera pomposa de decir "uno"—; el
 * porcentaje está para comparar filas entre sí, que con audiencias de dos y de
 * cuarenta y ocho no se puede hacer con los números crudos; y la barra está para
 * poder recorrer la columna sin leer ninguno de los dos.
 *
 * Los tres dicen lo mismo a propósito. No es redundancia: es una respuesta para
 * cada una de las tres velocidades a las que se mira una tabla.
 */
function Engagement({ anuncio }: { anuncio: Anuncio }) {
  const escala = useTypeScale();
  const total = cuantosRecibieron(anuncio);
  const leidos = anuncio.leidos.length;

  /* Sin destinatarios no hay nada que medir, y la barra vacía diría "no lo leyó
     nadie" cuando lo que pasó es que no le llegó a nadie. Son dos hechos
     distintos y la celda no puede confundirlos. */
  if (total === 0) {
    return <span className="text-muted-foreground">No recipients</span>;
  }

  const porcentaje = Math.round(tasaDeLectura(anuncio) * 100);

  return (
    <span className={cn("flex flex-col gap-1", TECHO)}>
      <span className="flex items-baseline justify-between gap-2">
        {/* El número que se lee primero va en el color del texto y el resto de
            la frase en el gris: lo que se recorre con la vista es cuántos
            abrieron, y "read of 48" es la unidad, no el dato. */}
        <span className="min-w-0 truncate text-muted-foreground">
          <span className="text-foreground tabular-nums">{leidos}</span>{" "}
          {leidos === 1 ? "read" : "reads"} of{" "}
          <span className="tabular-nums">{total}</span>
        </span>

        <span
          className="shrink-0 text-muted-foreground tabular-nums"
          style={{ fontSize: escala.caption }}
        >
          {porcentaje}%
        </span>
      </span>

      {/* La barra, oculta para quien lee de a una celda: es el mismo dato que la
          línea de arriba dibujado, y un lector de pantalla que lo anuncie dos
          veces cuenta dos hechos. Dos píxeles de alto —es una referencia, no un
          control—, y el carril se queda a la vista cuando el relleno mide cero,
          que es la fila que hay que ver. */}
      <span
        aria-hidden
        className="block h-0.5 w-full overflow-hidden rounded-full bg-border"
      >
        <span
          className={cn("block h-full rounded-full", RELLENO)}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
    </span>
  );
}

/* ─────────────────────────── La pantalla ─────────────────────────── */

/** `tabId` es el de la pestaña que la monta: la ficha de alta se pone en **su**
 *  board, no en el de la que esté puesta. Las pestañas que no se miran siguen
 *  montadas, y escribir contra "la activa" le pondría la ficha en la cara a
 *  otra. */
export function Announcements({ tabId }: { tabId?: string }) {
  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size="compact">
      <Pantalla tabId={tabId} />
    </SizeProvider>
  );
}

function Pantalla({ tabId }: { tabId?: string }) {
  /* El alta vive en el riel y no en un diálogo: escribir un aviso es justamente
     cuando hace falta poder mirar los que ya salieron. Ver `NuevoAnuncio`. */
  const alta = useAltaDeAnuncio(tabId);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const escala = useTypeScale();
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const todos = useAnuncios();

  /* A quiénes llegó, escrito una vez por fila y usado tres veces —la columna, la
     búsqueda y el `title`—: resolverlo adentro de cada uso sería armar la frase
     tres veces por fila. */
  const conDestino = useMemo(
    () => todos.map((anuncio) => ({ anuncio, aQuienes: aQuienesLlego(anuncio) })),
    [todos],
  );

  const encontrados = useMemo(
    () =>
      conDestino.filter(({ anuncio, aQuienes }) =>
        pasa(anuncio, aQuienes, busqueda, filtros),
      ),
    [conDestino, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

  const openTab = useWorkspace((w) => w.openTab);
  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

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
            Announcements
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            What the house told everyone &mdash; and how much of it got read.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search announcements"
              labelHidden
              icon={Search}
              placeholder="Search announcements"
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
              la barra busca y filtra, que es mirar. Va `primary` y última,
              contra el borde, que es donde este sistema deja la acción.

              Un `+` y el sustantivo, y no el megáfono con "New": el glifo de la
              sección ya está a la vista dos veces —en la fila del sidebar y en
              la pestaña—, así que repetirlo acá no ubicaba nada; lo que el botón
              tiene que decir es qué hace, y eso lo dice el `+`. Con el signo
              delante, el "New" pasa a ser la misma palabra escrita dos veces.

              Todavía no hace nada: lo que falta es dónde se escribe un anuncio
              —a quiénes, con qué texto—, y eso es una ficha entera, no un
              handler. El botón está para que la pantalla tenga su lugar de
              entrada y para poder ver la barra completa; el `onClick` se
              engancha acá cuando esa ficha exista. */}
          {/* Va última, contra el borde, que es donde este sistema deja la
              acción: el resto de la barra busca y filtra, que es mirar. */}
          <BotonDeAlta onClick={alta.abrir} disponible={alta.disponible}>
            Announcement
          </BotonDeAlta>
        </div>
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <MegaphoneOff />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No announcements</AnimatedEmptyTitle>
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
                  <TableHead>Title</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Sent Date</TableHead>
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
                {filas.map(({ anuncio, aQuienes }, i) => {
                  /* Una cuenta sola se muestra como cuenta —con su ficha
                     detrás—; varios elegidos se resumen y se asoman; un grupo se
                     nombra y nada más. Los tres casos se distinguen por lo que
                     dicen: "Everyone" no se parece a un nombre propio, y con un
                     glifo por delante lo que se ganaba era repetir en un dibujo
                     lo que el texto ya decía —y meterle una sangría a la única
                     columna que la tabla no le puso a ninguna otra—.

                     Los renglones de la tarjeta salen de dos lados según cómo
                     se mandó: los que la consola mandó nombran a quiénes uno por
                     uno —buzones de la casa incluidos—, y los que ya estaban
                     salieron a un grupo que se resuelve contra el padrón. La
                     tarjeta los muestra igual: la pregunta es la misma. */
                  const propios = anuncio.objetivos.length > 0;
                  const renglones = propios
                    ? anuncio.objetivos
                    : anuncio.destinatarios.map((u) => ({
                        id: u.id,
                        nombre: u.name,
                      }));
                  const aCuentas = anuncio.audiencia.clase === "cuentas";
                  const unico =
                    aCuentas && !propios && anuncio.destinatarios.length === 1
                      ? anuncio.destinatarios[0]
                      : undefined;
                  /* Se asoma cuando hay más de uno que nombrar. Con uno solo la
                     celda ya lo dice entero, y una tarjeta que repite lo que
                     está a la vista es una tarjeta que estorba. */
                  const seAsoma = (propios || aCuentas) && renglones.length > 1;

                  /* Sin destello, `initial`/`animate` en el mismo valor: la
                     fila no anima nada y el envoltorio no cuesta nada. */
                  const tocada = anuncio.id === alta.recienMandado;

                  return (
                    <FilaAnimada
                      key={anuncio.id}
                      index={i}
                      initial={tocada ? "encendida" : false}
                      animate={tocada ? "apagada" : undefined}
                      variants={DESTELLO}
                    >
                      {/* Lo que se dijo, y nada más. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={anuncio.titulo}
                        >
                          {anuncio.titulo}
                        </motion.span>
                      </TableCell>

                      {/* A quiénes salió. Cuando es una cuenta sola, es también
                          el disparador de su ficha —la misma que abre el nombre
                          en Accounts—: la cuenta es la misma cosa se la mire
                          desde donde se la mire. Un grupo no tiene ficha que
                          abrir, así que ahí es texto: no se inventa una cuenta
                          detrás de "Everyone" para que las filas se vean todas
                          iguales. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="flex w-fit max-w-full min-w-0"
                        >
                          {unico ? (
                            <TarjetaUsuario
                              usuario={unico}
                              onEstado={cambiarEstado}
                              onPerfil={abrirCuenta}
                            >
                              {unico.name}
                            </TarjetaUsuario>
                          ) : seAsoma ? (
                            /* Con varios, la celda escribe el primero y cuántos
                               más, y el resto se asoma —con su lectura al lado,
                               que es lo que la columna de al lado deja a
                               medias—. */
                            <AnnouncementRecipients
                              destinatarios={renglones}
                              leidos={anuncio.leidos}
                              resumen={aQuienes}
                            />
                          ) : (
                            /* El grupo —o el único elegido—, con a cuántos les
                               llegó en el `title`: el número entero vive en la
                               columna de al lado, y repetirlo acá sería contar
                               dos veces lo mismo. */
                            <span
                              className="min-w-0 truncate"
                              title={`${aQuienes} · ${cuantosRecibieron(anuncio)} recipients`}
                            >
                              {aQuienes}
                            </span>
                          )}
                        </motion.span>
                      </TableCell>

                      {/* Cuántos lo abrieron. Es la columna por la que se entra
                          a esta pantalla.

                          Más aire a la derecha que el resto de las celdas —24px
                          contra los 10 del escalón compacto, que es la misma
                          sangría con la que la tabla se despega de sus bordes—.
                          No es un capricho de esta columna: es la única cuyo
                          contenido llega **siempre** hasta el borde derecho —el
                          porcentaje va alineado ahí, y la barra mide todo el
                          ancho—, así que los 10px que a las otras les sobran acá
                          son todo lo que queda entre el "43%" y el nombre del
                          remitente. Con el aire de las demás, las dos columnas
                          se leen como una sola. */}
                      <TableCell className="pr-6">
                        <motion.span variants={entraCelda} className="block">
                          <Engagement anuncio={anuncio} />
                        </motion.span>
                      </TableCell>

                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={anuncio.remitente}
                        >
                          {anuncio.remitente}
                        </motion.span>
                      </TableCell>

                      {/* Cuándo salió, con el día entero y no en relativo: es la
                          misma fecha, escrita igual, que la Date Added de
                          Accounts, la Created At de Provisioning y la Created on
                          de Policies. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                          title={fechaDia(anuncio.enviadoEl)}
                        >
                          {fechaDia(anuncio.enviadoEl)}
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
