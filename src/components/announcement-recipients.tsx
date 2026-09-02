"use client";

import { UserRound } from "lucide-react";

import { usePapel } from "@/components/papel";
import { PeekCard } from "@/components/peek-card";
import { useTypeScale } from "@/lib/size-context";

/**
 * AnnouncementRecipients — a quiénes les llegó un anuncio, cuando son varios.
 *
 * La columna escribe el primero y cuántos más —"Camila Ferreyra +1"—, que es lo
 * que entra en una celda y lo que alcanza para recorrer la tabla. Lo que no
 * contesta es cuáles son los otros, y hay una pregunta más que aparece en esta
 * pantalla y en ninguna otra: la fila de al lado dice que lo leyeron dos de
 * cuatro, y lo que uno quiere saber es **cuáles dos**. Ese es el momento en que
 * alguien vuelve a llamar por teléfono.
 *
 * Así que el resto se asoma, con su lectura al lado. Es el mismo paso que la
 * transcripción de una nota de voz y que los objetivos de una política —más de
 * lo que entra en un tooltip, menos de lo que justifica abrir algo— y por eso
 * lleva la misma tarjeta de papel.
 *
 * Sólo para los anuncios que salieron a destinatarios elegidos, y sólo con más
 * de uno. A los que salieron a un grupo no se les asoma nada: cuarenta y ocho
 * nombres en una tarjeta que se abre al pasar el mouse no son un vistazo, son
 * otra tabla —y lo que la fila dice de esos es el grupo, que ya está entero a la
 * vista—.
 */

/** Lo que la tarjeta necesita de un destinatario: cómo se llama, y con qué
 *  compararlo contra la lista de los que lo abrieron. Es a propósito menos que
 *  una cuenta y menos que un `Destinatario`: los anuncios que la casa ya tenía
 *  mandados salieron a cuentas del padrón, y los que manda la consola salen a
 *  buzones y cuentas nombrados uno por uno. La tarjeta muestra las dos listas
 *  igual porque la pregunta es la misma: quiénes, y cuáles lo abrieron. */
interface Renglon {
  id: string;
  nombre: string;
}

/* Cómo se lee cada destinatario. Dos palabras y no un ícono: un tilde promete
   que la fila sin tilde también dice algo, y lo que se está contando acá es
   justamente la mitad que no abrió nada. */
const LECTURA = { si: "Read", no: "Unread" } as const;

function Destinatarios({
  destinatarios,
  leidos,
}: {
  destinatarios: Renglon[];
  leidos: string[];
}) {
  const escala = useTypeScale();
  const papel = usePapel();

  return (
    /* Un solo panel para todos, y no uno por destinatario: son los renglones de
       una lista —lo que cambia entre uno y otro es el nombre, no de qué se está
       hablando—, y un papel por renglón los cuenta como cosas separadas. */
    <ul
      className="flex flex-col overflow-hidden rounded-[12px]"
      style={{ background: papel.panel }}
    >
      {destinatarios.map((quien, i) => {
        const leyo = leidos.includes(quien.id);
        return (
          <li
            key={quien.id}
            className="flex min-w-0 items-center gap-2 px-3 py-2"
            style={{
              color: papel.texto,
              fontSize: escala.body,
              /* La línea entre renglones es del color del plato: un corte en el
                 papel y no una regla dibujada encima. El primero no la lleva
                 —arriba está el borde de la tarjeta—. */
              ...(i > 0 ? { borderTop: `1px solid ${papel.fondo}` } : null),
            }}
          >
            <UserRound
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0"
              style={{ color: papel.apagado }}
            />
            <span className="min-w-0 flex-1 truncate">{quien.nombre}</span>
            {/* Lo leído en el gris del texto y lo no leído en el apagado: la
                diferencia entre los dos renglones es lo que se vino a ver, y
                pintarlos iguales obliga a leer la palabra en cada uno. */}
            <span
              className="shrink-0"
              style={{
                color: leyo ? papel.texto : papel.apagado,
                fontSize: escala.caption,
              }}
            >
              {leyo ? LECTURA.si : LECTURA.no}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AnnouncementRecipients({
  destinatarios,
  leidos,
  /* Lo que la celda escribe. Lo resuelve la tabla y llega hecho: la tarjeta no
     vuelve a decidir cómo se resume algo que ya está resumido en la fila. */
  resumen,
}: {
  destinatarios: Renglon[];
  leidos: string[];
  resumen: string;
}) {
  const escala = useTypeScale();
  const papel = usePapel();

  return (
    <PeekCard
      openOn="hover"
      title="Recipients"
      align="start"
      side="bottom"
      width={300}
      /* El plato. El color va por `style` y no por clase: `Elevated` le pinta su
         propio `bg-surface-N` y una utilidad de Tailwind pierde contra eso por
         especificidad.

         Los dos radios se acompañan —18 afuera, 12 adentro, 6 de aire entre los
         dos—: un radio interior que no es el exterior menos el aire deja las dos
         curvas peleadas, y a esta distancia se ve. */
      className="rounded-[18px] [&_[data-slot=card-content]]:px-1.5 [&_[data-slot=card-content]]:pt-1.5"
      style={{ background: papel.fondo, color: papel.titulo }}
      /* Cuántos abrieron de cuántos, pegado al nombre. Es el mismo número de la
         columna de al lado, y está acá porque es lo que dice cuál de todas las
         tarjetas es ésta antes de contar los renglones. */
      badge={
        <span
          className="shrink-0 rounded-full px-2 py-0.5 tabular-nums"
          style={{
            background: papel.chip,
            color: papel.chipTexto,
            fontSize: escala.caption,
          }}
        >
          {leidos.length}/{destinatarios.length}
        </span>
      }
      /* De dónde salió la lista. En una consola que le manda avisos al correo de
         gente que vive acá, vale la pena que se sepa que esto es a quiénes salió
         y no a quiénes se pensaba mandarlo. */
      footer={
        <span
          className="w-full text-center"
          style={{ color: papel.apagado, fontSize: escala.caption }}
        >
          Who it went out to
        </span>
      }
      tabs={[
        {
          label: "Recipients",
          content: (
            <Destinatarios destinatarios={destinatarios} leidos={leidos} />
          ),
        },
      ]}
    >
      {/* El subrayado punteado, el mismo con el que esta consola marca lo que se
          asoma —los nombres de Accounts, los objetivos de una política—: sin él,
          la tarjeta aparece sobre una celda que no prometía nada. */}
      <span className="w-fit max-w-full min-w-0 cursor-default truncate decoration-dotted decoration-muted-foreground underline-offset-2 hover:underline aria-expanded:underline">
        {resumen}
      </span>
    </PeekCard>
  );
}
