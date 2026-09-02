import { useMemo } from "react";
import { create } from "zustand";

import { moderacionDe } from "@/pages/analiticas";
import type { CuentaDOC } from "@/pages/cuentas-doc";
import type { EstadoDeReporte } from "@/pages/reportes";
import { diasDesde } from "@/pages/tiempo";
import { ESTADOS, HOY, TIPOS, type Usuario } from "@/pages/usuarios";

/* Los reportes de la consola: el fixture de la sección Admin › Reports.
 *
 * Un reporte de acá **se pide**. Ésa es toda la diferencia con los de Email ›
 * Reports —`reportes.ts`—, y es la que explica por qué son dos tablas y no una:
 * aquéllos son ventanas que se cierran solas los domingos y nadie las eligió;
 * éstos existen porque una cuenta DOC entró un martes a la mañana y pidió uno.
 *
 * De ahí salen sus columnas. Un reporte semanal se describe por la semana que
 * cubre; uno pedido, por **qué se pidió** —el tipo— y **cuándo** —el pedido—.
 * No hay columna de período porque no hay período: lo que se pide es una foto de
 * la casa al momento de pedirla.
 *
 * Y de ahí sale también que las filas se escriban una por una en vez de
 * generarse. Una semana que cierra es una regla; alguien pidiendo cuatro
 * reportes seguidos su primera semana de acceso es un hecho, y una regla
 * generadora no puede inventarlo. Es la misma decisión que toman las políticas
 * de la casa y las cuentas DOC.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide una
 * lista de reportes y de dónde salen no es asunto suyo.
 */

/* ─────────────────────────── En qué anda ─────────────────────────── */

/* Los estados son los de `reportes.ts`, importados y no copiados: los dos
   reportes pasan por la misma cola —esperan, se arman, y terminan bien o mal— y
   dos listas de estados serían dos verdes distintos para el mismo hecho. Lo
   mismo vale para `sePuedeBajar`, que la pantalla importa de allá. */
export { ESTADOS_DE_REPORTE, ORDEN_ESTADOS, sePuedeBajar } from "@/pages/reportes";
export type { EstadoDeReporte } from "@/pages/reportes";

/* ─────────────────────────── De qué es ─────────────────────────── */

/** Los tres reportes que la consola sabe sacar, con la etiqueta que se ve, el
 *  color con el que el panel de filtros los distingue y qué trae cada uno.
 *
 *  Tres y no uno, al revés que en Email › Reports: allá el reporte es la semana
 *  y el tipo es una dimensión que todavía no se abrió; acá el tipo **es** lo que
 *  se pide —nadie pide "un reporte", pide el de IDs o el de lo que se frenó— y
 *  por eso tiene columna propia.
 *
 *  El orden es el de lo que se pide más seguido, que es el que el panel muestra:
 *  una lista alfabética pondría primero al que casi nadie saca.
 *
 *  `ayuda` no se ve en la tabla: es lo que el archivo dice de sí mismo en su
 *  cabecera, y lo que va a decir la ficha el día que se pueda pedir uno desde
 *  acá. Vive al lado de la etiqueta porque son dos maneras de decir lo mismo, y
 *  separadas se contradicen. */
export const TIPOS_DE_REPORTE_DOC = {
  "user-id": {
    label: "User ID Report",
    tinte: "#8b5cf6",
    ayuda: "Every account the house knows, with its id and when it was opened.",
  },
  volume: {
    label: "Communication Volume Report",
    tinte: "#3b82f6",
    ayuda: "How much each account talked, this month against the one before.",
  },
  blocked: {
    label: "Blocked Communication Report",
    tinte: "#f43f5e",
    ayuda: "What moderation stopped, and what it stopped it for.",
  },
} as const satisfies Record<
  string,
  { label: string; tinte: string; ayuda: string }
>;

export type TipoDeReporteDOC = keyof typeof TIPOS_DE_REPORTE_DOC;

export const ORDEN_TIPOS_DOC = Object.keys(
  TIPOS_DE_REPORTE_DOC,
) as TipoDeReporteDOC[];

/* ─────────────────────────── El reporte ─────────────────────────── */

