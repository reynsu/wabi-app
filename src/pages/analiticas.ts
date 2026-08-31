import { azarDesde, semillaDe } from "@/pages/azar";
import { HOY, type Usuario } from "@/pages/usuarios";

/* Las series que dibujan los gráficos del board.

   Nada de esto se guarda en el modelo. `Usuario` tiene los hechos —cuántos
   mensajes cruzó, cuántos frenó la moderación, a qué hora habla más— y estas
   funciones los **reparten**: la curva del día suma exactamente `messages` y
   pica en `peakHour`, y las categorías moderadas suman exactamente
   `blockedMessages`. Es la misma regla que el resto del fixture, y la que hace
   que el gráfico y la ficha de al lado no puedan contradecirse: guardar
   veinticuatro números además del total es tener dos fuentes para el mismo
   hecho, y la primera vez que alguien toque una, el widget dirá 875 y la ficha
   otra cosa.

   El reparto sale del id de la cuenta —ver `azar.ts`—, así que la curva es la
   misma en cada pintada. Sin eso el gráfico cambiaría de forma cada vez que el
   riel se repinta, que es todo el tiempo.

   El día que las analíticas vengan de una API se borra este archivo: los
   gráficos piden series y de dónde salen no es asunto suyo. */

/* ─────────────────────────── Las horas ─────────────────────────── */

export interface Hora {
  /** De 0 a 23. */
  hora: number;
  mensajes: number;
}

/* La forma de un día. Es una curva de base —nadie escribe a las cuatro de la
   mañana y todos escriben después del almuerzo— sobre la que después se apoya
   el pico de la cuenta. Sin la base, un solo palo en `peakHour` y ventitrés
   ceros: cierto según el modelo, pero no es cómo habla una persona. */
const BASE_DEL_DIA = [
  1, 1, 1, 1, 1, 2, 5, 12, 22, 28, 30, 30, 32, 34, 33, 30, 30, 32, 34, 33, 28,
  20, 10, 4,
];

/** Cuánto pesa el pico contra la base. Tres veces la hora más alta del día
 *  normal: se ve de un vistazo cuál es sin aplastar el resto de la curva a una
 *  línea, que es lo que pasa cuando el pico se lleva la mitad del total. */
const PESO_DEL_PICO = 3;

/** Cuántos mensajes cruzó la cuenta en cada hora del día, sumando `messages`.
 *
 *  Se reparte y se redondea, y lo que sobra del redondeo va a la hora pico: la
 *  suma tiene que dar el total exacto que la ficha muestra al lado, y el pico es
 *  el único lugar donde un mensaje de más no se nota. */
export function horasDe(usuario: Usuario): Hora[] {
  const azar = azarDesde(semillaDe(`${usuario.id}/horas`));

  /* La base, más el pico donde dice el modelo, más un temblor por hora para
     que no se lea como una fórmula. El temblor es chico —de 0.85 a 1.15— y
     determinista: mismo id, mismo temblor. */
  const pesos = BASE_DEL_DIA.map((base, hora) => {
    const pico = hora === usuario.peakHour ? Math.max(...BASE_DEL_DIA) * PESO_DEL_PICO : 0;
    return (base + pico) * (0.85 + azar() * 0.3);
  });

  const total = pesos.reduce((a, b) => a + b, 0);
  const horas = pesos.map((peso, hora) => ({
    hora,
    mensajes: Math.round((peso / total) * usuario.messages),
  }));

  /* El resto del redondeo, al pico. */
  const repartido = horas.reduce((a, h) => a + h.mensajes, 0);
  horas[usuario.peakHour].mensajes += usuario.messages - repartido;

  return horas;
}

const RELOJ = new Intl.DateTimeFormat("en-US", { hour: "numeric" });

/** Una hora del día como la escribe un reloj: `10 PM`. El modelo guarda el
 *  entero —cómo se muestra lo decide quien lo muestra— y la escriben dos: el
 *  eje del gráfico y la ficha de moderación. Dos formatos para la misma hora,
 *  uno arriba del otro, se leen como dos horas distintas. */
export const comoHora = (hora: number) =>
  /* Con la guarda: el `tickFormatter` y el `labelFormatter` de recharts se
     llaman también en cuadros donde todavía no hay dato —al montar, y mientras
     el tooltip busca a qué fila apunta—, y ahí llega `undefined`. Sin esto,
     `Intl` tira `RangeError: Invalid time value` y se cae el gráfico entero por
     un cuadro en el que no había nada que rotular. */
  Number.isFinite(hora)
    ? RELOJ.format(new Date(Date.UTC(2026, 0, 1, hora)))
    : "";

/* ─────────────────────────── El sentimiento ─────────────────────────── */

export interface PuntoDeSentimiento {
  /** El lunes de esa semana, en ISO: lo formatea quien lo muestra. */
  cuando: string;
  positivo: number;
  negativo: number;
  /** Cuántos mensajes hubo esa semana. Es la línea punteada: sin ella, dos
   *  semanas con el mismo tono se ven iguales aunque una tenga diez mensajes y
   *  la otra doscientos. */
  volumen: number;
}

