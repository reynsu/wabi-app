"use client";

/**
 * ListPane — la columna de la izquierda de las secciones del perfil, con su
 * ancho ajustable.
 *
 * Las tres secciones —conversaciones, correos, tickets— usan el mismo mueble:
 * una lista a la izquierda y lo elegido a la derecha. Que el ancho lo decida
 * este componente y no cada una es lo que hace que cambiar de sección no
 * cambie de mueble; que se pueda ajustar es porque lo que entra en esa columna
 * no es lo mismo en las tres —un asunto de correo es largo, una hora no— y lo
 * que a uno le sobra a otro le falta.
 *
 * **El ancho es uno por sección y no uno por pantalla**, guardado en el módulo.
 * Que sea del módulo y no de la pantalla es lo importante: no es estado de una
 * vista, es cómo alguien decidió que quiere ver esta clase de vista, y tenerlo
 * por pantalla obligaría a acomodarlo de nuevo en cada perfil que se abra.
 *
 * Y es por sección, y no uno solo para las tres, porque las tres terminaron
 * llevando cosas distintas: una conversación es un nombre y un renglón, un
 * ticket son tres renglones con badges y el último mensaje del cliente. Lo que
 * a una le sobra a otra le falta, y quien sabe cuánto lugar necesitan sus filas
 * es la sección.
 */

import { useRef, useState, type ReactNode } from "react";
import { create } from "zustand";

import { cn } from "@/lib/utils";

/** Los topes, iguales para todas. Abajo, lo que necesita una fila de tres
 *  renglones para no cortar el asunto en la primera palabra; arriba, la mitad
 *  de una pantalla angosta — más que eso deja de ser una lista al costado y
 *  pasa a ser la pantalla, con lo elegido de invitado. */
const MINIMO = 260;
const MAXIMO = 560;

/* Lo que mide cada sección mientras nadie la toque. La de tickets arranca un
   cuarto más ancha que las otras dos: sus filas llevan tres renglones, y el
   del medio es el último mensaje del cliente —una frase entera, no un nombre—,
   así que es la que más se agradece el lugar. */
const POR_DEFECTO: Record<string, number> = {
  conversations: 340,
  emails: 340,
  tickets: 425,
};

const DEFECTO = 340;

/* El ancho de cada panel, en una tienda. No es de una pantalla: dos perfiles
   abiertos comparten el ancho de su sección —es la misma clase de vista— y
   arrastrarlo en uno tiene que moverlo en el otro. */
const useAnchos = create<Record<string, number>>()(() => ({}));

const acotar = (px: number) => Math.max(MINIMO, Math.min(MAXIMO, px));

const anchoDe = (id: string, anchos: Record<string, number>) =>
  anchos[id] ?? POR_DEFECTO[id] ?? DEFECTO;

function fijarAncho(id: string, px: number) {
  const nuevo = acotar(px);
  const anchos = useAnchos.getState();
  if (nuevo === anchoDe(id, anchos)) return;
  useAnchos.setState({ [id]: nuevo });
}

/* Con selector por id: arrastrar el panel de conversaciones no vuelve a pintar
   al de tickets, que está montado en otra pestaña mirando su propio ancho. */
const useAncho = (id: string) => useAnchos((a) => anchoDe(id, a));

export function ListPane({
  id,
  children,
  className,
}: {
  /** Qué sección es. Es la clave de su ancho: dos perfiles abiertos comparten
   *  el de su sección —es la misma clase de vista— y las tres secciones no
   *  comparten entre sí. */
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const px = useAncho(id);
  const [arrastrando, setArrastrando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  /* Los handlers se enganchan acá adentro y no desde un efecto sobre el
     estado: pasando por estado, un arrastre corto alcanza a moverse y soltarse
     antes de que React vuelva a pintar, y los listeners llegan a una fiesta que
     ya terminó. Con `setPointerCapture` todo evento va a este elemento hasta
     que se suelte, así que escucharlo a él alcanza y `window` queda limpio.
     Es el mismo camino que hace el riel de widgets. */
  const empezar = (e: React.PointerEvent<HTMLElement>) => {
    const columna = caja.current;
    if (!columna) return;

    e.preventDefault();
    const tirador = e.currentTarget;
    tirador.setPointerCapture(e.pointerId);
    setArrastrando(true);

    /* El arrastre es **relativo**: se guarda dónde empezó el puntero y cuánto
       medía la columna, y de ahí el ancho es lo que se movió la mano. El
       cálculo absoluto —el ancho es la distancia del puntero al borde
       izquierdo— parece más simple y trae un problema: agarrar el filete tres
       píxeles corrido hace que la columna pegue ese salto al empezar. */
    const xInicial = e.clientX;
    const anchoInicial = columna.getBoundingClientRect().width;

    /* Mientras dura, el cursor manda en toda la página y el texto no se
       selecciona: sin esto, cruzar la lista con el botón apretado pinta media
       pantalla de azul. */
    const previo = document.body.style.cssText;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const mover = (ev: PointerEvent) =>
      fijarAncho(id, anchoInicial + (ev.clientX - xInicial));

    const soltar = () => {
      tirador.releasePointerCapture(e.pointerId);
      tirador.removeEventListener("pointermove", mover);
      tirador.removeEventListener("pointerup", soltar);
      tirador.removeEventListener("pointercancel", soltar);
      document.body.style.cssText = previo;
      setArrastrando(false);
    };

    tirador.addEventListener("pointermove", mover);
    tirador.addEventListener("pointerup", soltar);
    tirador.addEventListener("pointercancel", soltar);
  };

  /* El teclado ajusta de a un escalón. Un tirador que sólo responde al mouse
     es un control que la mitad de la gente no tiene. */
  const teclas = (e: React.KeyboardEvent) => {
    const paso = { ArrowLeft: -16, ArrowRight: 16 }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    fijarAncho(id, px + paso);
  };

  return (
    <div
      ref={caja}
      style={{ width: px }}
      className={cn(
        "relative flex shrink-0 flex-col border-r border-border",
        className,
      )}
    >
      {children}

      {/* El tirador: una franja angosta sobre el filete que ya separa la lista
          de lo elegido. En reposo no se dibuja —el filete solo ya dice dónde
          termina la columna— y con el puntero encima o mientras se arrastra la
          línea se oscurece, que es como esta app dice "de acá se agarra" —el
          mismo recurso que el borde del panel cuando lo están sosteniendo—.

          Va corrido medio ancho hacia afuera para quedar centrado sobre el
          filete: un tirador que empieza en el borde y crece hacia adentro se
          come cuatro píxeles de la última columna de la fila. */}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list"
        aria-valuenow={px}
        aria-valuemin={MINIMO}
        aria-valuemax={MAXIMO}
        tabIndex={0}
        onPointerDown={empezar}
        onKeyDown={teclas}
        className={cn(
          "absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize outline-none",
          "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2",
          "after:transition-colors after:duration-80",
          arrastrando
            ? "after:bg-foreground/25"
            : "after:bg-transparent hover:after:bg-foreground/25",
          "focus-visible:after:bg-[color:var(--focus-ring,#6B97FF)]",
        )}
      />
    </div>
  );
}
