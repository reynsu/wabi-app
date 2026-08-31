"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { sileo } from "sileo";

import { Button } from "@/components/ui/button";
import { copiarImagen, OMITIR } from "@/lib/copiar-nodo";

/**
 * CopiarChart — copia como imagen el diálogo en el que está.
 *
 * El diálogo entero y no el gráfico solo: un dibujo sin nombre pegado en un
 * informe no dice de qué cuenta es ni de qué meses, y quien lo reciba tiene que
 * preguntarlo. Lo que sirve pegado es lo mismo que sirve en pantalla —el
 * título, de quién, el tramo, el gráfico y su leyenda—, que es por lo que el
 * diálogo tiene esas cosas juntas. Lo único que queda afuera son sus dos
 * controles, marcados con `OMITIR`: son del marco, y una × pegada en un informe
 * no cierra nada.
 *
 * No recibe el nodo por props, lo busca: el botón vive en el header del diálogo
 * y el contenido en su cuerpo, así que atarlos por prop obliga a que alguien de
 * más arriba tenga el `ref` — y ese alguien, en un widget, es una función pura
 * que arma la definición y no puede tener estado.
 */

export function CopiarChart() {
  const boton = useRef<HTMLButtonElement>(null);
  /* El botón se queda en "copiado" un rato. Sin eso, apretarlo no tiene
     respuesta visible —el portapapeles no se ve— y se lo aprieta tres veces. */
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const marco = boton.current?.closest<HTMLElement>(
      '[data-slot="dialog-content"]',
    );
    if (!marco) return;

    try {
      await copiarImagen(marco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* Falla de verdad cuando el navegador no deja escribir el portapapeles
         —permiso denegado, o un contexto que no es seguro—. No es algo que
         quien mira pueda arreglar mirando más fuerte, así que se lo dice. */
      sileo.error({
        title: "Couldn't copy chart",
        description:
          "The browser wouldn't let this page write to the clipboard.",
      });
    }
  };

  return (
    <Button
      ref={boton}
      variant="ghost"
      size="icon"
      onClick={copiar}
      aria-label={copiado ? "Chart copied" : "Copy chart as image"}
      /* Tampoco él entra en la foto. Es del marco igual que la ×, y un botón de
         copiar adentro de lo copiado es un botón que no se puede apretar. */
      {...{ [OMITIR]: "" }}
    >
      {/* El tilde reemplaza al ícono en vez de aparecer al lado: es el mismo
          botón contestando, no un segundo control. */}
      {copiado ? <Check className="text-[#22c55e]" /> : <Copy />}
    </Button>
  );
}
