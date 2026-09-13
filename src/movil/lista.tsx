import type { ReactNode } from "react";

import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  Deslizable,
  GrupoDeslizable,
  type AccionDeslizable,
} from "@/movil/deslizable";

/**
 * Una tabla, en el teléfono.
 *
 * En 375px una tabla de cuatro columnas no se angosta: se trunca. "Camila
 * Ferreyra" queda en "Camila Fe…" y la fecha en "Mar 4,". Lo que entra no es la
 * misma información más chica sino **menos información**, así que la tabla se
 * deshace en filas apiladas y cada pantalla elige qué sobrevive: lo que
 * identifica al registro arriba, lo que lo ubica abajo, y a la derecha el dato
 * por el que se escanea la lista —un estado, una cifra—.
 *
 * Lo que no entra no se achica: se va a donde ya estaba. En esta app, cada fila
 * abre algo —un perfil, un vistazo, una pestaña— y ahí están las columnas que
 * acá se cayeron.
 *
 * Sin marco ni radio, como la tabla de escritorio: las filas llegan a los dos
 * bordes del plano y el aire lateral lo pone su propio relleno, no una caja.
 *
 * **La tipografía sale de la escala y no de un número escrito acá**: `body`
 * arriba y `caption` abajo, que es exactamente lo que usa la lista de
 * conversaciones del perfil. Son dos listas de la misma app leídas con el mismo
 * pulgar, y una a 15px al lado de otra a 13px se leen como dos productos. De
 * paso, la fila sigue el escalón de densidad que declare la pantalla en vez de
 * ignorarlo.
 */

/**
 * La sangría de una lista en el teléfono: 16px a cada lado.
 *
 * No es un número elegido acá, es **el mismo para las cuatro listas** que un
 * pulgar recorre en esta app —Accounts, y las conversaciones, los correos y los
 * tickets del perfil—. Estaban en 12, 12, 20 y 16: cada una tenía su razón
 * mirada sola —la de correos entra un escalón bajo el encabezado de su carpeta,
 * las otras vienen del panel angosto de escritorio, donde 12 es lo que sobra—, y
 * ninguna sobrevive al cambio de pantalla. Pasar de una a otra movía la columna
 * de nombres tres veces, y eso se lee como que cambió la app, no la sección.
 *
 * 16 y no 12: en el teléfono la lista llega a los dos bordes del plano, sin
 * columna ni marco que la separen de nada, así que la sangría de la fila es
 * todo el aire que hay contra el vidrio.
 *
 * En escritorio cada una se queda como estaba: ahí las listas viven en una
 * columna angosta al lado de lo elegido, y 12 es lo que deja pasar un asunto
 * más largo.
 */
export const SANGRIA_MOVIL = "px-4";

/**
 * La lista envuelve a sus filas en un grupo: correr una devuelve la que estaba
 * corrida. Ver `Deslizable`.
 *
 * **El filete entre filas va a un tercio del token.** A pleno, doce líneas
 * grises cada 56px pesan más que el contenido y la lista se lee como una
 * grilla; lo que separa dos filas es el aire, y el filete sólo tiene que
 * confirmarlo cuando se lo busca. Se baja la opacidad del mismo `--border` y no
 * se elige otro color, así sigue el tema solo: en claro queda al borde de no
 * verse y en oscuro, un blanco al 3%.
 */
export function ListaMovil({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GrupoDeslizable>
      <ul className={cn("flex flex-col [&>li+li]:border-t [&>li+li]:border-border/35", className)}>
        {children}
      </ul>
    </GrupoDeslizable>
  );
}

interface FilaMovilProps {
  /** El plato de la izquierda: un avatar, un ícono, un color. */
  media?: ReactNode;
  /** Lo que identifica al registro. Una línea, y se trunca. */
  titulo: ReactNode;
  /** Lo que lo ubica: de quién es, cuándo fue, dónde vive. */
  detalle?: ReactNode;
  /** El dato por el que se escanea la lista, contra el borde derecho. */
  extra?: ReactNode;
  /** Qué abre la fila. Sin esto la fila no es un botón: hay listas que sólo se
   *  leen, y una fila que no lleva a ningún lado no tiene por qué responder al
   *  dedo ni pedir una parada de tabulado. */
  onClick?: () => void;
  /** Quién es esta fila, para el grupo de la lista. Hace falta con `acciones`:
   *  es con lo que se sabe cuál está corrida. */
  id?: string;
  /** Lo que aparece al correr la fila hacia la izquierda —ver `Deslizable`—.
   *  La fila no sabe nada del gesto: sólo dice qué se le puede hacer. */
  acciones?: AccionDeslizable[];
  /** Lo que va debajo, a lo ancho de la fila. Para lo que no es una línea de
   *  texto: un reproductor de audio, una miniatura grande.
   *
   *  **Va afuera del botón, y por eso existe.** Un botón no puede contener otro
   *  —el navegador cierra el de afuera y la fila se parte en dos—, así que
   *  cualquier cosa con controles adentro tiene que vivir al lado del blanco
   *  que abre la fila y no adentro. El blanco sigue siendo todo el renglón de
   *  arriba, que es lo que el pulgar busca.
   *
   *  No se corre con `acciones`: el gesto mueve el botón y esto se queda
   *  quieto. Las dos cosas juntas piden envolver la fila entera, y ninguna
   *  pantalla lo necesita todavía. */
  debajo?: ReactNode;
}

export function FilaMovil({
  media,
  titulo,
  detalle,
  extra,
  onClick,
  id,
  acciones,
  debajo,
}: FilaMovilProps) {
  const escala = useTypeScale();

  const dentro = (
    <>
      {media}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate" style={{ fontSize: escala.body }}>
          {titulo}
        </span>
        {detalle && (
          <span
            className="truncate text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {detalle}
          </span>
        )}
      </span>
      {/* Lo de la derecha, en el mismo escalón que el detalle y con cifras de
          ancho fijo: es lo que hace escaneable la columna, y sin `tabular-nums`
          "2 h ago" y "19 h ago" bailan una contra otra. Igual que la hora de una
          conversación. */}
      {extra && (
        <span
          className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {extra}
        </span>
      )}
    </>
  );

  /* 56px de alto mínimo: es el escalón táctil de la casa —el mismo de los
     controles del header— y deja respirar dos líneas de texto. */
  const forma = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

  const cuerpo = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-cuelume-press="tick"
      className={cn(
        forma,
        "outline-none active:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
      )}
    >
      {dentro}
    </button>
  ) : (
    <div className={forma}>{dentro}</div>
  );

  return (
    <li>
      {acciones?.length ? (
        <Deslizable id={id} acciones={acciones}>
          {cuerpo}
        </Deslizable>
      ) : (
        cuerpo
      )}
      {/* Pegado a lo de arriba —el botón ya puso su propio aire abajo— y con la
          misma sangría que la fila. */}
      {debajo && <div className="-mt-1 px-4 pb-2.5">{debajo}</div>}
    </li>
  );
}
