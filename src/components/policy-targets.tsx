"use client";

import { Building2, UserRound } from "lucide-react";

import { usePapel } from "@/components/papel";
import { PeekCard } from "@/components/peek-card";
import { useTypeScale } from "@/lib/size-context";
import type { Objetivo, Politica } from "@/pages/politicas";

/**
 * PolicyTargets — a quiénes rige una regla, cuando son varios.
 *
 * La columna escribe el primero y cuántos más —"Volunteers +1"—, que es lo que
 * entra en una celda y lo que alcanza para recorrer la tabla. Lo que no
 * contesta es cuáles son los otros, y esa pregunta aparece justo cuando uno
 * está barriendo la lista: abrir la política para leer dos nombres es dar una
 * vuelta alrededor de la mesa.
 *
 * Así que el resto se asoma. Es el mismo paso que la transcripción de una nota
 * de voz —más de lo que entra en un tooltip, menos de lo que justifica abrir
 * algo— y por eso lleva la misma tarjeta de papel: el plato apenas gris, los
 * objetivos en un panel más claro apoyado encima, y el pie diciendo de dónde
 * salió la lista.
 *
 * Sólo cuando hay más de uno. Con un objetivo la celda ya lo dice entero, y una
 * tarjeta que repite lo que está a la vista es una tarjeta que estorba.
 */

/* Cómo se lee cada decisión. Las dos en una sola línea, en el gris apagado del
   papel: lo que se vino a leer son los nombres —la decisión ya la resumió la
   frase de la fila— y en la tarjeta sirven para no tener que abrir la regla
   para saber si a éste lo bloquea o lo deja pasar. */
const PERMISOS = { allow: "Allow", block: "Block" } as const;
const SENTIDOS = { in: "In", out: "Out", both: "Both" } as const;

function Objetivos({ objetivos }: { objetivos: Objetivo[] }) {
  const escala = useTypeScale();
  const papel = usePapel();

  return (
    /* Un solo panel para todos, y no uno por objetivo: son los renglones de una
       lista —lo que cambia entre uno y otro es el nombre, no de qué se está
       hablando—, y un papel por renglón los cuenta como cosas separadas. La
       tarjeta pasa a tener un papel, que es el gesto del diseño. */
    <ul
      className="flex flex-col overflow-hidden rounded-[12px]"
      style={{ background: papel.panel }}
    >
      {objetivos.map((o, i) => {
        const Icono = o.clase === "facility" ? Building2 : UserRound;
        return (
          <li
            key={o.id}
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
            <Icono
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0"
              style={{ color: papel.apagado }}
            />
            <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
            <span
              className="shrink-0 tabular-nums"
              style={{ color: papel.apagado, fontSize: escala.caption }}
            >
              {PERMISOS[o.permiso]} · {SENTIDOS[o.sentido]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PolicyTargets({
  politica,
  /* Lo que la celda escribe. Lo resuelve la tabla —que tiene el padrón a mano—
     y llega hecho: la tarjeta no vuelve a decidir cómo se resume algo que ya
     está resumido en la fila. */
  resumen,
}: {
  politica: Politica;
  resumen: string;
}) {
  const escala = useTypeScale();
  const papel = usePapel();

  return (
    <PeekCard
      openOn="hover"
      title="Applies to"
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
      /* Cuántos son, pegado al nombre: dice cuál de todas las tarjetas es ésta
         antes de contar los renglones. */
      badge={
        <span
          className="shrink-0 rounded-full px-2 py-0.5 tabular-nums"
          style={{
            background: papel.chip,
            color: papel.chipTexto,
            fontSize: escala.caption,
          }}
        >
          {politica.objetivos.length}
        </span>
      }
      /* De dónde salió la lista. En una consola que aplica reglas al correo de
         gente que vive acá, vale la pena que se sepa que esto es lo que la regla
         dice y no lo que alguien recuerda. */
      footer={
        <span
          className="w-full text-center"
          style={{ color: papel.apagado, fontSize: escala.caption }}
        >
          Written into the policy
        </span>
      }
      tabs={[{ label: "Applies to", content: <Objetivos objetivos={politica.objetivos} /> }]}
    >
      {/* El subrayado punteado, el mismo con el que esta consola marca lo que se
          asoma —los nombres de Accounts, las miniaturas de una foto—: sin él, la
          tarjeta aparece sobre una celda que no prometía nada. */}
      <span className="w-fit max-w-full min-w-0 cursor-default truncate decoration-dotted decoration-muted-foreground underline-offset-2 hover:underline aria-expanded:underline">
        {resumen}
      </span>
    </PeekCard>
  );
}
