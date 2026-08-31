"use client";

/**
 * FloatingActions — la barra de acciones que flota sobre un contenido y que se
 * transforma en un campo para escribir.
 *
 * Flota en vez de ocupar una franja fija abajo porque lo que hay detrás es lo
 * que importa: una barra en el flujo le come alto al contenido para siempre,
 * y esto sólo tapa un rato y cuando hace falta. Va centrada y despegada del
 * borde, apoyada sobre su propia sombra.
 *
 * Las acciones van en una grilla de dos columnas con filetes en el medio y no
 * en una fila de botones sueltos: cuatro botones seguidos son cuatro cosas de
 * la misma importancia peleando por el ancho, y en dos por dos cada una tiene
 * su celda y el bloque se lee como un solo objeto.
 *
 * Dos de las celdas no hacen algo: **transforman la barra**. `compose` la
 * convierte en un campo para escribir y `panel` en una lista con algo para
 * mirar. Es lo que evita tener un cuadro de texto y una columna de novedades
 * ocupando lugar todo el tiempo para cosas que se usan de a ratos, y lo que
 * hace que abrirlas se sienta como una continuación de la barra y no como otro
 * mueble que apareció.
 *
 * Los tres estados viven en la misma caja y se turnan; lo que se mueve entre
 * uno y otro es el tamaño de la caja —y, para el panel, también de qué lado
 * está—.
 *
 * Dos cosas más, las dos porque flota sobre algo que se está leyendo:
 *
 * - **Se arrastra.** Por bien puesta que esté, va a tapar algo que alguien
 *   quiera ver; poder correrla es más barato que adivinar dónde molesta menos.
 *   No se sale de lo que cubre, y no arranca desde el campo ni desde el cuerpo
 *   de la lista —ahí adentro un arrastre es seleccionar texto o scrollear.
 * - **Se desvanece cuando nadie la está usando.** En reposo deja ver lo que
 *   hay debajo y con el puntero encima vuelve entera. Mientras está abierta
 *   como campo o como lista no se desvanece: eso ya no es reposo.
 */

