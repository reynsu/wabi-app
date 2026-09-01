import { useMemo } from "react";
import { create } from "zustand";

import type { BadgeColor } from "@/components/ui/badge";
/* Quiénes escriben políticas: el mismo equipo que provisiona buzones. Esta casa
   tiene una sola consola y cuatro personas que la usan, así que la lista se toma
   prestada en vez de escribirse otra vez con los mismos nombres. */
import { CREADORES } from "@/pages/buzones";
import { HOY, TIPOS, useUsuarios, type Tipo, type Usuario } from "@/pages/usuarios";

/* Las políticas de correo de la casa: el fixture de la sección Email › Policies.
 *
 * Una política es una regla escrita —cuánto se guarda un correo, qué adjuntos
 * pasan, qué se manda a revisar antes de entregarlo— y **a quiénes se les
 * aplica**. Eso segundo es lo que la hace una tabla y no una página de ajustes:
 * la misma casa tiene una regla para todos, otra para las familias y una
 * excepción escrita para tres residentes, y lo que se viene a hacer acá es
 * encontrar cuál manda sobre quién.
 *
 * De dónde salen las filas, en dos partes:
 *
 * - **Las de la casa** van escritas a mano. Son catorce reglas con su nombre,
 *   su fecha y su motivo; una regla que las generara diría menos que la lista
 *   —es la misma decisión que toman los buzones de la casa y las plantillas de
 *   los correos—.
 * - **Las excepciones** salen de las cuentas que existen ahora. Una excepción
 *   es siempre de alguien, así que derivarlas del padrón es lo que hace que no
 *   quede una política apuntando a una cuenta que se dio de baja, y que la fecha
 *   de la excepción nunca sea anterior al día en que esa cuenta existió.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide una
 * lista de políticas y de dónde salen no es asunto suyo.
 */

/* ─────────────────────────── Qué regula ─────────────────────────── */

/** De qué habla la política, con el color con que el panel de filtros la
 *  distingue. Cinco familias, que son las cinco cosas que una casa decide sobre
 *  el correo de su gente: cuánto se guarda, qué entra, qué se lee antes de
 *  entregarlo, a dónde se copia y quién puede escribir. */
