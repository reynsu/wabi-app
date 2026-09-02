"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleDot,
  History,
  Image as ImageIcon,
  Lock,
  MessageSquareMore,
  MessageSquareOff,
  Mic,
  Paperclip,
  Save,
  Search,
} from "lucide-react";

import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { MessageThread } from "@/components/message-thread";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListPane } from "@/components/list-pane";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { useShape } from "@/lib/shape-context";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  conversacionesDe,
  esFoto,
  esNota,
  ultimo,
  type Conversacion,
} from "@/pages/conversaciones";
import { cuandoCorto, diasDesde } from "@/pages/tiempo";
import { iniciales, type Usuario } from "@/pages/usuarios";

/* La sección Conversations del perfil: la lista a la izquierda, el hilo
   abierto a la derecha.

   Es la forma que tiene un cliente de chat porque es lo que hay que leer: una
   conversación no se entiende por partes, y una lista de hilos sin el hilo al
   lado obliga a ir y volver perdiendo el lugar cada vez. Los dos paneles
   scrollean por separado —elegir el hilo número doce y leerlo entero no tiene
   por qué mover la lista— y los separa el mismo filete de un píxel que separa
   todo lo demás en esta pantalla.

   Es de **sólo lectura**. Esta es una consola de administración: quien la abre
   está moderando, no participando, y una caja de texto abajo diría que puede
   contestar en nombre de otro. La barra del pie lo dice con todas las letras,
   porque un chat sin dónde escribir se lee como un chat roto. */

/* ─────────────────────────── El movimiento ───────────────────────────

   Los escalones salen de `lib/springs` y no de una duración inventada acá:
   abrir una conversación y filtrar la lista son **reacciones** —algo que la
   persona tocó y tiene que contestar enseguida—, que es para lo que ese
   archivo está. No es el caso de `AnimatedEmpty`, que es una presentación y
   por eso tuvo que traerse pasos propios más lentos.

   Lo único que se agrega es el reparto de turnos. Lo de las burbujas se lo
   lleva `MessageThread`, que es el que las pinta; acá queda lo de la lista.

   La animación entera se apaga sola con `prefers-reduced-motion`: `main.tsx`
   monta `MotionConfig reducedMotion="user"`, que le saca a estas variantes lo
   que se mueve y le deja lo que se enciende. */

/* La lista arranca un poco más suelta que el hilo: son cuatro o cinco filas y
   no diez burbujas, así que el turno puede ser más largo sin que se note la
   espera. */
const cascadaLista = {
  oculto: {},
  visible: { transition: { delayChildren: 0.03, staggerChildren: 0.045 } },
} as const;

/** Una fila de la lista: entra desde la izquierda, que es de donde viene. */
const entraFila = {
  oculto: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: spring.moderate },
} as const;

/* ─────────────────────────── La lista ─────────────────────────── */

