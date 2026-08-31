import { useSyncExternalStore } from "react";

import type { BadgeColor } from "@/components/ui/badge";

/* El dominio de las cuentas: qué es un usuario, qué estados tiene y cuáles
   son. Vive acá y no adentro de `Users.tsx` porque dejó de ser de una sola
   pantalla: la tabla lo lee, y el perfil que se abre desde ella también.

   Cuando los usuarios salgan de una API, lo que cambia es este archivo —el
   fixture y las cuatro funciones de abajo—, y ninguna de las dos pantallas. */

/* Hoy es un valor fijo y no `new Date()`: las fechas de este fixture son de
   mentira, y con un hoy que se mueve solo la fila de "hace 2 horas" pasa a
   decir "hace tres meses" sin que nadie toque nada. Cuando los usuarios salgan
   de una API, esto se va con ellos.

   Vive acá, con el fixture del que depende, y no adentro de una pantalla: lo
   leen la tabla de Accounts y las conversaciones del perfil, y dos "hoy" que
   no coinciden es la clase de bug que nadie ve hasta que una fecha queda del
   lado equivocado de la medianoche. */
export const HOY = new Date("2026-08-28T12:00:00Z");

export const DIA = 24 * 60 * 60 * 1000;

/** Los estados de comunicación, en un solo lugar: la etiqueta que ve el que
 *  lee la tabla, el color con el que se lo distingue en el panel de filtros y
 *  el color del badge. Tres vistas de un mismo dato, y por eso no viven en
 *  tres constantes distintas que se contradicen. */
export const ESTADOS = {
  active: { label: "Active", tinte: "#22c55e", color: "green" },
  deactivated: { label: "Deactivated", tinte: "#a3a3a3", color: "gray" },
  blocked: { label: "Blocked", tinte: "#f43f5e", color: "rose" },
} as const satisfies Record<string, { label: string; tinte: string; color: BadgeColor }>;

export type Estado = keyof typeof ESTADOS;

/** Qué es la cuenta: quien vive en la residencia, o alguien de su gente. */
export const TIPOS = {
  resident: "Resident",
  friends: "Friends & Family",
} as const;

export type Tipo = keyof typeof TIPOS;

/** Dónde está un residente cuando su ficha no dice otra cosa. Es un default y
 *  no una constante escondida: `location` existe en el modelo para el día que
 *  haya alas, pisos o habitaciones, y hasta entonces todos caen acá. */
export const UBICACION_POR_DEFECTO = "Facility Base";

export interface Usuario {
  /** El id que se ve: va debajo del nombre, así que es el de la cuenta y no un
   *  número de fila. También es por donde busca la barra de arriba: si está a
   *  la vista, alguien lo va a pegar ahí. */
  id: string;
  name: string;
  status: Estado;
  /** Cuándo se lo vio por última vez, con hora: la columna dice "3 h ago". */
  lastActivity: string;
  /** Cuándo entró. Sin hora: nadie pregunta a qué hora se dio de alta. */
  addedAt: string;

  accountType: Tipo;
  /** Dónde está, sólo para un residente: a la gente de afuera no se la ubica
   *  adentro. Sin valor, cae en `UBICACION_POR_DEFECTO`. */
  location?: string;

