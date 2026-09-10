"use client";

import {
  useCallback,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

/* El teclado de las tablas de la consola, en un solo lugar.
 *
 * Las ocho tablas de la consola —Accounts, Provisioning, Policies,
 * Announcements, DOC Accounts, Email Search, Messages Search, Admin › Reports—
 * se recorrían sólo con el puntero. Con el teclado no había manera de pararse en una fila:
 * el `Tab` saltaba de control en control —del nombre de la fila 1 al botón de
 * bajar de la 1, al nombre de la 2— y la fila, que es la unidad que uno mira,
 * no existía. En una lista de cuarenta buzones eso son ochenta paradas para
 * llegar al último, y ninguna dice en qué renglón se está.
 *
 * Acá viven las teclas. Una sola parada de tabulado para toda la tabla —la fila
 * donde quedaste— y adentro se mueve con las flechas, que es lo que hace
 * cualquier lista: la misma forma que ya tiene el calendario del riel, y la que
 * la gente trae aprendida de su cliente de correo.
 *
 * ── Por qué acá y no adentro de `ui/table.tsx` ────────────────────────────
 *
 * Porque ese archivo no es nuestro: baja del registry @fluid y es byte a byte
 * el mismo que el del showcase (ver README). Una desviación local ahí se pierde
 * en silencio la próxima vez que alguien corra `shadcn add`, y lo que quedaría
 * en su lugar es una tabla que se ve igual y ya no se puede recorrer. La app
 * pone lo suyo desde afuera —props sobre `<Table>` y sobre cada fila—, que es
 * lo mismo que ya hace `tabla.ts` con las medidas.
 *
 * De adentro de `TableRow` sólo se usa una cosa: que reparte al `<tr>` las
 * props que no conoce. Si eso cambiara, esto deja de enganchar de una manera
 * ruidosa —las filas dejan de tener `tabindex`— y no en silencio.
 *
 * ── Por qué no `role="grid"` ──────────────────────────────────────────────
 *
 * Porque estas tablas son tablas y conviene que se sigan leyendo como tales. Un
 * `grid` le apaga a NVDA y a JAWS su modo de lectura y les cambia el mapa de
 * teclas por el nuestro, y a cambio de eso habría que darles navegación celda
 * por celda —que no es lo que esta consola necesita— y perderían la que ya
 * tienen, que es mejor. Los lectores de pantalla recorren estas tablas con sus
 * propios atajos; lo que faltaba, y es lo que se agrega, es el teclado de quien
 * ve la pantalla y no usa el mouse.
 *
 * ── El foco es la fila, no la celda ───────────────────────────────────────
 *
 * Las flechas mueven de fila. Para llegar a lo que la fila tiene adentro —el
 * nombre que abre la ficha, el botón que baja el reporte— está `Enter`, que
 * mete el foco en el primer control, y `Escape`, que lo devuelve a la fila. El
 * `Tab` sigue haciendo lo de siempre desde donde esté.
 *
 * Y cuando la fila entera hace algo —en Email Search y en Messages Search el
 * renglón abre el correo o el hilo—, `Enter` y `Espacio` hacen eso, que es lo
 * que promete el cursor de mano. Esas pantallas lo dicen pasando `onActivar`.
 */

/** Cuánto desvanece la lista contra cada borde del scroller: es el
 *  `--scroll-fade-size` de `scroll-fade` (index.css). Se descuenta al llevar
 *  una fila a la vista, si no la fila recién enfocada queda medio borrada
 *  contra el borde —que es exactamente donde el desvanecido está más fuerte—. */
const DESVANECIDO = 48;

/** Las filas que maneja este teclado: las que llevan `tabindex`, que se lo pone
 *  `fila()`. No `tbody tr` a secas —una pantalla puede tener un renglón que no
 *  salga de la lista— ni un `data-` propio: el `tabindex` ya está puesto por
 *  esto mismo y no hay dos maneras de que discrepen. */
const FILAS = "tbody tr[tabindex]";

/** Qué cuenta como un control de la fila, para `Enter`. El último selector es
 *  el que atrapa a los disparadores de Base UI que no son `<button>` —el nombre
 *  de una cuenta es un `span` con `tabindex`—. */
const CONTROLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Cómo se ve la fila enfocada.
 *
 *  Dos cosas y no una: el anillo azul del sistema —el mismo `--focus-ring` que
 *  llevan el resto de los controles de la app— y la banda del hover debajo. El
 *  anillo solo es lo que pide un foco visible; la banda es lo que hace que la
 *  fila del teclado se lea igual que la que uno está señalando con el mouse, en
 *  una tabla de cinco columnas donde un contorno de 1px a lo ancho del panel se
 *  pierde. Los textos se encienden como con el puntero, por lo mismo.
 *
 *  `focus-visible` y no `focus`: al hacer clic en una fila el navegador también
 *  la enfoca, y ahí el anillo sobraría —el puntero ya dice dónde está—.
 *
 *  Y sin `outline-none` al lado, que es lo que uno escribe por costumbre: en
 *  Tailwind 4 esa clase no apaga un contorno, fija `--tw-outline-style: none`
 *  para el elemento entero, y `outline-1` sale de esa misma variable. Las dos
 *  juntas dan un contorno de 1px con estilo `none` —o sea, ninguno, y sin
 *  ningún aviso—. No hace falta: el contorno de fábrica del navegador aparece
 *  con `:focus-visible` y es justo el que estamos reemplazando. */
const FOCO_FILA = cn(
  "focus-visible:bg-hover",
  "focus-visible:outline-1 focus-visible:-outline-offset-1",
  "focus-visible:outline-[color:var(--focus-ring,#6B97FF)]",
  "[&:focus-visible_td]:text-foreground",
);

interface Opciones {
  /** Cuántas filas tiene la tabla ahora. Es lo que mantiene la parada de
   *  tabulado adentro de la lista cuando el filtro o el paginador la acortan:
   *  sin esto, la fila 30 sigue siendo la parada de una lista de 4 y la tabla
   *  se vuelve inalcanzable con `Tab`. */
  cuantas: number;
  /** Cuánto ocupa la cabecera que flota encima del scroller. Se convierte en el
   *  `scroll-margin` de las filas: sin él, la fila que se acaba de enfocar se
   *  para justo debajo de la banda de títulos —o sea, tapada por ella—. */
  sangriaSuperior?: number | null;
  /** Qué hace la fila cuando la fila entera hace algo. Sin esto, `Enter` mete
   *  el foco en el primer control en vez de activar nada. */
  onActivar?: (indice: number) => void;
}

/** Las props que van a cada `<tr>` del cuerpo. Son todas estándar a propósito:
 *  así viajan igual por `TableRow`, por `FilaDestellante` y por cualquier
 *  `motion.create(TableRow)` sin que ninguno tenga que conocer este módulo. */
interface PropsDeFila {
  tabIndex: number;
  className: string;
  style: CSSProperties;
  onFocus: (evento: FocusEvent<HTMLTableRowElement>) => void;
}

export function useTecladoDeTabla({
  cuantas,
  sangriaSuperior,
  onActivar,
}: Opciones) {
  /* Dónde quedó el foco. Es la memoria del tabulado —la fila que se enfoca al
     entrar a la tabla es la última en la que se estuvo, no la primera—, y se
     recorta contra el largo de ahora para que siempre haya exactamente una. */
  const [foco, setFoco] = useState(0);
  const parada = Math.min(foco, Math.max(0, cuantas - 1));

  const filasDe = (tabla: HTMLTableElement) => [
    ...tabla.querySelectorAll<HTMLTableRowElement>(FILAS),
  ];

  const irA = useCallback((tabla: HTMLTableElement, indice: number) => {
    const filas = filasDe(tabla);
    const destino = Math.max(0, Math.min(indice, filas.length - 1));
    const fila = filas[destino];
    if (!fila) return;
    setFoco(destino);
    /* Enfocar primero sin mover nada y llevar a la vista después: el
       desplazamiento que hace el navegador al enfocar no conoce el
       `scroll-margin`, así que la fila terminaría contra el borde igual. */
    fila.focus({ preventScroll: true });
    fila.scrollIntoView?.({ block: "nearest" });
  }, []);

  /** Cuántas filas entran en el scroller, para `AvPág`. Se cuenta contra la
   *  caja que scrollea de verdad —la `ScrollArea` de la pantalla— y se le
   *  descuenta una fila, que es la que queda a la vista como referencia de
   *  dónde se estaba. */
  const porPantalla = (fila: HTMLTableRowElement) => {
    const caja = fila.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const alto = fila.offsetHeight || 44;
    if (!caja || !caja.clientHeight) return 10;
    return Math.max(1, Math.floor(caja.clientHeight / alto) - 1);
  };

  const onKeyDown = useCallback(
    (evento: KeyboardEvent<HTMLTableElement>) => {
      const tabla = evento.currentTarget;
      const objetivo = evento.target as HTMLElement;
      const fila = objetivo.closest<HTMLTableRowElement>(FILAS);
      if (!fila) return;

      /* El foco está en un control de la fila: las teclas son suyas —una flecha
         adentro de un campo mueve el cursor, no la lista—. Lo único que se
         atiende es la salida.

         Un popup abierto no cae acá: Base UI lo dibuja en un portal fuera de la
         tabla, así que su `Escape` no llega a este handler y sigue cerrándolo. */
      if (objetivo !== fila) {
        if (evento.key === "Escape") {
          evento.preventDefault();
          fila.focus();
        }
        return;
      }

      const filas = filasDe(tabla);
      const actual = filas.indexOf(fila);
      const mover = (indice: number) => {
        evento.preventDefault();
        irA(tabla, indice);
      };

      switch (evento.key) {
        case "ArrowDown":
          return mover(actual + 1);
        case "ArrowUp":
          return mover(actual - 1);
        case "Home":
          return mover(0);
        case "End":
          return mover(filas.length - 1);
        case "PageDown":
          return mover(actual + porPantalla(fila));
        case "PageUp":
          return mover(actual - porPantalla(fila));
        case "Enter": {
          evento.preventDefault();
          if (onActivar) return onActivar(actual);
          /* Sin acción de fila, `Enter` entra: el foco pasa al primer control
             —el nombre que abre la ficha— y de ahí el `Tab` sigue por los que
             vengan. `Escape` vuelve a la fila. */
          fila.querySelector<HTMLElement>(CONTROLES)?.focus();
          return;
        }
        case " ": {
          /* El espacio activa sólo donde la fila entera es un botón. En las
             demás se lo deja pasar: ahí sigue siendo lo que el navegador hace
             con él, que es bajar una pantalla de la lista. */
          if (!onActivar) return;
          evento.preventDefault();
          return onActivar(actual);
        }
      }
    },
    [irA, onActivar],
  );

  return {
    /** Va sobre el `<Table>` del cuerpo. */
    tabla: { onKeyDown },
    /** Va sobre cada fila del cuerpo, con las clases propias de la pantalla si
     *  las tiene —el `cursor-pointer` de una fila que se puede tocar—. */
    fila: (indice: number, clases?: string): PropsDeFila => ({
      tabIndex: indice === parada ? 0 : -1,
      className: cn(FOCO_FILA, clases),
      style: {
        /* Lo que más tapa de los dos, no la suma: arriba está la banda de
           títulos, y el desvanecido —que llega hasta 48px del borde— le queda
           entero por debajo cuando la banda es más alta que eso. Sumarlos
           dejaría la fila enfocada dos renglones más abajo de lo necesario. */
        scrollMarginTop: Math.max(sangriaSuperior ?? 0, DESVANECIDO),
        scrollMarginBottom: DESVANECIDO,
      },
      onFocus: () => setFoco(indice),
    }),
  };
}
