"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownUp,
  CalendarPlus,
  CircleDot,
  CircleX,
  History,
  Reply,
  RotateCcw,
  Save,
  Search,
  WrenchIcon,
} from "lucide-react";

import { punto } from "@/components/color-dot";
import { Badge } from "@/components/ui/badge";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { useBoardMaybe } from "@/components/board-context";
import { FloatingActions } from "@/components/floating-actions";
import type { WidgetDefinition } from "@/components/widget";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListPane } from "@/components/list-pane";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { cuandoCorto, diaLargo, diasDesde, hora } from "@/pages/tiempo";
import {
  ESTADOS_TICKET,
  ORDEN_ESTADOS,
  PRIORIDADES,
  abierto as sigueAbierto,
  moverEstado,
  responder,
  ultimaNovedad,
  ultimoDelCliente,
  useTickets,
  type Novedad,
  type Ticket,
} from "@/pages/tickets";
import { type Usuario } from "@/pages/usuarios";

/* La sección Support Tickets del perfil: la lista a la izquierda, el ticket
   abierto a la derecha.

   Mismo mueble que Conversations y Emails —mismo ancho, mismo filete, mismo
   buscador— y otra vez un adentro distinto, porque un ticket tampoco es lo
   mismo. Tiene un número que alguien dicta por teléfono, un estado que cambia,
   alguien a cargo, y una historia de lo que le fue pasando. Lo que se muestra
   a la derecha no es un cuerpo ni un hilo: es **una ficha y una línea de
   tiempo**, que es como se lee un ticket en cualquier lado. */

const cascadaLista = {
  oculto: {},
  visible: { transition: { delayChildren: 0.03, staggerChildren: 0.045 } },
} as const;

const entraFila = {
  oculto: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: spring.moderate },
} as const;

/* Acá la cascada sí corresponde, al revés que en Emails: las novedades de un
   ticket **pasaron una después de la otra**, así que escalonarlas dice algo
   cierto sobre lo que se está mirando. La ficha de arriba entra primero y
   entera, porque es el estado de ahora y no un paso más. */
const cascadaTicket = {
  oculto: {},
  visible: { transition: { delayChildren: 0.04, staggerChildren: 0.05 } },
} as const;

const entraBloque = {
  oculto: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: spring.moderate },
} as const;

/** La burbuja entra desde su lado, igual que en Conversations. */
const entraBurbuja = (propia: boolean) =>
  ({
    oculto: { opacity: 0, y: 6, x: propia ? 10 : -10 },
    visible: { opacity: 1, y: 0, x: 0, transition: spring.moderate },
  }) as const;

/* ─────────────────────────── El filtro ───────────────────────────

   Los tres atributos por los que se recorta la cola. Los conteos salen de las
   filas vivas y no de una constante: un panel que sigue diciendo los números de
   antes miente sobre lo que va a devolver — la misma regla que el de Accounts.

   `Sort` es un atributo del panel y no un control aparte porque se usa igual
   que los otros dos: se abre el mismo menú, se elige un valor, y la lista se
   rehace. Un selector suelto al lado sería un segundo lugar donde buscar lo
   mismo. */

const OPCIONES_ORDEN: FilterOption[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

/* Los tramos de cuándo se abrió. Los mismos cortes que usa la tabla de
   Accounts para "Date added": lo que uno pregunta de una fecha es casi siempre
   "¿esta semana? ¿este mes?", no un rango exacto. */
const OPCIONES_CREADO: FilterOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "older", label: "Older" },
];

const tramoCreado = (iso: string) => {
  const dias = diasDesde(iso);
  if (dias <= 7) return "7d";
  if (dias <= 30) return "30d";
  if (dias <= 90) return "90d";
  return "older";
};

const grupos = (filas: FilaDeTicket[]): FilterGroup[] => [
  {
    label: "The ticket",
    attributes: [
      {
        id: "status",
        label: "Status",
        icon: CircleDot,
        options: ORDEN_ESTADOS.map((value) => ({
          value,
          label: ESTADOS_TICKET[value].label,
          icon: punto(ESTADOS_TICKET[value].tinte),
          hint: String(filas.filter((f) => f.ticket.estado === value).length),
        })),
      },
      {
        id: "created",
        label: "Created",
        icon: CalendarPlus,
        options: OPCIONES_CREADO.map((o) => ({
          ...o,
          hint: String(
            filas.filter((f) => tramoCreado(f.ticket.abierto) === o.value)
              .length,
          ),
        })),
        /* Un tramo de tiempo no se acumula con otro: "esta semana o este mes"
           es "este mes". Elegir uno reemplaza al anterior. */
        single: true,
      },
    ],
  },
  {
    label: "The list",
    attributes: [
      {
        id: "sort",
        label: "Sort",
        icon: ArrowDownUp,
        options: OPCIONES_ORDEN,
        /* Sin `single` habría dos órdenes elegidos a la vez, que no es un
           orden. */
        single: true,
      },
    ],
  },
];