  /* Las analíticas de la cuenta. Números crudos y nada derivado: el porcentaje
     de la variación sale de `last30` contra `prev30`, y la duración legible de
     los minutos. Guardar el porcentaje además de los dos números es tener dos
     fuentes para el mismo hecho, y tarde o temprano dicen cosas distintas. */
  /* Cuántas conversaciones tiene no se guarda acá: las conversaciones existen
     —`conversaciones.ts`— y el número es cuántas son. Guardarlo además sería
     tener dos fuentes para el mismo hecho, y la primera vez que se agregue un
     hilo al fixture el header diría un número y la lista de abajo otro. */
  /* Ni los correos ni los tickets se cuentan acá, por lo mismo que las
     conversaciones: existen —`emails.ts`, `tickets.ts`— y el número es cuántos
     son. Guardarlo además sería tener dos fuentes para el mismo hecho, y la
     primera vez que se agregue uno al fixture el header diría un número y la
     lista de abajo otro. */
  /** Mensajes cruzados en esas conversaciones. */
  messages: number;
  /** Cuántos de esos mensajes frenó la moderación. Se guarda el conteo y no el
   *  porcentaje: la tasa sale de dividirlo por `messages`, y guardar las dos
   *  cosas es tener dos fuentes para el mismo hecho. */
  blockedMessages: number;
  /** La hora del día en la que más habla, de 0 a 23. Un entero y no un texto:
   *  "10:00 PM" es una manera de escribirlo —de las varias que hay— y eso lo
   *  decide quien lo muestra. */
  peakHour: number;
  /** Qué proporción de lo que se le manda termina en respuesta, de 0 a 1. */
  replyRate: number;
  /** Cuánto tarda en contestar, en minutos. */
  avgResponseMin: number;
  /** Mensajes en los últimos 30 días, y en los 30 anteriores. */
  last30: number;
  prev30: number;
}

/* Las iniciales para el `AvatarFallback`: primera del nombre, primera del
   apellido. Sin foto no hay nada más que mostrar, y dos letras es lo que
   entra en un círculo de 24px. */
