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
  /** Desde cuándo tiene este acceso.
   *
   *  Es **la fecha del acceso y no la del alta de la persona**: a alguien que
   *  cambia de rol se le mueve, porque lo que la columna dice es desde cuándo
   *  puede hacer lo que la fila dice que puede hacer. De ahí que haya fechas más
   *  nuevas que la de gente que está hace años.
   *
   *  Un día suelto —`2026-05-13`— o un momento —`2026-05-13T09:30`—. Las dos
   *  formas conviven porque las dos cosas se dicen de verdad: un acceso que
   *  empezó "ese día" y uno que empezó a una hora. La ficha de alta pide las dos
   *  con el mismo campo y sólo guarda la hora cuando alguien la eligió; sin eso,
   *  cada cuenta tendría un `00:00` que nadie fechó. Quien muestra el día usa
   *  `diaDe`. */
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

/** El día de un `desde`, tenga hora o no. Es lo que muestra la columna y por lo
 *  que pregunta el filtro: la hora, cuando la hay, es una precisión del acceso y
 *  no algo que se recorra en una tabla. */
export const diaDe = (desde: string) => desde.slice(0, 10);

/** El momento entero, escrito, para cuando hay lugar —el `title` de la celda—.
 *  `null` cuando el acceso no tiene hora: un "12:00 AM" agregado a un día que
 *  nadie fechó a esa hora es una precisión inventada. */
const CON_HORA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const momentoDe = (desde: string) =>
  desde.includes("T") ? CON_HORA.format(new Date(desde)) : null;

/* ─────────────────────────── La tienda ─────────────────────────── */

/* A una cuenta se le saca el acceso y se le devuelve desde el menú de la fila,
   así que hay dónde guardar eso. Como en los usuarios, se guarda **el estado** y
   no la lista entera: el resto de la fila no se edita desde acá.

   Un `Record` y no una lista: lo que se guarda es "esta cuenta quedó así", y una
   copia de la fila entera se despegaría del fixture el día que se le corrija un
   correo. */
interface Tienda {
  estados: Record<string, EstadoDOC>;
  /** Lo que la consola dio de alta. Aparte del fixture y no mezclado con él: son
   *  de dos naturalezas —lo que estaba y lo que hicimos—, y el día que las
   *  cuentas vengan de una API lo primero se borra y esto se queda. */
  creadas: CuentaDOC[];
}

const useTiendaDOC = create<Tienda>()(() => ({ estados: {}, creadas: [] }));

/** Sacarle el acceso a una cuenta, o devolvérselo.
 *
 *  Se exporta la acción suelta y no el hook: la llaman una tabla y un menú, y
 *  ninguno de los dos necesita volver a pintarse porque exista. */
export const cambiarEstadoDOC = (id: string, estado: EstadoDOC) =>
  useTiendaDOC.setState((t) => ({ estados: { ...t.estados, [id]: estado } }));

/** Cuánto tarda en darse de alta una cuenta.
 *
 *  No hay servidor detrás, y sin demora el alta sería instantánea: se toca el
 *  botón y la fila ya está. Eso no es lo que va a pasar el día que haya una API,
 *  y una pantalla diseñada contra un alta instantánea no tiene dónde poner lo
 *  que pasa mientras. Es la misma decisión, con el mismo número, que el alta de
 *  políticas, la de buzones y la de anuncios. */
const DEMORA_MS = 900;

const demora = () => new Promise((listo) => setTimeout(listo, DEMORA_MS));

/** Lo que la ficha manda. El nombre llega armado —la ficha lo pide en tres
 *  campos y los junta— porque lo que la casa guarda de una persona es cómo se
 *  llama, y partirlo en tres campos que sólo se vuelven a juntar para mostrarlos
 *  es guardar la forma del formulario en vez del dato. */
export interface AltaDOC {
  nombre: string;
  email: string;
  rol: RolDOC;
  organizaciones: Organizacion[];
  desde: string;
}

/**
 * Dar de alta una cuenta. Devuelve la que quedó.
 *
 * Es `async` y no una escritura a secas porque del otro lado va a haber una red:
 * quien la llama tiene que poder esperarla, mostrar que está en curso y
 * enterarse si falla.
 *
 * Falla cuando ya hay una cuenta con ese correo. No es una restricción inventada
 * para tener un error: el correo **es** la identidad de una fila en esta tabla
 * —hay dos personas con el mismo nombre—, así que dos cuentas con el mismo
 * correo son dos filas que nadie puede distinguir. Se chequea después de la
 * espera, contra la lista de ese momento, que es donde estaría la que se coló
 * mientras tanto.
 */
export async function crearCuentaDOC(datos: AltaDOC): Promise<CuentaDOC> {
  await demora();

  const email = datos.email.trim().toLowerCase();
  const { creadas } = useTiendaDOC.getState();
  const yaHay = [...CUENTAS, ...creadas].some(
    (c) => c.email.toLowerCase() === email,
  );
  if (yaHay) {
    throw new Error(`${email} already has an account.`);
  }

  const cuenta: CuentaDOC = {
    /* El id sale del correo, como el de las escritas: es lo único que no se
       repite, y así el estado que se le guarde encima sigue pegado a la cuenta
       correcta. */
    id: `doc/${email}`,
    nombre: datos.nombre.trim(),
    email,
    organizaciones: datos.organizaciones,
    rol: datos.rol,
    desde: datos.desde,
    /* Nace activa: dar de alta a alguien es dejarlo entrar. Una cuenta que nace
       desactivada es un formulario que no hizo nada. */
    estado: "active",
  };
  useTiendaDOC.setState({ creadas: [...creadas, cuenta] });
  return cuenta;
}

/* ─────────────────────────── El armado ─────────────────────────── */

/** Cómo se lee dónde trabaja. La primera y cuántas más, que es lo que entra en
 *  una celda. Con una sola no hay nada que contar —la celda ya lo dice entero—. */
export function dondeTrabaja(cuenta: CuentaDOC) {
  const [primera, ...resto] = cuenta.organizaciones;
  return { primera, mas: resto.length };
}

/** Las cuentas de ahora: las escritas más las que dio de alta la consola, con el
 *  estado que se les haya dejado encima, y de la más nueva a la más vieja.
 *
 *  El id sale del correo y no de un contador: es lo único que no se repite —dos
 *  personas se llaman igual en esta lista— y lo que hace que el estado guardado
 *  siga pegado a la cuenta correcta si alguien reordena el fixture. */
export function useCuentasDOC(): CuentaDOC[] {
  const estados = useTiendaDOC((t) => t.estados);
  const creadas = useTiendaDOC((t) => t.creadas);
  return useMemo(
    () =>
      [
        ...CUENTAS.map((c) => ({ ...c, id: `doc/${c.email}` })),
        ...creadas,
      ]
        .map((c) => ({ ...c, estado: estados[c.id] ?? c.estado }))
        /* Lo último primero, como el resto de las tablas de esta consola.
           
           Los `desde` se comparan como texto: en ISO el orden alfabético es el
           cronológico, y eso vale igual para los que llevan hora —`2026-05-13`
           es anterior a `2026-05-13T09:30`, que es lo correcto—.
           
           Cuando dos accesos empiezan el mismo día, desempata el nombre. Sin
           eso, dos filas con la misma fecha quedarían en el orden en que estén
           escritas en el fixture, que no significa nada y cambia el día que
           alguien las reordene. */
        .sort(
          (a, b) =>
            b.desde.localeCompare(a.desde) || a.nombre.localeCompare(b.nombre),
        ),
    [estados, creadas],
  );
}
