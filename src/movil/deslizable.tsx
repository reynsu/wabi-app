import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue } from "framer-motion";

import type { IconComponent } from "@/lib/icon-context";
import { spring } from "@/lib/springs";
import { useSurface } from "@/lib/surface-context";
import { SURFACE_BG } from "@/lib/surface-classes";
import { cn } from "@/lib/utils";

/**
 * Correr algo para descubrir lo que puede hacérsele.
 *
 * Es el gesto que en el teléfono reemplaza al hover: en escritorio las acciones
 * de un registro aparecen al pasarle por encima, y en un táctil no hay por
 * encima. Se corre hacia la izquierda, aparecen los botones, y se sueltan
 * pasada la mitad de lo que hay detrás —o antes, si el tirón trae envión—.
 *
 * **Envuelve cualquier cosa.** Una fila de una lista, una tarjeta de un board,
 * un mosaico: lo que se corre son sus hijos, y lo que aparece detrás son las
 * `acciones` que se le pasen. Lo único que la pieza de adentro tiene que hacer
 * es nada — ni saber que está corrida ni ofrecer un lugar para los botones.
 *
 * Dos reglas que hacen que el gesto no pelee con lo que ya había:
 *
 * - **Con algo corrido, el primer toque lo devuelve** en vez de activar lo que
 *   haya debajo. Se intercepta en captura, así que ni siquiera hace falta que
 *   el hijo se entere: es lo que uno espera del toque que sigue a un gesto, y
 *   evita entrar a un perfil cuando lo que se quería era arrepentirse.
 * - **Un arrastre no termina en clic.** Correr y soltar dispara igual el clic
 *   del navegador; acá se descarta el que viene de un gesto.
 *
 * Y una nota de accesibilidad, que es la deuda de cualquier gesto: los botones
 * son botones de verdad, están siempre en el DOM y al recibir el foco lo corren
 * solo, así que se llega con el teclado. Aun así **lo que viva sólo acá no
 * existe** para quien no puede hacer el gesto ni ve la pantalla: lo que se
 * ofrezca en un deslizable tiene que estar también en otro lado —el detalle que
 * la pieza abre, un menú—.
 */

/** Cuánto mide cada acción. Es el escalón táctil de la casa: un blanco de menos
 *  de 44px se falla, y éstos se tocan sin verlos venir. */
const ANCHO_ACCION = 76;

/** Cuánto hay que arrastrar para que quede abierto al soltar: la mitad de lo
 *  que hay detrás. Menos que eso es haber empujado sin querer. */
const PARA_QUE_QUEDE = 0.5;

/** Y con envión no hace falta llegar: un tirón corto y rápido también abre.
 *  Píxeles por segundo. */
const ENVION = 400;

export interface AccionDeslizable {
  label: string;
  icon?: IconComponent;
  onSelect: () => void;
  /** Lo que saca algo de circulación —bloquear, borrar— va en rojo. El resto,
   *  callado: si las dos gritan, ninguna grita. */
  tono?: "peligro";
}

/* Cuál está corrido, para todo un grupo.
 *
 * Uno a la vez: dos abiertos son dos juegos de acciones a la vista y ninguna
 * manera de saber cuál responde al próximo toque. La decisión es entre
 * hermanos, así que vive en el grupo y no en cada uno. */
const Grupo = createContext<{ cual?: string; correr: (id?: string) => void } | null>(null);

/**
 * El grupo: lo que hace que abrir uno cierre al otro.
 *
 * Va donde estén los hermanos —una lista lo pone alrededor de sus filas—. Sin
 * grupo, un `Deslizable` funciona igual, pero solo: es lo correcto para uno
 * suelto, y sería un bug para veinte.
 */
export function GrupoDeslizable({ children }: { children: ReactNode }) {
  const [cual, correr] = useState<string>();
  return <Grupo.Provider value={{ cual, correr }}>{children}</Grupo.Provider>;
}

