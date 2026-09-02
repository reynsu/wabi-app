import { useMemo } from "react";

import type { BadgeColor } from "@/components/ui/badge";
import { DIA, HOY, TIPOS, useUsuarios, type Usuario } from "@/pages/usuarios";

/* Los reportes de correo de la casa: el fixture de la sección Email › Reports.
 *
 * Un reporte es una ventana de una semana cerrada y firmada: qué cuentas de
 * correo se abrieron entre tal día y tal otro. Se genera solo, el día que la
 * semana termina, y queda para bajar.
 *
 * Eso —que sea una **ventana** y no una lista— es lo que le da su tabla. Las
 * otras tres pantallas de Email muestran cosas que existen ahora: buzones,
 * mensajes, reglas. Ésta muestra cosas que ya pasaron, y por eso sus columnas
 * son un período y un estado en vez de un dato del correo. Dos reportes del
 * mismo mes se llaman igual a propósito: lo que los distingue es la semana que
 * cubren, y por eso esa columna existe.
 *
 * De dónde salen las filas:
 *
 * - **Las ventanas** se generan: son semanas, una atrás de la otra, y una lista
 *   escrita a mano de sesenta fechas consecutivas no diría nada que la regla no
 *   diga. Es lo contrario de las políticas de la casa, donde cada fila tenía un
 *   motivo propio.
 * - **A quiénes cubre cada una** sale del padrón: las cuentas dadas de alta
 *   adentro de esa ventana. Derivarlo es lo que hace que el número de la columna
 *   sea verdad contra la tabla de Accounts —y lo que explica las semanas en
 *   cero: no todas las semanas entra alguien—.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide una
 * lista de reportes y de dónde salen no es asunto suyo.
 */

/* ─────────────────────────── En qué anda ─────────────────────────── */

/** En qué estado está un reporte, con la etiqueta que se ve, el color con el que
 *  el panel de filtros lo distingue y el del badge. Tres vistas de un mismo
 *  dato, y por eso no viven en tres constantes que se contradicen.
 *
 *  Son los cuatro que tiene la cola que los arma, y van en el orden en que un
 *  reporte los recorre: espera, se arma, y termina bien o mal. Ese orden es el
 *  del panel de filtros —una lista de estados alfabética obliga a reconstruir
 *  mentalmente en qué punto está cada uno—.
 *
 *  Los comparte Admin › Reports, que también arma reportes y también los pone
 *  en una cola. Es la misma pregunta —¿en qué anda esto?— hecha en dos
 *  pantallas, y dos listas de estados serían dos verdes distintos y dos órdenes
 *  distintos para el mismo hecho. Viven acá porque acá nacieron; el día que una
 *  tercera pantalla los use, se mudan a un archivo propio. */
