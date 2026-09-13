import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useEsMovil } from "@/hooks/use-es-movil";
import { spring } from "@/lib/springs";
import { useAtrasCierra } from "./navegacion";

/**
 * Una lista y lo que se elige de ella: al lado en escritorio, uno a la vez en
 * el teléfono.
 *
 * Las tres secciones del perfil son el mismo mueble —conversaciones, correos,
 * tickets— y en 375px ese mueble no entra: la lista sola ya se lleva la
 * pantalla, y lo elegido queda a la derecha, fuera de cuadro. Así que dejan de
 * ser dos columnas y pasan a ser dos lugares: se ve la lista, se elige, y lo
 * elegido la tapa entera.
 *
 * **Para volver no hay botón propio: es el gesto del sistema.** Mientras el
 * detalle está abierto hay una entrada de más en el historial —ver
 * `useAtrasCierra`—, así que el botón de Android, el swipe de iOS y la flecha
 * del header del shell cierran el detalle en vez de irse del perfil, que es lo
 * que uno espera de algo que se abrió encima.
 *
 * Hubo dos intentos de agregarle uno y los dos sobraban: una barra propia con
 * "‹ Conversations" —una franja de 45px que no hacía nada más que eso, con la
 * flecha del shell veinte píxeles más arriba— y después una flecha metida en la
 * cabecera del detalle, que era la misma flecha dos veces en la misma columna.
 * Lo que se abre encima se cierra con el gesto de siempre.
 *
 * En escritorio no cambia nada: los dos hijos salen uno al lado del otro, que
 * es como estaban.
 */

interface Marco {
  /** Que el marco se aparte —o vuelva— cuando el detalle tapa la lista. */
  onEncima: (encima: boolean) => void;
  /** Si esto que está montado es lo que se está mirando. Un perfil deja las
   *  tres secciones montadas y esconde dos: las escondidas no mandan nada. */
  visible: boolean;
}

const Contexto = createContext<Marco | null>(null);

/**
 * El marco que le presta la pantalla al detalle.
 *
 * Lo pone la pantalla que contiene un maestro/detalle y tiene chrome propio
 * arriba —el perfil tiene la cara, el nombre y el riel de secciones—. Mientras
 * se mira la lista ese chrome es lo que ubica: de quién es esto y qué se está
 * mirando de esa cuenta. Abierto el detalle deja de ubicar y sólo ocupa: lo que
 * se está leyendo es el hilo, y en 375px cada línea que se le saca al hilo se
 * paga en scroll.
 *
 * Así que el marco se entera y se aparta, y el detalle se queda con todo lo que
 * hay adentro de la pestaña. La barra de vuelta del detalle dice de dónde se
 * vino, que es lo único del chrome que hacía falta ahí.
 *
 * Va por contexto y no por props porque quien abre el detalle está tres
 * componentes más abajo que quien tiene que apartarse, y el camino entre los
 * dos es la lista de secciones del perfil: pasarlo a mano sería agregarle un
 * parámetro a la firma que comparten las nueve secciones para algo que sólo le
 * importa a tres.
 */
export function MarcoDelDetalle({
  onEncima,
  visible = true,
  children,
}: {
  onEncima: (encima: boolean) => void;
  visible?: boolean;
  children: ReactNode;
}) {
  const valor = useMemo(() => ({ onEncima, visible }), [onEncima, visible]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

interface MaestroDetalleProps {
  /** Si lo elegido está tapando la lista. Sólo importa en el teléfono. */
  abierto: boolean;
  onVolver: () => void;
  lista: ReactNode;
  detalle: ReactNode;
}

export function MaestroDetalle({
  abierto,
  onVolver,
  lista,
  detalle,
}: MaestroDetalleProps) {
  const esMovil = useEsMovil();
  const marco = useContext(Contexto);
  /* Escondido no cuenta: la sección que no se mira conserva su detalle abierto
     —volver a ella lo encuentra donde estaba—, pero mientras tanto no tapa
     nada, así que ni aparta al marco ni se queda con el atrás del sistema. */
  const encima = esMovil && abierto && (marco?.visible ?? true);

  useAtrasCierra(encima, onVolver);

  const avisar = marco?.onEncima;
  useEffect(() => {
    if (!avisar) return;
    avisar(encima);
    // Desmontarse es dejar de tapar: el marco vuelve solo.
    return () => avisar(false);
  }, [avisar, encima]);

  if (!esMovil) {
    return (
      <>
        {lista}
        {detalle}
      </>
    );
  }

  return (
    /* `data-detalle` dice cuál de los dos lugares está adelante. Es para poder
       preguntárselo desde afuera —una prueba, una sonda— sin depender de dónde
       quedó la animación. */
    <div
      data-detalle={abierto ? "abierto" : "cerrado"}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {lista}

      {/* El detalle entra desde la derecha, que es de donde vendría si las dos
          columnas siguieran existiendo: el movimiento dice que la lista sigue
          ahí, al lado, y no que esto es otra pantalla. */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring.moderate}
            className="absolute inset-0 z-10 flex flex-col bg-surface-3"
          >
            <div className="flex min-h-0 flex-1 flex-col">{detalle}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
