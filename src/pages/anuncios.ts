import { useMemo } from "react";
import { create } from "zustand";

/* Quiénes escriben anuncios: el mismo equipo que provisiona buzones y escribe
   políticas. Esta casa tiene una sola consola y cuatro personas que la usan, así
   que la lista se toma prestada en vez de escribirse otra vez con los mismos
   nombres. */
import { CREADORES } from "@/pages/buzones";
import {
  HOY,
  useUsuarios,
  usuariosDeAhora,
  type Tipo,
  type Usuario,
} from "@/pages/usuarios";

/* Los anuncios de la casa: el fixture de la sección Announcements.
 *
 * Un anuncio es algo que la casa **ya dijo** —el agua se corta el martes, la
 * sala de lectura reabre el lunes, tu pase de visita está en recepción— y a
 * quiénes se lo dijo. Eso segundo es lo que lo hace una tabla y no un muro de
 * novedades: la pregunta que se viene a hacer acá no es "¿qué se anunció?" sino
 * "¿a quién le llegó, y lo leyó?".
 *
 * De ahí la columna que esta tabla tiene y las otras no. Una política se escribe
 * y rige; un anuncio se manda y **puede no haber llegado a nadie**. Lo que la
 * fila contesta es esas dos cosas juntas: cuántos lo abrieron de cuántos lo
 * recibieron.
 *
 * De dónde salen las filas, en dos partes:
 *
 * - **Lo que se dijo** va escrito a mano. Cada anuncio tiene su motivo —por qué
 *   se avisó el corte de agua, por qué se le escribió a cuatro personas y no a
 *   todas—, y una regla que los generara diría menos que la lista. Es la misma
 *   decisión que toman los buzones de la casa y las políticas.
 * - **A quiénes les llegó** sale de las cuentas que existen ahora, acotadas a
 *   las que ya existían el día del envío. Un anuncio de agosto del año pasado no
 *   pudo haberle llegado a alguien que se dio de alta la semana pasada, y una
 *   lista escrita a mano se despegaría del padrón el día que se agregue una
 *   cuenta.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide una
 * lista de anuncios y de dónde salen no es asunto suyo.
 */

/* ─────────────────────────── A quiénes ─────────────────────────── */

/** A quiénes salió.
 *
 *  Es una unión y no una lista de ids porque son dos maneras distintas de
 *  mandar algo, y la columna las lee distinto: a un grupo se lo nombra —"todos
 *  los residentes", y quiénes son eso lo decide el padrón del día del envío—, y
 *  a un puñado de cuentas se las nombra una por una. Guardar el grupo como la
 *  lista que dio ese día sería congelar un padrón: el anuncio diría que salió a
 *  treinta y dos personas cuando lo que dijo quien lo mandó fue "a los
 *  residentes". */
export type Audiencia =
  | { clase: "todas" }
  | { clase: "tipo"; tipo: Tipo }
  | { clase: "cuentas"; cuentas: string[] };

/** El valor con el que el panel de filtros agrupa las audiencias. Las cuentas
 *  elegidas caen todas juntas bajo "Selected accounts", por lo mismo que en
 *  políticas: cuarenta y ocho opciones con un nombre cada una no son un filtro,
 *  son la misma tabla otra vez. */
export const AUDIENCIAS = {
  todas: "Everyone",
  resident: "Residents",
  friends: "Friends & Family",
  cuentas: "Selected accounts",
  /* Lo que escribe la consola: buzones de la casa y cuentas, nombre por nombre.
     Convive con las otras tres y no las reemplaza —los grupos siguen siendo una
     manera legítima de mandar algo, y son la que usan los que ya salieron—. Es
     la misma decisión que toma `politicas.ts` con sus objetivos. */
  elegidos: "Selected targets",
} as const;

export type ClaveDeAudiencia = keyof typeof AUDIENCIAS;

export const ORDEN_AUDIENCIAS = Object.keys(AUDIENCIAS) as ClaveDeAudiencia[];

/** Bajo qué opción del panel cae un anuncio. Toma el anuncio y no su
 *  `audiencia` porque son dos maneras de escribir lo mismo y la que manda es la
 *  que se usó: si nombra objetivos, salió a ellos y el `audiencia` que traiga es
 *  el que quedó por defecto. */
