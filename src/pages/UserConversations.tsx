"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, MessageSquareOff, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListPane } from "@/components/list-pane";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  conversacionesDe,
  ultimo,
  type Conversacion,
  type Mensaje,
} from "@/pages/conversaciones";
import { cuandoCorto, diaLargo, hora } from "@/pages/tiempo";
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

   Lo único que se agrega es el reparto de turnos. `staggerChildren` chico a
   propósito: con seis burbujas, 35ms por una da menos de un cuarto de segundo
   de cascada — se ve que el hilo se arma de arriba abajo, y no se espera.

   La animación entera se apaga sola con `prefers-reduced-motion`: `main.tsx`
   monta `MotionConfig reducedMotion="user"`, que le saca a estas variantes lo
   que se mueve y le deja lo que se enciende. */

const cascada = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.035 } },
} as const;

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

/** El separador de día: no es de ninguno de los dos lados, así que sólo sube. */
const entraDia = {
  oculto: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: spring.moderate },
} as const;

/* Una burbuja entra desde su propio lado. Es la parte que hace que la cascada
   diga algo además de "esto es nuevo": las de la cuenta llegan desde la derecha
   y las del contacto desde la izquierda, así que el hilo se arma alternando y
   se lee de quién es cada una antes de leerla. */
const entraBurbuja = (propio: boolean) =>
  ({
    oculto: { opacity: 0, y: 6, x: propio ? 10 : -10 },
    visible: { opacity: 1, y: 0, x: 0, transition: spring.moderate },
  }) as const;

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
  const caja = useRef<HTMLDivElement>(null);

  const { activeIndex, itemRects, isMeasured, sessionRef, handlers, registerItem } =
    useProximityHover(caja, { axis: "y" });

  /* Busca por con quién y por lo que se dijo. Lo segundo no es de más: los
     nombres se olvidan antes que la frase por la que uno vuelve a buscar la
     conversación. */
  const encontradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return conversaciones;
    return conversaciones.filter(
      (c) =>
        c.contacto.toLowerCase().includes(q) ||
        c.mensajes.some((m) => m.texto.toLowerCase().includes(q)),
    );
  }, [conversaciones, busqueda]);

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
      <div className="shrink-0 p-3">
        <InputGroup>
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

/* ─────────────────────────── El hilo ─────────────────────────── */

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const escala = useTypeScale();
  const propio = mensaje.de === "cuenta";

  return (
    <motion.div
      variants={entraBurbuja(propio)}
      className={cn("flex", propio ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex max-w-[min(28rem,78%)] flex-col gap-1 rounded-xl px-3 py-2",
          /* La burbuja de la cuenta va en el violeta del sistema —el mismo
             tono 292 de la banda de títulos de la tabla y de los badges— y no
             en un verde traído de un chat ajeno: es el único acento que esta
             app tiene, y el que hace falta acá es "estas son suyas", no un
             color de marca. La del contacto se queda en el gris del sistema.

             El valor va escrito acá y no como token en `index.css` por lo
             mismo que la banda de la tabla: ese archivo es copia byte a byte
             del showcase y una variable de más lo desalinea. */
          propio
            ? "bg-[oklch(0.938_0.035_292)] dark:bg-[oklch(0.395_0.045_292)]"
            : "bg-muted",
          /* La esquina del lado del que habla se achica: es lo que apunta la
             burbuja hacia su lado sin dibujar una colita. */
          propio ? "rounded-br-sm" : "rounded-bl-sm",
        )}
      >
        <span
          className="whitespace-pre-wrap break-words"
          style={{ fontSize: escala.body }}
        >
          {mensaje.texto}
        </span>
        {/* La hora adentro y alineada al final: afuera sumaría un renglón por
            mensaje y la conversación se leería como una lista de fechas. */}
        <span
          className="self-end tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {hora(mensaje.cuando)}
        </span>
      </div>
    </motion.div>
  );
}

function Hilo({ conversacion }: { conversacion: Conversacion }) {
  const escala = useTypeScale();
  const shape = useShape();

  /* Los mensajes agrupados por día. El separador se calcula acá y no en el
     `map` porque hace falta comparar con el anterior, y una fecha por burbuja
     sería la misma fecha repetida cinco veces. */
  const porDia = useMemo(() => {
    const grupos: { dia: string; mensajes: Mensaje[] }[] = [];
    for (const m of conversacion.mensajes) {
      const dia = diaLargo(m.cuando);
      const ultimoGrupo = grupos[grupos.length - 1];
      if (ultimoGrupo?.dia === dia) ultimoGrupo.mensajes.push(m);
      else grupos.push({ dia, mensajes: [m] });
    }
    return grupos;
  }, [conversacion]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Con quién es el hilo. El mismo alto y el mismo aire que el buscador
          de la lista, así las dos columnas arrancan a la misma altura. */}
      <motion.header
        /* La cabecera del hilo no espera turno: es lo que contesta al clic
           —"abriste esta"— y llegar tarde a su propia respuesta la haría ver
           lenta. Entra sola y en el escalón rápido; la cascada empieza
           después, abajo. */
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.fast}
        className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3"
      >
        <Avatar
          size="sm"
          className={cn("shrink-0", shape.item, "after:rounded-[inherit]")}
        >
          <AvatarFallback
            className="rounded-[inherit]"
            style={{ fontSize: escala.caption }}
          >
            {iniciales(conversacion.contacto)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate" style={{ fontSize: escala.body }}>
            {conversacion.contacto}
          </span>
          <span
            className="truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {conversacion.relacion}
          </span>
        </div>
      </motion.header>

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        {/* Los días van en fragmentos y no en un `div` por grupo: así la
            pastilla y las burbujas son todas hijas del mismo contenedor y la
            cascada es una sola, de arriba abajo. Con un `div` en el medio
            habría que repartir turnos en dos niveles y el orden se cruza. */}
        <motion.div
          variants={cascada}
          initial="oculto"
          animate="visible"
          className="flex flex-col gap-2 px-4 py-4"
        >
          {porDia.map((grupo) => (
            <Fragment key={grupo.dia}>
              {/* El día, centrado y en su propia cápsula. Es lo único de esta
                  columna que no es de nadie de los dos lados, y por eso va al
                  medio y no alineado a un margen. */}
              <motion.div
                variants={entraDia}
                className="flex justify-center py-2"
              >
                <span
                  className={cn(
                    "bg-muted px-2.5 py-1 text-muted-foreground",
                    shape.item,
                  )}
                  style={{ fontSize: escala.caption }}
                >
                  {grupo.dia}
                </span>
              </motion.div>
              {grupo.mensajes.map((m) => (
                <Burbuja key={m.id} mensaje={m} />
              ))}
            </Fragment>
          ))}
        </motion.div>
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

export function UserConversations({ usuario }: { usuario: Usuario }) {
  const escala = useTypeScale();
  const conversaciones = conversacionesDe(usuario);
  /* La primera abierta de entrada: un panel derecho vacío al lado de una lista
     llena es medio segundo de preguntarse si hay que hacer algo. */
  const [elegida, setElegida] = useState(conversaciones[0]?.id ?? "");
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
