"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEsMovil } from "@/hooks/use-es-movil";
import { cn } from "@/lib/utils";
import { useTemaOscuro } from "@/stores/tema";

/**
 * BotonDeAlta — la acción de una pantalla de lista: la única que crea algo.
 *
 * De hielo: un velo de gris muy liviano sobre un `ghost`, y **dos cantos de un
 * píxel** —uno oscuro por fuera y uno claro por dentro—. Son las dos aristas las
 * que hacen el efecto, no el relleno: es lo que separa un vidrio de una mancha,
 * y se lee limpio sin subir de tono. El negro sólido del `primary` pesa
 * demasiado para una barra que al lado tiene un campo y un panel de filtros.
 *
 * Vive acá y no adentro de una pantalla porque ya lo usan dos —Announcements y
 * DOC Accounts— y van a ser más. Copiado serían dos maneras de que dejen de ser
 * el mismo botón: alcanza con que alguien afine un canto para que crear algo en
 * una sección se vea distinto de crearlo en otra.
 *
 * Lo único que cambia entre pantallas es el sustantivo. El `+` es siempre el
 * mismo glifo y no el de la sección: el de la sección ya está a la vista dos
 * veces —la fila del sidebar y la pestaña—, y lo que el botón tiene que decir es
 * qué hace. Con el signo delante, un "New" adelante del sustantivo sería la
 * misma palabra escrita dos veces.
 *
 * Las sombras van por `style` y no en clases: son dos capas que cambian enteras
 * entre los dos temas, y escritas como utilidades arbitrarias —con sus guiones
 * bajos y sus paréntesis escapados— no hay manera de leerlas. El tema se
 * pregunta acá, como lo hacen las tarjetas de papel.
 *
 * El velo lleva `backdrop-blur`, que hoy no tiene qué desenfocar: estas barras
 * están apoyadas sobre un plano liso. Va puesto igual —el día que algo scrollee
 * por debajo, funciona solo— y lo que hace el efecto mientras tanto son el velo
 * y los dos cantos.
 *
 * **En el teléfono se queda sin la palabra.** El sustantivo al lado de un campo
 * de búsqueda y de un botón de filtros no entra en 375px, y de las tres cosas
 * de esa fila ésta es la que mejor se banca quedarse muda: un `+` arriba de una
 * lista es "agregar uno de éstos" en cualquier teléfono, y lo que agrega lo
 * termina de decir lo que se abre al tocarlo. El sustantivo no se pierde —pasa
 * al `aria-label`, que es donde un lector de pantalla lo busca— y el botón se
 * redondea entero, para acompañar a la píldora del campo que tiene al lado.
 */
export function BotonDeAlta({
  /** El sustantivo, sin el "New": "Announcement", "Account". */
  children,
  onClick,
  /** Sin esto el botón se apaga. Es para la pantalla que todavía no tiene dónde
   *  poner lo que el botón abre: apagado no promete algo que no va a pasar. */
  disponible = true,
}: {
  children: string;
  onClick?: () => void;
  disponible?: boolean;
}) {
  const oscuro = useTemaOscuro();
  const esMovil = useEsMovil();

  return (
    <Button
      variant="ghost"
      {...(esMovil
        ? { size: "icon" as const, "aria-label": `New ${children}` }
        : { leadingIcon: Plus })}
      /* `text-foreground` porque el `ghost` nace en el gris secundario: sobre el
         velo, la etiqueta va a la misma tinta que el resto de la barra. */
      className={cn(
        "bg-foreground/[0.04] text-foreground backdrop-blur-md dark:bg-foreground/[0.08]",
        esMovil && "rounded-full",
      )}
      onClick={onClick}
      disabled={!disponible}
      style={{
        boxShadow: oscuro
          ? "0 0 0 1px rgb(0 0 0 / 0.55), inset 0 0 0 1px rgb(255 255 255 / 0.14)"
          : "0 0 0 1px rgb(0 0 0 / 0.10), inset 0 0 0 1px rgb(255 255 255 / 0.90)",
      }}
    >
      {esMovil ? <Plus /> : children}
    </Button>
  );
}