/* Ordenar y filtrar es lo mismo para el panel —los dos son valores elegidos— y
   dos cosas distintas para la lista: uno saca filas y el otro las acomoda. Por
   eso el orden se lee aparte y no adentro de `pasa`. */
function pasa(fila: FilaDeTicket, filtros: FilterSelection) {
  const estados = filtros.status;
  if (estados?.length && !estados.includes(fila.ticket.estado)) return false;

  const creado = filtros.created;
  if (creado?.length && !creado.includes(tramoCreado(fila.ticket.abierto))) {
    return false;
  }

  return true;
}

/* ─────────────────────────── La lista ─────────────────────────── */

function Fila({
  ticket,
  principal,
  elegido,
  registrar,
  onElegir,
}: {
  ticket: Ticket;
  /** El renglón grande de la fila. En el perfil de una cuenta es el asunto
   *  —de quién es ya lo dice la pantalla—; en la pantalla de Tickets, donde
   *  los tickets son de todos, es el nombre de quien lo abrió. */
  principal: string;
  elegido: boolean;
  registrar: (node: HTMLElement | null) => void;
  onElegir: () => void;
}) {
  const escala = useTypeScale();
  const estado = ESTADOS_TICKET[ticket.estado];
  const vivo = sigueAbierto(ticket);
  const ultimo = ultimoDelCliente(ticket);

  return (
    <motion.button
      ref={registrar}
      variants={entraFila}
      type="button"
      role="option"
      aria-selected={elegido}
      onClick={onElegir}
      className={cn(
        "relative flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left outline-none",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
      )}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            /* Los que siguen vivos pesan más: en una lista de seis, lo que
               importa es cuáles todavía piden algo. */
            vivo ? "text-foreground" : "text-muted-foreground",
          )}
          style={{ fontSize: escala.body }}
        >
          {principal}
        </span>
        <span
          className="shrink-0 tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {cuandoCorto(ultimaNovedad(ticket).cuando)}
        </span>
      </span>

      {/* Lo último que dijo el cliente, no la última novedad: entre lo que dice
          soporte y lo que dice quien abrió el ticket, lo que hace falta para
          decidir a quién atender primero es lo segundo. La referencia se fue de
          acá —era un número que nadie lee al recorrer la lista— y sigue en la
          cabecera del chat, que es donde uno la busca cuando se la dictan. */}
      {ultimo && (
        <span
          className="min-w-0 truncate text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {ultimo.texto}
        </span>
      )}

      <span className="flex min-w-0 items-center gap-2">
        <Badge variant="dot" size="compact" color={estado.color}>
          {estado.label}
        </Badge>
        {/* La prioridad sólo se dibuja cuando es alta. Un badge que dice
            "Normal" en cinco filas de seis no informa: ocupa. */}
        {ticket.prioridad === "high" && (
          <Badge size="compact" color="rose">
            High
          </Badge>
        )}
        <span
          className="min-w-0 flex-1 truncate text-right text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {ticket.categoria}
        </span>
      </span>
    </motion.button>
  );
}