export interface ReporteDOC {
  id: string;
  /** Cómo se llama: el tipo y el día en que se pidió —"User ID Report —
   *  06/26/2026"—.
   *
   *  Repite lo que dicen las otras dos columnas a propósito, y no es de más: el
   *  nombre es cómo se llama **el archivo** cuando cae en la carpeta de
   *  descargas, y ahí afuera no hay columna de tipo ni de fecha que lo
   *  acompañe. Adentro de la tabla es lo que se lee primero; afuera es todo lo
   *  que queda.
   *
   *  No se guarda: se arma en `armar` a partir del tipo y del pedido. Guardarlo
   *  sería tener dos fuentes para el mismo hecho, y la primera fila a la que se
   *  le corrija el tipo pasaría a llamarse como el tipo que ya no es. */
  nombre: string;
  tipo: TipoDeReporteDOC;
  estado: EstadoDeReporte;
  /** Cuándo se lo pidió, con hora: dos pedidos del mismo día se distinguen por
   *  ella, y la tabla ordena por acá. La columna lo escribe en relativo —"2 mo
   *  ago"—, que es lo que se pregunta de un pedido; el día exacto está en el
   *  nombre. */
  pedidoEl: string;
  /** Quién lo pidió: el id de su cuenta DOC, no su nombre. Se resuelve contra la
   *  tabla viva de Admin › DOC Accounts, así el reporte nombra a quien lo pidió
   *  como se llama ahora —y una cuenta a la que le corrigieron el nombre no deja
   *  atrás una firma vieja—. */
  pedidoPor: string;
}

/* ─────────────────────────── Los pedidos ─────────────────────────── */

/* Las cuentas que piden. Escritas como constantes y no sueltas en cada fila:
   son los ids de `cuentas-doc.ts` —que salen del correo—, y repetir el correo
   dieciséis veces es dieciséis lugares donde se puede escribir mal uno. */
const IRENE = "doc/irene.bustos@facilitybase.org";
const NESTOR = "doc/nestor.ojeda@facilitybase.org";
const MARCELA = "doc/marcela.vidal@facilitybase.org";
const RUBEN = "doc/ruben.ferrari@facilitybase.org";
const SABRINA = "doc/sabrina.toledo@facilityhub.org";
const EMILIANO = "doc/emiliano.prats@transitioncenter.org";
const DANA = "doc/dana@kiwichat.com";

type Pedido = Omit<ReporteDOC, "id" | "nombre">;

/* Los pedidos, escritos del más nuevo al más viejo. Cada racimo tiene un motivo,
   y por eso están escritos y no generados. */