/** Cuántas semanas mira el gráfico. Seis meses: es el tramo en el que un cambio
 *  de tono se ve como un cambio y no como ruido. */
const SEMANAS = 26;
const SEMANA = 7 * 24 * 60 * 60 * 1000;

/** El tono de la cuenta, semana a semana.
 *
 *  El volumen sale de los mismos dos números que la ficha compara —`prev30` y
 *  `last30`—: la curva termina donde ellos dicen, así que el gráfico y el
 *  "−31%" de al lado cuentan la misma historia. El tono se mueve alrededor de
 *  lo que la cuenta tiene de bloqueado: una con mucha moderación pesa más del
 *  lado negativo, y no porque se lo hayamos escrito, sino porque es su tasa. */
export function sentimientoDe(usuario: Usuario): PuntoDeSentimiento[] {
  const azar = azarDesde(semillaDe(`${usuario.id}/tono`));
  const tasa = usuario.messages ? usuario.blockedMessages / usuario.messages : 0;

  /* De dónde a dónde va el volumen: de la actividad de hace dos meses a la de
     ahora, en promedio semanal. */
  const desde = usuario.prev30 / 4.3;
  const hasta = usuario.last30 / 4.3;

  /* El temblor semanal, suavizado con sus vecinos antes de usarlo. Crudo, un
     ±30% semana a semana da una sierra: cada punto sube y baja contra el
     anterior y el gráfico se lee como ruido, no como una tendencia. Promediado
     de a tres, las subidas duran varias semanas —que es como se mueve una
     conversación de verdad— y las jorobas del diseño aparecen solas. */
  const crudo = Array.from({ length: SEMANAS }, () => 0.6 + azar() * 0.8);
  const suave = crudo.map((_, i) => {
    const desdeI = Math.max(0, i - 1);
    const hastaI = Math.min(crudo.length - 1, i + 1);
    const tramo = crudo.slice(desdeI, hastaI + 1);
    return tramo.reduce((a, b) => a + b, 0) / tramo.length;
  });

  return Array.from({ length: SEMANAS }, (_, i) => {
    const t = i / (SEMANAS - 1);
    const volumen = Math.max(
      0,
      Math.round((desde + (hasta - desde) * t) * suave[i]),
    );
    /* Lo negativo es una fracción del volumen, empujada por la tasa de
       bloqueados; lo positivo es casi todo el resto. No suman el volumen a
       propósito: hay mensajes que no son ni una cosa ni la otra, que es la
       mayoría de lo que se dice en un día. */
    const negativo = Math.round(volumen * tasa * (0.5 + azar() * 1.6));
    const positivo = Math.round((volumen - negativo) * (0.3 + azar() * 0.35));
    return {
      cuando: new Date(
        HOY.getTime() - (SEMANAS - 1 - i) * SEMANA,
      ).toISOString(),
      positivo,
      negativo: Math.min(negativo, volumen),
      volumen,
    };
  });
}

/* ─────────────────────────── La moderación ─────────────────────────── */

export interface Motivo {
  /** La clave, para el `ChartConfig`. */
  id: string;
  label: string;
  cantidad: number;
}

/* Por qué se frena un mensaje en esta casa. No son las categorías de una red
   social: acá el que escribe es la familia de alguien que vive en una
   residencia, y lo que hay que frenar es lo que se le hace a un residente.
   Los pesos dicen cuán común es cada uno —la estafa es el problema de esta
   casa, y la lista lo dice sin que haga falta un comentario al lado del
   gráfico—. */
const MOTIVOS = [
  { id: "scam", label: "Scam", peso: 46 },
  { id: "personal", label: "Personal data", peso: 27 },
  { id: "harassment", label: "Harassment", peso: 18 },
  { id: "profanity", label: "Profanity", peso: 9 },
] as const;

/** En qué se reparten los mensajes que la moderación frenó. Suman exactamente
 *  `blockedMessages`: el resto del redondeo va al motivo más común, que es el
 *  único donde un mensaje de más no cambia el orden de la lista. */
export function moderacionDe(usuario: Usuario): Motivo[] {
  const azar = azarDesde(semillaDe(`${usuario.id}/moderacion`));
  const pesos = MOTIVOS.map((m) => m.peso * (0.6 + azar() * 0.8));
  const total = pesos.reduce((a, b) => a + b, 0);

  const motivos = MOTIVOS.map((m, i) => ({
    id: m.id,
    label: m.label,
    cantidad: Math.round((pesos[i] / total) * usuario.blockedMessages),
  }));

  const repartido = motivos.reduce((a, m) => a + m.cantidad, 0);
  motivos[0].cantidad += usuario.blockedMessages - repartido;

  /* Los que quedaron en cero no se pintan: una porción de tamaño cero en una
     dona es una raya, y una fila de leyenda que dice "0" es una categoría que
     no pasó. */
  return motivos.filter((m) => m.cantidad > 0);
}