function Fila({
  conversacion,
  elegida,
  resaltada,
  onElegir,
  registrar,
}: {
  conversacion: Conversacion;
  elegida: boolean;
  resaltada: boolean;
  onElegir: () => void;
  registrar: (node: HTMLElement | null) => void;
}) {
  const escala = useTypeScale();
  const shape = useShape();
  const final = ultimo(conversacion);

  return (
    <motion.button
      ref={registrar}
      variants={entraFila}
      type="button"
      role="option"
      aria-selected={elegida}
      onClick={onElegir}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left outline-none",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
      )}
    >
      <Avatar className={cn("shrink-0", shape.item, "after:rounded-[inherit]")}>
        <AvatarFallback
          className="rounded-[inherit]"
          style={{ fontSize: escala.caption }}
        >
          {iniciales(conversacion.contacto)}
        </AvatarFallback>
      </Avatar>

      {/* Dos renglones, como cualquier lista de chats: arriba con quién y
          cuándo, abajo el último mensaje. El `min-w-0` es lo que deja que el
          texto se corte en vez de empujar la hora fuera de la fila. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* `min-w-0` en los dos renglones y no sólo en el texto: un contenedor
            flex arranca con `min-width: auto`, así que se niega a achicarse por
            debajo de lo que mide su contenido y empuja la fila fuera del panel
            —la hora y el badge terminaban recortados contra el borde—. El
            `truncate` del hijo no alcanza si el padre no cede primero. */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate transition-colors duration-80",
              elegida || resaltada ? "text-foreground" : "text-foreground/90",
            )}
            style={{ fontSize: escala.body }}
          >
            {conversacion.contacto}
          </span>
          {/* La hora no se encoge ni se parte: es lo que hace escaneable la
              columna. `tabular-nums` para que "9:10" y "11:30" no bailen. */}
          <span
            className="shrink-0 tabular-nums text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {cuandoCorto(final.cuando)}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {/* Quién habló último, abreviado. Sin esto, "Yes please, that
                would be lovely" parece dicho por el contacto. */}
            {final.de === "cuenta" && (
              <span className="text-muted-foreground/70">You: </span>
            )}
            {/* Si lo último no fue texto, su glifo delante. El texto se sigue
                mostrando —la transcripción de la nota, el pie de la foto: es lo
                que hace elegible la fila— pero solo diría que alguien escribió
                eso, y lo que hizo fue decirlo o mandarlo. */}
            {final.voz && (
              <Mic
                size={11}
                strokeWidth={1.5}
                className="mr-1 inline-block shrink-0 align-[-1px]"
                aria-label="Voice note"
              />
            )}
            {final.foto && (
              <ImageIcon
                size={11}
                strokeWidth={1.5}
                className="mr-1 inline-block shrink-0 align-[-1px]"
                aria-label="Photo"
              />
            )}
            {final.texto}
          </span>
          {conversacion.sinLeer > 0 && (
            <Badge size="compact" color="green">
              {conversacion.sinLeer}
            </Badge>
          )}
        </span>
      </span>
    </motion.button>
  );
}

/* ─────────────────────────── El filtro ───────────────────────────

   Los tres atributos por los que se recorta la lista. Es el mismo panel que ya
   tenía Tickets al lado de su buscador, y por eso está: las tres secciones del
   perfil son el mismo mueble —una lista a la izquierda y lo elegido a la
   derecha— y que una recorte por atributos y las otras dos sólo por texto hacía
   que cambiar de sección cambiara de herramienta.

   Los conteos salen de las conversaciones vivas y no de una constante: un panel
   que dice un número y devuelve otro miente sobre lo que va a hacer.

   Son tres y no más porque una cuenta tiene cuatro o cinco hilos: lo que se
   pregunta de esa lista es "¿qué me falta leer?", "¿dónde estaba ese audio?" y
   "¿de cuándo es?". Un atributo por cada campo del modelo sería un panel más
   largo que la lista que recorta. */

const OPCIONES_LEIDO: FilterOption[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

/* Qué trae el hilo adentro. Es la única manera de volver a encontrar una nota
   de voz: la búsqueda mira su transcripción, pero para eso hay que acordarse de
   qué decía —y de un audio uno se acuerda de que era un audio—. */
const OPCIONES_CONTENIDO: FilterOption[] = [
  { value: "voice", label: "Voice notes" },
  { value: "photo", label: "Photos" },
];

/* Los tramos del último mensaje. Los mismos cuatro cortes que usan Email Search
   y la tabla de Accounts: es la misma pregunta hecha en tres lugares, y un
   corte distinto en uno solo los volvería incomparables. */
const OPCIONES_ACTIVIDAD: FilterOption[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "older", label: "Older" },
];

const tramoActividad = (iso: string) => {
  const dias = diasDesde(iso);
  if (dias < 1) return "today";
  if (dias < 7) return "week";
  if (dias < 30) return "month";
  return "older";
};