export function iniciales(nombre: string) {
  const partes = nombre.split(" ").filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

/* El fixture. Es el estado inicial de la tienda de abajo y nada más: en
   cuanto hay un botón que bloquea, la lista deja de ser una constante. */
const USUARIOS: Usuario[] = [
  { id: "USR-1042", name: "Camila Ferreyra", status: "active", lastActivity: "2026-08-28T09:10:00Z", addedAt: "2026-03-04",
    accountType: "resident",
    messages: 240, replyRate: 0.55, avgResponseMin: 12, last30: 20, prev30: 29,
    blockedMessages: 2, peakHour: 8 },
  { id: "USR-1088", name: "Bruno Salas", status: "active", lastActivity: "2026-08-28T07:45:00Z", addedAt: "2026-05-19",
    accountType: "resident",
    messages: 539, replyRate: 0.62, avgResponseMin: 35, last30: 33, prev30: 38,
    blockedMessages: 11, peakHour: 15 },
  { id: "USR-1153", name: "Lucía Otero", status: "active", lastActivity: "2026-08-27T16:20:00Z", addedAt: "2025-11-02",
    accountType: "friends",
    messages: 912, replyRate: 0.69, avgResponseMin: 58, last30: 46, prev30: 44,
    blockedMessages: 27, peakHour: 22 },
  { id: "USR-1207", name: "Martín Quiroga", status: "deactivated", lastActivity: "2026-08-24T11:00:00Z", addedAt: "2026-08-12",
    accountType: "resident",
    messages: 1359, replyRate: 0.76, avgResponseMin: 81, last30: 3, prev30: 25,
    blockedMessages: 122, peakHour: 14 },
  { id: "USR-1264", name: "Sofía Bermúdez", status: "active", lastActivity: "2026-08-26T18:05:00Z", addedAt: "2026-01-28",
    accountType: "resident",
    messages: 1880, replyRate: 0.83, avgResponseMin: 104, last30: 72, prev30: 52,
    blockedMessages: 94, peakHour: 21 },
  { id: "USR-1319", name: "Iván Palacios", status: "blocked", lastActivity: "2026-07-30T09:00:00Z", addedAt: "2025-09-15",
    accountType: "friends",
    messages: 1350, replyRate: 0.9, avgResponseMin: 127, last30: 0, prev30: 35,
    blockedMessages: 338, peakHour: 13 },
  { id: "USR-1372", name: "Renata Bianchi", status: "active", lastActivity: "2026-08-28T11:30:00Z", addedAt: "2026-06-30",
    accountType: "resident",
    messages: 1834, replyRate: 0.57, avgResponseMin: 150, last30: 98, prev30: 96,
    blockedMessages: 37, peakHour: 20 },
  { id: "USR-1428", name: "Diego Miralles", status: "active", lastActivity: "2026-08-25T14:10:00Z", addedAt: "2026-04-08",
    accountType: "resident",
    messages: 2392, replyRate: 0.64, avgResponseMin: 173, last30: 21, prev30: 18,
    blockedMessages: 72, peakHour: 12 },
  { id: "USR-1490", name: "Paula Genovese", status: "deactivated", lastActivity: "2026-08-14T10:00:00Z", addedAt: "2026-02-11",
    accountType: "friends",
    messages: 684, replyRate: 0.71, avgResponseMin: 196, last30: 0, prev30: 20,
    blockedMessages: 41, peakHour: 19 },
  { id: "USR-1533", name: "Andrés Lupo", status: "active", lastActivity: "2026-08-27T20:40:00Z", addedAt: "2026-08-20",
    accountType: "resident",
    messages: 1130, replyRate: 0.78, avgResponseMin: 219, last30: 47, prev30: 57,
    blockedMessages: 56, peakHour: 11 },
  { id: "USR-1586", name: "Valentina Roldán", status: "deactivated", lastActivity: "2026-06-02T08:30:00Z", addedAt: "2025-07-21",
    accountType: "resident",
    messages: 900, replyRate: 0.85, avgResponseMin: 242, last30: 2, prev30: 30,
    blockedMessages: 72, peakHour: 18 },
  { id: "USR-1641", name: "Tomás Iriarte", status: "active", lastActivity: "2026-08-23T09:15:00Z", addedAt: "2026-08-01",
    accountType: "friends",
    messages: 1309, replyRate: 0.92, avgResponseMin: 265, last30: 73, prev30: 62,
    blockedMessages: 26, peakHour: 10 },
  { id: "USR-1705", name: "Milena Costas", status: "active", lastActivity: "2026-08-28T06:05:00Z", addedAt: "2026-07-14",
    accountType: "resident",
    messages: 1792, replyRate: 0.59, avgResponseMin: 288, last30: 86, prev30: 64,
    blockedMessages: 54, peakHour: 17 },
  { id: "USR-1768", name: "Facundo Arrieta", status: "deactivated", lastActivity: "2026-08-18T17:50:00Z", addedAt: "2026-03-27",
    accountType: "resident",
    messages: 2349, replyRate: 0.66, avgResponseMin: 311, last30: 1, prev30: 15,
    blockedMessages: 164, peakHour: 9 },
  { id: "USR-1822", name: "Julieta Ponce", status: "blocked", lastActivity: "2026-08-09T12:00:00Z", addedAt: "2025-12-09",
    accountType: "friends",
    messages: 2980, replyRate: 0.73, avgResponseMin: 334, last30: 0, prev30: 20,
    blockedMessages: 775, peakHour: 16 },
  { id: "USR-1899", name: "Nahuel Vidal", status: "active", lastActivity: "2026-08-26T09:35:00Z", addedAt: "2026-08-26",
    accountType: "resident",
    messages: 450, replyRate: 0.8, avgResponseMin: 357, last30: 35, prev30: 30,
    blockedMessages: 4, peakHour: 8 },
  { id: "USR-1955", name: "Agustín Ferrari", status: "active", lastActivity: "2026-08-28T05:20:00Z", addedAt: "2026-08-24",
    accountType: "resident",
    messages: 784, replyRate: 0.87, avgResponseMin: 380, last30: 48, prev30: 36,
    blockedMessages: 16, peakHour: 15 },
  { id: "USR-2018", name: "Delfina Sosa", status: "active", lastActivity: "2026-08-28T02:10:00Z", addedAt: "2026-08-18",
    accountType: "friends",
    messages: 1192, replyRate: 0.94, avgResponseMin: 403, last30: 61, prev30: 77,
    blockedMessages: 36, peakHour: 22 },
  { id: "USR-2074", name: "Emilia Navarro", status: "active", lastActivity: "2026-08-27T22:45:00Z", addedAt: "2026-08-05",
    accountType: "resident",
    messages: 1674, replyRate: 0.61, avgResponseMin: 426, last30: 74, prev30: 77,
    blockedMessages: 67, peakHour: 14 },
  { id: "USR-2131", name: "Joaquín Peralta", status: "deactivated", lastActivity: "2026-08-27T13:05:00Z", addedAt: "2026-07-29",
    accountType: "resident",
    messages: 2230, replyRate: 0.68, avgResponseMin: 449, last30: 3, prev30: 15,
    blockedMessages: 201, peakHour: 21 },
  { id: "USR-2196", name: "Micaela Duarte", status: "active", lastActivity: "2026-08-26T21:30:00Z", addedAt: "2026-07-19",
    accountType: "friends",
    messages: 1560, replyRate: 0.75, avgResponseMin: 472, last30: 100, prev30: 77,
    blockedMessages: 16, peakHour: 13 },
  { id: "USR-2240", name: "Santiago Aguirre", status: "blocked", lastActivity: "2026-08-26T08:15:00Z", addedAt: "2026-07-02",
    accountType: "resident",
    messages: 2079, replyRate: 0.82, avgResponseMin: 15, last30: 0, prev30: 25,
    blockedMessages: 520, peakHour: 20 },
  { id: "USR-2307", name: "Carla Benítez", status: "active", lastActivity: "2026-08-25T19:40:00Z", addedAt: "2026-06-21",
    accountType: "resident",
    messages: 592, replyRate: 0.89, avgResponseMin: 38, last30: 36, prev30: 38,
    blockedMessages: 18, peakHour: 12 },
  { id: "USR-2365", name: "Federico Ocampo", status: "active", lastActivity: "2026-08-25T07:55:00Z", addedAt: "2026-06-09",
    accountType: "friends",
    messages: 999, replyRate: 0.56, avgResponseMin: 61, last30: 49, prev30: 44,
    blockedMessages: 40, peakHour: 19 },
  { id: "USR-2418", name: "Rocío Maldonado", status: "active", lastActivity: "2026-08-24T16:25:00Z", addedAt: "2026-05-27",
    accountType: "resident",
    messages: 1480, replyRate: 0.63, avgResponseMin: 84, last30: 62, prev30: 48,
    blockedMessages: 74, peakHour: 11 },
  { id: "USR-2473", name: "Lautaro Vega", status: "deactivated", lastActivity: "2026-08-23T18:35:00Z", addedAt: "2026-05-14",
    accountType: "resident",
    messages: 1110, replyRate: 0.7, avgResponseMin: 107, last30: 1, prev30: 15,
    blockedMessages: 78, peakHour: 18 },
  { id: "USR-2529", name: "Antonella Ríos", status: "active", lastActivity: "2026-08-22T09:50:00Z", addedAt: "2026-04-30",
    accountType: "friends",
    messages: 1554, replyRate: 0.77, avgResponseMin: 130, last30: 88, prev30: 96,
    blockedMessages: 31, peakHour: 10 },
  { id: "USR-2588", name: "Gonzalo Cabrera", status: "deactivated", lastActivity: "2026-08-21T14:05:00Z", addedAt: "2026-04-16",
    accountType: "resident",
    messages: 2072, replyRate: 0.84, avgResponseMin: 153, last30: 3, prev30: 25,
    blockedMessages: 186, peakHour: 17 },
  { id: "USR-2641", name: "Belén Ibarra", status: "active", lastActivity: "2026-08-20T11:20:00Z", addedAt: "2026-04-02",
    accountType: "resident",
    messages: 2664, replyRate: 0.91, avgResponseMin: 176, last30: 24, prev30: 19,
    blockedMessages: 107, peakHour: 9 },
  { id: "USR-2705", name: "Mateo Sandoval", status: "active", lastActivity: "2026-08-19T15:45:00Z", addedAt: "2026-03-19",
    accountType: "friends",
    messages: 730, replyRate: 0.58, avgResponseMin: 199, last30: 37, prev30: 51,
    blockedMessages: 36, peakHour: 16 },
  { id: "USR-2764", name: "Florencia Acuña", status: "active", lastActivity: "2026-08-17T08:30:00Z", addedAt: "2026-03-05",
    accountType: "resident",
    messages: 660, replyRate: 0.65, avgResponseMin: 222, last30: 50, prev30: 56,
    blockedMessages: 7, peakHour: 8 },
  { id: "USR-2812", name: "Ezequiel Moyano", status: "deactivated", lastActivity: "2026-08-15T12:10:00Z", addedAt: "2026-02-20",
    accountType: "resident",
    messages: 1029, replyRate: 0.72, avgResponseMin: 245, last30: 3, prev30: 15,
    blockedMessages: 93, peakHour: 15 },
  { id: "USR-2879", name: "Guadalupe Cáceres", status: "active", lastActivity: "2026-08-13T17:00:00Z", addedAt: "2026-02-06",
    accountType: "friends",
    messages: 1472, replyRate: 0.79, avgResponseMin: 268, last30: 76, prev30: 61,
    blockedMessages: 44, peakHour: 22 },
  { id: "USR-2933", name: "Rodrigo Ledesma", status: "blocked", lastActivity: "2026-08-11T10:40:00Z", addedAt: "2026-01-22",
    accountType: "resident",
    messages: 1989, replyRate: 0.86, avgResponseMin: 291, last30: 0, prev30: 25,
    blockedMessages: 418, peakHour: 14 },
  { id: "USR-2990", name: "Malena Ferreyra", status: "active", lastActivity: "2026-08-08T13:25:00Z", addedAt: "2026-01-08",
    accountType: "resident",
    messages: 2580, replyRate: 0.93, avgResponseMin: 314, last30: 102, prev30: 116,
    blockedMessages: 129, peakHour: 21 },
  { id: "USR-3046", name: "Nicolás Bustos", status: "active", lastActivity: "2026-08-05T09:05:00Z", addedAt: "2025-12-27",
    accountType: "friends",
    messages: 1770, replyRate: 0.6, avgResponseMin: 337, last30: 25, prev30: 24,
    blockedMessages: 18, peakHour: 13 },
  { id: "USR-3108", name: "Ariana Godoy", status: "active", lastActivity: "2026-08-02T16:50:00Z", addedAt: "2025-12-15",
    accountType: "resident",
    messages: 504, replyRate: 0.67, avgResponseMin: 360, last30: 38, prev30: 31,
    blockedMessages: 10, peakHour: 20 },
  { id: "USR-3167", name: "Franco Villalba", status: "deactivated", lastActivity: "2026-07-28T11:15:00Z", addedAt: "2025-11-28",
    accountType: "resident",
    messages: 872, replyRate: 0.74, avgResponseMin: 383, last30: 1, prev30: 15,
    blockedMessages: 61, peakHour: 12 },
  { id: "USR-3221", name: "Pilar Escobar", status: "active", lastActivity: "2026-07-22T14:35:00Z", addedAt: "2025-11-14",
    accountType: "friends",
    messages: 1314, replyRate: 0.81, avgResponseMin: 406, last30: 64, prev30: 74,
    blockedMessages: 53, peakHour: 19 },
  { id: "USR-3284", name: "Bautista Ramos", status: "deactivated", lastActivity: "2026-07-15T08:45:00Z", addedAt: "2025-10-30",
    accountType: "resident",
    messages: 1830, replyRate: 0.88, avgResponseMin: 429, last30: 3, prev30: 25,
    blockedMessages: 165, peakHour: 11 },
  { id: "USR-3340", name: "Sol Medina", status: "active", lastActivity: "2026-07-06T19:20:00Z", addedAt: "2025-10-16",
    accountType: "resident",
    messages: 1320, replyRate: 0.55, avgResponseMin: 452, last30: 90, prev30: 75,
    blockedMessages: 13, peakHour: 18 },
  { id: "USR-3399", name: "Ignacio Farías", status: "active", lastActivity: "2026-06-27T10:10:00Z", addedAt: "2025-10-01",
    accountType: "friends",
    messages: 1799, replyRate: 0.62, avgResponseMin: 475, last30: 103, prev30: 75,
    blockedMessages: 36, peakHour: 10 },
  { id: "USR-3452", name: "Abril Rivero", status: "active", lastActivity: "2026-06-18T15:30:00Z", addedAt: "2025-09-18",
    accountType: "resident",
    messages: 2352, replyRate: 0.69, avgResponseMin: 18, last30: 26, prev30: 31,
    blockedMessages: 71, peakHour: 17 },
  { id: "USR-3518", name: "Thiago Cortés", status: "deactivated", lastActivity: "2026-06-04T12:55:00Z", addedAt: "2025-09-03",
    accountType: "resident",
    messages: 639, replyRate: 0.76, avgResponseMin: 41, last30: 3, prev30: 15,
    blockedMessages: 58, peakHour: 9 },
  { id: "USR-3575", name: "Catalina Núñez", status: "active", lastActivity: "2026-05-21T09:40:00Z", addedAt: "2025-08-20",
    accountType: "friends",
    messages: 1080, replyRate: 0.83, avgResponseMin: 64, last30: 52, prev30: 44,
    blockedMessages: 54, peakHour: 16 },
  { id: "USR-3630", name: "Emanuel Paz", status: "blocked", lastActivity: "2026-05-08T17:15:00Z", addedAt: "2025-08-06",
    accountType: "resident",
    messages: 870, replyRate: 0.9, avgResponseMin: 87, last30: 0, prev30: 25,
    blockedMessages: 218, peakHour: 8 },
  { id: "USR-3694", name: "Zoe Barrios", status: "active", lastActivity: "2026-04-24T11:05:00Z", addedAt: "2025-07-15",
    accountType: "resident",
    messages: 1274, replyRate: 0.57, avgResponseMin: 110, last30: 78, prev30: 95,
    blockedMessages: 25, peakHour: 15 },
  { id: "USR-3751", name: "Lucas Herrera", status: "active", lastActivity: "2026-04-09T14:20:00Z", addedAt: "2025-06-24",
    accountType: "friends",
    messages: 1752, replyRate: 0.64, avgResponseMin: 133, last30: 91, prev30: 92,
    blockedMessages: 53, peakHour: 22 },
];

/* ─────────────────────────── La tienda ─────────────────────────── */

/* Los usuarios viven en el módulo y no adentro de una pantalla. Es lo que
   obliga el workspace: la tabla y el perfil son dos pestañas hermanas, no una
   adentro de la otra, así que no hay un árbol de React que las dos compartan
   y por donde bajar un estado. Con la lista adentro de `Users` cada pestaña
   tendría su propia copia, y bloquear desde el perfil dejaría a la tabla
   diciendo "Active" sobre una cuenta bloqueada.

   Que las pestañas sostengan lo suyo vale para lo que es de la vista —el
   filtro, el scroll, qué se está mirando—. El estado de una cuenta no es de
   la vista: es el mismo hecho para todo el que lo mire.

   Es una tienda mínima a propósito —una variable, un `Set` de oyentes y
   `useSyncExternalStore`—: lo que hay para compartir es una lista de mentira
   hasta que haya API, y traer una librería de estado para eso es cargar un
   camión para mudar una silla. */

let vivos: Usuario[] = USUARIOS;

const oyentes = new Set<() => void>();

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/** La lista viva. Todo lo que la lee se vuelve a pintar cuando cambia. */
export function useUsuarios() {
  return useSyncExternalStore(suscribir, () => vivos);
}

/** Un usuario por id. `undefined` si no está: un perfil abierto sobre una
 *  cuenta que ya no existe tiene que poder decirlo en vez de romperse. */
export function useUsuario(id: string) {
  return useUsuarios().find((u) => u.id === id);
}

/** Bloquear, desbloquear, dar de baja. La lista se reemplaza entera y las
 *  filas que no cambian se conservan por identidad, así que un `useMemo` que
 *  filtre sobre ella sigue sirviendo para todo lo demás. */
export function cambiarEstado(id: string, status: Estado) {
  const proximos = vivos.map((u) => (u.id === id ? { ...u, status } : u));
  if (proximos.every((u, i) => u === vivos[i])) return;
  vivos = proximos;
  for (const avisar of oyentes) avisar();
}
