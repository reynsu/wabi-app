"use client";

import { useMemo } from "react";

import { PanelDeTickets } from "@/pages/UserTickets";
import { useTodosLosTickets } from "@/pages/tickets";
import { useUsuarios } from "@/pages/usuarios";

/* La pantalla de Tickets del sidebar: los de toda la residencia, no los de una
   cuenta.

   El archivo se llama `SupportTickets` y no `Tickets` por una razón boba y
   real: en macOS el sistema de archivos no distingue mayúsculas, y
   `Tickets.tsx` y `tickets.ts` —el fixture— serían el mismo archivo para el
   compilador.

   Es el mismo panel que la sección del perfil —la lista a la izquierda, el chat
   a la derecha, la ficha y la historia en el board—, y lo único que cambia es
   qué dice el renglón grande de cada fila. En el perfil dice el asunto, porque
   de quién es el ticket ya lo dice la pantalla entera; acá los tickets son de
   todos, así que lo primero que hay que saber es **de quién es cada uno**. El
   asunto no se pierde: sigue estando en la cabecera del chat, que es donde uno
   mira después de haber elegido a quién atender.

   Ordenados por lo que se movió último —lo hace `useTodosLosTickets`—: una cola
   de soporte se lee por lo que pasó recién y no por quién entró primero al
   padrón. */
export function SupportTickets({ tabId }: { tabId: string }) {
  /* Las dos listas vivas. Contestar o cerrar desde acá cambia el mismo ticket
     que muestra el perfil de esa cuenta, porque detrás hay una sola tienda. */
  const usuarios = useUsuarios();
  const todos = useTodosLosTickets(usuarios);

  const filas = useMemo(
    () =>
      todos.map(({ ticket, usuario }) => ({
        ticket,
        principal: usuario.name,
      })),
    [todos],
  );

  return (
    <PanelDeTickets
      filas={filas}
      tabId={tabId}
      vacio={{
        titulo: "No open tickets",
        detalle:
          "Nobody has opened one yet. It’s the quiet state, and the usual one.",
      }}
    />
  );
}