import {
  useEffect,
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
  label: string;
  icon: IconComponent;
  placeholder: string;
  /** Devuelve el texto escrito. La barra se ocupa de vaciar el campo y de
   *  volver a plegarse. */
  onSend: (texto: string) => void;
  /** Cuando no hay dónde mandar. La celda queda apagada y, si el campo estaba
   *  abierto, se pliega: un cursor parpadeando sobre algo que ya no acepta
   *  texto promete algo que no va a pasar. */
  disabled?: boolean;
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

/** En qué está la barra. Un solo estado y no dos banderas: no puede estar
 *  escribiendo y mostrando la lista a la vez, y con dos booleanos ese "no
 *  puede" hay que acordarse de sostenerlo en cada lugar que los toca. */
type Modo = "acciones" | "campo" | "panel";

export function FloatingActions({
  actions,
  panel,
  compose,
  className,
}: FloatingActionsProps) {
  const shape = useShape();
  const escala = useTypeScale();
  const [modoGuardado, setModo] = useState<Modo>("acciones");
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const cancha = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  /* Si dejan de aceptar texto mientras el campo está abierto, se pliega. Hoy
     no puede pasar desde acá —cerrar el ticket es una celda de la grilla, y la
     grilla no existe mientras se escribe—, pero el estado del que depende
     `disabled` es de afuera y puede cambiar por otro lado.

     El ajuste se hace **al derivar**, en el mismo render, y no en un efecto:
     un efecto pintaría una vez el campo que no corresponde y recién después lo
     sacaría. Es el mismo patrón que usa la ventana de la tabla de Accounts
     cuando cambia lo filtrado. */
  const modo =
    compose.disabled && modoGuardado === "campo" ? "acciones" : modoGuardado;
  if (modo !== modoGuardado) setModo(modo);

  const escribiendo = modo === "campo";

  /* El foco va al campo apenas aparece: si hay que hacer clic de nuevo para
     escribir, el botón que abrió el campo no hizo la mitad de su trabajo. */
  useEffect(() => {
    if (escribiendo) campo.current?.focus();
  }, [escribiendo]);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    compose.onSend(limpio);
    setTexto("");
    /* Se pliega al mandar. El campo abierto y vacío después de enviar es un
       cursor esperando algo que ya se dijo, y encima tapa la respuesta recién
       agregada — que es justamente lo que uno quiere ver. Volver a abrirlo es
       un clic, y el que contesta dos veces seguidas lo paga barato. */
    setModo("acciones");
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enviar();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setModo("acciones");
    }
  };

  const Lapiz = compose.icon;

  /* Que la caja esté entera o desvanecida. Abierta como campo o como lista no
     se desvanece: eso ya no es reposo. El foco cuenta igual que el puntero —
     quien llega con el teclado también la está usando. */
  const despierta = modo !== "acciones" || cerca || arrastrando;

  return (
    /* La cancha del arrastre: todo lo que la barra cubre. Es también lo que la
       posiciona, así que el lugar de reposo y el límite de hasta dónde se
       puede correr son la misma caja y no dos que hay que mantener de acuerdo.
       `pointer-events-none` para que no le robe el puntero a lo que hay
       debajo. */
    <div
      ref={cancha}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-end px-4 pb-4",
        /* La lista se va contra el borde derecho y las otras dos se quedan al
           medio. Es lo que la separa de las otras dos formas: no es la barra
           con otra cara, es algo que se corrió a un costado para dejar ver la
           conversación que hay detrás. */
        modo === "panel" ? "justify-end" : "justify-center",
        className,
      )}
    >
      {/* El `layout` va acá, en la caja que de verdad cambia de tamaño, y no
          en el contenedor de posición —que ocupa todo el ancho y nunca cambia,
          así que no tenía nada que animar—. Lo que se ve es la caja bajando de
          dos filas a una: la altura se interpola y el bloque se pliega sobre sí
          mismo.

          Entre la grilla y el campo el ancho es el mismo a propósito:
          cambiarlo además la movería para los costados mientras se pliega, y
          dos movimientos a la vez se leen como un salto. La lista sí cambia de
          ancho **y** de lado, y ahí los dos movimientos son el mismo gesto —se
          corre a la derecha— en vez de dos que compiten. */}
      <motion.div
        layout
        drag
        dragConstraints={cancha}
        /* Sin inercia: esto no es una tarjeta que uno tira, es un mueble que
           se corre. Que siga viaje después de soltarla la dejaría en un lugar
           que nadie eligió. Un poco de elástico contra el borde para que se
           note dónde termina la cancha. */
        dragMomentum={false}
        dragElastic={0.04}
        onDragStart={() => setArrastrando(true)}
        onDragEnd={() => setArrastrando(false)}
        onHoverStart={() => setCerca(true)}
        onHoverEnd={() => setCerca(false)}
        onFocus={() => setCerca(true)}
        onBlur={(e) => {
          /* Sólo cuando el foco se va de la caja entera: pasar de una celda a
             la de al lado no es haberse ido. */
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setCerca(false);
          }
        }}
        animate={{ opacity: despierta ? 1 : 0.45 }}
        transition={{ layout: spring.moderate, opacity: { duration: 0.12 } }}
        className={cn(
          "pointer-events-auto w-full",
          modo === "panel" ? "max-w-xs" : "max-w-md",
        )}
      >
        <Elevated
          offset={2}
          shadowLevel={4}
          className={cn("overflow-hidden", shape.container)}
        >
          {/* `wait` y no `popLayout`: el que se va tiene que terminar de irse
              antes de que entre el otro. Con `popLayout` el saliente pasa a
              `absolute` mientras la caja ya se plegó, y adentro de un
              `overflow-hidden` eso son dos bloques encimados y recortados
              durante toda la salida.

              El costo de `wait` sería un hueco en el medio, y lo tapa el
              `layout` de la caja: mientras uno sale y entra el otro, la altura
              está interpolando, así que lo que se ve es el bloque plegándose y
              no un vacío. Por eso las dos transiciones de adentro son cortas —
              lo que dura la transformación es la de la caja. */}
          <AnimatePresence mode="wait" initial={false}>
            {modo === "panel" && panel ? (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.1 }}
                className="flex flex-col"
              >
                {/* El encabezado y el botón que la cierra. La lista es lo único
                    de los tres estados que no se cierra sola: el campo se
                    pliega al mandar y al perder el foco vacío, pero esto se
                    queda hasta que alguien diga que terminó de mirarlo. */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-2 pl-4 pr-2">
                  <span
                    className="min-w-0 truncate text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {panel.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModo("acciones")}
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
                    tapar la conversación que vino a acompañar. */}
                {/* Mismo motivo que en el campo: acá adentro arrastrar es
                    scrollear la lista. La caja se sigue corriendo desde su
                    encabezado, que es de donde se agarra un panel. */}
                <div
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="max-h-64 overflow-y-auto px-4 py-3"
                >
                  {panel.content}
                </div>
              </motion.div>
            ) : escribiendo ? (
              <motion.div
                key="campo"
                /* El campo sube a su lugar: viene de donde estaba la última fila
                   de la grilla. */
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-2 py-1.5 pl-4 pr-1.5"
              >
                <input
                  ref={campo}
                  /* Adentro del campo, arrastrar es seleccionar texto. Cortar
                     el evento acá es lo que se lo saca al arrastre sin tener
                     que apagarlo para toda la caja. */
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={teclas}
                  onBlur={() => {
                    /* Vacío y sin foco no hay nada que guardar, así que se
                       pliega solo. Con algo escrito se queda: perder un borrador
                       por mirar para otro lado es la peor manera de perderlo. */
                    if (!texto.trim()) setModo("acciones");
                  }}
                  placeholder={compose.placeholder}
                  aria-label={compose.label}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: escala.body }}
                />
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!texto.trim()}
                  aria-label={compose.label}
                  className={cn(
                    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center outline-none transition-colors duration-80",
                    shape.item,
                    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    texto.trim()
                      ? "bg-hover text-foreground"
                      : "text-muted-foreground/50",
                  )}
                >
                  <SendHorizontal size={16} strokeWidth={1.5} />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grilla"
                /* La grilla se encoge apenas al irse y se despliega al volver: es
                   lo que la hace parecer que se pliega adentro de la caja en vez
                   de apagarse. */
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.1 }}
                /* Los filetes salen de un `gap` con el fondo del borde detrás:
                   así la línea la dibuja el hueco entre celdas y no un `border`
                   por celda, que en una grilla deja dobles en el medio y sueltos
                   en los extremos. */
                className="grid grid-cols-2 gap-px bg-border"
              >
                {actions.map((accion) => (
                  <Celda
                    key={accion.label}
                    icon={accion.icon}
                    label={accion.label}
                    disabled={accion.disabled}
                    onClick={accion.onSelect}
                  />
                ))}
                {/* Las dos que transforman la barra van al final y en ese
                    orden: mirar antes que escribir, que es también el orden
                    en que se usan. */}
                {panel && (
                  <Celda
                    icon={panel.icon}
                    label={panel.label}
                    onClick={() => setModo("panel")}
                  />
                )}
                <Celda
                  icon={Lapiz}
                  label={compose.label}
                  disabled={compose.disabled}
                  onClick={() => setModo("campo")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Elevated>
      </motion.div>
    </div>
  );
}

function Celda({
  icon: Icono,
  label,
  onClick,
  disabled,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const escala = useTypeScale();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex cursor-pointer items-center gap-2 bg-surface-5 px-4 py-3 text-left outline-none",
        "transition-colors duration-80 hover:bg-hover",
        "focus-visible:relative focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface-5",
      )}
      style={{ fontSize: escala.body }}
    >
      <Icono
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
