"use client";

/**
 * MessageThread — las burbujas de una conversación, con sus separadores de día.
 *
 * Vive acá y no adentro de la sección del perfil porque son dos las pantallas
 * que muestran un hilo: la sección Conversations de una cuenta, y el vistazo
 * del riel que abre una fila de Messages Search. **Un hilo leído desde el
 * perfil y el mismo hilo leído desde la búsqueda no son dos cosas**, así que no
 * pueden ser dos componentes que se van pareciendo cada vez menos.
 *
 * Lo que no trae es el mueble: ni la cabecera de con quién es, ni la caja que
 * scrollea, ni el pie de sólo lectura. Eso cambia según dónde se lo cuelgue
 * —media pantalla allá, la columna del riel acá— y es justamente la parte que
 * no es el hilo.
 *
 * Sabe una cosa más que las burbujas: cuál mensaje se vino a ver. Quien llega
 * desde una búsqueda llega por *uno*, y un hilo que se abre en el primero deja
 * a esa persona buscando a ojo lo que ya había encontrado.
 */

import { Fragment, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";

import { AudioMessage } from "@/components/audio-message";
import { MessageImage } from "@/components/message-image";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { type Mensaje } from "@/pages/conversaciones";
import { diaLargo, hora } from "@/pages/tiempo";

/* ─────────────────────────── El movimiento ───────────────────────────

   `staggerChildren` chico a propósito: con seis burbujas, 35ms por una da menos
   de un cuarto de segundo de cascada — se ve que el hilo se arma de arriba
   abajo, y no se espera.

   La animación entera se apaga sola con `prefers-reduced-motion`: `main.tsx`
   monta `MotionConfig reducedMotion="user"`. */

const cascada = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.035 } },
} as const;

/** El separador de día: no es de ninguno de los dos lados, así que sólo sube. */
const entraDia = {
  oculto: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: spring.moderate },
} as const;

/* Una burbuja entra desde su propio lado. Es la parte que hace que la cascada
   diga algo además de "esto es nuevo": las de la cuenta llegan desde la derecha
   y las del contacto desde la izquierda, así que el hilo se arma alternando y
   se lee de quién es cada una antes de leerla. */
const entraBurbuja = (propio: boolean) =>
  ({
    oculto: { opacity: 0, y: 6, x: propio ? 10 : -10 },
    visible: { opacity: 1, y: 0, x: 0, transition: spring.moderate },
  }) as const;

/* ─────────────────────────── La burbuja ─────────────────────────── */

