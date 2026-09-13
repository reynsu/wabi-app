import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  AudioLines,
  CalendarClock,
  Contact,
  CornerUpRight,
  MessageSquareOff,
  MessageSquareText,
  MessagesSquare,
  Search,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { AudioMessage } from "@/components/audio-message";
import { MessageImage } from "@/components/message-image";
import { punto } from "@/components/color-dot";
import { LateralPreview } from "@/components/lateral-preview";
import { MessageThread } from "@/components/message-thread";
import { usePreview } from "@/stores/preview";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { useWorkspace } from "@/stores/workspace";
import { Button } from "@/components/ui/button";
import { contiene } from "@/pages/texto";
import { esFoto, esNota, type Conversacion } from "@/pages/conversaciones";
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
import { useEsMovil } from "@/hooks/use-es-movil";
import { useListaInfinita } from "@/hooks/use-lista-infinita";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { BOTON_EN_PILDORA, CAMPO_EN_PILDORA } from "@/movil/buscador";
import { FilaMovil, ListaMovil } from "@/movil/lista";
import { usePaginacion } from "@/hooks/use-paginacion";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { TarjetaUsuario } from "@/pages/Users";
import {
  DIRECCIONES,
  ORDEN_DIRECCIONES,
  destinatarioDe,
  direccionDe,
  relacionesDe,
  remitenteDe,
  todosLosMensajes,
  type MensajeEnContexto,
  type Participante,
} from "@/pages/mensajes";
import { tabDePerfil } from "@/pages/perfil-tab";
import { diasDesde, fechaLarga, haceCuanto } from "@/pages/tiempo";
import {
  ESTADOS,
  cambiarEstado,
  useUsuarios,
  type Usuario,
} from "@/pages/usuarios";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";
import { useTecladoDeTabla } from "@/pages/tabla-teclado";

/* La pantalla de Messages Search: los mensajes de toda la casa, no los de un
   hilo.

   Es el mismo mueble que Accounts Search y Email Search —un header con la
   búsqueda y el `FilterMenu`, la tabla debajo, el pager abajo de todo— porque
   son tres maneras de buscar en la misma consola, y cambiar de fila del
   sidebar no debería cambiar de mueble. Lo que cambia es qué hay adentro, que
   es lo único que tiene por qué cambiar.

   Tres columnas: entre quiénes fue, qué dice, y cuándo salió. El texto se lleva
   el ancho porque es lo que uno lee para decidir —el resto de la fila sólo lo
   ubica—.

   Lo que la separa de Email Search es que acá **las dos puntas del mensaje
   están en la misma celda**. Un correo se busca por autor; un mensaje de chat
   no se entiende sin el otro lado —"Lucía" arriba y "to Camila Ferreyra" abajo
   es la fila entera contada en dos renglones—. De esas dos puntas, la que es
   una cuenta de la consola abre su tarjeta y lleva a su perfil; el contacto es
   un nombre y se queda quieto. Ver `Nombre`. */

/* ─────────────────────────── El movimiento ───────────────────────────

   Los mismos escalones y las mismas variantes que Email Search, y a propósito:
   son la misma pantalla con otro contenido, y dos entradas distintas para el
   mismo gesto —tocar una fila del sidebar— se leen como dos apps.

   La animación entera se apaga sola con `prefers-reduced-motion`: `main.tsx`
   monta `MotionConfig reducedMotion="user"`. */

const cascadaPantalla = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.04 } },
} as const;

/** Un bloque de la pantalla —el header, el pie—: se enciende y se acerca. */
const entraBloque = {
  oculto: { opacity: 0, scale: 0.99 },
  visible: { opacity: 1, scale: 1, transition: spring.moderate },
} as const;

/** La tabla: sólo se enciende. Una tabla que se agranda arrastra sus líneas y
 *  su banda con ella, y eso es un mueble moviéndose, no una lista apareciendo. */
const entraTabla = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: spring.moderate },
} as const;

