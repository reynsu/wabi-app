import { useMemo } from "react";
import { create } from "zustand";

import type { BadgeColor } from "@/components/ui/badge";
import { CREADORES } from "@/pages/buzones";

/* Las cuentas DOC: el fixture de la sección Admin › DOC Accounts.
 *
 * Son las cuentas de **quienes usan esta consola**, no de quienes viven en la
 * casa. Ésa es toda la diferencia con `usuarios.ts`, y es la que explica por qué
 * son dos tablas y no una: un residente tiene un buzón, conversaciones y
 * políticas que rigen sobre él; una cuenta DOC tiene un rol, una organización y
 * una fecha desde la cual puede entrar. Nadie es las dos cosas.
 *
 * Las cuatro personas que administran la casa —las mismas que escriben políticas,
 * provisionan buzones y mandan anuncios— están acá con su cuenta. No es un
 * guiño: si la consola dice que una política la escribió Marcela Vidal, tiene
 * que haber una cuenta de Marcela Vidal, y esta tabla es donde vive. Por eso los
 * nombres se toman prestados de `CREADORES` en vez de escribirse otra vez.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide una
 * lista de cuentas y de dónde salen no es asunto suyo.
 */

/* ─────────────────────────── Qué puede hacer ─────────────────────────── */

/** El rol, que es lo que la cuenta puede hacer adentro de la consola. Cuatro, y
 *  el orden es el del alcance —de lo que más puede a lo que menos—: una lista de
 *  permisos alfabética obliga a reconstruir mentalmente cuál pesa más.
 *
 *  `kiwi` es el que no es de la casa: es del proveedor de la consola, que entra
 *  a sostener el sistema y no a administrar la residencia. Por eso está separado
 *  de `admin` aunque los dos puedan casi todo —quién responde por lo que esa
 *  cuenta hace es otra persona—. */
export const ROLES_DOC = {
  kiwi: {
    label: "Kiwi Admin",
    ayuda: "Vendor staff, for keeping the console running.",
  },
  admin: { label: "Admin", ayuda: "Runs the house: accounts, mail and policies." },
  investigator: {
    label: "Investigator",
    ayuda: "Reads mail and messages; changes nothing.",
  },
  limited: {
    label: "Limited Access",
    ayuda: "One desk, one screen — no accounts, no policies.",
  },
} as const;

export type RolDOC = keyof typeof ROLES_DOC;

export const ORDEN_ROLES = Object.keys(ROLES_DOC) as RolDOC[];

/* ─────────────────────────── Si puede entrar ─────────────────────────── */

/** Los dos estados de una cuenta DOC, con su etiqueta, el color con el que el
 *  panel los distingue y el del badge.
 *
 *  Dos y no tres: una cuenta de residente además se puede **bloquear** —cortarle
 *  la comunicación sin darla de baja—, y eso acá no significa nada. A alguien
 *  que trabaja se le saca el acceso o no.
 *
 *  Los tintes son los mismos que usan los estados de una cuenta de residente: es
 *  la misma pregunta —¿esto está andando?— hecha en dos tablas, y dos verdes
 *  distintos las volverían incomparables. */