function Lista({
  filas,
  elegido,
  onElegir,
}: {
  filas: FilaDeTicket[];
  elegido: string;
  onElegir: (id: string) => void;
}) {
  const escala = useTypeScale();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const caja = useRef<HTMLDivElement>(null);

  const GRUPOS = useMemo(() => grupos(filas), [filas]);

  const { activeIndex, itemRects, isMeasured, sessionRef, handlers, registerItem } =
    useProximityHover(caja, { axis: "y" });

  /* Busca por referencia, asunto, categoría y por lo que se dijo adentro. La
     referencia es la que más se usa —llega dictada por teléfono— y por eso es
     lo primero que se compara. */
  const encontrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    const recortadas = filas.filter(
      (fila) =>
        pasa(fila, filtros) &&
        (!q ||
          fila.ticket.referencia.toLowerCase().includes(q) ||
          /* También por lo que la fila muestra grande, sea el asunto o el
             nombre de quien lo abrió: es lo que el que busca tiene en la
             cabeza. */
          fila.principal.toLowerCase().includes(q) ||
          fila.ticket.asunto.toLowerCase().includes(q) ||
          fila.ticket.categoria.toLowerCase().includes(q) ||
          fila.ticket.novedades.some((n) =>
            n.texto.toLowerCase().includes(q),
          )),
    );

    /* El orden es por **lo que se movió último**, que es lo que muestra el
       renglón de la derecha de cada fila: ordenar por otra cosa dejaría una
       columna de horas desordenada. `Oldest` da vuelta el mismo criterio, no
       lo cambia. */
    const viejoPrimero = filtros.sort?.includes("oldest");
    return [...recortadas].sort((a, b) => {
      const ta = new Date(ultimaNovedad(a.ticket).cuando).getTime();
      const tb = new Date(ultimaNovedad(b.ticket).cuando).getTime();
      return viejoPrimero ? ta - tb : tb - ta;
    });
  }, [filas, busqueda, filtros]);

  const registrar = useMemo(
    () =>
      encontrados.map(
        (_, i) => (node: HTMLElement | null) => registerItem(i, node),
      ),
    [encontrados, registerItem],
  );

  const hoverRect = activeIndex !== null ? itemRects[activeIndex] : null;
  const elegidoIdx = encontrados.findIndex((f) => f.ticket.id === elegido);
  const elegidoRect = elegidoIdx >= 0 ? itemRects[elegidoIdx] : null;

  return (
    <ListPane id="tickets">
      {/* El buscador y el filtro, en la misma fila. El campo se lleva lo que
          sobra y el botón mide lo suyo: los dos recortan la misma lista, y
          ponerlos en dos renglones haría creer que son dos cosas. */}
      <div className="flex shrink-0 items-center gap-2 p-3">
        <InputGroup className="min-w-0 flex-1">
          <InputField
            index={0}
            label="Search tickets"
            labelHidden
            icon={Search}
            placeholder="Search tickets"
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

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        <motion.div
          ref={caja}
          role="listbox"
          aria-label="Support tickets"
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          variants={cascadaLista}
          initial="oculto"
          animate="visible"
          className="relative flex flex-col pb-2"
        >
          {elegidoRect && isMeasured && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bg-active"
              initial={false}
              animate={{ top: elegidoRect.top, height: elegidoRect.height }}
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
                  top: elegidoRect?.top ?? hoverRect.top,
                  height: elegidoRect?.height ?? hoverRect.height,
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

          {encontrados.map(({ ticket, principal }, i) => (
            <Fila
              key={ticket.id}
              ticket={ticket}
              principal={principal}
              elegido={ticket.id === elegido}
              registrar={registrar[i]}
              onElegir={() => onElegir(ticket.id)}
            />
          ))}

          {encontrados.length === 0 && (
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

/* ─────────────────────────── El chat ───────────────────────────

   El cuerpo del ticket es una conversación y se dibuja como tal: lo que hay
   entre el residente y el que lo atiende son mensajes, no entradas de un
   registro. La ficha y la historia de estados —lo que sí es registro— se fueron
   al board, que es donde va lo que acompaña a lo que estás mirando sin
   interrumpirlo.

   Las burbujas son las mismas que en Conversations, y a propósito: adentro de
   este perfil, el lado derecho es siempre esta cuenta. Que el interlocutor sea
   soporte y no la hija no cambia de qué lado está quien abrió el ticket. */

function Burbuja({ novedad }: { novedad: Novedad }) {
  const escala = useTypeScale();
  const propia = novedad.autor === "cuenta";

  return (
    <motion.div
      variants={entraBurbuja(propia)}
      className={cn("flex flex-col gap-1", propia ? "items-end" : "items-start")}
    >
      {/* Quién habla, arriba y chiquito. En un chat de dos no haría falta, pero
          acá del otro lado puede haber recepción, mantenimiento o el equipo de
          cuidados según la novedad, y sin el nombre no se sabe con quién se
          está hablando en cada tramo. */}
      {!propia && (
        <span
          className="px-1 text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {novedad.nombre}
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[min(28rem,78%)] flex-col gap-1 rounded-xl px-3 py-2",
          /* El mismo violeta del sistema que en Conversations —tono 292— para
             lo que dijo la cuenta, y el gris para el otro lado. */
          propia
            ? "bg-[oklch(0.938_0.035_292)] dark:bg-[oklch(0.395_0.045_292)]"
            : "bg-muted",
          propia ? "rounded-br-sm" : "rounded-bl-sm",
        )}
      >
        <span
          className="whitespace-pre-wrap break-words"
          style={{ fontSize: escala.body }}
        >
          {novedad.texto}
        </span>
        <span
          className="self-end tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {hora(novedad.cuando)}
        </span>
      </div>
    </motion.div>
  );
}

function Chat({ ticket }: { ticket: Ticket }) {
  const escala = useTypeScale();
  const estado = ESTADOS_TICKET[ticket.estado];
  const cerrado = ticket.estado === "closed";

  /* Agrupadas por día, como en Conversations: un ticket puede tardar semanas y
     sin el corte las respuestas se leen como si hubieran sido seguidas. */
  const porDia = useMemo(() => {
    const grupos: { dia: string; novedades: Novedad[] }[] = [];
    for (const n of ticket.novedades) {
      const dia = diaLargo(n.cuando);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.dia === dia) ultimo.novedades.push(n);
      else grupos.push({ dia, novedades: [n] });
    }
    return grupos;
  }, [ticket]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* La cabecera dice de qué ticket es esta conversación. El número y el
          estado están también en el board; acá van porque el chat tiene que
          poder leerse con el board cerrado. */}
      <motion.header
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.fast}
        className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate" style={{ fontSize: escala.body }}>
            {ticket.asunto}
          </span>
          <span
            className="truncate tabular-nums text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {ticket.referencia} · {ticket.categoria}
          </span>
        </div>
        <Badge variant="dot" size="compact" color={estado.color}>
          {estado.label}
        </Badge>
      </motion.header>

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        <motion.div
          variants={cascadaTicket}
          initial="oculto"
          animate="visible"
          className="flex flex-col gap-2 px-4 py-4"
        >
          {porDia.map((grupo) => (
            <Fragment key={grupo.dia}>
              <motion.div
                variants={entraBloque}
                className="flex justify-center py-2"
              >
                <span
                  className="rounded-lg bg-muted px-2.5 py-1 text-muted-foreground"
                  style={{ fontSize: escala.caption }}
                >
                  {grupo.dia}
                </span>
              </motion.div>
              {grupo.novedades.map((n) => (
                <Burbuja key={n.id} novedad={n} />
              ))}
            </Fragment>
          ))}
        </motion.div>
      </ScrollArea>

      {/* Lo que se puede hacer con el ticket, flotando sobre la conversación.
          Antes acá había un pie que decía que esto era de sólo lectura; ya no
          lo es, y lo que ocupa su lugar es lo que se puede hacer.

          `Save ticket` todavía no guarda nada: no hay backend detrás y no hay
          nada editable en la ficha. Está por lo mismo que `Save user` en el
          menú del header — la fila dice que va a existir, y cuando exista lo
          que falta es lo de atrás, no el botón. Las otras tres funcionan. */}
      <FloatingActions
        actions={[
          { label: "Save ticket", icon: Save, onSelect: () => {} },
          {
            label: cerrado ? "Reopen ticket" : "Close ticket",
            icon: cerrado ? RotateCcw : CircleX,
            onSelect: () =>
              moverEstado(ticket.id, cerrado ? "open" : "closed"),
          },
        ]}
        /* La historia, adentro de la barra. La misma que va al board, y no una
           segunda: el board la tiene siempre al costado mientras se lee, y esto
           es el vistazo de al lado del chat para el que no tiene el riel
           abierto. Va la versión completa —también las novedades que no movieron
           el estado— porque acá se la pidió: en el board es un resumen que
           acompaña, y esto es haber preguntado. */
        panel={{
          label: "Show activity",
          icon: History,
          title: `${ticket.referencia} · Activity`,
          content: <Historia ticket={ticket} completa />,
        }}
        /* Un ticket cerrado no recibe respuestas: contestarle sería dejar un
           mensaje en algo que ya nadie mira. La celda queda apagada, y al lado
           está *Reopen ticket*, que es lo que hay que hacer primero — no hace
           falta explicar por qué está apagado cuando la salida está pegada. */
        compose={{
          label: "Reply",
          icon: Reply,
          placeholder: `Reply to ${ticket.referencia}…`,
          onSend: (texto) => responder(ticket.id, texto),
          disabled: cerrado,
        }}
      />
    </div>
  );
}

/* ─────────────────────────── Lo que va al board ───────────────────────────

   La ficha y la historia de estados no son la conversación: son lo que hay que
   tener a la vista **mientras** se la lee. Ese es exactamente el trabajo del
   riel —"cómo va esto", al costado de "qué estoy mirando"—, así que en vez de
   meterlas arriba del chat y empujarlo media pantalla para abajo, la sección
   las pone en el board de su pestaña.

   Se rehacen cuando cambia el ticket. Los ids llevan la referencia adentro, y
   `mostrarWidgets` compara por id: si son los mismos no escribe nada, que es
   lo que evita que el efecto se llame a sí mismo. */

/** Una fila de la ficha. */
function Dato({ k, v }: { k: string; v: ReactNode }) {
  const escala = useTypeScale();

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground" style={{ fontSize: escala.caption }}>
        {k}
      </dt>
      <dd className="min-w-0 truncate text-right" style={{ fontSize: escala.caption }}>
        {v}
      </dd>
    </div>
  );
}