/** El texto de una celda: entra desenfocado y se enfoca. Todas al mismo tiempo
 *  —en una búsqueda los resultados no llegaron uno detrás del otro, estaban
 *  todos ahí—, y en el texto y no en la fila, porque desenfocar un borde de un
 *  píxel lo hace desaparecer. */
const entraCelda = {
  oculto: { opacity: 0, filter: "blur(5px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: spring.slow },
} as const;

/* ─────────────────────────── Los nombres ─────────────────────────── */

/* Una de las dos puntas del mensaje.
 *
 * Si es una cuenta de la consola va la misma `TarjetaUsuario` que abre el
 * nombre en Accounts Search y la dirección en Email Search: se asoma con el
 * puntero encima y con el clic lleva al perfil. Una cuenta es la misma cosa se
 * la mire desde donde se la mire, así que la ficha que la ficha también.
 *
 * Si es un contacto —la hija, la recepción, el médico— va el nombre solo, sin
 * subrayado y sin cursor de mano. No es una omisión: esta consola administra
 * cuentas, y el contacto no es una. Una tarjeta con los campos vacíos y un
 * clic que no lleva a ningún lado prometen una ficha que no existe, y eso se
 * descubre después de haber ido a buscarla. Que no se pueda tocar es la
 * respuesta, dada antes de la pregunta.
 *
 * El clic para el nombre siempre: la fila entera abre el perfil en la sección
 * Conversations, así que sin frenarlo el clic de la tarjeta y el de la fila
 * pedirían la misma pestaña dos veces. */
function Nombre({
  participante,
  onPerfil,
}: {
  participante: Participante;
  onPerfil: (usuario: Usuario) => void;
}) {
  if (!participante.usuario) {
    return <span className="truncate">{participante.nombre}</span>;
  }

  return (
    /* La caja flex no es decoración: el disparador de la tarjeta es un `span`
       —inline—, y a un inline el `max-w-full` que lo recortaría no le aplica.
       Adentro de un flex se convierte en ítem y ahí sí se corta, en vez de
       empujar la columna del texto cuando el panel viene angosto. Es la misma
       caja que usan las otras dos tablas alrededor del nombre. */
    <span
      className="flex w-fit max-w-full min-w-0"
      onClick={(e) => e.stopPropagation()}
    >
      <TarjetaUsuario
        usuario={participante.usuario}
        onEstado={cambiarEstado}
        onPerfil={onPerfil}
      />
    </span>
  );
}

/* ─────────────────────────── El vistazo ─────────────────────────── */

/* La conversación abierta en el riel, con el mensaje que se vino a ver marcado.
 *
 * Es el mismo hilo que muestra el perfil —las mismas burbujas, los mismos
 * separadores de día— y se escribe igual a propósito: un hilo leído desde la
 * búsqueda y el mismo hilo leído desde la cuenta no son dos cosas. Lo que
 * cambia es el mueble: allá es media pantalla con la lista de hilos al lado,
 * acá es la columna del riel, así que con quién es la conversación sube al
 * header del `LateralPreview` en vez de repetirse adentro.
 *
 * Lo que agrega el riel es el resaltado. Se llegó acá desde **un** mensaje, no
 * desde el hilo: abrirlo sin marcar cuál era dejaría a quien buscó volviendo a
 * buscar a ojo, adentro del hilo, lo que ya había encontrado en la tabla. */
function ConversacionEnElRiel({
  conversacion,
  usuario,
  mensajeId,
  onClose,
  onCuenta,
}: {
  conversacion: Conversacion;
  usuario: Usuario;
  mensajeId: string;
  onClose: () => void;
  onCuenta: () => void;
}) {
  return (
    <LateralPreview
      title={conversacion.contacto}
      /* Qué es de la cuenta, y de qué cuenta: el nombre del contacto solo no
         dice ninguna de las dos cosas, y las dos son lo que ubica el hilo. Van
         en el subtítulo y no adentro del cuerpo —que es donde vivían en el
         perfil— porque el riel desvanece lo que toca su borde de arriba: un
         renglón de identificación medio borrado es peor que no ponerlo. Es el
         mismo subtítulo que arma Email Search con la carpeta y la cuenta. */
      subtitle={`${conversacion.relacion} · ${usuario.name}`}
      icon={MessagesSquare}
      onClose={onClose}
      footer={
        <Button
          variant="secondary"
          leadingIcon={MessagesSquare}
          className="w-full"
          onClick={onCuenta}
        >
          {/* Dice adónde lleva: no a la cuenta a secas, sino a esta misma
              conversación adentro de la cuenta. */}
          Open in account conversations
        </Button>
      }
    >
      {/* El hilo entero. Sin aire lateral propio —el riel ya lo pone— y con el
          `-mx-` que le devuelve a las burbujas el ancho completo de la columna:
          en un riel angosto, cuatro píxeles de más por lado son un renglón
          menos por burbuja. */}
      <MessageThread
        mensajes={conversacion.mensajes}
        resaltado={mensajeId}
        className="px-0 py-0"
      />
    </LateralPreview>
  );
}

/* ─────────────────────────── El tiempo ─────────────────────────── */

/* En qué tramo de los que ofrece el panel cae un mensaje. Es la contracara de
   `OPCIONES_ENVIO`: los dos hablan de lo mismo, así que mover un corte acá y no
   allá es lo que hace que un filtro devuelva algo distinto de lo que promete. */
const tramoEnvio = (iso: string) => {
  const dias = diasDesde(iso);
  if (dias < 1) return "today";
  if (dias < 7) return "week";
  if (dias < 30) return "month";
  return "older";
};

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: es
   la misma razón que en las otras dos pantallas —un panel que dice un número y
   devuelve otro miente sobre lo que va a hacer—. */

const opcionesDireccion = (filas: MensajeEnContexto[]): FilterOption[] =>
  ORDEN_DIRECCIONES.map((value) => ({
    value,
    label: DIRECCIONES[value].label,
    icon: punto(DIRECCIONES[value].tinte),
    hint: String(filas.filter((f) => direccionDe(f) === value).length),
  }));

const opcionesRelacion = (filas: MensajeEnContexto[]): FilterOption[] =>
  relacionesDe(filas).map((value) => ({
    value,
    label: value,
    hint: String(filas.filter((f) => f.conversacion.relacion === value).length),
  }));

const opcionesEstado = (filas: MensajeEnContexto[]): FilterOption[] =>
  (Object.keys(ESTADOS) as (keyof typeof ESTADOS)[]).map((value) => ({
    value,
    label: ESTADOS[value].label,
    icon: punto(ESTADOS[value].tinte),
    hint: String(filas.filter((f) => f.usuario.status === value).length),
  }));

/* De qué está hecho el mensaje. Es el filtro que hace usable la búsqueda cuando
   la mitad de lo que pasa por la casa no es texto: "quiero oír lo que dijo",
   "quiero ver qué mandó", o al revés, "quiero leer y no abrir sesenta cosas". */
const opcionesFormato = (filas: MensajeEnContexto[]): FilterOption[] =>
  [
    {
      value: "text",
      label: "Text",
      prueba: (f: MensajeEnContexto) => !esNota(f.mensaje) && !esFoto(f.mensaje),
    },
    {
      value: "voice",
      label: "Voice note",
      prueba: (f: MensajeEnContexto) => esNota(f.mensaje),
    },
    {
      value: "image",
      label: "Image",
      prueba: (f: MensajeEnContexto) => esFoto(f.mensaje),
    },
  ].map(({ value, label, prueba }) => ({
    value,
    label,
    hint: String(filas.filter(prueba).length),
  }));

const OPCIONES_ENVIO: FilterOption[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "older", label: "Older" },
];