export const ESTADOS_DE_REPORTE = {
  pending: { label: "Pending", tinte: "#a3a3a3", color: "gray" },
  processing: { label: "Processing", tinte: "#3b82f6", color: "blue" },
  completed: { label: "Completed", tinte: "#22c55e", color: "green" },
  failed: { label: "Failed", tinte: "#f43f5e", color: "rose" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

export type EstadoDeReporte = keyof typeof ESTADOS_DE_REPORTE;

export const ORDEN_ESTADOS = Object.keys(
  ESTADOS_DE_REPORTE,
) as EstadoDeReporte[];

/** Si hay algo que bajar. Sólo lo terminado: un reporte que se está armando no
 *  tiene archivo todavía, y uno que falló no lo va a tener. El botón de la fila
 *  lo pregunta acá en vez de comparar contra un estado a mano, que es lo que
 *  hace que el día que haya un cuarto estado no se olvide ninguna pantalla.
 *
 *  Pide el estado y no el reporte entero: las dos pantallas que bajan reportes
 *  —ésta y Admin › Reports— tienen filas de forma distinta y la pregunta es la
 *  misma. Acotarla al `Reporte` de acá obligaría a la otra a escribirla otra
 *  vez, que es justamente lo que este helper existe para evitar. */
export const sePuedeBajar = (reporte: { estado: EstadoDeReporte }) =>
  reporte.estado === "completed";

/* ─────────────────────────── De qué es ─────────────────────────── */

/** De qué habla el reporte. Hoy hay uno solo —la actividad de las cuentas de
 *  correo—, y por eso las sesenta filas dicen lo mismo y filtrar por tipo no
 *  saca ninguna.
 *
 *  Está igual, y no es de más: el día que la casa saque un segundo tipo —uno de
 *  retención, uno de moderación— la tabla ya sabe decir cuál es cada fila y el
 *  panel ya sabe preguntarlo. Lo que **no** hay es una columna: una columna
 *  donde las sesenta filas dicen lo mismo es un ancho gastado en no decir nada,
 *  y el día que haya dos tipos se agrega. */
export const TIPOS_DE_REPORTE = {
  activity: { label: "Email Account Activity" },
} as const;

export type TipoDeReporte = keyof typeof TIPOS_DE_REPORTE;

export const ORDEN_TIPOS = Object.keys(TIPOS_DE_REPORTE) as TipoDeReporte[];

/* ─────────────────────────── El reporte ─────────────────────────── */

export interface Reporte {
  id: string;
  /** Cómo se llama. Lleva el código de la instalación y el mes, así que dos
   *  semanas del mismo mes se llaman igual: es a propósito —el nombre dice de
   *  qué mes es el reporte, y cuál de las semanas lo dice la columna del
   *  período—. */
  nombre: string;
  tipo: TipoDeReporte;
  /** Las cuentas que cubre. Ids y no cuentas enteras: se resuelven contra el
   *  padrón vivo cuando hay que escribirlas, así el reporte nombra a la cuenta
   *  como se llama ahora. */
  cuentas: string[];
  /** La ventana, con los dos extremos como días sueltos —`2026-07-23`—. El
   *  primer día entra y el último también: es la semana que el reporte dice
   *  cubrir. */
  desde: string;
  hasta: string;
  estado: EstadoDeReporte;
  /** Cuándo se armó. Es el día que la ventana cerró: un reporte semanal no
   *  existe antes de que termine la semana que cuenta. */
  creadoEl: string;
}

/* ─────────────────────────── El armado ─────────────────────────── */

/** El código de la instalación, que es lo que abre el nombre de cada reporte.
 *  Va acá y no en cada fila porque es de la casa y no del reporte: el día que la
 *  consola maneje dos residencias, esto sale de cuál se está mirando. */
const CODIGO = "KC-B";

/** Cuántas semanas para atrás llega la lista. Sesenta son catorce meses: entra
 *  el año entero que ofrece el panel de filtros y sobra un poco para que el
 *  tramo "antes de este año" tenga filas de verdad. */
const SEMANAS = 60;

const SEMANA = 7 * DIA;

const MES_Y_ANIO = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const comoDia = (t: number) => new Date(t).toISOString().slice(0, 10);

/** El día de hoy del fixture. Todo cuelga de acá y no de un `new Date()`: con el
 *  reloj real, la última ventana se movería sola y las fechas de las cuentas
 *  —que son de mentira— quedarían del lado equivocado. */
const HOY_DIA = HOY.getTime();

/** En qué anda cada una de las primeras semanas.
 *
 *  Elegidas y no al azar: con `Math.random()` la tabla contaría una historia
 *  distinta en cada pintada, y el que encuentra el reporte que falló no podría
 *  volver a encontrarlo.
 *
 *  Y en este orden porque la cola arma de la más vieja a la más nueva: la de la
 *  semana pasada se está armando, y la que cerró hoy espera atrás. Al revés —la
 *  nueva armándose y la vieja esperando— sería una cola que se saltea su propia
 *  fila. */
const EN_CURSO: Record<number, EstadoDeReporte> = {
  0: "pending",
  1: "processing",
  6: "failed",
};

function armar(usuarios: Usuario[]): Reporte[] {
  return Array.from({ length: SEMANAS }, (_, i) => {
    const hasta = comoDia(HOY_DIA - i * SEMANA);
    const desde = comoDia(HOY_DIA - (i + 1) * SEMANA);

    /* Las cuentas de la ventana: las que se dieron de alta adentro. El extremo
       de abajo queda afuera y el de arriba adentro, así una cuenta cae en una
       sola semana y no en dos. */
    const cuentas = usuarios
      .filter((u) => u.addedAt > desde && u.addedAt <= hasta)
      .map((u) => u.id);

    /* Todo lo que quedó atrás está terminado; lo de las primeras semanas todavía
       está pasando. Es lo que hace que la columna de estado tenga algo que decir
       en las filas que se miran, que son las de arriba. */
    const estado: EstadoDeReporte = EN_CURSO[i] ?? "completed";

    return {
      id: `rep/${i}`,
      /* Todos del mismo tipo: hoy hay uno solo. Se escribe igual en cada fila
         —y no se asume— para que el día que haya dos, el que agregue el segundo
         no tenga que salir a buscar dónde se decidía esto. */
      tipo: "activity",
      /* El mes es el del cierre de la ventana: una semana que empieza en julio
         y termina en agosto es del reporte de agosto, que es cuando se firmó. */
      nombre: `${CODIGO} ${MES_Y_ANIO.format(new Date(`${hasta}T12:00:00Z`))} Report`,
      cuentas,
      desde,
      hasta,
      estado,
      creadoEl: hasta,
    };
  });
  /* Ya salen del más nuevo al más viejo: `i` cuenta semanas para atrás. Sin
     `sort`, que ordenaría otra vez algo que ya está en orden. */
}

/** Los reportes de ahora. Se vuelven a armar cuando cambia el padrón: a quiénes
 *  cubre cada ventana depende de quiénes entraron esa semana. */
export function useReportes(): Reporte[] {
  const usuarios = useUsuarios();
  return useMemo(() => armar(usuarios), [usuarios]);
}

/* ─────────────────────────── Qué semana cubre ─────────────────────────── */

/** Los tramos con los que el panel pregunta por el período.
 *
 *  Se pregunta contra el **cierre de la ventana** y no contra la fecha de alta,
 *  aunque hoy sean el mismo día: lo que el filtro dice es "reportes que cubren
 *  este tramo", y el día que un reporte se rearme —una semana vieja que se
 *  vuelve a correr— el alta se mueve y la ventana no. Preguntar por el alta
 *  devolvería el reporte en el tramo equivocado.
 *
 *  Los cortes son los mismos que ofrecen Accounts, Provisioning y Policies: es
 *  la misma pregunta hecha en cuatro pantallas, y un corte distinto en una sola
 *  las volvería incomparables. */
export function tramoDePeriodo(reporte: Reporte) {
  const dias = (HOY_DIA - new Date(`${reporte.hasta}T12:00:00Z`).getTime()) / DIA;
  if (dias <= 30) return "30d";
  if (dias <= 90) return "90d";
  if (dias <= 365) return "year";
  return "older";
}

/* ─────────────────────────── Lo que se baja ─────────────────────────── */

/** El reporte como archivo: una cabecera con qué ventana es, y después una fila
 *  por cuenta.
 *
 *  Es texto y no un PDF con membrete porque lo que el reporte tiene para decir
 *  son cinco campos por cuenta, y un CSV es lo que se abre en la planilla donde
 *  esto va a terminar igual. Y es de verdad: la fila promete un archivo, así que
 *  bajarlo tiene que dar un archivo con lo que la fila dice —no un aviso de que
 *  se bajó algo—.
 *
 *  Se arma acá, al lado del modelo, y quien lo llama se encarga de entregarlo:
 *  esto no sabe de blobs ni de anchors. */
export function csvDeReporte(reporte: Reporte, usuarios: Usuario[]): string {
  /* Las comillas dobles se escapan duplicándolas, que es lo que dice el
     RFC 4180: un nombre con una coma —o con una comilla— no puede partir una
     fila en dos. */
  const campo = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const fila = (celdas: string[]) => celdas.map(campo).join(",");

  const cuentas = reporte.cuentas
    .map((id) => usuarios.find((u) => u.id === id))
    .filter((u): u is Usuario => u !== undefined);

  return [
    fila(["Report", reporte.nombre]),
    fila(["Period covered", reporte.desde, reporte.hasta]),
    fila(["Accounts", String(cuentas.length)]),
    "",
    fila(["Account ID", "Name", "Account type", "Added"]),
    ...cuentas.map((u) =>
      fila([u.id, u.name, TIPOS[u.accountType], u.addedAt]),
    ),
  ].join("\n");
}

/** Cómo se llama el archivo. Lleva la ventana y no la fecha de hoy: dos reportes
 *  del mismo mes se llaman igual en la tabla, y bajados los dos a la misma
 *  carpeta el nombre tiene que decir cuál es cuál. */
export const archivoDeReporte = (reporte: Reporte) =>
  `${reporte.nombre.replace(/\s+/g, "-")}-${reporte.desde}-${reporte.hasta}.csv`;