interface DeslizableProps {
  acciones: AccionDeslizable[];
  children: ReactNode;
  /** Quién es, para el grupo. Si no se pasa, se usa uno generado: sirve para el
   *  que está solo, no para el que tiene hermanos. */
  id?: string;
  className?: string;
}

export function Deslizable({ acciones, children, id, className }: DeslizableProps) {
  const propio = useId();
  const mio = id ?? propio;
  const grupo = useContext(Grupo);
  const solo = useState<string>();
  const cual = grupo ? grupo.cual : solo[0];
  const correr = grupo ? grupo.correr : solo[1];

  const x = useMotionValue(0);
  const arrastrando = useRef(false);
  const sustrato = useSurface();

  const ancho = acciones.length * ANCHO_ACCION;
  const abierto = cual === mio;

  /* La posición la manda el estado del grupo y no el gesto: así uno se cierra
     también cuando el que se abrió es otro. */
  useEffect(() => {
    const parar = animate(x, abierto ? -ancho : 0, spring.moderate);
    return () => parar.stop();
  }, [abierto, ancho, x]);

  if (acciones.length === 0) return <>{children}</>;

  return (
    /* El recorte es del marco y no del que se mueve: lo que se corre tiene que
       poder salirse por el borde sin que se vea, y las acciones se quedan
       quietas mientras la pieza las descubre —no viajan con ella—. */
    <div className={cn("relative isolate overflow-hidden", className)}>
      <span className="absolute inset-y-0 right-0 z-0 flex">
        {acciones.map((accion) => (
          <button
            key={accion.label}
            type="button"
            onClick={() => {
              accion.onSelect();
              correr(undefined);
            }}
            onFocus={() => correr(mio)}
            data-cuelume-press="tick"
            style={{ width: ANCHO_ACCION }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none",
              "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
              accion.tono === "peligro"
                ? "bg-[oklch(0.58_0.2_18)] text-white active:bg-[oklch(0.52_0.2_18)]"
                : "bg-surface-1 text-muted-foreground active:bg-hover",
            )}
          >
            {accion.icon && <accion.icon className="size-4" />}
            {accion.label}
          </button>
        ))}
      </span>

      {/* `dragDirectionLock` es lo que hace que el gesto no pelee con el scroll
          de lo que lo contenga: el primer movimiento decide el eje y el otro
          queda descartado hasta que se suelta. Hacia la derecha no hay nada que
          mostrar, así que no cede ni elástico.

          El fondo sale de la escalera: lo que se corre tapa a las acciones
          mientras está en su lugar, y para taparlas tiene que ser opaco en el
          escalón en el que esté montado —una lista sobre el plano, una tarjeta
          adentro de una hoja—. */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ancho, right: 0 }}
        dragElastic={{ left: 0.06, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        onDragStart={() => {
          arrastrando.current = true;
        }}
        onDragEnd={(_, info) => {
          const queda = info.offset.x < -ancho * PARA_QUE_QUEDE || info.velocity.x < -ENVION;
          correr(queda ? mio : undefined);
          /* Se anima acá además del efecto: si el estado no cambió —soltar
             cerrado algo que ya estaba cerrado— el efecto no vuelve a correr y
             quedaría a mitad de camino. */
          animate(x, queda ? -ancho : 0, spring.moderate);
        }}
        onClickCapture={(e) => {
          /* El clic que cierra, y el que sobra. El primero es el toque que
             sigue al gesto; el segundo, el que el navegador dispara al soltar
             un arrastre. Los dos se comen acá, antes de que el hijo se entere.
             `stopPropagation` no alcanza: en captura hay que impedir que baje. */
          if (!abierto && !arrastrando.current) return;
          e.preventDefault();
          e.stopPropagation();
          if (abierto) correr(undefined);
          arrastrando.current = false;
        }}
        className={cn("relative z-10 touch-pan-y", SURFACE_BG[Math.min(sustrato, 8)])}
      >
        {children}
      </motion.div>
    </div>
  );
}
