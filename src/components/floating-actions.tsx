"use client";

/**
 * FloatingActions — la barra que flota sobre un contenido: un campo para
 * escribir, y al lado los botones de lo que se puede hacer.
 *
 * Flota en vez de ocupar una franja fija abajo porque lo que hay detrás es lo
 * que importa: una barra en el flujo le come alto al contenido para siempre, y
 * esto sólo tapa un rato y cuando hace falta. Va centrada y despegada del borde,
 * apoyada sobre su propia sombra.
 *
 * ── Cuatro objetos y no una caja ─────────────────────────────────────────
 *
 * El campo es una pastilla y cada botón es un círculo, cada uno con su plano y
 * su sombra, separados entre sí. **No es una decisión de estilo:** dice qué es
 * cada cosa. El campo es donde se escribe —una sola cosa, larga, que recibe lo
 * que uno teclea— y los botones son gestos sueltos, sin relación entre ellos:
 * guardar no tiene nada que ver con cerrar. Metidos en la misma caja se leían
 * como una grilla de opciones parejas, y responder —que es lo que más se usa—
 * quedaba como una celda más.
 *
 * Antes era eso: una grilla de dos por dos que se transformaba en campo o en
 * lista. Escribir costaba un clic que además cambiaba todo el mueble; ahora el
 * campo está siempre puesto y lo que se transforma es sólo la lista.
 *
 * ── Los botones dicen su nombre al pasar el puntero ──────────────────────
 *
 * En reposo son círculos con su ícono. Con el puntero encima, el que está debajo
 * se estira y muestra su rótulo adentro. El rótulo aparece **donde está el
 * ícono**, que es donde el ojo ya está mirando, y no en una capa flotando sobre
 * una barra que ya flota.
 *
 * Lo que cuesta, y conviene saberlo: al abrirse uno, los de al lado se corren.
 * Quien iba hacia el segundo se lo encuentra un poco más allá. Se eligió igual
 * porque la alternativa —el rótulo como chapita encima— agrega una capa sobre lo
 * que se está leyendo, y acá lo que hay detrás es la conversación.
 *
 * ── Dos cosas más, las dos porque flota sobre algo que se está leyendo ────
 *
 * - **Se arrastra.** Por bien puesta que esté, va a tapar algo que alguien
 *   quiera ver; poder correrla es más barato que adivinar dónde molesta menos.
 *   No se sale de lo que cubre, y no arranca desde el campo ni desde el cuerpo
 *   de la lista —ahí adentro un arrastre es seleccionar texto o scrollear.
 * - **Se desvanece cuando nadie la está usando.** En reposo deja ver lo que hay
 *   debajo y con el puntero encima vuelve entera. Con la lista abierta no se
 *   desvanece: eso ya no es reposo.
 */

import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SendHorizontal, X } from "lucide-react";

import type { IconComponent } from "@/lib/icon-context";
import { Elevated } from "@/lib/elevated";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

export interface FloatingAction {
  label: string;
  icon: IconComponent;
  onSelect: () => void;
  disabled?: boolean;
}

export interface FloatingCompose {
  /** Para lectores de pantalla: el campo no tiene rótulo a la vista, y el
   *  `placeholder` no es uno. */
  label: string;
  icon: IconComponent;
  placeholder: string;
  /** Devuelve el texto escrito. La barra se ocupa de vaciar el campo. */
  onSend: (texto: string) => void;
  /** Cuando no hay dónde mandar. El campo queda apagado y lo dice en su lugar:
   *  un cursor parpadeando sobre algo que no acepta texto promete algo que no va
   *  a pasar. */
  disabled?: boolean;
  /** Qué decir cuando está apagado, en lugar del `placeholder`. Sin esto el
   *  campo apagado sigue invitando a escribir. */
  placeholderApagado?: string;
}

export interface FloatingPanel {
  label: string;
  icon: IconComponent;
  /** El encabezado de la lista, al lado del botón que la cierra. */
  title: string;
  content: ReactNode;
}

interface FloatingActionsProps {
  actions: FloatingAction[];
  panel?: FloatingPanel;
  compose: FloatingCompose;
  className?: string;
}