export const claveDeAudiencia = (anuncio: Anuncio): ClaveDeAudiencia => {
  if (anuncio.objetivos.length > 0) return "elegidos";
  const { audiencia } = anuncio;
  return audiencia.clase === "tipo" ? audiencia.tipo : audiencia.clase;
};

/* ─────────────────────────── Cuánto se leyó ───────────────────────────

   La lectura entra al panel de filtros en tramos y no como un número: nadie
   busca "los que están en el 62%". Lo que se busca es lo que hay que hacer algo
   al respecto —lo que no abrió nadie— y lo que ya está resuelto. */

export const LECTURA = {
  todos: "Read by everyone",
  mayoria: "Read by most",
  pocos: "Read by a few",
  nadie: "Not opened yet",
} as const;

export type ClaveDeLectura = keyof typeof LECTURA;

export const ORDEN_LECTURA = Object.keys(LECTURA) as ClaveDeLectura[];

/** En qué tramo cae un anuncio. Es la contracara de la lista de arriba: los dos
 *  hablan de lo mismo, así que mover un corte acá y no allá es lo que hace que
 *  un filtro devuelva algo distinto de lo que promete.
 *
 *  Un anuncio sin destinatarios —los hay: los primeros salieron cuando la casa
 *  tenía tres cuentas— cae en "no lo abrió nadie" y no en "lo leyeron todos".
 *  Cero de cero es cien por ciento sólo para una calculadora. */
export function tramoDeLectura(anuncio: Anuncio): ClaveDeLectura {
  const total = cuantosRecibieron(anuncio);
  if (total === 0 || anuncio.leidos.length === 0) return "nadie";
  const tasa = anuncio.leidos.length / total;
  if (tasa >= 1) return "todos";
  return tasa >= 0.5 ? "mayoria" : "pocos";
}

/** Qué proporción lo abrió, de 0 a 1. Se calcula y no se guarda: guardar el
 *  porcentaje además de los dos números es tener dos fuentes para el mismo
 *  hecho, y tarde o temprano dicen cosas distintas. */
export const tasaDeLectura = (anuncio: Anuncio) =>
  cuantosRecibieron(anuncio) === 0
    ? 0
    : anuncio.leidos.length / cuantosRecibieron(anuncio);

/** A cuántos les llegó. Los objetivos ganan cuando los hay —es lo que la consola
 *  escribió, nombre por nombre—, y si no, el grupo resuelto contra el padrón del
 *  día del envío. Se pregunta por acá y no por `destinatarios.length` en cada
 *  lugar: son dos maneras de decir a cuántos, y contar sólo una deja al que se
 *  acaba de mandar diciendo que no le llegó a nadie. */
export const cuantosRecibieron = (anuncio: Anuncio) =>
  anuncio.objetivos.length > 0
    ? anuncio.objetivos.length
    : anuncio.destinatarios.length;

/** A quiénes llegó, escrito para la columna. A un grupo se lo nombra; a un
 *  puñado de cuentas, la primera y cuántas más —que es lo que entra en una
 *  celda—. */
export function aQuienesLlego(anuncio: Anuncio): string {
  const { audiencia } = anuncio;
  /* El nombre del grupo sale de `AUDIENCIAS` y no de `TIPOS`: son los mismos
     dos grupos, pero el padrón los nombra en singular —lo que es *una* cuenta,
     "Resident"— y acá se está diciendo a quiénes salió, que son varios. Además
     es la palabra exacta que ofrece el panel de filtros, y una columna que dice
     "Resident" contra un filtro que dice "Residents" se lee como dos cosas. */
  /* Los objetivos ganan: si la consola nombró a quiénes, eso es lo que salió,
     y el grupo que traiga el anuncio es el que quedó por defecto. */
  const [uno, ...otros] = anuncio.objetivos;
  if (uno) return otros.length > 0 ? `${uno.nombre} +${otros.length}` : uno.nombre;

  if (audiencia.clase === "todas") return AUDIENCIAS.todas;
  if (audiencia.clase === "tipo") return AUDIENCIAS[audiencia.tipo];

  const [primero, ...resto] = anuncio.destinatarios;
  if (!primero) return "No one";
  return resto.length > 0 ? `${primero.name} +${resto.length}` : primero.name;
}

/* ─────────────────────────── Lo que un anuncio lleva ─────────────────────────── */

