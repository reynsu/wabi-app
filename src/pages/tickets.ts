import { useMemo, useSyncExternalStore } from "react";

import { HOY, type Usuario } from "@/pages/usuarios";
import type { BadgeColor } from "@/components/ui/badge";

/* Los tickets de soporte de una cuenta: el fixture de la tercera sección del
   perfil.

   Mismo trato que las otras dos —escritos a mano, repartidos por el número del
   id, y **cuántos tiene una cuenta es cuántos hay en esta lista**—, y otra vez
   un modelo propio. Un ticket no es un correo ni un hilo de chat: tiene un
   número que se cita por teléfono, un estado que cambia, alguien a cargo, y una
   historia de lo que le fue pasando. Eso último es lo único que se parece a una
   conversación, y ni siquiera: son novedades, no respuestas. */

/** Dónde está el ticket. El orden es el del ciclo de vida, que es también el
 *  orden en que conviene leerlos. */
export const ESTADOS_TICKET = {
  /** Entró y nadie lo tocó. Es el único que se gana solo, por no haber pasado
   *  nada todavía. */
  new: { label: "New", tinte: "#3b82f6", color: "blue" },
  /** Alguien lo está mirando: hay ida y vuelta. */
  open: { label: "Open", tinte: "#8b5cf6", color: "violet" },
  /** Esperando algo que no depende de soporte —una respuesta del residente, un
   *  repuesto, una semana para ver si vuelve a pasar—. */
  pending: { label: "Pending", tinte: "#f59e0b", color: "amber" },
  /** Terminado. */
  closed: { label: "Closed", tinte: "#a3a3a3", color: "gray" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

/** Los cuatro, en el orden del ciclo de vida. Es el orden en el que los ofrece
 *  el panel de filtros: leerlos así es leer por dónde va cada uno. */
export const ORDEN_ESTADOS = Object.keys(ESTADOS_TICKET) as EstadoTicket[];

export type EstadoTicket = keyof typeof ESTADOS_TICKET;

/** Cuánto corre. Sin color propio: la prioridad no compite con el estado, que
 *  es lo que primero hay que saber. La alta se marca y el resto se dice. */
export const PRIORIDADES = {
  low: "Low",
  normal: "Normal",
  high: "High",
} as const;

export type Prioridad = keyof typeof PRIORIDADES;

/** Quién dejó la novedad. */
export type Autor = "cuenta" | "soporte";

export interface Novedad {
  id: string;
  autor: Autor;
  /** Quién es, con nombre. Para `cuenta` lo pone el perfil. */
  nombre: string;
  texto: string;
  cuando: string;
  /** Cuando la novedad además movió el estado, cuál pasó a ser. Va junta con
   *  el texto y no en una entrada aparte: "lo miré y lo cerré" es una sola
   *  cosa que pasó, no dos. */
  estado?: EstadoTicket;
}

export interface Ticket {
  id: string;
  /** El número que se cita por teléfono. Es lo primero que se lee de la fila,
   *  antes que el asunto. */
  referencia: string;
  asunto: string;
  categoria: string;
  estado: EstadoTicket;
  prioridad: Prioridad;
  /** Quién lo tiene. Sin asignar es un estado real y se dice. */
  asignado: string | null;
  abierto: string;
  novedades: Novedad[];
}

/* ─────────────────────────── Las plantillas ─────────────────────────── */

interface Plantilla {
  asunto: string;
  categoria: string;
  estado: EstadoTicket;
  prioridad: Prioridad;
  asignado: string | null;
  /** Cada novedad con los minutos que pasaron desde que se abrió el ticket. */
  novedades: {
    autor: Autor;
    nombre?: string;
    texto: string;
    min: number;
    estado?: EstadoTicket;
  }[];
}

const PLANTILLAS: Plantilla[] = [
  {
    asunto: "Radiator in the bedroom stays cold",
    categoria: "Maintenance",
    estado: "open",
    prioridad: "high",
    asignado: "Tomás Iriarte",
    novedades: [
      { autor: "cuenta", texto: "The one in the living room works fine, but the bedroom one never warms up. It's been like this since the weekend.", min: 0 },
      { autor: "soporte", nombre: "Front Desk", texto: "Thanks for letting us know. Logged and passed to maintenance.", min: 45 },
      { autor: "soporte", nombre: "Tomás Iriarte", texto: "Came by and bled the radiator — there was air in the line. Leaving it on overnight to see if it holds.", min: 1_310, estado: "open" },
    ],
  },
  {
    asunto: "Wi-Fi drops in the afternoon",
    categoria: "Connectivity",
    estado: "pending",
    prioridad: "normal",
    asignado: "Nahuel Vidal",
    novedades: [
      { autor: "cuenta", texto: "Video calls cut out around four every day. Mornings are fine.", min: 0 },
      { autor: "soporte", nombre: "Nahuel Vidal", texto: "That's when the east wing is busiest. We moved your room to the other access point — could you try a call tomorrow afternoon and tell us how it goes?", min: 220, estado: "pending" },
    ],
  },
  {
    asunto: "Duplicate charge on the August statement",
    categoria: "Billing",
    estado: "closed",
    prioridad: "normal",
    asignado: "Billing",
    novedades: [
      { autor: "cuenta", texto: "The laundry service appears twice for the same week.", min: 0 },
      { autor: "soporte", nombre: "Billing", texto: "You're right — it was entered twice when the batch was re-run. The credit will show on next month's statement.", min: 380, estado: "pending" },
      { autor: "soporte", nombre: "Billing", texto: "Credit applied. Closing this one, but reply here if it doesn't show up.", min: 1_540, estado: "closed" },
    ],
  },
  {
    asunto: "Request: second key for my daughter",
    categoria: "Access",
    estado: "new",
    prioridad: "low",
    asignado: null,
    novedades: [
      { autor: "cuenta", texto: "She visits most Sundays and I'd rather she didn't have to wait at the desk.", min: 0 },
    ],
  },
  {
    asunto: "Shower drains slowly",
    categoria: "Maintenance",
    estado: "closed",
    prioridad: "normal",
    asignado: "Tomás Iriarte",
    novedades: [
      { autor: "cuenta", texto: "Water pools around my feet by the end.", min: 0 },
      { autor: "soporte", nombre: "Tomás Iriarte", texto: "Cleared the trap. Running clean now.", min: 640, estado: "pending" },
      { autor: "soporte", nombre: "Front Desk", texto: "No further reports after two weeks. Closing.", min: 21_600, estado: "closed" },
    ],
  },
  {
    asunto: "Meal preference change — no shellfish",
    categoria: "Care",
    estado: "closed",
    prioridad: "high",
    asignado: "Care Team",
    novedades: [
      { autor: "cuenta", texto: "My doctor asked me to stop eating shellfish. Can the kitchen be told?", min: 0 },
      { autor: "soporte", nombre: "Care Team", texto: "Noted on the care plan and passed to the kitchen. It's flagged on the daily sheet from tomorrow.", min: 95, estado: "closed" },
    ],
  },
];

const numeroDe = (id: string) => Number(id.replace(/\D/g, "")) || 0;

const MINUTO = 60 * 1000;
/** Cuánto separa un ticket del siguiente. Días, no horas: nadie abre tres
 *  tickets la misma tarde. */
const PASO = 9 * 24 * 60 * 60 * 1000;

function construir(usuario: Usuario): Ticket[] {
  const n = numeroDe(usuario.id);
  /* Una de cada cuatro cuentas no abrió ninguno, y está bien: la mayoría de la
     gente no abre tickets, y una sección que nunca se ve vacía esconde el
     único estado que casi siempre es el verdadero. */
  const cuantos = n % 4 === 0 ? 0 : 1 + (n % 3);
  const desde = n % PLANTILLAS.length;
  /* El último movimiento cae antes de la última vez que se vio a la cuenta.
     El más viejo, semanas atrás. */
  const ultimo = new Date(usuario.lastActivity).getTime() - 6 * 60 * MINUTO;

  return Array.from({ length: cuantos }, (_, k) => {
    const plantilla = PLANTILLAS[(desde + k) % PLANTILLAS.length];
    const finDelTicket = ultimo - k * PASO;
    const largo = plantilla.novedades[plantilla.novedades.length - 1].min;
    const abierto = finDelTicket - largo * MINUTO;

    return {
      id: `${usuario.id}/t${k}`,
      /* La referencia sale del id de la cuenta y del orden, así que es estable
         y no se repite entre cuentas — que es todo lo que se le pide a un
         número que alguien va a dictar por teléfono. */
      referencia: `TKT-${n}${k + 1}`,
      asunto: plantilla.asunto,
      categoria: plantilla.categoria,
      estado: plantilla.estado,
      prioridad: plantilla.prioridad,
      asignado: plantilla.asignado,
      abierto: new Date(abierto).toISOString(),
      novedades: plantilla.novedades.map((nov, i) => ({
        id: `${usuario.id}/t${k}/n${i}`,
        autor: nov.autor,
        nombre: nov.autor === "cuenta" ? usuario.name : (nov.nombre ?? "Support"),
        texto: nov.texto,
        cuando: new Date(abierto + nov.min * MINUTO).toISOString(),
        estado: nov.estado,
      })),
    };
  });
}

/* ─────────────────────────── La tienda ───────────────────────────

   Los tickets dejaron de ser sólo lectura: desde el chat se contesta, se
   cierra y se reabre. Así que la lista es estado y no una constante, y vive en
   el módulo por el mismo motivo que los usuarios —ver `usuarios.ts`—: el chat,
   la lista de la izquierda y los widgets del board son tres lugares distintos
   que tienen que decir lo mismo, y dos de ellos ni siquiera están en el mismo
   árbol de React.

   Se construye por cuenta y a demanda: cuarenta y ocho listas armadas de
   entrada para mirar una sola es trabajo tirado. */

const memoria = new Map<string, Ticket[]>();

const oyentes = new Set<() => void>();

/* Un número que sube con cada escritura. `ticketsDe` guarda lo que arma y
   devuelve el mismo array mientras nadie lo toque, así que para "todos los
   tickets de todas las cuentas" no alcanza con mirar un array: hace falta algo
   que cambie cuando cambia cualquiera. */
let version = 0;

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

const avisar = () => {
  version += 1;
  for (const oyente of oyentes) oyente();
};

export function ticketsDe(usuario: Usuario): Ticket[] {
  const guardado = memoria.get(usuario.id);
  if (guardado) return guardado;
  const armados = construir(usuario);
  memoria.set(usuario.id, armados);
  return armados;
}

/** La lista viva de una cuenta. Todo lo que la lee se vuelve a pintar cuando
 *  cambia. */
export function useTickets(usuario: Usuario): Ticket[] {
  return useSyncExternalStore(
    suscribir,
    /* `ticketsDe` guarda lo que arma, así que devuelve el mismo array mientras
       nadie lo toque: `useSyncExternalStore` lo compara por identidad y sin eso
       repintaría para siempre. */
    () => ticketsDe(usuario),
  );
}

/* El id del ticket lleva el de la cuenta adelante (`USR-1042/t0`), así que
   para escribir no hace falta pasar las dos cosas. */
const cuentaDe = (ticketId: string) => ticketId.split("/")[0];

/* Cuándo pasa lo que se hace ahora. `HOY` es fijo —el fixture entero cuelga de
   él—, así que dos respuestas seguidas caerían en el mismo minuto y el orden se
   perdería. El contador las separa de a uno; cuando haya un reloj de verdad,
   esto se va con el fixture. */
let empujon = 0;
const ahora = () =>
  new Date(HOY.getTime() + ++empujon * 60 * 1000).toISOString();

/* Escribir es reemplazar: la lista de la cuenta se rehace con el ticket
   cambiado adentro, y los que no cambian se conservan por identidad. */
function editar(ticketId: string, fn: (t: Ticket) => Ticket) {
  const id = cuentaDe(ticketId);
  const lista = memoria.get(id);
  if (!lista) return;
  memoria.set(
    id,
    lista.map((t) => (t.id === ticketId ? fn(t) : t)),
  );
  avisar();
}

/** Quién contesta desde la consola. Hasta que haya una sesión con nombre, las
 *  respuestas salen a nombre del equipo y no de una persona: firmar con el
 *  nombre de quien está asignado sería ponerle palabras en la boca. */
const QUIEN_CONTESTA = "Support";

/** Contesta el ticket desde la consola. */
export function responder(ticketId: string, texto: string) {
  const limpio = texto.trim();
  if (!limpio) return;
  editar(ticketId, (t) => ({
    ...t,
    novedades: [
      ...t.novedades,
      {
        id: `${t.id}/n${t.novedades.length}`,
        autor: "soporte",
        nombre: QUIEN_CONTESTA,
        texto: limpio,
        cuando: ahora(),
      },
    ],
  }));
}

/** Cierra o reabre. El cambio entra como una novedad más y no como un campo
 *  que se pisa por afuera: así el ticket cuenta lo que le pasó, que es lo que
 *  la historia del board está para mostrar. */
export function moverEstado(ticketId: string, estado: EstadoTicket) {
  editar(ticketId, (t) =>
    t.estado === estado
      ? t
      : {
          ...t,
          estado,
          novedades: [
            ...t.novedades,
            {
              id: `${t.id}/n${t.novedades.length}`,
              autor: "soporte",
              nombre: QUIEN_CONTESTA,
              texto:
                estado === "closed"
                  ? "Closed from the console."
                  : "Reopened from the console.",
              cuando: ahora(),
              estado,
            },
          ],
        },
  );
}

/** Un ticket junto a la cuenta que lo abrió. Es lo que necesita la pantalla de
 *  Tickets del sidebar, donde los tickets no son de una cuenta sino de todas y
 *  lo primero que hay que saber es de quién es cada uno. */
export interface TicketConDueno {
  ticket: Ticket;
  usuario: Usuario;
}

/** Todos los tickets abiertos en la residencia, del más movido al más quieto.
 *  Ese orden y no el del id: una cola de soporte se lee por lo que se movió
 *  recién, no por quién entró primero al padrón. */
export function useTodosLosTickets(usuarios: Usuario[]): TicketConDueno[] {
  const v = useSyncExternalStore(suscribir, () => version);

  return useMemo(
    () =>
      usuarios
        .flatMap((usuario) =>
          ticketsDe(usuario).map((ticket) => ({ ticket, usuario })),
        )
        .sort(
          (a, b) =>
            new Date(ultimaNovedad(b.ticket).cuando).getTime() -
            new Date(ultimaNovedad(a.ticket).cuando).getTime(),
        ),
    /* `v` va en las dependencias aunque el cuerpo no lo lea: es el número que
       sube con cada escritura, y es lo único que puede decir que un ticket
       cambió —`ticketsDe` devuelve el mismo array mientras nadie lo toque, así
       que sin esto la lista se quedaría con la foto de la primera vez—. */
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [usuarios, v],
  );
}

/** La última novedad: es lo que la lista muestra como vistazo y lo que dice
 *  cuándo se movió por última vez. */
export const ultimaNovedad = (t: Ticket) => t.novedades[t.novedades.length - 1];

/** Lo último que dijo el cliente. No la última novedad: entre lo que dice
 *  soporte y lo que dice quien abrió el ticket, lo que hace falta para decidir
 *  a quién atender primero es lo segundo. `undefined` si todavía no habló —hoy
 *  no puede pasar, todos los hilos arrancan con él, pero un ticket abierto
 *  desde la consola algún día sí. */
export const ultimoDelCliente = (t: Ticket) =>
  [...t.novedades].reverse().find((n) => n.autor === "cuenta");

/** Un ticket sigue vivo mientras no esté resuelto ni cerrado. Es lo que separa
 *  "hay algo que hacer" de "esto ya pasó". */
export const abierto = (t: Ticket) => t.estado !== "closed";
