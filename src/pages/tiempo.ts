import { DIA, HOY } from "@/pages/usuarios";

/* Cómo se escribe "cuándo fue" en una lista.

   Vive aparte porque lo usan las dos secciones del perfil —conversaciones y
   correos— y las dos tienen que decirlo igual: dos formatos distintos para el
   mismo instante, uno al lado del otro, se leen como dos hechos distintos.

   Todo cuelga de `HOY`, el hoy fijo del fixture: con un `new Date()` de verdad
   la fila que dice "Yesterday" pasaría a decir "Aug 27" sin que nadie toque
   nada.

   `cuandoCorto` es el de una lista: hoy la hora, ayer la palabra, esta semana
   el día, y más atrás la fecha. Nadie quiere leer "Aug 27, 2026, 4:20 PM"
   cuarenta veces en una columna de sesenta píxeles. */
const HORA = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const DIA_SEMANA = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const FECHA_CORTA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const aMedianoche = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Cuántos días pasaron, con decimales: sirve para comparar contra tramos —
 *  "menos de siete" — sin preocuparse por dónde cae la medianoche. */
export const diasDesde = (iso: string) =>
  (HOY.getTime() - new Date(iso).getTime()) / DIA;

/** Cuántos días enteros de calendario separan a esa fecha de hoy. */
export function diasDeCalendario(iso: string) {
  return Math.round(
    (aMedianoche(HOY) - aMedianoche(new Date(iso))) / DIA,
  );
}

export function cuandoCorto(iso: string) {
  const dias = diasDeCalendario(iso);
  const fecha = new Date(iso);
  if (dias <= 0) return HORA.format(fecha);
  if (dias === 1) return "Yesterday";
  if (dias < 7) return DIA_SEMANA.format(fecha);
  return FECHA_CORTA.format(fecha);
}

/* Hace cuánto, siempre en relativo. Es el renglón que acompaña a una fecha ya
   escrita —"Aug 28" arriba, "2 h ago" abajo—, así que nunca cae de vuelta en
   una fecha: repetir "Aug 28" debajo de "Aug 28" no agrega nada, y lo que le
   falta a la fecha es justamente el vistazo de cuán reciente es.

   La escalera va apretando a medida que se aleja —horas, días, semanas, meses,
   años—: a nadie le sirve "hace 47 días", y "hace 7 semanas" tampoco. Cada
   tramo es el que la gente usa para hablar de esa distancia. */
const SEMANA = 7 * DIA;

export function haceCuanto(iso: string) {
  const pasado = HOY.getTime() - new Date(iso).getTime();
  const horas = Math.floor(pasado / (60 * 60 * 1000));
  if (horas < 1) return "Just now";
  if (horas < 24) return `${horas} h ago`;

  const dias = Math.floor(pasado / DIA);
  if (dias === 1) return "Yesterday";
  if (dias < 7) return `${dias} d ago`;

  const semanas = Math.floor(pasado / SEMANA);
  if (semanas < 5) return `${semanas} w ago`;

  /* Los meses y los años, contados por calendario y no dividiendo días: un mes
     no mide 30 días y un año no mide 365, y con la cuenta a ojo el 1 de marzo
     termina diciendo que enero fue "hace 1 mo" o "hace 2 mo" según el año. */
  const fecha = new Date(iso);
  const meses =
    (HOY.getFullYear() - fecha.getFullYear()) * 12 +
    (HOY.getMonth() - fecha.getMonth()) -
    (HOY.getDate() < fecha.getDate() ? 1 : 0);
  if (meses < 12) return `${Math.max(meses, 1)} mo ago`;

  const anios = Math.floor(meses / 12);
  return `${anios} y ago`;
}

/** El encabezado que separa un día de otro adentro del hilo. */
export function diaLargo(iso: string) {
  const dias = diasDeCalendario(iso);
  if (dias <= 0) return "Today";
  if (dias === 1) return "Yesterday";
  if (dias < 7) return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(iso));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export const hora = (iso: string) => HORA.format(new Date(iso));

/* La fecha entera, para cuando hay lugar y precisión importa —la cabecera de
   un correo abierto—. Acá sí va el año: un correo se archiva, y "Aug 27" sin
   año deja de servir en enero. */
const FECHA_LARGA = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const fechaLarga = (iso: string) => FECHA_LARGA.format(new Date(iso));

/* Una fecha de alta: el día, sin hora. Con año, porque una lista de altas cruza
   diciembre; sin hora, porque nadie pregunta a qué hora se dio de alta algo.

   Toma el día suelto que guardan los modelos —`2026-03-04`— y lo lee al mediodía
   en UTC: es lo que lo mantiene del lado correcto de la medianoche se lo mire
   desde donde se lo mire.

   Vive acá y no adentro de una pantalla porque lo usan dos —la fecha de alta de
   una cuenta en Accounts y la de un buzón en Provisioning— y dos formatos para
   el mismo día, uno al lado del otro, se leen como dos hechos distintos. */
const FECHA_DIA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const alMediodia = (dia: string) => new Date(`${dia}T12:00:00Z`);

export const fechaDia = (dia: string) => FECHA_DIA.format(alMediodia(dia));

/** En qué tramo de los que ofrece el panel de filtros cae una fecha de alta. Es
 *  la contracara de esa lista de opciones: los dos hablan de lo mismo, así que
 *  cambiar un corte acá y no allá es lo que hace que un filtro devuelva algo
 *  distinto de lo que promete. */
export function tramoAlta(dia: string) {
  const dias = (HOY.getTime() - alMediodia(dia).getTime()) / DIA;
  if (dias <= 30) return "30d";
  if (dias <= 90) return "90d";
  if (dias <= 365) return "year";
  return "older";
}