export const ESTADOS_DOC = {
  active: { label: "Active", tinte: "#22c55e", color: "green" },
  deactivated: { label: "Deactivated", tinte: "#a3a3a3", color: "gray" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

export type EstadoDOC = keyof typeof ESTADOS_DOC;

export const ORDEN_ESTADOS_DOC = Object.keys(ESTADOS_DOC) as EstadoDOC[];

/* ─────────────────────────── Dónde trabaja ─────────────────────────── */

/** Las organizaciones que la consola conoce. La casa es una —`Facility Base`, el
 *  mismo nombre con el que el padrón ubica a un residente cuando su ficha no
 *  dice otra cosa—, y las otras dos son las que comparten cuentas con ella.
 *
 *  Una cuenta puede estar en varias: quien coordina el traslado de un residente
 *  trabaja en las dos puntas, y por eso la columna dice "Facility Base +2 more"
 *  en vez de una sola. */
export const ORGANIZACIONES = [
  "Facility Base",
  "Facility Hub",
  "Transition Center",
] as const;

export type Organizacion = (typeof ORGANIZACIONES)[number];

/* ─────────────────────────── La cuenta ─────────────────────────── */

export interface CuentaDOC {
  /** El id que se ve en ningún lado: acá la identidad a la vista es el correo
   *  —no hay dos cuentas con el mismo—, y el id es sólo la `key` de la fila.
   *  Dos personas se pueden llamar igual, y en este fixture pasa. */
  id: string;
  nombre: string;
  email: string;
  /** En cuáles trabaja. La primera es la de siempre; la columna escribe ésa y
   *  cuántas más. */
  organizaciones: Organizacion[];
  rol: RolDOC;
  /** Desde cuándo tiene este acceso. Día suelto —`2026-05-13`— como el alta de
   *  una cuenta o de un buzón.
   *
   *  Es **la fecha del acceso y no la del alta de la persona**: a alguien que
   *  cambia de rol se le mueve, porque lo que la columna dice es desde cuándo
   *  puede hacer lo que la fila dice que puede hacer. De ahí que haya fechas más
   *  nuevas que la de gente que está hace años. */
  desde: string;
  estado: EstadoDOC;
}

/* Las cuentas, escritas. Cada una tiene un motivo —por qué el proveedor tiene
   dos cuentas, por qué la trabajadora social está en tres organizaciones, por
   qué la de alguien que se fue quedó desactivada en vez de borrada— y una regla
   generadora no podría inventarlo. Es la misma decisión que toman los buzones de
   la casa y las políticas escritas. */
const [IRENE, NESTOR, MARCELA, HUGO] = CREADORES;

const CUENTAS: Omit<CuentaDOC, "id">[] = [
  /* Las cuatro que administran la casa. Son las que firman todo lo que esta
     consola hizo, así que su fecha es la más vieja de la tabla: estaban antes
     que las políticas que escribieron. */
  {
    nombre: IRENE,
    email: "irene.bustos@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "admin",
    desde: "2025-04-02",
    estado: "active",
  },
  {
    nombre: NESTOR,
    email: "nestor.ojeda@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "admin",
    desde: "2025-04-02",
    estado: "active",
  },
  {
    nombre: MARCELA,
    /* En tres: coordina traslados, y un traslado se trabaja en las dos puntas.
       Es la fila que explica para qué está el "+2 more" de la columna. */
    email: "marcela.vidal@facilitybase.org",
    organizaciones: ["Facility Base", "Transition Center", "Facility Hub"],
    rol: "admin",
    desde: "2025-04-14",
    estado: "active",
  },
  {
    nombre: HUGO,
    email: "hugo.sarmiento@facilitybase.org",
    organizaciones: ["Facility Base", "Facility Hub"],
    rol: "admin",
    desde: "2025-05-06",
    estado: "active",
  },

  /* El proveedor. No son de la casa: entran a sostener la consola, y por eso su
     correo es de otro dominio y su rol es otro aunque puedan casi lo mismo. */
  {
    nombre: "Dana Kellner",
    email: "dana@kiwichat.com",
    organizaciones: ["Facility Base", "Facility Hub", "Transition Center"],
    rol: "kiwi",
    desde: "2025-03-18",
    estado: "active",
  },
  {
    nombre: "Priya Raghunathan",
    email: "priya@kiwichat.com",
    organizaciones: ["Facility Base"],
    rol: "kiwi",
    desde: "2026-05-11",
    estado: "active",
  },

  /* Quienes leen y no tocan. Un investigador entra a mirar correo y mensajes
     —eso ya existe en esta consola, es Email Search— y no puede cambiar nada. */
  {
    nombre: "Rubén Ferrari",
    email: "ruben.ferrari@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "investigator",
    desde: "2025-09-08",
    estado: "active",
  },
  {
    nombre: "Sabrina Toledo",
    email: "sabrina.toledo@facilityhub.org",
    organizaciones: ["Facility Hub"],
    rol: "investigator",
    desde: "2026-06-23",
    estado: "active",
  },
  {
    nombre: "Emiliano Prats",
    email: "emiliano.prats@transitioncenter.org",
    organizaciones: ["Transition Center", "Facility Base"],
    rol: "investigator",
    desde: "2026-02-17",
    estado: "active",
  },

  /* Acceso acotado: la recepción y la enfermería miran una pantalla y nada más.
     Son las cuentas más nuevas porque el rol se agregó después. */
  {
    nombre: "Carolina Vera",
    email: "carolina.vera@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "limited",
    desde: "2026-05-13",
    estado: "active",
  },
  {
    nombre: "Tomás Aguilar",
    email: "tomas.aguilar@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "limited",
    desde: "2026-07-01",
    estado: "active",
  },
  {
    nombre: "Lorena Cifuentes",
    email: "lorena.cifuentes@facilityhub.org",
    organizaciones: ["Facility Hub"],
    rol: "limited",
    desde: "2026-08-04",
    estado: "active",
  },

  /* Las que ya no entran. Se desactivan y no se borran: lo que esas cuentas
     hicieron sigue firmado con su nombre en las otras tablas, y una fila que
     desaparece deja una firma sin dueño. */
  {
    nombre: "Ignacio Bermúdez",
    email: "ignacio.bermudez@facilitybase.org",
    organizaciones: ["Facility Base"],
    rol: "admin",
    desde: "2025-06-11",
    estado: "deactivated",
  },
  {
    nombre: "Rubén Ferrari",
    /* El mismo nombre que arriba y otra persona: por eso la identidad a la vista
       es el correo y no el nombre. Pasa de verdad en una casa con doscientos
       empleados, y la tabla tiene que aguantarlo sin que nadie dude. */
    email: "r.ferrari@transitioncenter.org",
    organizaciones: ["Transition Center"],
    rol: "investigator",
    desde: "2025-11-19",
    estado: "deactivated",
  },
  {
    nombre: "Alicia Monteros",
    email: "alicia.monteros@facilitybase.org",
    organizaciones: ["Facility Base", "Transition Center"],
    rol: "limited",
    desde: "2026-01-27",
    estado: "deactivated",
  },
];

/* ─────────────────────────── La tienda ─────────────────────────── */

/* A una cuenta se le saca el acceso y se le devuelve desde el menú de la fila,
   así que hay dónde guardar eso. Como en los usuarios, se guarda **el estado** y
   no la lista entera: el resto de la fila no se edita desde acá.

   Un `Record` y no una lista: lo que se guarda es "esta cuenta quedó así", y una
   copia de la fila entera se despegaría del fixture el día que se le corrija un
   correo. */
interface Tienda {
  estados: Record<string, EstadoDOC>;
}

const useTiendaDOC = create<Tienda>()(() => ({ estados: {} }));

/** Sacarle el acceso a una cuenta, o devolvérselo.
 *
 *  Se exporta la acción suelta y no el hook: la llaman una tabla y un menú, y
 *  ninguno de los dos necesita volver a pintarse porque exista. */
export const cambiarEstadoDOC = (id: string, estado: EstadoDOC) =>
  useTiendaDOC.setState((t) => ({ estados: { ...t.estados, [id]: estado } }));

/* ─────────────────────────── El armado ─────────────────────────── */

/** Cómo se lee dónde trabaja. La primera y cuántas más, que es lo que entra en
 *  una celda. Con una sola no hay nada que contar —la celda ya lo dice entero—. */
export function dondeTrabaja(cuenta: CuentaDOC) {
  const [primera, ...resto] = cuenta.organizaciones;
  return { primera, mas: resto.length };
}

/** Las cuentas de ahora: las escritas, con el estado que la consola les haya
 *  dejado encima.
 *
 *  El id sale del correo y no de un contador: es lo único que no se repite —dos
 *  personas se llaman igual en esta lista— y lo que hace que el estado guardado
 *  siga pegado a la cuenta correcta si alguien reordena el fixture. */
export function useCuentasDOC(): CuentaDOC[] {
  const estados = useTiendaDOC((t) => t.estados);
  return useMemo(
    () =>
      CUENTAS.map((c) => {
        const id = `doc/${c.email}`;
        return { ...c, id, estado: estados[id] ?? c.estado };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [estados],
  );
  /* Por nombre y no por fecha, al revés que las otras tablas de esta consola:
     un directorio se recorre buscando a una persona, y para eso el orden que
     sirve es el alfabético. Las otras se recorren buscando lo último que pasó. */
}