/** A quién le llega, uno por uno: un buzón de la casa o una cuenta.
 *
 *  Convive con `Audiencia` y no la reemplaza: los grupos —"todos", "los
 *  residentes"— siguen siendo una manera legítima de mandar algo, y son la que
 *  usan los que ya salieron. Lo que la consola escribe ahora es la otra: nombre
 *  por nombre. Es la misma convivencia que en `politicas.ts`. */
export interface Destinatario {
  /** `facility/Front Desk`, `user/USR-1042`. Basta para no repetir uno y para
   *  ser la `key` de su fila. */
  id: string;
  nombre: string;
  clase: "facility" | "user";
  /** La cuenta, cuando es de alguien. Los buzones de la casa no son de nadie, y
   *  por eso esto es opcional y no una cuenta inventada: la columna abre la
   *  ficha sólo cuando hay ficha que abrir. */
  cuenta?: string;
}

/** Un archivo que va con el anuncio.
 *
 *  Se guarda lo que se puede afirmar —cómo se llama, cuánto pesa, de qué es— y
 *  no el archivo: no hay dónde subirlo. El día que haya un bucket, acá aparece
 *  su URL y nada más de esto cambia. El tamaño va en bytes, como lo da el
 *  navegador: lo legible lo arma quien lo muestra. */
export interface Adjunto {
  id: string;
  nombre: string;
  bytes: number;
  tipo: string;
}

/* ─────────────────────────── El anuncio ─────────────────────────── */

export interface Anuncio {
  id: string;
  /** Lo que se dijo, en una línea. Es lo que se lee primero y por donde se
   *  busca, así que se escribe como una oración y no como una clave. */
  titulo: string;
  audiencia: Audiencia;
  /** Cuándo salió, sin hora: la columna dice el día, y lo que se pregunta de un
   *  anuncio no es a qué hora se mandó sino de cuándo data. Día suelto
   *  —`2026-08-13`— como el alta de una cuenta o de un buzón. */
  enviadoEl: string;
  /** Quién lo mandó. Un nombre y no un id, por lo mismo que en los buzones: el
   *  que lee esta tabla conoce a las cuatro personas que administran la
   *  consola. */
  remitente: string;
  /** A quiénes les llegó, resueltas contra el padrón del día del envío. Son las
   *  cuentas y no sus ids: la celda muestra el nombre de ahora y abre la ficha,
   *  y las dos cosas necesitan la cuenta entera. */
  destinatarios: Usuario[];
  /** Cuáles de ellas lo abrieron. Ids y no cuentas: es un subconjunto de la
   *  lista de arriba, y guardarlas dos veces es tener dos fuentes para el mismo
   *  hecho. */
  leidos: string[];
  /** Lo que dice, entero.
   *
   *  Vacío en los que la casa ya tenía mandados: son de antes de que la consola
   *  supiera escribir un cuerpo, y ponerles un texto inventado sería afirmar que
   *  se dijo algo que nadie escribió. Es lo mismo que hacen las políticas de la
   *  casa con sus direcciones. */
  cuerpo: string;
  /** A quiénes salió, uno por uno. Vacío quiere decir que salió por `audiencia`,
   *  que es como están escritos los de la casa. */
  objetivos: Destinatario[];
  adjuntos: Adjunto[];
}

/* ─────────────────────────── Lo que se dijo ─────────────────────────── */

/** Un anuncio como se escribe acá: lo que dice, a quiénes salió, cuándo, quién
 *  lo mandó y qué proporción lo abrió. Los destinatarios y las lecturas no se
 *  escriben —se resuelven contra el padrón—, así que esto no es un `Anuncio`
 *  todavía. */
interface Escrito {
  titulo: string;
  audiencia: Audiencia;
  enviadoEl: string;
  remitente: string;
  /** Qué proporción de los que lo recibieron lo abrió, de 0 a 1.
   *
   *  Se escribe acá y no se deriva de una regla porque es lo único de un
   *  anuncio que no se puede inventar con una fórmula: un simulacro de incendio
   *  lo abre todo el mundo y una newsletter la abre la mitad, y eso depende de
   *  lo que el anuncio dice, no de cuándo salió ni de a cuántos. Cuáles lo
   *  abrieron sí se derivan —ver `armar`—: lo que importa acá es cuántos. */
  tasa: number;
}