export function FloatingActions({
  actions,
  panel,
  compose,
  className,
}: FloatingActionsProps) {
  const shape = useShape();
  const escala = useTypeScale();
  const [enPanel, setEnPanel] = useState(false);
  const [texto, setTexto] = useState("");
  const cancha = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  /** Cuál botón tiene el puntero o el foco encima. Uno solo: el rótulo se abre
   *  donde está la mano, no en los tres a la vez. */
  const [encima, setEncima] = useState<string | null>(null);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    compose.onSend(limpio);
    setTexto("");
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enviar();
    }
  };

  /* Los botones de la fila. La lista es uno más y no un caso aparte: desde
     afuera es lo mismo —un ícono con su nombre que hace algo—, y lo que hace es
     abrirla. */
  const botones: FloatingAction[] = [
    ...actions,
    ...(panel
      ? [{ label: panel.label, icon: panel.icon, onSelect: () => setEnPanel(true) }]
      : []),
  ];

  /* Que la fila esté entera o desvanecida. El foco cuenta igual que el puntero:
     quien llega con el teclado también la está usando. */
  const despierta = enPanel || cerca || arrastrando;

  return (
    /* La cancha del arrastre: todo lo que la barra cubre. Es también lo que la
       posiciona, así que el lugar de reposo y el límite de hasta dónde se puede
       correr son la misma caja y no dos que hay que mantener de acuerdo.
       `pointer-events-none` para que no le robe el puntero a lo que hay debajo. */
    <div
      ref={cancha}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-end px-4 pb-4",
        /* La lista se va contra el borde derecho y la fila se queda al medio. Es
           lo que la separa: no es la barra con otra cara, es algo que se corrió a
           un costado para dejar ver la conversación que hay detrás. */
        enPanel ? "justify-end" : "justify-center",
        className,
      )}
    >
      <motion.div
        layout
        drag
        dragConstraints={cancha}
        /* Sin inercia: esto no es una tarjeta que uno tira, es un mueble que se
           corre. Que siga viaje después de soltarla la dejaría en un lugar que
           nadie eligió. Un poco de elástico contra el borde para que se note
           dónde termina la cancha. */
        dragMomentum={false}
        dragElastic={0.04}
        onDragStart={() => setArrastrando(true)}
        onDragEnd={() => setArrastrando(false)}
        onHoverStart={() => setCerca(true)}
        onHoverEnd={() => setCerca(false)}
        onFocus={() => setCerca(true)}
        onBlur={(e) => {
          /* Sólo cuando el foco se va de la fila entera: pasar de un botón al de
             al lado no es haberse ido. */
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setCerca(false);
          }
        }}
        animate={{ opacity: despierta ? 1 : 0.45 }}
        transition={{ layout: spring.moderate, opacity: { duration: 0.12 } }}
        /* El arrastre agarra a los cuatro objetos de una: se corren juntos
           porque son una sola barra repartida, no cuatro cosas sueltas que cada
           uno acomoda por su lado. */
        className={cn("pointer-events-auto w-full", enPanel ? "max-w-xs" : "max-w-md")}
      >
        <AnimatePresence mode="wait" initial={false}>
          {enPanel && panel ? (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.1 }}
            >
              <Elevated
                offset={2}
                shadowLevel={4}
                className={cn("flex flex-col overflow-hidden", shape.container)}
              >
                {/* El encabezado y el botón que la cierra. La lista es lo único
                    que no se cierra solo: se queda hasta que alguien diga que
                    terminó de mirarla. */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-4">
                  <span
                    className="min-w-0 truncate text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {panel.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnPanel(false)}
                    aria-label={`Close ${panel.title}`}
                    className={cn(
                      "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground outline-none",
                      "transition-colors duration-80 hover:bg-hover hover:text-foreground",
                      shape.item,
                      "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    )}
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
                {/* Un tope de alto y scroll adentro: un ticket con veinte
                    novedades no puede empujar la caja hasta arriba de todo y
                    tapar la conversación que vino a acompañar. Y acá adentro
                    arrastrar es scrollear la lista: la caja se sigue corriendo
                    desde su encabezado, que es de donde se agarra un panel. */}
                <div
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="max-h-64 overflow-y-auto px-4 py-3"
                >
                  {panel.content}
                </div>
              </Elevated>
            </motion.div>
          ) : (
            <motion.div
              key="fila"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              /* La fila, el campo y cada botón se mueven con el **mismo**
                 escalón. Estaban en dos —`fast` para los botones, `moderate`
                 para la caja— y son partes de un mismo movimiento: con dos
                 tiempos, el borde del botón llegaba a destino y el resto seguía
                 viajando, que es lo que se leía como un tirón.

                 `moderate` y no `fast`: ochenta milisegundos para setenta
                 píxeles de ancho no es rápido, es un salto —no hay recorrido que
                 el ojo pueda seguir—. Ciento sesenta es el tiempo con el que
                 esta app mueve lo que cambia de tamaño. */
              transition={{ duration: 0.1, layout: spring.moderate }}
              className="flex items-center gap-2"
            >
              {/* El campo. Se lleva el ancho que sobra —es lo único que crece— y
                  los botones se quedan con el suyo.

                  **El alto es fijo y no sale del contenido.** Sin `h-11`, la
                  pastilla medía lo que midiera lo de adentro: veintiocho píxeles
                  vacía y treinta y seis en cuanto aparecía el botón de mandar,
                  así que crecía al escribir la primera letra y se encogía al
                  borrar la última. Un campo que cambia de alto mientras uno
                  escribe mueve la conversación que hay detrás por una razón que
                  no tiene nada que ver con ella.

                  Y es el mismo `h-11` de los botones: son cuatro objetos de una
                  misma fila y lo que los alinea es medir igual, no acomodarlos
                  cada uno por su lado. */}
              <motion.div
                layout
                transition={{ layout: spring.moderate }}
                className="flex h-11 min-w-0 flex-1"
              >
              <Elevated
                offset={2}
                shadowLevel={4}
                className={cn(
                  "flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full py-0 pr-1.5 pl-4",
                )}
              >
                <input
                  /* Adentro del campo, arrastrar es seleccionar texto. Cortar el
                     evento acá es lo que se lo saca al arrastre sin tener que
                     apagarlo para toda la barra. */
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={teclas}
                  disabled={compose.disabled}
                  aria-label={compose.label}
                  placeholder={
                    compose.disabled
                      ? (compose.placeholderApagado ?? compose.placeholder)
                      : compose.placeholder
                  }
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-foreground outline-none",
                    "placeholder:text-muted-foreground disabled:cursor-default",
                  )}
                  style={{ fontSize: escala.body }}
                />

                {/* El botón de mandar aparece cuando hay algo que mandar.
                    Siempre puesto sería un botón apagado la mayor parte del
                    tiempo; Enter manda igual, y esto está para el que no lo
                    sabe. Va adentro de la pastilla porque es del campo y no un
                    quinto objeto de la fila. */}
                <AnimatePresence initial={false}>
                  {texto.trim() !== "" && (
                    <motion.button
                      key="enviar"
                      type="button"
                      aria-label="Send"
                      onClick={enviar}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={spring.fast}
                      className={cn(
                        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full",
                        "text-muted-foreground transition-colors duration-80 outline-none",
                        "hover:bg-hover hover:text-foreground",
                        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                      )}
                    >
                      <SendHorizontal size={15} strokeWidth={1.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </Elevated>
              </motion.div>

              {/* Los tres, adentro de un mismo grupo.
                  
                  **Apagar el rótulo es del grupo y no de cada botón.** Lo era de
                  cada uno, y cruzar de un botón al de al lado pasaba por los ocho
                  píxeles de aire que los separan: ahí no hay ninguno encima, así
                  que el rótulo abierto se cerraba, el botón se encogía, y recién
                  entonces empezaba a abrirse el siguiente. Dos movimientos de ida
                  y vuelta para lo que la mano vivió como un solo gesto.
                  
                  Con el apagado en el grupo, ese aire ya no es "afuera": el
                  rótulo se queda puesto hasta que otro botón lo reclama, y lo que
                  se ve es un relevo. Sólo salir del grupo entero lo apaga. */}
              <motion.div
                layout
                onHoverEnd={() => setEncima(null)}
                transition={{ layout: spring.moderate }}
                className="flex shrink-0 items-center gap-2"
              >
              {botones.map((a) => {
                const Icono = a.icon;
                const abierto = encima === a.label && !a.disabled;
                return (
                  <motion.div
                    key={a.label}
                    layout
                    transition={{ layout: spring.moderate }}
                    className="shrink-0"
                  >
                    <Elevated offset={2} shadowLevel={4} className="rounded-full">
                      <motion.button
                        layout
                        type="button"
                        aria-label={a.label}
                        disabled={a.disabled}
                        onClick={a.onSelect}
                        onHoverStart={() => setEncima(a.label)}
                        onFocus={() => setEncima(a.label)}
                        onBlur={() => setEncima((v) => (v === a.label ? null : v))}
                        transition={{ layout: spring.moderate }}
                        className={cn(
                          "relative flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full",
                          /* Cerrado es un cuadrado de cuarenta y cuatro, y eso
                             sale de `min-w-11` y no de un padding elegido para
                             que la cuenta dé: el ancho mínimo **es** el alto, así
                             que el círculo sigue siendo círculo el día que el
                             ícono cambie de tamaño. Al abrirse, el rótulo pasa el
                             mínimo y empuja el borde derecho. */
                          "min-w-11 px-3",
                          "text-muted-foreground transition-colors duration-80 outline-none",
                          "hover:bg-hover hover:text-foreground",
                          "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                          "disabled:pointer-events-none disabled:opacity-40",
                        )}
                      >
                        <Icono size={17} strokeWidth={1.5} className="shrink-0" />

                        {/* El rótulo sólo se desvanece; **la geometría es del
                            `layout`**.

                            Antes animaba su propio `width` de cero a `auto` y
                            además el botón tenía `layout`: dos sistemas moviendo
                            la misma caja, cada uno con su idea de dónde está el
                            borde. Eso es lo que se sentía tironeado. Con el
                            ancho en manos de la proyección de `layout` hay un
                            solo dueño, y el rótulo se ocupa nada más de aparecer.

                            **Sin `popLayout`, y eso es un arreglo y no un
                            olvido.** Estuvo, para que al salir el rótulo se
                            retirara del flujo en el acto y el botón se encogiera
                            enseguida, y traía un bug a la vista: `popLayout` lo
                            pone en `position: absolute` para sacarlo del flujo,
                            y lo ubica contra el marco del padre —que en ese
                            mismo momento está animando su propio tamaño—. El
                            resultado era el rótulo deformado y afuera del botón
                            por un instante. Medido: se iba hasta ciento treinta
                            y dos píxeles pasando el borde derecho, con el ancho
                            saltando entre cuarenta y seis y ciento cincuenta y
                            cuatro para un texto que mide sesenta y dos.

                            Sin él, el rótulo se queda en el flujo mientras se
                            desvanece y el botón se encoge después. Cuesta los
                            cien milisegundos de la salida, y es un precio que se
                            paga entero: lo otro se veía. */}
                        <AnimatePresence initial={false}>
                          {abierto && (
                            <motion.span
                              key="rotulo"
                              /* Entra **detrás** de la caja y no con ella.
                              
                                 Estaba en cien milisegundos planos contra los
                                 ciento sesenta que tarda el ancho: el texto
                                 llegaba a opacidad uno cuando el botón todavía
                                 se estaba abriendo, así que se lo veía apretado
                                 contra el borde y después el borde se corría. La
                                 espera de cincuenta lo hace aparecer sobre un
                                 lugar que ya existe, y los ciento sesenta lo
                                 dejan terminar junto con la caja.
                              
                                 Y sale más rápido de lo que entra —setenta— para
                                 que el encogimiento no arranque con el texto
                                 todavía visible: irse es lo que uno ya decidió,
                                 aparecer es lo que hay que dejar leer.
                              
                                 Los cuatro píxeles de corrimiento son de dónde
                                 viene: el rótulo sale de atrás del ícono, que es
                                 lo que uno estaba mirando. No mueven la caja
                                 —son una transformación del hijo— así que el
                                 ancho sigue siendo del `layout`. */
                              initial={{ opacity: 0, x: -4 }}
                              animate={{
                                opacity: 1,
                                x: 0,
                                transition: { duration: 0.16, delay: 0.05 },
                              }}
                              exit={{
                                opacity: 0,
                                x: -4,
                                transition: { duration: 0.07 },
                              }}
                              className="whitespace-nowrap"
                              style={{ fontSize: escala.caption }}
                            >
                              {a.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </Elevated>
                  </motion.div>
                );
              })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