function Burbuja({
  mensaje,
  resaltada,
  registrar,
}: {
  mensaje: Mensaje;
  resaltada: boolean;
  registrar?: (node: HTMLDivElement | null) => void;
}) {
  const escala = useTypeScale();
  const propio = mensaje.de === "cuenta";

  return (
    <motion.div
      ref={registrar}
      variants={entraBurbuja(propio)}
      className={cn("flex", propio ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex flex-col gap-1 rounded-xl px-3 py-2",
          /* El ancho de una burbuja: hasta 28rem, y nunca más del 78% del
             hilo, para que se lea de quién es sin mirar el lado. Dos
             excepciones, y las dos por lo mismo —el contenido no es texto y el
             78% no le alcanza—:

             - La nota de voz **en teléfono**: la barra del referente lleva
               adentro tiempo, onda, tacho, play y la ×, y con el 78% no le
               queda ancho a la onda. Arriba de `md` vuelve la regla de siempre.
             - La foto, **siempre**: una imagen en el 78% de un hilo angosto no
               se ve. Se le da un piso —`min-w`— para que una vertical no salga
               como una tira, y el techo sigue siendo el de todas. */
          mensaje.foto
            ? "w-full min-w-[min(16rem,100%)] max-w-[min(28rem,88%)]"
            : mensaje.voz
              ? "w-full max-w-full md:w-auto md:max-w-[min(28rem,78%)]"
              : "max-w-[min(28rem,78%)]",
          /* La burbuja de la cuenta va en el violeta del sistema —el mismo
             tono 292 de la banda de títulos de la tabla y de los badges— y no
             en un verde traído de un chat ajeno: es el único acento que esta
             app tiene, y el que hace falta acá es "estas son suyas", no un
             color de marca. La del contacto se queda en el gris del sistema.

             El valor va escrito acá y no como token en `index.css` por lo
             mismo que la banda de la tabla: ese archivo es copia byte a byte
             del showcase y una variable de más lo desalinea. */
          propio
            ? "bg-[oklch(0.938_0.035_292)] dark:bg-[oklch(0.395_0.045_292)]"
            : "bg-muted",
          /* La esquina del lado del que habla se achica: es lo que apunta la
             burbuja hacia su lado sin dibujar una colita. */
          propio ? "rounded-br-sm" : "rounded-bl-sm",
          /* El mensaje que se vino a ver: un anillo del acento, por afuera y
             sin tocar la caja. Un `ring` y no un borde porque un borde de un
             píxel le cambia el tamaño a la burbuja y la desalinea de las que
             tiene arriba y abajo; y el acento y no un fondo distinto porque el
             fondo ya está diciendo de qué lado es el mensaje, que es lo que no
             se puede pisar. */
          resaltada &&
            "ring-2 ring-[oklch(0.55_0.19_292)] dark:ring-[oklch(0.72_0.16_292)]",
        )}
      >
        {/* Una nota de voz trae las dos cosas: la píldora para escucharla y la
            transcripción debajo para leerla. No es redundancia —es una consola
            de moderación: se lee para saber qué dice y se escucha para saber
            cómo lo dijo, y con sesenta hilos por revisar lo primero es lo que
            más se usa—. La transcripción va en el escalón chico y en el color
            secundario: es de la nota, no es la nota. */}
        {/* Una foto: la imagen arriba y el pie debajo, en el mismo cuerpo que
            cualquier otro mensaje —el pie *es* el mensaje, no una nota al pie
            de la imagen—. La burbuja se ensancha para darle lugar: una foto en
            el 78% de un hilo angosto no se ve, y el ancho de la burbuja es lo
            único que puede cederle. */}
        {mensaje.foto ? (
          <div className="flex flex-col gap-2">
            <MessageImage
              id={mensaje.id}
              foto={mensaje.foto}
              pie={mensaje.texto}
            />
            <span
              className="whitespace-pre-wrap break-words"
              style={{ fontSize: escala.body }}
            >
              {mensaje.texto}
            </span>
          </div>
        ) : mensaje.voz ? (
          <div className="flex flex-col gap-1.5">
            <AudioMessage
              id={mensaje.id}
              segundos={mensaje.voz.segundos}
              /* El marco del reproductor va sobre el fondo de la burbuja, no
                 sobre el de la pantalla: su `bg-muted` sobre una burbuja que ya
                 es `bg-muted` desaparecería, y sobre la violeta de la cuenta
                 sería un gris pegado encima. Translúcido sobre el fondo de la
                 pantalla se apoya en los dos. */
              className="bg-background/55"
            />
            <span
              className="whitespace-pre-wrap break-words text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              {mensaje.texto}
            </span>
          </div>
        ) : (
          <span
            className="whitespace-pre-wrap break-words"
            style={{ fontSize: escala.body }}
          >
            {mensaje.texto}
          </span>
        )}
        {/* La hora adentro y alineada al final: afuera sumaría un renglón por
            mensaje y la conversación se leería como una lista de fechas. */}
        <span
          className="self-end tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {hora(mensaje.cuando)}
        </span>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── El hilo ─────────────────────────── */

export function MessageThread({
  mensajes,
  /** El id del mensaje que se vino a ver. Se lo marca con el anillo del acento
   *  y se lo trae a la vista. Sin esto el hilo se lee de arriba abajo, que es
   *  lo que hace quien lo abre desde la cuenta. */
  resaltado,
  className,
}: {
  mensajes: Mensaje[];
  resaltado?: string;
  className?: string;
}) {
  const escala = useTypeScale();
  const shape = useShape();
  const marcado = useRef<HTMLDivElement | null>(null);

  /* Los mensajes agrupados por día. El separador se calcula acá y no en el
     `map` porque hace falta comparar con el anterior, y una fecha por burbuja
     sería la misma fecha repetida cinco veces. */
  const porDia = useMemo(() => {
    const grupos: { dia: string; mensajes: Mensaje[] }[] = [];
    for (const m of mensajes) {
      const dia = diaLargo(m.cuando);
      const ultimoGrupo = grupos[grupos.length - 1];
      if (ultimoGrupo?.dia === dia) ultimoGrupo.mensajes.push(m);
      else grupos.push({ dia, mensajes: [m] });
    }
    return grupos;
  }, [mensajes]);

  /* Traer el marcado a la vista, al medio y no pegado a un borde: lo que hace
     entender un mensaje es lo que se dijo antes y lo que se contestó después,
     y arriba de todo se pierde la mitad de eso.

     Sin animación: la cascada de entrada ya está corriendo, y dos movimientos
     al mismo tiempo —el hilo armándose y el scroll viajando— se leen como uno
     roto. Se salta y se ve el hilo aparecer ya en el lugar correcto. */
  useEffect(() => {
    if (!resaltado) return;
    marcado.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [resaltado]);

  return (
    /* Los días van en fragmentos y no en un `div` por grupo: así la pastilla y
       las burbujas son todas hijas del mismo contenedor y la cascada es una
       sola, de arriba abajo. Con un `div` en el medio habría que repartir
       turnos en dos niveles y el orden se cruza. */
    <motion.div
      variants={cascada}
      initial="oculto"
      animate="visible"
      className={cn("flex flex-col gap-2 px-4 py-4", className)}
    >
      {porDia.map((grupo) => (
        <Fragment key={grupo.dia}>
          {/* El día, centrado y en su propia cápsula. Es lo único de esta
              columna que no es de nadie de los dos lados, y por eso va al medio
              y no alineado a un margen. */}
          <motion.div variants={entraDia} className="flex justify-center py-2">
            <span
              className={cn(
                "bg-muted px-2.5 py-1 text-muted-foreground",
                shape.item,
              )}
              style={{ fontSize: escala.caption }}
            >
              {grupo.dia}
            </span>
          </motion.div>
          {grupo.mensajes.map((m) => (
            <Burbuja
              key={m.id}
              mensaje={m}
              resaltada={m.id === resaltado}
              registrar={
                m.id === resaltado ? (node) => (marcado.current = node) : undefined
              }
            />
          ))}
        </Fragment>
      ))}
    </motion.div>
  );
}