const ESCRITOS: Escrito[] = [
  {
    /* Lo último que salió, y todavía está juntando lecturas: es la fila que
       explica para qué está la columna de engagement. */
    titulo: "Water will be off Tuesday from 9 to 12",
    audiencia: { clase: "todas" },
    enviadoEl: "2026-08-24",
    remitente: "Hugo Sarmiento",
    tasa: 0.42,
  },
  {
    titulo: "Your room change is confirmed for Friday",
    audiencia: { clase: "cuentas", cuentas: ["USR-1042", "USR-1088"] },
    enviadoEl: "2026-08-13",
    remitente: "Marcela Vidal",
    tasa: 0.5,
  },
  {
    titulo: "New visiting hours start next month",
    audiencia: { clase: "todas" },
    enviadoEl: "2026-08-10",
    remitente: "Irene Bustos",
    tasa: 0.79,
  },
  {
    titulo: "Physio sessions moved to the morning slot",
    audiencia: {
      clase: "cuentas",
      cuentas: ["USR-1264", "USR-1372", "USR-1428"],
    },
    enviadoEl: "2026-08-05",
    remitente: "Marcela Vidal",
    tasa: 0.67,
  },
  {
    titulo: "The dining room moves to the garden wing",
    audiencia: { clase: "todas" },
    enviadoEl: "2026-07-28",
    remitente: "Hugo Sarmiento",
    tasa: 0.86,
  },
  {
    titulo: "Your visitor pass is ready at the front desk",
    audiencia: { clase: "cuentas", cuentas: ["USR-1153"] },
    enviadoEl: "2026-07-22",
    remitente: "Hugo Sarmiento",
    tasa: 1,
  },
  {
    titulo: "Family day: Saturday the 12th, 3 pm",
    audiencia: { clase: "tipo", tipo: "friends" },
    enviadoEl: "2026-07-01",
    remitente: "Marcela Vidal",
    tasa: 0.68,
  },
  {
    titulo: "Reminder: annual check-up next week",
    audiencia: {
      clase: "cuentas",
      cuentas: ["USR-1586", "USR-1822", "USR-3340", "USR-3399"],
    },
    enviadoEl: "2026-06-25",
    remitente: "Marcela Vidal",
    tasa: 0.75,
  },
  {
    /* Un simulacro lo lee todo el mundo, y es el que marca el techo de la
       columna: sin una fila que llegue al 100 no se sabe si el 42 de arriba es
       poco o es lo normal en esta casa. */
    titulo: "Fire drill on Thursday at 10:30",
    audiencia: { clase: "todas" },
    enviadoEl: "2026-06-17",
    remitente: "Néstor Ojeda",
    tasa: 0.95,
  },
  {
    titulo: "Extra blankets are out of storage",
    audiencia: { clase: "tipo", tipo: "resident" },
    enviadoEl: "2026-06-02",
    remitente: "Marcela Vidal",
    tasa: 0.71,
  },
  {
    titulo: "Package waiting at reception",
    audiencia: { clase: "cuentas", cuentas: ["USR-3751"] },
    enviadoEl: "2026-05-11",
    remitente: "Hugo Sarmiento",
    tasa: 1,
  },
  {
    titulo: "Wi-Fi maintenance window this weekend",
    audiencia: { clase: "todas" },
    enviadoEl: "2026-05-08",
    remitente: "Néstor Ojeda",
    tasa: 0.63,
  },
  {
    titulo: "Bus outing to the coast: confirm your seat",
    audiencia: {
      clase: "cuentas",
      cuentas: ["USR-1042", "USR-1264", "USR-1586", "USR-1822", "USR-3340"],
    },
    enviadoEl: "2026-04-25",
    remitente: "Marcela Vidal",
    tasa: 0.6,
  },
  {
    titulo: "Flu shots available at the nurse's office",
    audiencia: { clase: "tipo", tipo: "resident" },
    enviadoEl: "2026-04-22",
    remitente: "Marcela Vidal",
    tasa: 0.88,
  },
  {
    titulo: "Your mailbox quota was raised",
    audiencia: { clase: "cuentas", cuentas: ["USR-3167", "USR-3694"] },
    enviadoEl: "2026-04-14",
    remitente: "Néstor Ojeda",
    tasa: 0.5,
  },
  {
    titulo: "How to book a video call with your relative",
    audiencia: { clase: "tipo", tipo: "friends" },
    enviadoEl: "2026-03-16",
    remitente: "Marcela Vidal",
    tasa: 0.54,
  },
  {
    /* Nadie lo abrió, y el club de jardinería se quedó sin gente. Es la otra
       punta de la columna: si todas las filas tienen algo de verde, el cero deja
       de significar nada. */
    titulo: "Garden club sign-up closes Friday",
    audiencia: {
      clase: "cuentas",
      cuentas: ["USR-2990", "USR-3046", "USR-3630"],
    },
    enviadoEl: "2026-03-02",
    remitente: "Hugo Sarmiento",
    tasa: 0,
  },
  {
    titulo: "Parking on the north lot closes for repaving",
    audiencia: { clase: "tipo", tipo: "friends" },
    enviadoEl: "2026-02-09",
    remitente: "Hugo Sarmiento",
    tasa: 0.47,
  },
  {
    titulo: "The library reopens on Monday",
    audiencia: { clase: "tipo", tipo: "resident" },
    enviadoEl: "2026-01-19",
    remitente: "Hugo Sarmiento",
    tasa: 0.92,
  },
  {
    titulo: "Holiday menu is up on the board",
    audiencia: { clase: "todas" },
    enviadoEl: "2025-12-18",
    remitente: "Marcela Vidal",
    tasa: 0.9,
  },
  {
    titulo: "New mail policy: what gets held and why",
    audiencia: { clase: "todas" },
    enviadoEl: "2025-11-05",
    remitente: "Irene Bustos",
    tasa: 0.81,
  },
  {
    titulo: "Choir practice moves to Wednesdays",
    audiencia: { clase: "tipo", tipo: "resident" },
    enviadoEl: "2025-10-08",
    remitente: "Hugo Sarmiento",
    tasa: 0.74,
  },
  {
    titulo: "Elevator B out of service until Friday",
    audiencia: { clase: "todas" },
    enviadoEl: "2025-09-11",
    remitente: "Néstor Ojeda",
    tasa: 0.66,
  },
  {
    /* El primero de todos. Salió cuando la casa tenía tres cuentas dadas de
       alta, y eso es lo que la fila dice: "3 reads of 3" y no "48". */
    titulo: "Welcome to the new mail console",
    audiencia: { clase: "todas" },
    enviadoEl: "2025-08-05",
    remitente: "Irene Bustos",
    tasa: 1,
  },
];