const PEDIDOS: Pedido[] = [
  /* La cola de ahora. Los tres estados que no son "terminado" viven arriba de
     todo porque la cola arma de lo más viejo a lo más nuevo: el de anteayer se
     está armando y el de ayer espera atrás. Al revés —el nuevo armándose y el
     viejo esperando— sería una cola que se saltea su propia fila.

     Son lo que le da algo que decir a la columna de estado, y lo único que
     explica por qué hay tres filas sin botón de bajar. */
  { tipo: "user-id", estado: "pending", pedidoEl: "2026-08-27T16:40", pedidoPor: IRENE },
  { tipo: "volume", estado: "processing", pedidoEl: "2026-08-26T09:12", pedidoPor: MARCELA },
  /* El que falló: un reporte de lo que la moderación frenó, pedido sobre la
     casa entera. Es el más pesado de los tres, y es el que se cae. */
  { tipo: "blocked", estado: "failed", pedidoEl: "2026-08-24T11:05", pedidoPor: RUBEN },

  /* El mes corriente, ya terminado. */
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-08-21T10:22", pedidoPor: RUBEN },
  { tipo: "volume", estado: "completed", pedidoEl: "2026-08-14T15:48", pedidoPor: NESTOR },
  { tipo: "blocked", estado: "completed", pedidoEl: "2026-08-03T08:57", pedidoPor: MARCELA },

  /* Julio. */
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-07-30T14:11", pedidoPor: SABRINA },
  { tipo: "volume", estado: "completed", pedidoEl: "2026-07-17T09:35", pedidoPor: DANA },
  { tipo: "blocked", estado: "completed", pedidoEl: "2026-07-06T12:02", pedidoPor: EMILIANO },

  /* El racimo de junio, y el motivo de que esta tabla tenga ocho filas casi
     iguales seguidas: a Sabrina Toledo le dieron acceso el 23 de junio, y su
     primera semana la pasó bajando el padrón una y otra vez. Pasa de verdad
     —alguien que entra nuevo saca el mismo reporte hasta entender qué trae— y
     es lo que hace que la columna del pedido gane su lugar: sin la hora, estas
     ocho filas son indistinguibles. */
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-26T10:52", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-26T10:41", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-25T14:07", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-25T09:31", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-25T09:18", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-25T09:03", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-23T16:44", pedidoPor: SABRINA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-06-23T16:20", pedidoPor: SABRINA },

  /* Mayo: los dos de una misma tarde. Un reporte de volumen y uno de lo frenado
     pedidos con siete minutos de diferencia son la misma pregunta hecha en dos
     mitades —cuánto se habló, y cuánto de eso no salió—. */
  { tipo: "blocked", estado: "completed", pedidoEl: "2026-05-09T11:33", pedidoPor: MARCELA },
  { tipo: "volume", estado: "completed", pedidoEl: "2026-05-09T11:26", pedidoPor: MARCELA },

  /* Lo de más atrás, que es lo que le da filas de verdad al tramo "antes de este
     año" del panel. Espaciado y sin racimos: nadie se acuerda de por qué pidió
     un reporte en marzo. */
  { tipo: "volume", estado: "completed", pedidoEl: "2026-03-12T13:15", pedidoPor: NESTOR },
  { tipo: "user-id", estado: "completed", pedidoEl: "2026-01-19T10:08", pedidoPor: IRENE },
  { tipo: "blocked", estado: "completed", pedidoEl: "2025-11-04T15:52", pedidoPor: EMILIANO },
  { tipo: "user-id", estado: "completed", pedidoEl: "2025-09-30T09:44", pedidoPor: IRENE },
  { tipo: "volume", estado: "completed", pedidoEl: "2025-07-15T11:11", pedidoPor: DANA },
  { tipo: "user-id", estado: "completed", pedidoEl: "2025-05-22T16:03", pedidoPor: IRENE },
];

/* ─────────────────────────── El armado ─────────────────────────── */

/** El día como lo escribe el nombre de un reporte —`06/26/2026`—. Es el único
 *  lugar de la consola donde una fecha va en números y no en letras, y tiene
 *  motivo: no es una fecha que se lea en una columna sino parte del nombre de un
 *  archivo, donde "Jun 26, 2026" mete dos espacios y una coma. */
const DIA_EN_NUMEROS = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/* El día se lee al mediodía en UTC, como el resto de los días sueltos de esta
   consola: es lo que lo mantiene del lado correcto de la medianoche se lo mire
   desde donde se lo mire. */
const nombreDe = (tipo: TipoDeReporteDOC, pedidoEl: string) =>
  `${TIPOS_DE_REPORTE_DOC[tipo].label} — ${DIA_EN_NUMEROS.format(
    new Date(`${pedidoEl.slice(0, 10)}T12:00:00Z`),
  )}`;

/** Los reportes de ahora, armados: el nombre y el id salen del pedido, y la
 *  lista queda del más nuevo al más viejo.
 *
 *  El id lleva el momento del pedido y no un contador: es lo único que no se
 *  repite —hay ocho pedidos casi iguales en junio— y es lo que hace que la
 *  `key` de la fila siga siendo la misma si alguien reordena el fixture.
 *
 *  Los `pedidoEl` se comparan como texto: en ISO el orden alfabético es el
 *  cronológico. Sin `sort` no alcanzaría con que estén escritos en orden —el
 *  día que alguien agregue uno en el medio, la tabla mentiría—. */