function Ficha({ ticket }: { ticket: Ticket }) {
  const estado = ESTADOS_TICKET[ticket.estado];

  return (
    <dl className="flex h-full flex-col justify-center gap-1.5">
      <Dato
        k="Status"
        v={
          <Badge variant="dot" size="compact" color={estado.color}>
            {estado.label}
          </Badge>
        }
      />
      <Dato k="Priority" v={PRIORIDADES[ticket.prioridad]} />
      <Dato k="Category" v={ticket.categoria} />
      {/* Sin asignar es un estado de verdad y se dice: un renglón en blanco
          parece roto, y esconderlo hace creer que alguien lo tiene. */}
      <Dato
        k="Assigned to"
        v={ticket.asignado ?? <span className="text-muted-foreground">Unassigned</span>}
      />
      <Dato k="Opened" v={cuandoCorto(ticket.abierto)} />
    </dl>
  );
}

/** La historia, sin el texto de los mensajes: quién lo tocó, cuándo, y a qué
 *  estado lo movió. El texto está en el chat, y repetirlo acá haría del board
 *  una segunda copia de la conversación en vez de su resumen. */
function Historia({ ticket, completa }: { ticket: Ticket; completa?: boolean }) {
  const escala = useTypeScale();
  const hitos = ticket.novedades.filter((n) => completa || n.estado);

  return (
    <ol className="relative flex flex-col gap-3">
      <span
        aria-hidden
        className="absolute bottom-1.5 left-[3px] top-1.5 w-px bg-border"
      />
      {hitos.map((n) => {
        const estado = n.estado ? ESTADOS_TICKET[n.estado] : null;
        return (
          <li key={n.id} className="flex items-start gap-3">
            {/* Relleno cuando movió el estado, hueco cuando sólo dijo algo: la
                columna se recorre con el ojo buscando dónde cambió algo. */}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full",
                estado
                  ? "bg-foreground"
                  : "border border-border bg-background",
              )}
            />
            {/* `items-start`: el badge es `inline-flex`, pero como hijo de una
                columna flex se estira al ancho del contenedor y su borde se
                va hasta el otro lado. Acá lo que manda es el contenido. */}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="truncate" style={{ fontSize: escala.caption }}>
                  {n.nombre}
                </span>
                <span
                  className="shrink-0 tabular-nums text-muted-foreground"
                  style={{ fontSize: escala.caption }}
                >
                  {cuandoCorto(n.cuando)}
                </span>
              </span>
              {estado && (
                <Badge variant="dot" size="compact" color={estado.color}>
                  {estado.label}
                </Badge>
              )}
            </div>
          </li>
        );
      })}
      {hitos.length === 0 && (
        <li className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          Nothing has changed hands yet.
        </li>
      )}
    </ol>
  );
}