/* ─────────────────────────── La tienda ─────────────────────────── */

/* Un anuncio se manda desde la consola, así que hay dónde guardar lo que se
   mandó. Como en las políticas y los buzones, se guarda **sólo lo que la consola
   hizo** y no la lista entera: los de la casa se arman contra las cuentas vivas,
   y una copia acá se despegaría de ellas.

   Y una sola cosa, no tres: un anuncio no se edita ni se borra —ya salió—, así
   que no hay `editados` ni `borrados` que guardar. */
interface Tienda {
  mandados: Anuncio[];
}

const useTiendaDeAnuncios = create<Tienda>()(() => ({ mandados: [] }));

/** Hoy, como día suelto. Se exporta porque lo usan dos: el envío, que lo estampa
 *  en el anuncio, y el preview de la ficha, que dice cuándo va a salir. Dos
 *  "hoy" distintos —uno del fixture y otro del reloj real— es una ficha que
 *  promete una fecha y una fila que muestra otra.
 *
 *  Sale del `HOY` fijo del fixture y no de un `new Date()`
 *  de verdad: con el reloj real, lo que se manda hoy tendría una fecha y todo lo
 *  demás —que cuelga de `HOY`— otra, y la tabla mostraría un anuncio mandado
 *  después de mañana. */
export const DIA_DE_HOY = HOY.toISOString().slice(0, 10);

/** Cuánto tarda en mandarse un anuncio.
 *
 *  No hay servidor detrás, y sin demora el envío sería instantáneo: se toca el
 *  botón y la fila ya está. Eso no es lo que va a pasar el día que haya una API,
 *  y una pantalla diseñada contra un envío instantáneo no tiene dónde poner lo
 *  que pasa mientras —que es la mitad de lo que hay que mostrar—. Es la misma
 *  decisión, con el mismo número, que el alta de políticas y la de buzones. */