function armar(): ReporteDOC[] {
  return PEDIDOS.map((pedido) => ({
    ...pedido,
    id: `doc-rep/${pedido.tipo}/${pedido.pedidoEl}`,
    nombre: nombreDe(pedido.tipo, pedido.pedidoEl),
  })).sort((a, b) => b.pedidoEl.localeCompare(a.pedidoEl));
}

const ESCRITOS = armar();

/* ─────────────────────────── Pedir uno ─────────────────────────── */

/* Lo que la consola pidió vive en una tienda, aparte del fixture y no mezclado
   con él: son de dos naturalezas —lo que estaba y lo que hicimos—, y el día que
   los reportes vengan de una API lo primero se borra y esto se queda. Es la
   misma decisión que toman `cuentas-doc.ts` y `anuncios.ts`. */
interface Tienda {
  pedidos: ReporteDOC[];
}

const useTiendaDeReportes = create<Tienda>()(() => ({ pedidos: [] }));

/** Quién pide cuando pide la consola. Hay una sola sesión y no hay login, así
 *  que es la misma persona que firma los anuncios —`YO`, en `anuncios.ts`—,
 *  escrita acá como el id de su cuenta DOC porque eso es lo que un reporte
 *  guarda. Se escribe y no se deriva del nombre: en esta casa hay dos personas
 *  que se llaman igual, y por eso la identidad de una cuenta es su correo. */
export const QUIEN_PIDE = IRENE;

/** Cuánto tarda en entrar un pedido a la cola.
 *
 *  No hay servidor detrás, y sin demora el pedido sería instantáneo: se toca el
 *  botón y la fila ya está. Eso no es lo que va a pasar el día que haya una API,
 *  y una pantalla diseñada contra un alta instantánea no tiene dónde poner lo
 *  que pasa mientras. Es la misma decisión, con el mismo número, que las altas
 *  de políticas, buzones, anuncios y cuentas. */
const DEMORA_MS = 900;

/** Cuántos pidió esta sesión. Es lo único que separa dos pedidos hechos sin
 *  moverse de la silla: el momento del pedido sale del hoy fijo del fixture, así
 *  que los dos caen en el mismo instante y sin esto compartirían id —y la tabla
 *  pintaría dos filas con la misma `key`—. El día que el reloj sea de verdad, o
 *  que el id lo devuelva una API, esto se borra. */
let cuantos = 0;

/**
 * Pedir un reporte. Devuelve el que quedó.
 *
 * Es `async` y no una escritura a secas porque del otro lado va a haber una red:
 * quien la llama tiene que poder esperarla, mostrar que está en curso y
 * enterarse si falla.
 *
 * No falla por repetido, al revés que el alta de una cuenta DOC: pedir dos veces
 * el mismo reporte es algo que pasa de verdad —hay ocho pedidos casi iguales en
 * junio— y no hay nada que un segundo pedido rompa. Lo que distingue una fila de
 * la de abajo es cuándo se la pidió, no qué se pidió.
 *
 * Nace `pending`, que es lo que es: entró a la cola y todavía no lo armó nadie.
 * Por eso la fila aparece sin botón de bajar —no hay archivo— y el estado de la
 * fila lo explica sin que haga falta un cartel.
 */
export async function pedirReporte(tipo: TipoDeReporteDOC): Promise<ReporteDOC> {
  await new Promise((listo) => setTimeout(listo, DEMORA_MS));

  /* El momento sale del hoy fijo del fixture y no de un `new Date()`: con el
     reloj real, la fila nueva quedaría fechada meses después de la última del
     fixture y la columna diría "in 4 days". Todo lo que esta consola escribe
     cuelga del mismo hoy. */
  const pedidoEl = `${HOY.toISOString().slice(0, 10)}T${HOY.toISOString().slice(11, 16)}`;

  const reporte: ReporteDOC = {
    id: `doc-rep/pedido/${(cuantos += 1)}`,
    nombre: nombreDe(tipo, pedidoEl),
    tipo,
    estado: "pending",
    pedidoEl,
    pedidoPor: QUIEN_PIDE,
  };
  /* Adelante y no al final: los pedidos de esta sesión comparten el instante
     —sale del hoy fijo— así que el orden entre ellos lo decide el orden de la
     lista, y el último pedido tiene que quedar arriba. */
  useTiendaDeReportes.setState(({ pedidos }) => ({
    pedidos: [reporte, ...pedidos],
  }));
  return reporte;
}