/** De qué valores dispone cada conversación para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O.
 *
 *  `contenido` devuelve una lista y no un valor, que es lo que hace que elegir
 *  "Voice notes" y "Photos" a la vez traiga los hilos que tienen una cosa **o**
 *  la otra —y no los que tienen las dos—: es como cualquiera lee un filtro de
 *  varios valores marcados. */
const CAMPOS: Record<string, (c: Conversacion) => string[]> = {
  read: (c) => [c.sinLeer > 0 ? "unread" : "read"],
  contenido: (c) => [
    ...(c.mensajes.some(esNota) ? ["voice"] : []),
    ...(c.mensajes.some(esFoto) ? ["photo"] : []),
  ],
  activity: (c) => [tramoActividad(ultimo(c).cuando)],
};

const conCuenta = (
  opciones: FilterOption[],
  conversaciones: Conversacion[],
  campo: (c: Conversacion) => string[],
): FilterOption[] =>
  opciones.map((o) => ({
    ...o,
    hint: String(conversaciones.filter((c) => campo(c).includes(o.value)).length),
  }));

const grupos = (conversaciones: Conversacion[]): FilterGroup[] => [
  {
    label: "The conversation",
    attributes: [
      {
        id: "read",
        label: "Read state",
        icon: CircleDot,
        options: conCuenta(OPCIONES_LEIDO, conversaciones, CAMPOS.read),
      },
      {
        id: "contenido",
        label: "Contains",
        icon: Paperclip,
        options: conCuenta(
          OPCIONES_CONTENIDO,
          conversaciones,
          CAMPOS.contenido,
        ),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      /* `single`, como los tramos de Tickets y de Email Search: "hoy o esta
         semana" es "esta semana". Elegir uno reemplaza al anterior. */
      {
        id: "activity",
        label: "Last message",
        icon: CalendarClock,
        options: OPCIONES_ACTIVIDAD,
        single: true,
      },
    ],
  },
];

function pasa(conversacion: Conversacion, filtros: FilterSelection) {
  return Object.entries(filtros).every(([id, valores]) => {
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(conversacion);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La lista ─────────────────────────── */

function Lista({
  conversaciones,
  elegida,
  onElegir,
}: {
  conversaciones: Conversacion[];
  elegida: string;
  onElegir: (id: string) => void;
}) {
  const escala = useTypeScale();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const caja = useRef<HTMLDivElement>(null);

  const GRUPOS = useMemo(() => grupos(conversaciones), [conversaciones]);

  const { activeIndex, itemRects, isMeasured, sessionRef, handlers, registerItem } =
    useProximityHover(caja, { axis: "y" });

  /* Busca por con quién y por lo que se dijo. Lo segundo no es de más: los
     nombres se olvidan antes que la frase por la que uno vuelve a buscar la
     conversación.

     El panel recorta lo mismo por atributos, y los dos se aplican juntos: entre
     la barra y el panel es Y —lo que uno escribe **y** lo que marcó—, que es lo
     que ya hacen las cinco tablas de esta consola. */
  const encontradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones.filter(
      (c) =>
        pasa(c, filtros) &&
        (!q ||
          c.contacto.toLowerCase().includes(q) ||
          c.mensajes.some((m) => m.texto.toLowerCase().includes(q))),
    );
  }, [conversaciones, busqueda, filtros]);

  /* Las funciones que registran cada fila, memorizadas: una arrow escrita en
     el `map` cambia de identidad en cada render y React la lee como que la
     fila se fue y volvió, pidiendo una remedición cada vez. Se rehacen cuando
     cambia lo filtrado, que es cuando el conjunto de filas cambia de verdad. */
  const registrar = useMemo(
    () =>
      encontradas.map(
        (_, i) => (node: HTMLElement | null) => registerItem(i, node),
      ),
    [encontradas, registerItem],
  );

  const hoverRect = activeIndex !== null ? itemRects[activeIndex] : null;
  const elegidaIdx = encontradas.findIndex((c) => c.id === elegida);
  const elegidaRect = elegidaIdx >= 0 ? itemRects[elegidaIdx] : null;

  return (
    <ListPane id="conversations">
      {/* El buscador y el filtro, en la misma fila y en ese orden. Es el mismo
          renglón que Tickets, y por la misma razón: los dos recortan la misma
          lista, y ponerlos en dos renglones haría creer que son dos cosas
          —además de comerse un renglón de la lista, que es lo que este panel
          tiene menos—.

          El campo se lleva lo que sobra y el botón mide lo suyo. `InputGroup`
          trae un `w-72` fijo —el ancho de un formulario suelto— y este panel es
          redimensionable: con el ancho fijo, arrastrarlo para ver los nombres
          enteros deja el buscador parado donde estaba y un hueco a su
          derecha. */}
      <div className="flex shrink-0 items-center gap-2 p-3">
        <InputGroup className="min-w-0 flex-1">
          <InputField
            index={0}
            label="Search conversations"
            labelHidden
            icon={Search}
            placeholder="Search conversations"
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

      {/* `[&>div]:min-w-0!`: Base UI mete un envoltorio con `min-width:
          fit-content` adentro del viewport para poder medir el ancho
          intrínseco de lo que scrollea. Con una lista vertical eso no hace
          falta y hace daño: la fila deja de achicarse, crece hasta lo que mide
          su texto entero y se lleva la hora y el badge fuera del panel. Va con
          `!` porque el estilo lo pone el primitivo, no una clase. */}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        <motion.div
          ref={caja}
          role="listbox"
          aria-label="Conversations"
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          variants={cascadaLista}
          initial="oculto"
          animate="visible"
          className="relative flex flex-col pb-2"
        >
          {/* El fondo de lo elegido, y encima el del hover. Dos capas y no un
              `bg-` por fila: es el mismo mecanismo que usan el sidebar y el
              dropdown, y es lo que hace que el resaltado viaje de una fila a
              otra en vez de prenderse y apagarse. Cuadrados y a todo el ancho:
              la lista es una columna de filas pegadas, no una pila de
              tarjetas. */}
          {elegidaRect && isMeasured && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bg-active"
              initial={false}
              animate={{ top: elegidaRect.top, height: elegidaRect.height }}
              transition={spring.moderate}
            />
          )}

          <AnimatePresence>
            {hoverRect && isMeasured && (
              <motion.span
                // Ver `UserProfile`: la sesión no tiene que provocar un
                // pintado, sólo ser distinta entre una entrada y la siguiente.
                // oxlint-disable-next-line react/refs
                key={sessionRef.current}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-hover"
                initial={{
                  opacity: 0,
                  top: elegidaRect?.top ?? hoverRect.top,
                  height: elegidaRect?.height ?? hoverRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: hoverRect.top,
                  height: hoverRect.height,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>

          {encontradas.map((c, i) => (
            <Fila
              key={c.id}
              conversacion={c}
              elegida={c.id === elegida}
              resaltada={activeIndex === i}
              onElegir={() => onElegir(c.id)}
              registrar={registrar[i]}
            />
          ))}

          {encontradas.length === 0 && (
            <p
              className="px-3 py-6 text-center text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              Nothing matches &ldquo;{busqueda}&rdquo;.
            </p>
          )}
        </motion.div>
      </ScrollArea>
    </ListPane>
  );
}

/* ─────────────────────────── El filtro del hilo ───────────────────────────

   Los atributos por los que se va a poder recortar **un hilo abierto**, que no
   son los mismos por los que se recorta la lista de hilos: allá se elige cuál
   leer y acá se busca adentro del que ya se está leyendo. De ahí que pregunte
   quién lo dijo y no cuál falta leer.

   **Todavía no recortan nada.** Están declarados y el menú los muestra, pero lo
   que se elija no toca los mensajes: ver la nota al pie de este archivo. Se
   declaran igual porque un menú de filtros que abre un panel vacío no es un
   control a medio hacer, es uno roto. */

const OPCIONES_QUIEN: FilterOption[] = [
  { value: "cuenta", label: "The account" },
  { value: "contacto", label: "The contact" },
];

const GRUPOS_DEL_HILO: FilterGroup[] = [
  {
    label: "The message",
    attributes: [
      { id: "quien", label: "Sent by", icon: CircleDot, options: OPCIONES_QUIEN },
      {
        id: "contenido",
        label: "Contains",
        icon: Paperclip,
        options: OPCIONES_CONTENIDO,
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      {
        id: "cuando",
        label: "Sent",
        icon: CalendarClock,
        options: OPCIONES_ACTIVIDAD,
        single: true,
      },
    ],
  },
];

/* ─────────────────────────── El hilo ─────────────────────────── */

/* El mueble del hilo: la cabecera de con quién es, la caja que scrollea y el
   pie de sólo lectura. Las burbujas las pone `MessageThread`, que es el mismo
   que usa el vistazo del riel en Messages Search. */
function Hilo({ conversacion }: { conversacion: Conversacion }) {
  const escala = useTypeScale();
  /* Lo que se escribió y lo que se marcó. Vive acá porque los dos controles son
     de esta cabecera, y no en la sección: dos hilos abiertos en dos pestañas
     tienen que poder estar buscando cosas distintas.

     **No recorta nada todavía.** Los dos controles se comportan como controles
     —se escribe en uno, se elige en el otro— y lo elegido no llega a los
     mensajes: ver la nota al pie. Con estado y no inertes a propósito: un campo
     en el que no se puede escribir no se lee como algo que falta terminar, se
     lee como algo roto. */
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Buscar adentro del hilo abierto: el mismo par de controles que la
          lista, en el mismo orden.

          En el escalón compacto, y **la lista no**. Son dos barras de
          herramientas que hacen lo mismo pero no pesan lo mismo: la de la lista
          es la entrada de la sección —lo primero que se toca al llegar, y lo
          único que hay arriba de una columna que se recorre entera— y la del
          hilo va encima de lo que se está leyendo, así que cuanto menos ocupe,
          mejor. Un escalón menos es lo que la corre del camino sin sacarla.

          El costo es que las dos cabeceras dejan de medir igual —60 contra 52— y
          los dos campos no quedan a la misma altura. Es a propósito: el filete
          que las separa es vertical y no hay nada que alinee de un lado al otro
          salvo el ojo.

          Contra el borde derecho y sin nada a la izquierda: con quién es el hilo
          ya lo dice la fila encendida de la lista, dos centímetros más allá, y
          repetirlo acá era decir dos veces lo mismo. */}
      <SizeProvider size="compact">
        <motion.header
          /* La cabecera del hilo no espera turno: es lo que contesta al clic
             —"abriste esta"— y llegar tarde a su propia respuesta la haría ver
             lenta. Entra sola y en el escalón rápido; la cascada empieza
             después, abajo. */
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.fast}
          className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-4 py-3"
        >
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search this conversation"
              labelHidden
              icon={Search}
              placeholder="Search this conversation"
              value={busqueda}
              onChange={setBusqueda}
              className="[&>div:has(>input)]:bg-card [&>div:has(>input)]:ring-border"
            />
          </InputGroup>

          {/* Sin la palabra: el embudo es el único glifo de esta barra que dice
              "achicá esto", y al lado de un campo de búsqueda y de otro botón de
              ícono la palabra era ancho gastado. El contador se queda cuando hay
              algo filtrado —es para lo que existe—; ver `labelHidden`. */}
          <FilterMenu
            groups={GRUPOS_DEL_HILO}
            align="end"
            variant="secondary"
            labelHidden
            value={filtros}
            onValueChange={setFiltros}
          />

          {/* Lo que se le hace al hilo, en un menú y no en tres botones sueltos.
              Son cosas que se le hacen a la conversación y no cosas que la
              pantalla ofrece —son infrecuentes y pesarían más que los dos
              controles que tienen al lado—, y cuelga con el mismo `align="end"`
              que el menú de la cuenta en el header del perfil.

              Lo que **no** comparte con ése es el glifo. Los tres puntos son como
              esta app dice "acá hay más de lo que se ve", así que los dos menús
              habían terminado con el mismo: uno encima del otro, a treinta
              píxeles de distancia, dos botones idénticos que hacen cosas
              distintas —el de arriba actúa sobre la cuenta entera, éste sobre un
              hilo—. Y a ese tamaño no hay manera de distinguirlos: lo único que
              los separa es dónde están.

              La burbuja con puntos dice de qué son estas acciones sin que haya
              que abrirlas, que es justo lo que los tres puntos no pueden decir.
              Sigue diciendo "hay más acá" —los puntos están— y agrega sobre qué.

              **Ninguna de las tres hace nada todavía**: ver la nota al pie. */}
          <DropdownMenu>
            <DropdownTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon-compact"
                  aria-label="Conversation actions"
                />
              }
            >
              <MessageSquareMore />
            </DropdownTrigger>

            {/* Ancho propio, con piso. Los 288px que trae el panel son para un
                menú de navegación, donde filas de largos distintos se alinean
                con un ancho parejo; acá son tres acciones cortas y ese ancho
                deja media caja vacía.

                Pero `w-auto` a secas lo encoge hasta la palabra más larga que
                tiene adentro, y con etiquetas de un verbo —"Save", "Block"— sale
                una columna más angosta que el botón del que cuelga: se lee como
                un recorte y no como un panel. El `min-w` del anclaje no alcanza,
                porque el ancla es un botón de ícono de 28px.

                Los mismos 144px que usa el menú de una fila de Policies, y por
                el mismo motivo: le dan el ancho de un menú y siguen sin ser el
                de una barra lateral. */}
            <DropdownContent
              side="bottom"
              align="end"
              className="w-auto min-w-36"
            >
              {/* Lo que se le hace al registro, arriba y separado de lo que se le
                  hace a la comunicación: no son la misma clase de acción. Es el
                  mismo reparto que el menú de la cuenta.

                  Los verbos van solos, sin el "conversation" atrás. El menú
                  cuelga de un botón que se llama "Conversation actions" y está
                  clavado en la cabecera del hilo: sobre qué actúan ya lo dice el
                  lugar, y repetirlo en cada fila era la misma palabra tres veces
                  en tres renglones seguidos. Es lo mismo que hace el botón de
                  alta con su sustantivo. */}
              <MenuItem index={0} icon={Save} label="Save" />
              <MenuItem index={1} icon={History} label="History" />

              <DropdownSeparator />

              {/* Bloquear y desbloquear son la misma fila —un hilo está de un lado
                  o del otro, nunca de los dos—, así que la fila cambia de etiqueta
                  y de ícono en vez de aparecer al lado de su contraria. Es la
                  misma regla que el menú de la cuenta y que el pie del `PeekCard`
                  de la tabla. */}
              <MenuItem
                index={2}
                icon={conversacion.bloqueada ? CircleCheck : Ban}
                label={conversacion.bloqueada ? "Unblock" : "Block"}
              />
            </DropdownContent>
          </DropdownMenu>
        </motion.header>
      </SizeProvider>

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        <MessageThread mensajes={conversacion.mensajes} />
      </ScrollArea>

      {/* Donde iría la caja de texto. Decirlo cuesta un renglón y evita que
          alguien busque durante medio minuto dónde se escribe. */}
      <footer
        className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        <Lock size={12} strokeWidth={1.5} />
        Read-only — this console doesn&rsquo;t send messages
      </footer>
    </div>
  );
}

/* ─────────────────────────── La sección ─────────────────────────── */

export function UserConversations({
  usuario,
  foco,
}: {
  usuario: Usuario;
  /** Qué hilo venía a ver el que abrió el perfil. Lo manda Messages Search,
   *  que llega desde un mensaje suelto: la conversación de la que salió es la
   *  respuesta, y la primera del listado no. Sin par en la lista se ignora
   *  —abre la primera—, que es lo mismo que hace la sección Emails. */
  foco?: string;
}) {
  const escala = useTypeScale();
  const conversaciones = conversacionesDe(usuario);
  /* La primera abierta de entrada: un panel derecho vacío al lado de una lista
     llena es medio segundo de preguntarse si hay que hacer algo. */
  const [elegida, setElegida] = useState(foco ?? conversaciones[0]?.id ?? "");
  const abierta =
    conversaciones.find((c) => c.id === elegida) ?? conversaciones[0];

  if (!abierta) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <MessageSquareOff
          size={24}
          strokeWidth={1.5}
          className="text-muted-foreground"
        />
        <p style={{ fontSize: escala.body }}>No conversations</p>
        <p
          className="max-w-sm text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          This account hasn&rsquo;t taken part in any thread yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Lista
        conversaciones={conversaciones}
        elegida={abierta.id}
        onElegir={setElegida}
      />
      {/* `key` en el hilo: cambiar de conversación es cambiar de contenido, no
          actualizarlo. Sin esto React reusaría el mismo árbol y el scroll de la
          conversación anterior se quedaría puesto en la nueva. */}
      <Hilo key={abierta.id} conversacion={abierta} />
    </div>
  );
}

/* ─────────────────────────── Lo que falta ───────────────────────────

   **Buscar y filtrar adentro del hilo.** Los dos controles de la cabecera están
   puestos y se comportan como controles —se escribe en uno, se elige en el
   otro— y lo que dicen no llega a los mensajes: `MessageThread` sigue recibiendo
   `conversacion.mensajes` entero.

   Están así a propósito y no a medias por descuido. Lo que falta no es cablear
   un `filter`: es decidir qué hace la pantalla con lo encontrado, y eso son dos
   diseños distintos que no se parecen en nada.

   - **Recortar** el hilo a los mensajes que pasan deja una conversación con
     agujeros, y una conversación con agujeros no se entiende: la gracia de un
     hilo es que cada mensaje contesta al anterior. Habría que marcar dónde falta
     algo, y eso es una pieza que no existe.
   - **Señalar** —dejar el hilo entero y encender los que pasan, con un "3 de 12"
     y flechas para saltar de uno a otro— es lo que hace un buscador de chat de
     verdad, y pide que `MessageThread` sepa recibir un conjunto de ids marcados
     y desplazarse hasta uno.

   La segunda es la que corresponde, y es la que hay que escribir. Mientras
   tanto los atributos ya están declarados —`GRUPOS_DEL_HILO`— y reusan las
   mismas opciones que el panel de la lista, así que el día que se escriba no hay
   que inventar el vocabulario otra vez.

   **Las tres acciones del menú.** Las filas están y ninguna hace nada, y lo que
   le falta a cada una es distinto:

   - **Block / Unblock** es la que más lejos está, y no por la escritura sino por
     el modelo. `Conversacion.bloqueada` hoy sale del estado de la cuenta —una
     residente bloqueada tiene todos sus hilos cortados—, así que desbloquear
     *este* hilo no tiene dónde guardarse sin desbloquear a la persona entera.
     Cortar un contacto suelto es el hecho que falta: una tienda como la de los
     tickets, con el id del hilo, y `bloqueada` pasando a leerse de ahí. La fila
     ya dice la etiqueta correcta contra el estado que hay.
   - **Save** espera lo mismo que el "Save user" del header del perfil: no hay
     nada editable en un hilo todavía, así que no hay qué guardar. Cuando lo
     haya, lo que falta es eso y no esta fila.
   - **History** es la más barata de las tres y la que más se parece a algo que
     ya existe: el riel de un ticket muestra su historia con `LateralPreview`, y
     acá sería la misma pieza contra las novedades del hilo. */
