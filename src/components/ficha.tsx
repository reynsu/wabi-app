"use client";

import type { ReactNode } from "react";

import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";

/* Las piezas de una ficha del riel, en un solo lugar.
 *
 * Una ficha es el formulario que esta consola abre al costado de una tabla en
 * vez de encima: escribir una política, mandar un anuncio. Son dos —y van a ser
 * más—, y lo que comparten no es "un par de divs" sino las cuatro decisiones que
 * hacen que las dos se lean como la misma hoja: cuánto aire hay entre un campo y
 * el siguiente, que el rótulo va afuera del control, que la hoja se parte con
 * una regla punteada y no con un borde, y que un campo en reposo ya se ve como
 * un campo.
 *
 * Estaban escritas en `NuevaPolitica.tsx`, que fue la primera. Copiadas a la
 * segunda serían dos maneras de que dejen de ser iguales: alcanza con que
 * alguien afine una para que abrir el riel desde otra fila del sidebar empiece a
 * abrir otro mueble.
 */

/* Este archivo exporta constantes además de componentes, que es lo que el fast
   refresh no quiere. Es a propósito: la escala y los dos componentes que la usan
   son una sola cosa leída de una vez. */
/* oxlint-disable react/only-export-components */

/** La escala vertical de una ficha. Tres valores y no seis: entre el rótulo y su
 *  control (6), entre un campo y el siguiente (20), y a los lados de una regla
 *  (24). Una ficha donde cada bloque elige su aire propio se lee como varias
 *  fichas apiladas. */
export const AIRE = { rotulo: "gap-1.5", campos: "gap-5", corte: "gap-6" };

/** Los campos arrancan con la cara que el sistema les da al pasarles el puntero
 *  —fondo `muted/50` y anillo— en vez de arrancar transparentes.
 *
 *  En una barra de herramientas un campo transparente está bien: hay tres cosas
 *  en ese renglón y se sabe cuál es el buscador. En una ficha hay cinco campos
 *  uno abajo del otro, y transparentes se leen como texto suelto: no se ve dónde
 *  se escribe hasta que la mano pasa por encima, que es justo lo que un
 *  formulario no puede pedir.
 *
 *  El foco se conserva: la regla del `focus-within` pesa más que la de reposo, y
 *  por eso el campo enfocado sigue subiendo a `bg-card` como en todo el resto de
 *  la app. */
export const CAMPO_PUESTO = [
  "[&>div:has(>input)]:bg-muted/50",
  "[&>div:has(>input)]:ring-border",
  "[&:focus-within>div:has(>input)]:bg-card",
].join(" ");

/** Un control segmentado: fondo gris, la elegida en blanco con su sombra, y el
 *  resto en el gris del texto secundario. El color aparece sólo donde significa
 *  algo —el rojo de "Block"—, y por eso el tinte es de la opción y no del
 *  control. */
export function Segmentado<T extends string>({
  valor,
  opciones,
  onElegir,
  /** Para los pares que ya se saben de memoria —las rayas y los cuadraditos de
   *  lista o grilla—. El rótulo se sigue escribiendo, en el `aria-label`: lo que
   *  se esconde es el texto a la vista, no el nombre de la opción, así que quien
   *  no ve el ícono sigue oyendo qué elige.
   *
   *  Sólo para pares de íconos conocidos. Un segmentado de tres opciones sin
   *  palabras es una adivinanza, y las fichas de esta app —de donde salió este
   *  control— escriben todas su rótulo. */
  rotuloOculto,
  className,
}: {
  valor: T;
  opciones: { value: T; label: string; icon?: ReactNode; tinte?: string }[];
  onElegir: (v: T) => void;
  rotuloOculto?: boolean;
  className?: string;
}) {
  const escala = useTypeScale();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-muted p-0.5",
        className,
      )}
    >
      {opciones.map((o) => {
        const puesta = o.value === valor;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onElegir(o.value)}
            aria-label={rotuloOculto ? o.label : undefined}
            aria-pressed={rotuloOculto ? puesta : undefined}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg transition-colors duration-80",
              /* Sin rótulo la opción es un cuadrado fijo y no una porción del
                 ancho: `size-6` más el `p-0.5` del control dan veintiocho, que
                 es el alto de un botón compacto —el de "Filters", que suele
                 estar al lado—. Con `flex-1` y padding, el control quedaba dos
                 píxeles más alto y se notaba en la barra. */
              rotuloOculto ? "size-6 shrink-0" : "flex-1 px-2 py-1",
              puesta
                ? "bg-card text-foreground shadow-surface-2"
                : "text-muted-foreground hover:text-foreground",
              puesta && o.tinte,
            )}
            style={{ fontSize: escala.caption }}
          >
            {o.icon}
            {!rotuloOculto && o.label}
          </button>
        );
      })}
    </span>
  );
}

/** Un campo: el rótulo encima, una línea de ayuda cuando hace falta, y el
 *  control debajo.
 *
 *  El rótulo va afuera y no adentro del campo: con el rótulo arriba, la columna
 *  se recorre de un vistazo —qué se pide, qué se puso— sin tener que enfocar
 *  cada control para acordarse de qué era. Es lo que separa una ficha de un
 *  formulario de diálogo. */
export function Campo({
  rotulo,
  ayuda,
  children,
  /** Para cuando la ficha acomoda sus campos en una grilla y uno tiene que
   *  ocupar más de una columna. El campo no decide dónde va —eso es de la
   *  hoja—, pero es el que lleva la clase que lo dice. */
  className,
}: {
  rotulo: string;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}) {
  const escala = useTypeScale();
  return (
    <div className={cn("flex min-w-0 flex-col", AIRE.rotulo, className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium" style={{ fontSize: escala.caption }}>
          {rotulo}
        </span>
        {ayuda && (
          <span
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {ayuda}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** La regla que parte una ficha. Punteada: separa partes de una misma hoja, no
 *  dos superficies distintas. */
export const Corte = () => (
  <span aria-hidden className="h-px shrink-0 border-t border-dashed border-border" />
);