const grupos = (filas: MensajeEnContexto[]): FilterGroup[] => [
  {
    label: "The message",
    attributes: [
      { id: "text", label: "Content", icon: MessageSquareText, type: "text" },
      { id: "sender", label: "Sender", icon: UserRound, type: "text" },
      { id: "recipient", label: "Recipient", icon: CornerUpRight, type: "text" },
      {
        id: "direction",
        label: "Direction",
        icon: ArrowLeftRight,
        options: opcionesDireccion(filas),
      },
      {
        id: "format",
        label: "Format",
        icon: AudioLines,
        options: opcionesFormato(filas),
      },
      /* `single`, como los tramos de Accounts: "hoy o esta semana" es "esta
         semana". Elegir uno reemplaza al anterior. */
      {
        id: "sent",
        label: "Date sent",
        icon: CalendarClock,
        options: OPCIONES_ENVIO,
        single: true,
      },
    ],
  },
  {
    label: "The thread",
    attributes: [
      {
        id: "relation",
        label: "Relationship",
        icon: Contact,
        options: opcionesRelacion(filas),
      },
      {
        id: "status",
        label: "Account status",
        icon: UsersIcon,
        options: opcionesEstado(filas),
      },
    ],
  },
];

/** De qué valores dispone cada mensaje para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (f: MensajeEnContexto) => string[]> = {
  direction: (f) => [direccionDe(f)],
  format: (f) => [
    esNota(f.mensaje) ? "voice" : esFoto(f.mensaje) ? "image" : "text",
  ],
  relation: (f) => [f.conversacion.relacion],
  status: (f) => [f.usuario.status],
  sent: (f) => [tramoEnvio(f.mensaje.cuando)],
};

/** Los atributos de texto: los del panel que no tienen lista, y también contra
 *  qué busca la barra de arriba. Es la misma pregunta escrita dos veces, así
 *  que se contesta en un solo lugar. */