/** La vista entera de un widget: la que se abre como pestaña al tocar el
 *  mosaico. Es lo mismo con aire, que es lo que el board no tiene. */
function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-10">
      <h2 className="text-[16px] font-medium tracking-tight">{titulo}</h2>
      {children}
    </div>
  );
}

function widgetsDe(ticket: Ticket): WidgetDefinition[] {
  return [
    {
      id: `ticket/${ticket.referencia}/details`,
      label: ticket.referencia,
      icon: CircleDot,
      span: "2x1",
      glance: () => <Ficha ticket={ticket} />,
      full: () => (
        <Pagina titulo={`${ticket.referencia} · ${ticket.asunto}`}>
          <Ficha ticket={ticket} />
        </Pagina>
      ),
    },
    {
      id: `ticket/${ticket.referencia}/activity`,
      label: "Activity",
      icon: History,
      span: "2x2",
      glance: () => <Historia ticket={ticket} />,
      full: () => (
        <Pagina titulo={`${ticket.referencia} · Activity`}>
          {/* La entera lleva también las novedades que no movieron el estado:
              hay lugar, y ahí sí sirve ver el recorrido completo. */}
          <Historia ticket={ticket} completa />
        </Pagina>
      ),
    },
  ];
}

/* ─────────────────────────── La sección ─────────────────────────── */