const DEMORA_MS = 900;

const demora = () => new Promise((listo) => setTimeout(listo, DEMORA_MS));

/** Lo que la ficha manda. No lleva fecha ni lecturas: la fecha es hoy, y un
 *  anuncio recién salido no lo abrió nadie todavía. */
export interface Envio {
  titulo: string;
  cuerpo: string;
  objetivos: Destinatario[];
  adjuntos: Adjunto[];
  remitente: string;
}

/**
 * Mandar un anuncio. Devuelve el que salió.
 *
 * Es `async` y no una escritura a secas porque del otro lado va a haber una red:
 * quien lo llama tiene que poder esperarlo, mostrar que está en curso y
 * enterarse si falla.
 *
 * Falla por dos cosas, y las dos se chequean **después de la espera**, contra el
 * estado de ese momento:
 *
 * 1. **No hay a quién mandárselo.** Un anuncio sin destinatarios no es un
 *    borrador guardado, es una fila que dice "0 reads of 0" para siempre. La
 *    ficha ya no deja llegar hasta acá con la lista vacía; esto es el piso, para
 *    cuando alguien llame a esta función desde otro lado.
 *
 * 2. **Una de las cuentas quedó bloqueada mientras se escribía.** Ésta es la que
 *    importa, y es la razón de que el chequeo vaya después de la espera y no
 *    antes: bloquear una cuenta es cortarle la comunicación con la casa, y se
 *    hace desde Accounts —otra pestaña, abierta al mismo tiempo que ésta—. Entre
 *    que alguien elige a Iván como destinatario y toca "Send", otra persona pudo
 *    haberlo bloqueado. Mandarle igual el aviso sería que esta consola contradiga
 *    lo que la consola acaba de decidir.
 *
 *    Es el mismo chequeo que hacen las otras dos altas de esta casa contra la
 *    lista viva —un buzón repetido, una política repetida—: lo que el formulario
 *    no puede prevenir porque pasó afuera de él.
 */
export async function mandarAnuncio(datos: Envio): Promise<Anuncio> {
  await demora();

  const titulo = datos.titulo.trim();
  if (datos.objetivos.length === 0) {
    throw new Error("Pick at least one facility or account to send it to.");
  }

  /* Sólo las cuentas: un buzón de la casa no se bloquea —no es de nadie—, así
     que los objetivos `facility` no tienen contra qué chequearse. */
  const padron = usuariosDeAhora();
  const bloqueados = datos.objetivos.filter((o) => {
    if (!o.cuenta) return false;
    return padron.find((u) => u.id === o.cuenta)?.status === "blocked";
  });

  if (bloqueados.length > 0) {
    /* Con uno se lo nombra: quien lo lee tiene que poder ir a sacarlo de la lista
       sin adivinar cuál es. Con varios el nombre no entra y el número alcanza
       —los chips están a la vista en la ficha, que sigue abierta—. */
    throw new Error(
      bloqueados.length === 1
        ? `${bloqueados[0].nombre} was blocked while you were writing. Remove them and send again.`
        : `${bloqueados.length} recipients were blocked while you were writing. Remove them and send again.`,
    );
  }

  const { mandados } = useTiendaDeAnuncios.getState();
  const anuncio: Anuncio = {
    /* El id lleva el contador y no sólo el título: dos anuncios pueden llamarse
       igual —el mismo aviso mandado dos veces a dos grupos— y la `key` de la
       fila no puede repetirse. */
    id: `ann/mandado/${mandados.length + 1}`,
    titulo,
    /* Sin grupo: salió a los objetivos, y `claveDeAudiencia` los mira primero.
       El `todas` es el que queda por defecto y no se lee. */
    audiencia: { clase: "todas" },
    enviadoEl: DIA_DE_HOY,
    remitente: datos.remitente,
    /* Los destinatarios resueltos quedan vacíos: quiénes lo recibieron ya está
       dicho, nombre por nombre, en `objetivos`. Y nadie lo abrió todavía, que es
       lo que la columna tiene que decir de algo que acaba de salir. */
    destinatarios: [],
    leidos: [],
    cuerpo: datos.cuerpo.trim(),
    objetivos: datos.objetivos,
    adjuntos: datos.adjuntos,
  };
  useTiendaDeAnuncios.setState({ mandados: [...mandados, anuncio] });
  return anuncio;
}