const TEXTOS: Record<string, (f: MensajeEnContexto) => string[]> = {
  text: (f) => [f.mensaje.texto],
  sender: (f) => [remitenteDe(f).nombre],
  recipient: (f) => [destinatarioDe(f).nombre],
};

function pasa(
  fila: MensajeEnContexto,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim();
  /* La barra de arriba busca en lo que la fila muestra —los dos nombres y el
     mensaje— y además en el id de la cuenta: la tabla no lo tiene en ninguna
     columna, pero es lo primero que uno pega ahí cuando llegó desde un
     perfil. */
  if (
    texto &&
    !contiene(
      [
        fila.mensaje.texto,
        remitenteDe(fila).nombre,
        destinatarioDe(fila).nombre,
        fila.usuario.id,
      ],
      texto,
    )
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    const libre = TEXTOS[id];
    if (libre) return valores.some((v) => contiene(libre(fila), v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(fila);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El texto se lleva la mitad: es lo único que se lee para decidir. El
   remitente se queda con lo que mide un nombre y la fecha con lo justo para su
   renglón. */
const COLUMNAS = [
  { id: "sender", ancho: "30%" },
  { id: "content", ancho: "52%" },
  { id: "sent", ancho: "18%" },
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

/** Cuántos mensajes entran en una página. */
const POR_PAGINA = 40;

export function MessageSearch() {
  /* Compacta en escritorio y normal en el teléfono, como Accounts: el escalón
     denso existe porque son cuarenta filas peleando por el alto de una
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
  /* Los mensajes de todas las cuentas, del más nuevo al más viejo. Salen de la
     lista viva de usuarios: el día que se dé de baja a alguien, sus mensajes se
     van con él sin que esta pantalla tenga que enterarse. */
  const usuarios = useUsuarios();
  const todos = useMemo(() => todosLosMensajes(usuarios), [usuarios]);
  const escala = useTypeScale();
  /* Lo que mide la cabecera, para que el scroller reserve ese alto arriba: la
     cabecera flota encima, así que sin la reserva las primeras filas nacerían
     tapadas. */
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const encontrados = useMemo(
    () => todos.filter((f) => pasa(f, busqueda, filtros)),
    [todos, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

  const openTab = useWorkspace((w) => w.openTab);

  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* El riel muestra una conversación a la vez, y la que muestra es la de esta
     pestaña: el `PreviewProvider` guarda una por scope, así que dos copias de
     esta pantalla no se pisan el vistazo. */
  const { show, close } = usePreview();

  /* La fila entera abre el hilo en el riel, con su mensaje marcado. En el riel
     y no en una pestaña nueva: quien está barriendo una tabla de setecientos
     mensajes quiere ver el contexto de uno **sin irse de la tabla**, y una
     pestaña por fila deja la barra llena de perfiles a los tres clics. Al
     perfil se sigue llegando, desde el pie del vistazo. */
  const abrirHilo = useCallback(
    ({ usuario, conversacion, mensaje }: MensajeEnContexto) =>
      show(
        <ConversacionEnElRiel
          /* Abrir otra conversación es cambiar de contenido, no actualizarlo:
             sin la `key` React reusaría el hilo que ya está y el scroll se
             quedaría donde lo dejó el anterior —y el resaltado no se traería a
             la vista, porque el efecto no vuelve a correr—. La clave lleva el
             mensaje y no el hilo: dos filas del mismo hilo son dos vistazos
             distintos, cada uno marcando el suyo. */
          key={mensaje.id}
          conversacion={conversacion}
          usuario={usuario}
          mensajeId={mensaje.id}
          onClose={close}
          /* Al perfil, a sus conversaciones, y a **esta** conversación: el
             vistazo se abrió desde un mensaje de ella, así que su pantalla
             entera es la sección Conversations de la cuenta con ese hilo
             abierto. */
          onCuenta={() =>
            openTab(tabDePerfil(usuario, "conversations", conversacion.id))
          }
        />,
      ),
    [show, close, openTab],
  );

  /* En qué página estamos, con la clave de lo que estaba filtrado cuando se
     eligió: cambiar el filtro vuelve a la primera, la página se acota contra el
     total, y cambiar de página vuelve arriba. Las tres decisiones viven en el
     hook —lo mismo hacen Provisioning y Email Search—. */
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
  /* Y en el teléfono no hay páginas: la lista se sigue. Un pager es de
     escritorio —hay un pie fijo, un teclado para saltar a la siete y un "de
     cuántos" que ubica—; en un teléfono el pulgar ya está haciendo el gesto de
     bajar, y cortarlo cada cuarenta filas para que toque una flecha es pedirle
     que cambie de modo para seguir haciendo lo mismo. Ver `useListaInfinita`.

     Los dos hooks se llaman siempre y se elige uno: son hooks, y el que no se
     usa no hace nada —el de la lista sólo mira el centinela, que en escritorio
     no se monta—. */
  const { filas: seguidas, centinela } = useListaInfinita(encontrados, clave);
  const filas = esMovil ? seguidas : paginadas;

  /* El teclado de la tabla: una sola parada de tabulado —la fila donde
     quedaste— y las flechas adentro. Ver `tabla-teclado`.

     Con `onActivar`, porque acá la fila entera hace algo: `Enter` y `Espacio`
     abren el hilo, que es lo mismo que promete el cursor de mano sobre el
     renglón. */
  const teclado = useTecladoDeTabla({
    cuantas: filas.length,
    sangriaSuperior: altoCabecera,
    onActivar: (i) => abrirHilo(filas[i]),
  });

  return (
    /* La pantalla reparte los turnos y sus piezas los toman: el header, la
       cabecera de la tabla y el cuerpo son sus hijos, y las filas los hijos del
       cuerpo. El estado viaja por el contexto de Framer, así que el `ScrollArea`
       y la `Table` que hay en el medio no lo cortan. */
    <motion.div
      variants={cascadaPantalla}
      initial="oculto"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col"
    >
      {/* En el teléfono el header es el buscador y nada más: el header del
          shell ya dice dónde estás —"Chat / Search"—, y el título con su bajada
          cuesta dos renglones de los diez que hay. Mismo criterio, mismo aire y
          misma píldora que Accounts: son dos maneras de buscar en la misma
          consola y no tienen por qué recibir distinto. */}
      {esMovil ? (
        <motion.header
          variants={entraBloque}
          className="flex shrink-0 items-center gap-2 px-4 py-3"
        >
          <InputGroup className="min-w-0 flex-1">
            <InputField
              index={0}
              label="Search messages"
              labelHidden
              icon={Search}
              placeholder="Search messages"
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
            value={filtros}
            onValueChange={setFiltros}
            className={BOTON_EN_PILDORA}
          />
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
            Messages Search
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Search every message the house has exchanged, and see who said it
            to whom.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search messages"
              labelHidden
              icon={Search}
              placeholder="Search messages"
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
      )}

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <MessageSquareOff />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No messages</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              Nothing matches what you&rsquo;re looking for. Try fewer letters,
              or drop a filter.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      ) : esMovil ? (
        /* En el teléfono la tabla se deshace en filas apiladas —ver
           `movil/lista`—. Las tres columnas no se angostan, se truncan: a 375px
           "Valentina Bermúdez" quedaba en "Valentina B…", el mensaje —que es lo
           que uno vino a buscar— en cinco palabras, y "Just now" en "Jus…".

           Sobrevive lo mismo que en la tabla, repartido de otra manera: arriba
           quién le escribió a quién, abajo lo que dice, y a la derecha cuándo,
           que es la columna por la que se barre la lista.

           El nombre no es un botón acá. En escritorio el remitente lleva a su
           perfil y la fila al hilo —dos blancos en la misma fila, que con un
           puntero se distinguen y con un pulgar no—, así que en el teléfono la
           fila hace una sola cosa: abre el hilo en la hoja. Al perfil se llega
           desde el pie del vistazo, que es donde ya estaba. */
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade scrollbar-hide"
        >
          <ListaMovil>
            {filas.map((fila) => {
              const remitente = remitenteDe(fila);
              const destinatario = destinatarioDe(fila);

              return (
                <FilaMovil
                  key={fila.mensaje.id}
                  id={fila.mensaje.id}
                  /* Los dos nombres en el mismo renglón, el segundo en gris: es
                     el mismo par que la tabla pone en dos, y acá dos renglones
                     de nombres dejarían al mensaje de tercero. Se truncan
                     juntos, y el que se corta primero es el destinatario, que
                     es el que se mira segundo. */
                  titulo={
                    <>
                      {remitente.nombre}
                      <span className="text-muted-foreground">
                        {" "}to {destinatario.nombre}
                      </span>
                    </>
                  }
                  /* Lo que dice. Una foto entra con su miniatura al lado del
                     pie, como en la tabla: treinta y dos píxeles no son para
                     mirar la foto sino para reconocerla —qué es y de qué color
                     es—, y eso vale igual en un teléfono. */
                  /* Y una nota de voz no lleva texto en la fila: lo que se
                     dijo está en la transcripción, y la transcripción tiene su
                     propio botón adentro del reproductor —igual que en la
                     tabla—. Escribirla además acá sería que el botón prometa
                     mostrar algo que ya se está viendo. */
                  detalle={
                    fila.mensaje.voz ? undefined : fila.mensaje.foto ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <MessageImage
                          id={fila.mensaje.id}
                          foto={fila.mensaje.foto}
                          pie={fila.mensaje.texto}
                          variant="thumb"
                        />
                        <span className="min-w-0 truncate">
                          {fila.mensaje.texto}
                        </span>
                      </span>
                    ) : (
                      fila.mensaje.texto
                    )
                  }
                  extra={haceCuanto(fila.mensaje.cuando)}
                  /* Y una nota de voz se escucha acá. Un glifo delante del
                     texto decía "esto fue dicho, no escrito" y nada más: para
                     oírlo había que abrir el hilo, cuando lo que hace falta son
                     veintitrés segundos que ya están cargados. Es el mismo
                     reproductor de la tabla de escritorio y del hilo, en la
                     medida del teléfono.

                     Debajo y no en el renglón del texto: la barra mide 44px de
                     alto y tiene botones adentro, así que no es una línea ni
                     puede vivir dentro del botón de la fila —ver `debajo`—. */
                  debajo={
                    fila.mensaje.voz && (
                      <AudioMessage
                        id={fila.mensaje.id}
                        segundos={fila.mensaje.voz.segundos}
                        transcripcion={fila.mensaje.texto}
                      />
                    )
                  }
                  onClick={() => abrirHilo(fila)}
                />
              );
            })}
          </ListaMovil>

          {/* El final de la lista: cuando se acerca, entra el próximo tramo. */}
          <div ref={centinela} aria-hidden className="h-px" />
        </ScrollArea>
      ) : (
        <motion.div variants={entraTabla} className="relative min-h-0 flex-1">
          {/* Los títulos van afuera del scroller y flotando encima: adentro,
              `scroll-fade` los desvanecería cada vez que hay filas por arriba.
              Las dos tablas se alinean porque comparten `Columnas` y van las
              dos en `table-fixed`. */}
          <div ref={medirCabecera} className="absolute inset-x-0 top-0 z-10">
            <Table
              className={cn("table-fixed", BANDA_TITULOS, SANGRIA, AIRE_TITULOS)}
            >
              <Columnas />
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Content Preview</TableHead>
                  <TableHead>Sent at</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            {/* La reserva para la cabecera que flota encima. Lleva el ancla:
                es lo que la pantalla usa para encontrar la caja que scrollea y
                subirla cuando cambia de página. */}
            <div ref={ancla} style={{ paddingTop: altoCabecera ?? 0 }} />
            <Table
              {...teclado.tabla}
              className={cn("table-fixed", SANGRIA, AIRE_FILA)}
            >
              <Columnas />
              <TableBody>
                {filas.map((fila, i) => {
                  const remitente = remitenteDe(fila);
                  const destinatario = destinatarioDe(fila);

                  return (
                    /* La fila entera abre el hilo en el perfil de la cuenta: es
                       una sola cosa que se puede tocar, y el cursor de mano lo
                       promete en todo el ancho. La única parte que hace otra
                       cosa es un nombre que además es cuenta, que lleva a su
                       perfil a secas —ver `Nombre`—. */
                    <TableRow
                      key={fila.mensaje.id}
                      index={i}
                      {...teclado.fila(i, "cursor-pointer")}
                      onClick={() => abrirHilo(fila)}
                    >
                      {/* Quién lo escribió, y debajo a quién.
                          
                          El destinatario estuvo afuera con el argumento de que
                          en un hilo de a dos se deduce: es el otro. Es cierto
                          leyendo una fila, y deja de serlo recorriendo la
                          tabla, que es lo que uno hace acá. Con sólo el
                          remitente, dos filas seguidas de la misma persona no
                          dicen si le escribió a la misma o a dos distintas, y
                          para saberlo hay que abrir el hilo. Eso convierte una
                          lectura en un clic.
                          
                          Va en un segundo renglón y no en una columna propia:
                          es la contracara del nombre de arriba —el mismo hecho
                          visto del otro lado—, y una columna lo pondría al
                          nivel de lo que dice el mensaje y de cuándo se mandó.
                          
                          En el gris del texto secundario, y el "to" también:
                          lo que se recorre es la columna de los remitentes, y
                          el destinatario está para cuando uno se detuvo en una
                          fila. Dos nombres del mismo peso pelean, y el que
                          ganaría es el de abajo por estar más cerca del que
                          sigue. */}
                      <TableCell className="text-foreground">
                        <motion.div
                          variants={entraCelda}
                          className="flex min-w-0 flex-col gap-0.5"
                        >
                          <Nombre
                            participante={remitente}
                            onPerfil={abrirCuenta}
                          />
                          <span
                            className="flex min-w-0 items-baseline gap-1 text-muted-foreground"
                            style={{ fontSize: escala.caption }}
                          >
                            <span className="shrink-0">to</span>
                            <span className="truncate">
                              {destinatario.nombre}
                            </span>
                          </span>
                        </motion.div>
                      </TableCell>

                      {/* Lo que dice. Un mensaje de texto es su texto, cortado
                          donde no entra; una nota de voz es su onda y una foto
                          es su miniatura, que es lo único que se puede
                          *previsualizar* de cada una —y lo que hace que la fila
                          se distinga de un vistazo, sin leerla—.

                          La transcripción no se pinta al lado de la onda: las
                          dos juntas se llevan la columna y quedan las dos
                          cortadas. Va detrás del botón del reproductor, que la
                          despliega debajo cuando hace falta —y es la que
                          contesta cuando alguien busca lo que se dijo: la
                          búsqueda mira la transcripción, no la onda—. */}
                      <TableCell className="text-foreground">
                        <motion.div variants={entraCelda}>
                          {fila.mensaje.foto ? (
                            /* La miniatura y el pie, en la misma línea. La
                               miniatura no reemplaza al texto: dice que la fila
                               es una imagen y de qué color es, y el pie sigue
                               siendo lo que se lee para decidir —y lo que la
                               búsqueda encuentra—. */
                            <div className="flex min-w-0 items-center gap-2.5">
                              <MessageImage
                                id={fila.mensaje.id}
                                foto={fila.mensaje.foto}
                                variant="thumb"
                              />
                              <span
                                className="min-w-0 truncate"
                                title={fila.mensaje.texto}
                              >
                                {fila.mensaje.texto}
                              </span>
                            </div>
                          ) : fila.mensaje.voz ? (
                            <AudioMessage
                              id={fila.mensaje.id}
                              segundos={fila.mensaje.voz.segundos}
                              transcripcion={fila.mensaje.texto}
                            />
                          ) : (
                            /* El mensaje entero a un hover de distancia: la
                               columna corta, y a veces lo que se buscaba está
                               del otro lado del corte. */
                            <span
                              className="block truncate"
                              title={fila.mensaje.texto}
                            >
                              {fila.mensaje.texto}
                            </span>
                          )}
                        </motion.div>
                      </TableCell>

                      {/* Cuándo salió, en relativo y en un solo renglón. Es lo
                          que uno quiere saber de un mensaje —cuán reciente
                          es—, y la fecha exacta casi nunca: "Aug 9" obliga a
                          restar mentalmente para llegar a lo que "3 w ago" ya
                          dice. Es lo mismo que hace la columna de Email
                          Search, y por la misma razón.

                          El instante entero igual no se pierde: va en el
                          `title`, a un hover de distancia, con día de la
                          semana y hora, para las dos veces que hace falta. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={fechaLarga(fila.mensaje.cuando)}
                        >
                          {haceCuanto(fila.mensaje.cuando)}
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

      {/* El pie: de cuántos se está viendo cuáles, y por dónde se pasa a los
          que siguen. Va afuera del scroller y pegado abajo —es del mueble, no
          de la lista—, así que el pager no se va con el scroll.

          Sólo cuando hay resultados. Un pager sobre una tabla vacía ofrece
          páginas que no existen. Y sólo en escritorio: en el teléfono no hay
          páginas por las que pasar, así que la franja de 49px que las ofrecía
          se la queda la lista. Con ella se va el "1–40 of 727", que es la
          cuenta que le da escala a lo buscado; sigue estando en Email Search y
          en las otras tablas, y acá el que necesita saber si afinar la búsqueda
          lo ve en cuánto tarda en llegar al fondo. */}
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