export const TIPOS_DE_POLITICA = {
  retention: { label: "Retention", tinte: "#3b82f6", color: "blue" },
  attachments: { label: "Attachments", tinte: "#8b5cf6", color: "violet" },
  moderation: { label: "Moderation", tinte: "#f59e0b", color: "amber" },
  routing: { label: "Routing", tinte: "#14b8a6", color: "teal" },
  access: { label: "Access", tinte: "#f43f5e", color: "rose" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

export type TipoDePolitica = keyof typeof TIPOS_DE_POLITICA;

export const ORDEN_TIPOS = Object.keys(TIPOS_DE_POLITICA) as TipoDePolitica[];

/* ─────────────────────────── A quién ─────────────────────────── */

/** A quiénes se les aplica.
 *
 *  Es una unión y no un texto porque la columna hace dos cosas distintas: sobre
 *  un grupo escribe su nombre, y sobre una cuenta abre su ficha. Guardado como
 *  frase —"Camila Ferreyra"— la fila no tendría con qué encontrar a esa cuenta,
 *  y el día que alguien corrija un apellido la política seguiría nombrando al
 *  viejo. */
export type Alcance =
  | { clase: "todas" }
  | { clase: "tipo"; tipo: Tipo }
  | { clase: "casa" }
  | { clase: "cuenta"; cuenta: string };

/** Cómo se lee un alcance. La cuenta se busca en el padrón vivo: lo que la
 *  columna muestra es el nombre de ahora. */
export function comoSeLee(alcance: Alcance, usuarios: Usuario[]): string {
  switch (alcance.clase) {
    case "todas":
      return "All accounts";
    case "tipo":
      return TIPOS[alcance.tipo];
    case "casa":
      return "House mailboxes";
    case "cuenta":
      return (
        usuarios.find((u) => u.id === alcance.cuenta)?.name ?? alcance.cuenta
      );
  }
}

/** El valor con el que el panel de filtros agrupa los alcances. Las cuentas
 *  caen todas juntas bajo "A single account": cuarenta opciones con un nombre
 *  cada una no es un filtro, es la misma tabla otra vez. */
export const ALCANCES = {
  todas: "All accounts",
  resident: "Residents",
  friends: "Friends & Family",
  casa: "House mailboxes",
  cuenta: "A single account",
  objetivos: "Selected targets",
} as const;

export type ClaveDeAlcance = keyof typeof ALCANCES;

export const ORDEN_ALCANCES = Object.keys(ALCANCES) as ClaveDeAlcance[];

/** Bajo qué opción del panel cae una política. Toma la política y no su
 *  `alcance` porque son dos maneras de escribir lo mismo y la que manda es la
 *  que la regla usó: si nombra objetivos, rige sobre ellos y el `alcance` que
 *  traiga es el que quedó por defecto. */
export const claveDeAlcance = (politica: Politica): ClaveDeAlcance => {
  if (politica.objetivos.length > 0) return "objetivos";
  const { alcance } = politica;
  return alcance.clase === "tipo" ? alcance.tipo : alcance.clase;
};

/** Sobre quiénes rige, escrito para la columna. Los objetivos ganan cuando los
 *  hay —el primero y cuántos más, que es lo que entra en una celda— y si no,
 *  el grupo de siempre. */
export function aQuienesRige(politica: Politica, usuarios: Usuario[]): string {
  const [primero, ...resto] = politica.objetivos;
  if (!primero) return comoSeLee(politica.alcance, usuarios);
  return resto.length > 0 ? `${primero.nombre} +${resto.length}` : primero.nombre;
}

/* ─────────────────────────── Lo que una regla toca ─────────────────────────── */

/** Qué le pasa al correo de un objetivo: pasa o no pasa. */
export type Permiso = "allow" | "block";

/** En qué dirección. Una regla sobre el correo que entra no es la misma que
 *  sobre el que sale, y la mayoría de las de esta casa son sobre lo que entra. */
export type Sentido = "in" | "out" | "both";

/** A quién apunta una regla, una por una. Es la unidad que la ficha de alta
 *  arma: un buzón de la casa o un residente, con sus dos decisiones.
 *
 *  Convive con `Alcance` y no lo reemplaza: los grupos —"todos", "los
 *  residentes"— siguen siendo una manera legítima de escribir una regla, y son
 *  la que usan las que la casa ya tenía escritas. Lo que la consola escribe
 *  ahora es la otra: nombre por nombre. */
export interface Objetivo {
  /** `facility/Front Desk`, `resident/Camila Ferreyra`. Basta para no repetir
   *  uno y para ser la `key` de su tarjeta. */
  id: string;
  nombre: string;
  clase: "facility" | "resident";
  permiso: Permiso;
  sentido: Sentido;
}

/* ─────────────────────────── La política ─────────────────────────── */

export interface Politica {
  id: string;
  /** Qué dice la regla, en una línea. Es lo que se busca y lo que se lee
   *  primero, así que se escribe como una oración y no como una clave. */
  nombre: string;
  tipo: TipoDePolitica;
  alcance: Alcance;
  /** Cuándo se la escribió, sin hora: nadie pregunta a qué hora se dictó una
   *  regla. Día suelto —`2026-03-04`— como el alta de una cuenta o de un
   *  buzón. */
  creadaEl: string;
  /** Quién la escribió. Un nombre y no un id, por lo mismo que en los buzones:
   *  el que lee esta tabla conoce a las cuatro personas que administran la
   *  consola. */
  creador: string;
  /** Los remitentes que la regla mira: correos enteros o dominios. Vacío quiere
   *  decir "cualquiera", que es lo que dice la ficha mientras no se agregue
   *  ninguno. */
  direcciones: string[];
  /** A quiénes apunta, uno por uno. Vacío quiere decir que rige por `alcance`,
   *  que es como están escritas las de la casa. */
  objetivos: Objetivo[];
}

/* Las reglas de la casa. Escritas: cada una tiene un motivo que una regla
   generadora no podría inventar —por qué el correo de facturación se copia a la
   recepción, por qué las familias tienen un límite de adjuntos más chico—. */
interface Regla {
  nombre: string;
  tipo: TipoDePolitica;
  alcance: Alcance;
  creadaEl: string;
  creador: string;
}

const DE_LA_CASA: Regla[] = [
  {
    nombre: "Keep delivered mail for 12 months",
    tipo: "retention",
    alcance: { clase: "todas" },
    creadaEl: "2025-04-14",
    creador: "Irene Bustos",
  },
  {
    nombre: "Purge quarantined mail after 30 days",
    tipo: "retention",
    alcance: { clase: "todas" },
    creadaEl: "2025-04-14",
    creador: "Irene Bustos",
  },
  {
    /* Los buzones de la casa contestan trámites, y un trámite se discute meses
       después. Por eso guardan más que el correo de una persona. */
    nombre: "Keep house mail for 5 years",
    tipo: "retention",
    alcance: { clase: "casa" },
    creadaEl: "2025-04-21",
    creador: "Irene Bustos",
  },
  {
    nombre: "Hold attachments over 25 MB",
    tipo: "attachments",
    alcance: { clase: "todas" },
    creadaEl: "2025-05-06",
    creador: "Néstor Ojeda",
  },
  {
    nombre: "Block executable attachments",
    tipo: "attachments",
    alcance: { clase: "todas" },
    creadaEl: "2025-05-06",
    creador: "Néstor Ojeda",
  },
  {
    /* Las familias mandan fotos, y muchas. El límite más chico no es
       desconfianza: es lo que evita que un álbum entero tape el buzón de alguien
       que revisa el correo una vez por semana. */
    nombre: "Compress photos over 10 MB",
    tipo: "attachments",
    alcance: { clase: "tipo", tipo: "friends" },
    creadaEl: "2025-06-18",
    creador: "Marcela Vidal",
  },
  {
    nombre: "Review mail from senders outside the address book",
    tipo: "moderation",
    alcance: { clase: "tipo", tipo: "resident" },
    creadaEl: "2025-06-18",
    creador: "Marcela Vidal",
  },
  {
    nombre: "Hold mail flagged as a payment request",
    tipo: "moderation",
    alcance: { clase: "todas" },
    creadaEl: "2025-07-02",
    creador: "Marcela Vidal",
  },
  {
    nombre: "Hold mail asking for documents or ID",
    tipo: "moderation",
    alcance: { clase: "tipo", tipo: "resident" },
    creadaEl: "2025-09-15",
    creador: "Marcela Vidal",
  },
  {
    /* Lo que llega a facturación lo trabaja la recepción: la copia es para que
       nadie tenga que reenviar a mano lo que ya llegó. */
    nombre: "Copy billing mail to the front desk",
    tipo: "routing",
    alcance: { clase: "casa" },
    creadaEl: "2025-10-01",
    creador: "Hugo Sarmiento",
  },
  {
    nombre: "Send care-team mail to the nurse on call",
    tipo: "routing",
    alcance: { clase: "casa" },
    creadaEl: "2025-11-12",
    creador: "Hugo Sarmiento",
  },
  {
    nombre: "Deliver activity notices every morning at 9",
    tipo: "routing",
    alcance: { clase: "todas" },
    creadaEl: "2026-01-20",
    creador: "Hugo Sarmiento",
  },
  {
    nombre: "Require staff approval for new external senders",
    tipo: "access",
    alcance: { clase: "tipo", tipo: "resident" },
    creadaEl: "2026-02-11",
    creador: "Irene Bustos",
  },
  {
    nombre: "Block mail from unverified domains",
    tipo: "access",
    alcance: { clase: "todas" },
    creadaEl: "2026-04-03",
    creador: "Néstor Ojeda",
  },
];

/* Las excepciones. Son de una cuenta y de nadie más, y por eso salen del padrón
   y no de una lista escrita: una excepción a nombre de alguien que se dio de
   baja es una regla que ya no rige sobre nadie.

   `cada`/`resto` reparte cuáles cuentas tienen cuál: es el mismo truco que usan
   los buzones para saber quién ya tiene el suyo, y lo que evita que todas las
   cuentas terminen con las cuatro excepciones. Los números son primos entre sí
   con el largo del padrón para que no caigan siempre sobre las mismas. */
interface Excepcion {
  nombre: (usuario: Usuario) => string;
  tipo: TipoDePolitica;
  creador: string;
  cada: number;
  resto: number;
  /** Cuántos días después del alta de la cuenta se escribió. Una excepción se
   *  escribe cuando el caso aparece, no el día que la persona llegó. */
  dias: number;
}

const EXCEPCIONES: Excepcion[] = [
  {
    nombre: (u) => `Raise the attachment limit for ${u.name}`,
    tipo: "attachments",
    creador: "Néstor Ojeda",
    cada: 5,
    resto: 0,
    dias: 21,
  },
  {
    nombre: (u) => `Review every message sent to ${u.name}`,
    tipo: "moderation",
    creador: "Marcela Vidal",
    cada: 7,
    resto: 3,
    dias: 45,
  },
  {
    nombre: (u) => `Copy ${u.name}'s mail to the care team`,
    tipo: "routing",
    creador: "Hugo Sarmiento",
    cada: 6,
    resto: 2,
    dias: 30,
  },
  {
    nombre: (u) => `Keep ${u.name}'s mail for 3 years`,
    tipo: "retention",
    creador: "Irene Bustos",
    cada: 9,
    resto: 4,
    dias: 60,
  },
];

const DIA = 24 * 60 * 60 * 1000;

/** Hoy, como día suelto. Sale del `HOY` fijo del fixture y no de un `new Date()`
 *  de verdad: con el reloj real, lo que se escribe hoy tendría una fecha y todo
 *  lo demás —que cuelga de `HOY`— otra, y la tabla mostraría una regla escrita
 *  después de mañana. */
const DIA_DE_HOY = HOY.toISOString().slice(0, 10);

const numeroDe = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Un día suelto, tantos días después de otro. Se hace con `Date` y se vuelve a
 *  cortar a diez caracteres: sumarle días a un `2026-03-04` como texto es
 *  inventar un calendario. */
const diasDespues = (dia: string, dias: number) => {
  const alta = new Date(`${dia}T12:00:00Z`).getTime();
  const cuando = alta + dias * DIA;
  /* Nunca después de hoy: la excepción se escribe cuando el caso aparece, y un
     caso no aparece la semana que viene. Sin esto, una cuenta dada de alta hace
     un mes tendría reglas fechadas en octubre.

     Y cuando no entra, cae a mitad de camino entre el alta y hoy en vez de
     aplastarse contra hoy: recortar con un `min` deja diez reglas fechadas
     todas el mismo día, que es un patrón que se ve y que no dice nada. */
  const cabe = cuando <= HOY.getTime();
  return new Date(cabe ? cuando : alta + (HOY.getTime() - alta) * 0.6)
    .toISOString()
    .slice(0, 10);
};

/* ─────────────────────────── La tienda ─────────────────────────── */

/* Una política sí se edita y sí se borra desde la tabla —es lo que las dos
   opciones del menú de la fila prometen—, así que hay dónde guardar eso. Como en
   los buzones, se guarda **sólo lo que la consola hizo** y no la lista entera:
   las excepciones se arman de las cuentas vivas, y una copia acá se despegaría
   de ellas.

   Tres cosas, de tres naturalezas: lo escrito desde la consola (`creadas`), las
   correcciones sobre lo que ya existía (`editadas`) y lo que se sacó
   (`borradas`). */

/** Lo que una edición puede cambiar: lo que la política dice y sobre quién.
 *  Cuándo se la escribió y quién la escribió son historia, y la historia no se
 *  edita desde una tabla. */
export interface Correccion {
  nombre: string;
  tipo: TipoDePolitica;
  alcance: Alcance;
}

/** Lo que la ficha de alta manda. No lleva tipo: una regla hecha de remitentes
 *  y de permisos por objetivo **es** una regla de acceso, y hacerle elegir la
 *  familia a quien la escribe es pedirle que clasifique lo que acaba de
 *  describir. Las de retención, adjuntos y ruteo son las que la casa ya tiene
 *  escritas. */
export interface Alta {
  nombre: string;
  direcciones: string[];
  objetivos: Objetivo[];
  creador: string;
}

interface Tienda {
  creadas: Politica[];
  editadas: Record<string, Correccion>;
  borradas: string[];
}

const useTiendaDePoliticas = create<Tienda>()(() => ({
  creadas: [],
  editadas: {},
  borradas: [],
}));

const hechoHastaAhora = () => useTiendaDePoliticas.getState();

/** Escribir una política nueva. Devuelve la que quedó, que es lo que la
 *  pantalla usa para señalarla en la tabla. */
export function crearPolitica(datos: Alta): Politica {
  const { creadas } = hechoHastaAhora();
  const politica: Politica = {
    /* El id lleva el contador y no sólo el nombre: dos políticas pueden
       llamarse igual —la misma regla escrita dos veces para dos grupos— y la
       `key` de la fila no puede repetirse. */
    id: `pol/nueva/${creadas.length + 1}`,
    nombre: datos.nombre,
    tipo: "access",
    /* Sin objetivos rige sobre todos, que es lo que la ficha dice mientras no
       se agregue ninguno. Con objetivos el alcance no se mira: manda la lista.
       Ver `claveDeAlcance`. */
    alcance: { clase: "todas" },
    creadaEl: DIA_DE_HOY,
    creador: datos.creador,
    direcciones: datos.direcciones,
    objetivos: datos.objetivos,
  };
  useTiendaDePoliticas.setState({ creadas: [...creadas, politica] });
  return politica;
}

export function editarPolitica(id: string, correccion: Correccion) {
  const { creadas, editadas } = hechoHastaAhora();
  /* Lo escrito desde la consola se corrige en su lugar; lo derivado no se puede
     tocar donde vive —se vuelve a armar en cada pintada—, así que su corrección
     se guarda aparte y se aplica al armar. */
  if (creadas.some((p) => p.id === id)) {
    useTiendaDePoliticas.setState({
      creadas: creadas.map((p) => (p.id === id ? { ...p, ...correccion } : p)),
    });
    return;
  }
  useTiendaDePoliticas.setState({
    editadas: { ...editadas, [id]: correccion },
  });
}

export function borrarPolitica(id: string) {
  const { creadas, borradas } = hechoHastaAhora();
  if (creadas.some((p) => p.id === id)) {
    useTiendaDePoliticas.setState({ creadas: creadas.filter((p) => p.id !== id) });
    return;
  }
  useTiendaDePoliticas.setState({ borradas: [...borradas, id] });
}

/* ─────────────────────────── El armado ─────────────────────────── */

function armar(usuarios: Usuario[], tienda: Tienda): Politica[] {
  const { creadas, editadas, borradas } = tienda;

  const deLaCasa: Politica[] = DE_LA_CASA.map((r, i) => ({
    id: `pol/casa/${i}`,
    nombre: r.nombre,
    tipo: r.tipo,
    alcance: r.alcance,
    creadaEl: r.creadaEl,
    creador: r.creador,
    /* Las de la casa rigen por grupo y no nombre por nombre: son las que
       estaban escritas antes de que la consola supiera escribir reglas. */
    direcciones: [],
    objetivos: [],
  }));

  const excepciones: Politica[] = EXCEPCIONES.flatMap((e, i) =>
    usuarios
      .filter((u) => numeroDe(u.id) % e.cada === e.resto)
      .map((usuario) => ({
        id: `pol/exc/${i}/${usuario.id}`,
        nombre: e.nombre(usuario),
        tipo: e.tipo,
        alcance: { clase: "cuenta", cuenta: usuario.id } as Alcance,
        /* Nunca antes de que la cuenta existiera: una regla escrita sobre
           alguien que todavía no vivía acá es una fecha que se contradice sola
           con la ficha. */
        creadaEl: diasDespues(usuario.addedAt, e.dias),
        creador: e.creador,
        direcciones: [],
        objetivos: [],
      })),
  );

  return [...deLaCasa, ...excepciones, ...creadas]
    .filter((p) => !borradas.includes(p.id))
    .map((p) => ({ ...p, ...(editadas[p.id] ?? {}) }))
    /* Los días sueltos se comparan como texto: en ISO el orden alfabético es el
       cronológico. La última escrita cae primero —se la ve sin ir a buscarla—,
       que es también donde queda lo que se acaba de crear. */
    .sort((a, b) => b.creadaEl.localeCompare(a.creadaEl));
}

/** Las políticas de ahora. Se vuelven a armar cuando cambia el padrón o cuando
 *  la consola escribe, edita o borra una. */
export function usePoliticas(): Politica[] {
  const usuarios = useUsuarios();
  const tienda = useTiendaDePoliticas();
  return useMemo(() => armar(usuarios, tienda), [usuarios, tienda]);
}

/** Quién escribe cuando escribe la consola. Hay una sola sesión y no hay login:
 *  la primera de la lista es quien está sentada acá. */
export const YO = CREADORES[0];

export { CREADORES };