/** Quién manda cuando manda la consola. Hay una sola sesión y no hay login: la
 *  primera de la lista es quien está sentada acá. */
export const YO = CREADORES[0];

/* ─────────────────────────── El armado ─────────────────────────── */

/** Un número entre 0 y 1 a partir de un texto, siempre el mismo. Es FNV-1a, que
 *  no tiene nada de criptográfico y no lo necesita: lo único que se le pide es
 *  que reparta parejo y que no dependa de en qué orden se pintó la tabla.
 *
 *  Con `Math.random()` la lista de quiénes abrieron un anuncio cambiaría en cada
 *  render, y la tarjeta que la muestra diría una cosa distinta cada vez que se
 *  la abre. */
function mezcla(semilla: string) {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** A quiénes les llegó: las cuentas de la audiencia que **ya existían** el día
 *  del envío.
 *
 *  El corte por fecha no es un detalle: sin él, el anuncio de agosto del año
 *  pasado figura mandado a cuarenta y ocho personas, de las cuales cuarenta y
 *  cinco se dieron de alta después. La tabla diría que casi nadie lo leyó, y lo
 *  que pasó es que casi nadie lo recibió. */
function destinatariosDe(escrito: Escrito, usuarios: Usuario[]): Usuario[] {
  const existia = (u: Usuario) => u.addedAt <= escrito.enviadoEl;
  const { audiencia } = escrito;

  switch (audiencia.clase) {
    case "todas":
      return usuarios.filter(existia);
    case "tipo":
      return usuarios.filter((u) => u.accountType === audiencia.tipo && existia(u));
    case "cuentas":
      /* En el orden en que se las eligió y no en el del padrón: la celda escribe
         la primera, y cuál es la primera lo decidió quien mandó el anuncio. */
      return audiencia.cuentas
        .map((id) => usuarios.find((u) => u.id === id))
        .filter((u): u is Usuario => u !== undefined && existia(u));
  }
}

function armar(usuarios: Usuario[], mandados: Anuncio[]): Anuncio[] {
  const deLaCasa: Anuncio[] = ESCRITOS.map((escrito, i) => {
    const id = `ann/${i}`;
    const destinatarios = destinatariosDe(escrito, usuarios);

    /* Cuáles lo abrieron. La cantidad la dice el fixture; cuáles se derivan
       barajando la lista con una semilla que mezcla el anuncio y la cuenta.
       Mezclar los dos es lo que evita que sean siempre las mismas personas las
       que abren todo: con la semilla sólo de la cuenta, la tabla contaría que
       hay veinte lectores fieles y veintiocho que nunca abren nada. */
    const cuantos = Math.round(escrito.tasa * destinatarios.length);
    const leidos = [...destinatarios]
      .sort((a, b) => mezcla(`${id}·${a.id}`) - mezcla(`${id}·${b.id}`))
      .slice(0, cuantos)
      .map((u) => u.id);

    return {
      id,
      titulo: escrito.titulo,
      audiencia: escrito.audiencia,
      enviadoEl: escrito.enviadoEl,
      remitente: escrito.remitente,
      destinatarios,
      leidos,
      /* Los de la casa salieron por grupo y sin cuerpo guardado: son los que
         estaban mandados antes de que la consola supiera escribir uno. */
      cuerpo: "",
      objetivos: [],
      adjuntos: [],
    };
  });

  return [...deLaCasa, ...mandados].sort((a, b) =>
    b.enviadoEl.localeCompare(a.enviadoEl),
  );
  /* Los días sueltos se comparan como texto: en ISO el orden alfabético es el
     cronológico. El último que salió cae primero —es el que todavía está
     juntando lecturas, y el que uno viene a mirar—. */
}

/** Los anuncios de ahora. Se vuelven a armar cuando cambia el padrón: quién
 *  recibió qué depende de quiénes había, y el nombre que muestra la columna es
 *  el de ahora. */
export function useAnuncios(): Anuncio[] {
  const usuarios = useUsuarios();
  const mandados = useTiendaDeAnuncios((t) => t.mandados);
  return useMemo(() => armar(usuarios, mandados), [usuarios, mandados]);
}

/** Quiénes mandan anuncios. Los mismos cuatro que escriben políticas y
 *  provisionan buzones. */
export { CREADORES as REMITENTES };