/** Los reportes de ahora: los escritos más los que pidió la consola, del más
 *  nuevo al más viejo.
 *
 *  Lo pedido va **antes** de lo escrito, y se apoya en que `sort` es estable:
 *  todo lo que esta consola pide cae en el mismo instante —el hoy fijo del
 *  fixture— así que el orden entre empatados es el de la lista, y lo que uno
 *  acaba de pedir tiene que quedar arriba de todo. */
export function useReportesDOC(): ReporteDOC[] {
  const pedidos = useTiendaDeReportes((t) => t.pedidos);
  return useMemo(
    () =>
      [...pedidos, ...ESCRITOS].sort((a, b) =>
        b.pedidoEl.localeCompare(a.pedidoEl),
      ),
    [pedidos],
  );
}

/* ─────────────────────────── Cuándo se lo pidió ─────────────────────────── */

/** En qué tramo de los que ofrece el panel de filtros cae el pedido.
 *
 *  Los cortes son los mismos que ofrecen Accounts, Provisioning, Policies y
 *  Email › Reports: es la misma pregunta hecha en cinco pantallas, y un corte
 *  distinto en una sola las volvería incomparables.
 *
 *  Se pregunta contra el pedido y no contra otra fecha porque no hay otra: un
 *  reporte pedido es un solo instante. Los de Email tienen dos —cuándo se armó y
 *  qué semana cubren— y por eso allá hay que elegir cuál manda. */
export function tramoDePedido(reporte: ReporteDOC) {
  const dias = diasDesde(reporte.pedidoEl);
  if (dias <= 30) return "30d";
  if (dias <= 90) return "90d";
  if (dias <= 365) return "year";
  return "older";
}

/* ─────────────────────────── Quién lo pidió ─────────────────────────── */

/** Cómo se llama quien pidió el reporte, resuelto contra la tabla de cuentas.
 *
 *  Cae en el correo del id cuando la cuenta ya no está: una cuenta DOC se
 *  desactiva en vez de borrarse —justamente para que sus firmas no queden
 *  huérfanas—, pero el día que una API devuelva un pedido de alguien que la
 *  consola no conoce, la fila tiene que poder decir de quién es igual. Un
 *  "Unknown" ahí sería tirar el único dato que hay. */