/** Un ticket con lo que su fila muestra grande. */
export interface FilaDeTicket {
  ticket: Ticket;
  principal: string;
}

/* El panel de tickets: la lista a la izquierda, el chat a la derecha, la ficha
   y la historia en el board. Lo usan dos pantallas —la sección del perfil y la
   fila Tickets del sidebar— y lo único que cambia entre ellas es qué tickets se
   le pasan y qué dice el renglón grande de cada fila.

   Que sea un componente y no dos pantallas parecidas es lo que evita que
   arreglar algo acá haya que arreglarlo dos veces. */
export function PanelDeTickets({
  filas,
  tabId,
  vacio,
}: {
  filas: FilaDeTicket[];
  /** La pestaña de la que esto cuelga. Hace falta para el board: los widgets
   *  se ponen en el board *de esa* pestaña y no en el de la que esté activa,
   *  porque las pestañas escondidas siguen montadas y le pisarían el board a
   *  la que sí se está mirando. */
  tabId: string;
  /** Qué decir cuando no hay ninguno. Lo trae quien lo usa: "esta cuenta no
   *  abrió ninguno" y "no hay tickets abiertos" son dos cosas distintas. */
  vacio: { titulo: string; detalle: string };
}) {
  const escala = useTypeScale();
  const [elegido, setElegido] = useState(filas[0]?.ticket.id ?? "");
  const abiertoAhora =
    filas.find((f) => f.ticket.id === elegido)?.ticket ?? filas[0]?.ticket;

  const board = useBoardMaybe();
  const widgets = useMemo(
    () => (abiertoAhora ? widgetsDe(abiertoAhora) : []),
    [abiertoAhora],
  );

  useEffect(() => {
    board?.mostrarWidgets(tabId, widgets);
  }, [board, tabId, widgets]);

  if (!abiertoAhora) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <WrenchIcon
          size={24}
          strokeWidth={1.5}
          className="text-muted-foreground"
        />
        <p style={{ fontSize: escala.body }}>{vacio.titulo}</p>
        <p
          className="max-w-sm text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {vacio.detalle}
        </p>
      </div>
    );
  }

  return (
    /* `h-full` además de `flex-1`: adentro del perfil este panel cuelga de una
       columna flex y le alcanzaba con crecer, pero montado directo como
       pestaña su padre es un bloque con `overflow: auto` —el panel del
       workspace—, y ahí `flex-1` no tiene contra qué medir. Sin altura
       definida la raíz crecía hasta lo que midiera la lista entera, los
       `ScrollArea` de adentro no entraban a jugar y la barra flotante quedaba
       miles de píxeles debajo del pliegue. */
    <div className="flex h-full min-h-0 flex-1">
      <Lista filas={filas} elegido={abiertoAhora.id} onElegir={setElegido} />
      {/* `key`: abrir otro ticket es cambiar de contenido, no actualizarlo. */}
      <Chat key={abiertoAhora.id} ticket={abiertoAhora} />
    </div>
  );
}

/** La sección Support Tickets del perfil: los de esta cuenta, y la fila dice
 *  el asunto —de quién son ya lo dice la pantalla—. */
export function UserTickets({
  usuario,
  tabId,
}: {
  usuario: Usuario;
  tabId: string;
}) {
  const tickets = useTickets(usuario);
  const filas = useMemo(
    () => tickets.map((ticket) => ({ ticket, principal: ticket.asunto })),
    [tickets],
  );

  return (
    <PanelDeTickets
      filas={filas}
      tabId={tabId}
      vacio={{
        titulo: "No support tickets",
        detalle: "This account hasn’t opened any. That’s the usual case.",
      }}
    />
  );
}