export function quienPidio(pedidoPor: string, cuentas: CuentaDOC[]) {
  const cuenta = cuentas.find((c) => c.id === pedidoPor);
  return cuenta?.nombre ?? pedidoPor.replace(/^doc\//, "");
}

/* ─────────────────────────── Lo que se baja ─────────────────────────── */

/* Las comillas dobles se escapan duplicándolas, que es lo que dice el RFC 4180:
   un nombre con una coma —o con una comilla— no puede partir una fila en dos. */
const campo = (v: string) => `"${v.replace(/"/g, '""')}"`;
const fila = (celdas: string[]) => celdas.map(campo).join(",");

/** El cuerpo de cada reporte: qué columnas tiene y qué cuentas entran.
 *
 *  Uno por tipo, y distintos de verdad. Un solo cuerpo para los tres —las mismas
 *  columnas con otro título arriba— sería tres filas de la tabla prometiendo
 *  tres cosas y entregando una, que es lo mismo que no tener tipos.
 *
 *  Todos salen del padrón vivo: el reporte dice de la casa lo que la casa dice
 *  de sí misma en Accounts, y un número que no cierre contra esa tabla es un
 *  número inventado. */
const CUERPOS: Record<
  TipoDeReporteDOC,
  (usuarios: Usuario[]) => { titulos: string[]; filas: string[][] }
> = {
  /* Quiénes son. Entran todas las cuentas, incluidas las bloqueadas y las dadas
     de baja: lo que se pide es el padrón, y un padrón que esconde a los que ya
     no están no sirve para lo que se pide un padrón. */
  "user-id": (usuarios) => ({
    titulos: ["Account ID", "Name", "Account type", "Status", "Added"],
    filas: usuarios.map((u) => [
      u.id,
      u.name,
      TIPOS[u.accountType],
      ESTADOS[u.status].label,
      u.addedAt,
    ]),
  }),

  /* Cuánto se habló. Los tres números crudos y ninguna variación calculada: el
     que abre esto en una planilla la calcula como la necesite, y un porcentaje
     redondeado adentro del archivo es una cuenta que después no se puede
     rehacer. */
  volume: (usuarios) => ({
    titulos: [
      "Account ID",
      "Name",
      "Messages",
      "Last 30 days",
      "Previous 30 days",
    ],
    filas: usuarios.map((u) => [
      u.id,
      u.name,
      String(u.messages),
      String(u.last30),
      String(u.prev30),
    ]),
  }),

  /* Qué se frenó, y por qué. Las cuentas sin nada frenado quedan afuera: un
     reporte de lo bloqueado con doscientas filas en cero es doscientas filas
     que hay que descartar a mano para llegar a las que dicen algo.
     Los motivos salen de `moderacionDe`, que es de donde salen los de la ficha
     de la cuenta: dos fuentes para el mismo reparto terminan diciendo cosas
     distintas. */
  blocked: (usuarios) => ({
    titulos: ["Account ID", "Name", "Blocked messages", "Reasons"],
    filas: usuarios
      .filter((u) => u.blockedMessages > 0)
      .map((u) => [
        u.id,
        u.name,
        String(u.blockedMessages),
        moderacionDe(u)
          .map((m) => `${m.label} (${m.cantidad})`)
          .join("; "),
      ]),
  }),
};

/**
 * El reporte como archivo: una cabecera con qué es y quién lo pidió, y después
 * el cuerpo que le toca a su tipo.
 *
 * Es texto y no un PDF con membrete porque lo que el reporte tiene para decir
 * son cuatro o cinco campos por cuenta, y un CSV es lo que se abre en la
 * planilla donde esto va a terminar igual. Y es de verdad: la fila promete un
 * archivo, así que bajarlo tiene que dar un archivo con lo que la fila dice —no
 * un aviso de que se bajó algo—.
 *
 * Se arma acá, al lado del modelo, y quien lo llama se encarga de entregarlo:
 * esto no sabe de blobs ni de anchors —para eso está `descargar`—.
 *
 * Una salvedad del fixture: el cuerpo sale del padrón de **ahora**, así que un
 * reporte pedido en mayo trae lo que la casa tiene hoy. El día que haya una API,
 * el archivo lo devuelve ella con lo que había el día que se lo pidió, y esta
 * función se borra entera.
 */
export function csvDeReporteDOC(
  reporte: ReporteDOC,
  usuarios: Usuario[],
  cuentas: CuentaDOC[],
): string {
  const tipo = TIPOS_DE_REPORTE_DOC[reporte.tipo];
  const { titulos, filas } = CUERPOS[reporte.tipo](usuarios);

  return [
    fila(["Report", reporte.nombre]),
    fila(["Type", tipo.label]),
    fila(["Contents", tipo.ayuda]),
    fila(["Requested", reporte.pedidoEl, quienPidio(reporte.pedidoPor, cuentas)]),
    fila(["Accounts", String(filas.length)]),
    "",
    fila(titulos),
    ...filas.map(fila),
  ].join("\n");
}

/** Cómo se llama el archivo. Lleva el tipo y el momento del pedido —hasta el
 *  minuto— y no el nombre de la fila: el nombre trae barras y un guión largo, y
 *  eso adentro de un nombre de archivo es una ruta que nadie quiso escribir.
 *
 *  El minuto está por lo mismo que la columna: ocho pedidos de junio se llaman
 *  igual, y bajados a la misma carpeta el nombre tiene que decir cuál es cuál.
 *  Sin él, el navegador los numeraría —"(1)", "(2)"— en el orden en que se los
 *  bajó, que no es el orden en que se los pidió. */
export const archivoDeReporteDOC = (reporte: ReporteDOC) =>
  `${reporte.tipo}-report-${reporte.pedidoEl.replace(/[T:]/g, "-")}.csv`;
