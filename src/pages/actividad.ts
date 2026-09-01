import { azarDesde, semillaDe } from "@/pages/azar";
import { alMediodia } from "@/pages/tiempo";
import { HOY, type Usuario } from "@/pages/usuarios";

/* Lo que le pasó a una cuenta: el dinero, las compras y lo que hizo la consola.
 *
 * Nada de esto se guarda. Sale de lo que la cuenta ya tiene —cuándo se dio de
 * alta, cuándo se la vio por última vez, en qué estado está, cuántos mensajes
 * frenó la moderación, qué tickets abrió— y de ahí se reparte, igual que las
 * series de los gráficos. Es la misma regla de siempre: guardar una lista además
 * de los hechos de los que sale es tener dos fuentes para lo mismo, y la primera
 * vez que alguien toque una, la ficha va a decir una cosa y la actividad otra.
 *
 * Las tres pestañas contestan tres preguntas distintas sobre la misma cuenta:
 *
 *   Transaction  qué se le cobró — cada renovación, cada compra, cada rechazo
 *   Purchases    qué tiene contratado — el plan, los extras, lo que venció
 *   Logs         qué le hizo la consola — quién la tocó, cuándo y por qué
 *
 * El día que esto venga de una API se borra el archivo: las pestañas piden
 * listas y de dónde salen no es asunto suyo.
 */

const DIA = 24 * 60 * 60 * 1000;

/* ─────────────────────────── Los productos ─────────────────────────── */

/** En qué estado está un producto en esta cuenta. */
export type EstadoDeProducto = "active" | "expired" | "refunded";

export interface Compra {
  /** La clave del producto en la tienda: `app.kiwi_product.chat.1699638583189`.
   *  Es del producto y no de la compra —dos cuentas con el mismo plan ven la
   *  misma clave—, que es lo que la hace servir para buscarlo. */
  id: string;
  nombre: string;
  /** Qué es, en una línea: lo que la tienda escribe debajo del nombre. */
  resumen: string;
  /** Si se paga todos los meses o se pagó una vez. Es un booleano y no la
   *  palabra: "Subscription" y "One-time" son cómo se escribe esto en inglés,
   *  y eso lo decide la pantalla. */
  suscripcion: boolean;
  centavos: number;
  estado: EstadoDeProducto;
  /** El último movimiento del producto en esta cuenta: la renovación de este
   *  mes, la baja, la compra. */
  cuando: string;
}

/* Lo que se vende adentro del chat. Es una residencia y no un shopping: lo que
   se compra son las capacidades de la app —mandar fotos, mandar voz, guardar
   más—, que es exactamente lo que las otras pantallas muestran usándose. */
const CATALOGO = [
  {
    nombre: "Premium Photo & Voice",
    resumen: "Unlimited chat service bundle",
    suscripcion: true,
    centavos: 499,
  },
  {
    nombre: "Messaging Plan",
    resumen: "Monthly message allowance",
    suscripcion: true,
    centavos: 695,
  },
  {
    nombre: "Extra Storage 50 GB",
    resumen: "Room for photos and voice notes",
    suscripcion: true,
    centavos: 299,
  },
  {
    nombre: "Translation Add-on",
    resumen: "Live translation in every chat",
    suscripcion: true,
    centavos: 199,
  },
  {
    nombre: "Voice Minutes Pack",
    resumen: "60 minutes of voice notes",
    suscripcion: false,
    centavos: 349,
  },
  {
    nombre: "Photo Book Print",
    resumen: "Printed album, mailed to the house",
    suscripcion: false,
    centavos: 1_800,
  },
  {
    nombre: "Sticker Pack — Seasons",
    resumen: "Seasonal sticker collection",
    suscripcion: false,
    centavos: 99,
  },
] as const;

/* La clave de un producto sale de su nombre y de nada más: es la misma en todas
   las cuentas, como en cualquier tienda. El número es el instante en que el
   producto se dio de alta, en milisegundos, que es la forma que tienen esas
   claves donde se las ve. */
const TIENDA = "app.kiwi_product.chat";
const ALTA_DEL_CATALOGO = Date.UTC(2023, 5, 1);

const claveDe = (nombre: string) =>
  `${TIENDA}.${
    ALTA_DEL_CATALOGO +
    Math.floor(azarDesde(semillaDe(`producto/${nombre}`))() * 600 * DIA)
  }`;

/** Qué productos tiene esta cuenta, del movimiento más nuevo al más viejo.
 *
 *  Cuántos, sale de cuán activa es —`last30`— y no de un número fijo: quien
 *  escribe todos los días termina pagando el plan y algún extra, y quien casi no
 *  aparece no tiene por qué tener la misma lista.
 *
 *  Y ninguno es más viejo que el alta de la cuenta: un producto comprado antes
 *  de que la cuenta existiera es una fecha que se contradice sola con la ficha. */
export function comprasDe(usuario: Usuario): Compra[] {
  const azar = azarDesde(semillaDe(`${usuario.id}/compras`));
  const visto = new Date(usuario.lastActivity).getTime();
  const alta = alMediodia(usuario.addedAt).getTime();
  const viva = usuario.status === "active";

  const cuantos = Math.max(
    1,
    Math.min(CATALOGO.length, 1 + Math.round(usuario.last30 / 20)),
  );

  return CATALOGO.map((p) => ({ p, orden: azar() }))
    .sort((a, b) => a.orden - b.orden)
    .slice(0, cuantos)
    .map(({ p }, i) => {
      /* Los dos dados se tiran siempre, se usen o no: sacarlos adentro de un
         `if` corre el resto de la serie según lo que salió antes, y entonces
         cambiar una regla acá le cambia las fechas a productos que no la tocan. */
      const sigue = azar() < 0.5;
      const devuelto = azar() < 0.15;

      /* Una suscripción vigente sólo la tiene una cuenta viva: la que se dio de
         baja dejó de renovar, y decir "Active" al lado de "Deactivated" en la
         misma pantalla es una de las dos mintiendo. Lo comprado de una vez no
         vence —queda comprado—, así que lo único que lo saca de vigente es que
         se lo hayan devuelto. */
      const vigente = p.suscripcion ? viva && sigue : !devuelto;

      /* Lo vigente que se renueva movió este mes; lo demás quedó atrás. */
      const dias =
        vigente && p.suscripcion
          ? Math.floor(azar() * 28)
          : 20 + Math.floor(azar() * 320);

      return {
        id: claveDe(p.nombre),
        nombre: p.nombre,
        resumen: p.resumen,
        suscripcion: p.suscripcion,
        centavos: p.centavos,
        estado: (devuelto && !p.suscripcion
          ? "refunded"
          : vigente
            ? "active"
            : "expired") as EstadoDeProducto,
        cuando: new Date(
          Math.max(alta, visto - (dias + i) * DIA),
        ).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime());
}

/* ─────────────────────────── El dinero ─────────────────────────── */

/** Cómo terminó el cobro. */
export type EstadoDeCobro = "approved" | "declined" | "refunded" | "pending";

/** Qué se intentó hacer con el producto. Es otro eje que el estado: "Renewed"
 *  dice qué se quiso cobrar y "Declined" cómo salió, y una renovación rechazada
 *  necesita las dos palabras para contarse. */
export type Movimiento = "Purchased" | "Renewed" | "Refunded";

/** Por dónde entró la plata. */
export type Fuente = "App Store" | "Play Store" | "Web";

export interface Transaccion {
  id: string;
  cuando: string;
  producto: string;
  resumen: string;
  fuente: Fuente;
  movimiento: Movimiento;
  /** En centavos. Entero y no decimal: `19.99 + 0.01` no da veinte, y una lista
   *  de importes que se suman termina mostrando el error de coma flotante en la
   *  pantalla. Lo formatea quien lo muestra. */
  centavos: number;
  estado: EstadoDeCobro;
}

/** Cuántos meses de renovaciones se listan. Seis: es el mismo tramo que miran
 *  los gráficos, así que las dos pantallas hablan del mismo período. */
const MESES = 6;

/* Por dónde paga esta cuenta. Una sola tienda por persona y no una por
   movimiento: nadie renueva la misma suscripción un mes por App Store y al
   siguiente por Google Play, y una columna que va cambiando de tienda se lee
   como un error de datos. */
const FUENTES: Fuente[] = ["App Store", "Play Store", "Web"];

function fuenteDe(usuario: Usuario): Fuente {
  const tirada = azarDesde(semillaDe(`${usuario.id}/tienda`))();
  /* La casa reparte teléfonos, así que las dos tiendas se llevan casi todo; la
     web es la excepción de quien pagó desde la computadora de la familia. */
  return tirada < 0.5 ? FUENTES[0] : tirada < 0.9 ? FUENTES[1] : FUENTES[2];
}

/** El libro de cobros de la cuenta, del movimiento más nuevo al más viejo.
 *
 *  Sale de los productos que la cuenta tiene y no de una lista aparte: cada
 *  renglón de acá es un movimiento de uno de los renglones de Purchases, así que
 *  las dos pestañas no pueden contar historias distintas. Una suscripción vencida
 *  termina en la renovación que salió mal, una vigente encadena sus renovaciones
 *  hacia atrás, y lo comprado de una vez tiene un solo movimiento: el día que se
 *  compró.
 *
 *  Nada se remonta más allá del alta de la cuenta. */
export function transaccionesDe(usuario: Usuario): Transaccion[] {
  const alta = alMediodia(usuario.addedAt).getTime();
  const fuente = fuenteDe(usuario);
  const filas: Transaccion[] = [];

  for (const producto of comprasDe(usuario)) {
    const azar = azarDesde(semillaDe(`${usuario.id}/${producto.id}/cobros`));
    const ultimo = new Date(producto.cuando).getTime();

    const anotar = (
      n: number,
      cuando: number,
      movimiento: Movimiento,
      estado: EstadoDeCobro,
    ) =>
      filas.push({
        id: `${usuario.id}/${producto.id}/${n}`,
        cuando: new Date(cuando).toISOString(),
        producto: producto.nombre,
        resumen: producto.resumen,
        fuente,
        movimiento,
        centavos: producto.centavos,
        estado,
      });

    /* Lo comprado de una vez: un renglón y se terminó. */
    if (!producto.suscripcion) {
      const devuelto = producto.estado === "refunded";
      anotar(0, ultimo, devuelto ? "Refunded" : "Purchased", devuelto ? "refunded" : "approved");
      continue;
    }

    for (let m = 0; m < MESES; m++) {
      const cuando = ultimo - m * 30 * DIA;
      if (cuando < alta) break;

      /* Si el mes anterior ya cae antes del alta, éste es el primero: no es una
         renovación, es la compra. */
      const primero = cuando - 30 * DIA < alta || m === MESES - 1;

      if (m === 0 && producto.estado === "expired") {
        /* La que la terminó. Una suscripción no vence sola: vence el día que el
           cobro no pasa, y ése es el renglón que hay que poder encontrar. */
        anotar(m, cuando, "Renewed", "declined");
        continue;
      }

      /* La última de una vigente puede estar todavía procesándose: es lo que le
         pasa a un cobro de hace unas horas, y es el único caso en que la columna
         de estado dice algo que va a cambiar solo. */
      const procesando = m === 0 && HOY.getTime() - cuando < 2 * DIA && azar() < 0.5;

      anotar(
        m,
        cuando,
        primero ? "Purchased" : "Renewed",
        procesando ? "pending" : "approved",
      );

      if (primero) break;
    }
  }

  return filas.sort(
    (a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime(),
  );
}

/* ─────────────────────────── Los registros ─────────────────────────── */

export interface Registro {
  id: string;
  cuando: string;
  /** Qué pasó, en una línea. */
  que: string;
  /** Quién lo hizo. `system` cuando no fue una persona. */
  quien: string;
  /** Si hace falta mirarlo. Lo que le cambia el estado a una cuenta y lo que la
   *  moderación frenó se marcan; el resto es el ruido normal de una consola. */
  atencion?: boolean;
  /** Sólo en los reseteos de contraseña: hasta cuándo sirve la temporal, y cuál
   *  es. Va junta y no en dos campos sueltos porque una sin la otra no es nada:
   *  una contraseña sin vencimiento no se puede evaluar, y un vencimiento sin
   *  contraseña no se puede usar. */
  reseteo?: { valida: string; temporal: string };
}

const OPERADORES = ["Marcela Vidal", "Néstor Ojeda", "Hugo Sarmiento"];

/** Cuánto vale una contraseña temporal. Un día: lo suficiente para que alguien
 *  la lea por teléfono y entre, y no tanto como para que quede dando vueltas. */
const VALIDEZ = DIA;

/* El alfabeto de las temporales: sin `l`, sin `o`, sin `0` ni `1`. Estas claves
   se dictan por teléfono a alguien que está por escribirlas, y las que se
   confunden al leerlas en voz alta son las que hacen falta dictar dos veces. */
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

const claveTemporal = (semilla: string) => {
  const azar = azarDesde(semillaDe(semilla));
  const grupo = () =>
    Array.from(
      { length: 4 },
      () => ALFABETO[Math.floor(azar() * ALFABETO.length)],
    ).join("");
  return `${grupo()}-${grupo()}`;
};

/** El registro administrativo de la cuenta, de lo último a lo primero.
 *
 *  Son las cosas que alguien *le hizo* a la cuenta: el alta, los reseteos de
 *  contraseña, los bloqueos, lo que frenó la moderación. No lo que la cuenta
 *  hizo —cuántos hilos tiene, cuántos correos pasaron—: eso ya lo dice la ficha
 *  de arriba y las analíticas, y repetirlo acá convierte el registro en un
 *  resumen y esconde entre resúmenes las tres líneas que hay que poder
 *  encontrar.
 *
 *  Casi todo se deriva de hechos que ya existen —el alta, el estado, la
 *  moderación—, así que el registro y el resto de la app no pueden
 *  contradecirse: si la ficha dice "Blocked", acá está la línea que lo dice. */
export function registrosDe(usuario: Usuario): Registro[] {
  const azar = azarDesde(semillaDe(`${usuario.id}/logs`));
  const operador = () => OPERADORES[Math.floor(azar() * OPERADORES.length)];
  const alta = alMediodia(usuario.addedAt).getTime();
  const visto = new Date(usuario.lastActivity).getTime();
  const filas: Registro[] = [];

  const agregar = (
    id: string,
    cuando: number,
    que: string,
    quien: string,
    atencion?: boolean,
    reseteo?: Registro["reseteo"],
  ) =>
    filas.push({
      id: `${usuario.id}/log/${id}`,
      cuando: new Date(cuando).toISOString(),
      que,
      quien,
      atencion,
      reseteo,
    });

  /* El alta: el primer renglón de cualquier cuenta. */
  agregar("alta", alta, "Account created", operador());
  agregar("buzon", alta + 2 * 60 * 60 * 1000, "Mailbox provisioned", operador());

  /* Los reseteos. Es una residencia: la contraseña olvidada y el llamado a la
     recepción son el trámite más común que hay, y son también el que deja un
     secreto escrito en la consola —por eso el renglón lo esconde hasta que
     alguien decide mirarlo—. */
  const reseteos = azar() < 0.45 ? 0 : azar() < 0.8 ? 1 : 2;
  for (let i = 0; i < reseteos; i++) {
    const cuando = alta + (0.2 + 0.65 * azar()) * (visto - alta);
    agregar(
      `clave/${i}`,
      cuando,
      "Password reset was requested for this account.",
      operador(),
      false,
      {
        valida: new Date(cuando + VALIDEZ).toISOString(),
        temporal: claveTemporal(`${usuario.id}/clave/${i}`),
      },
    );
  }

  /* Un bloqueo viejo, ya levantado. Lo hace y lo deshace la misma persona: la
     que bloquea de más a la tarde es la que desbloquea cuando el malentendido
     se aclara, y dos nombres distintos contarían otra historia. */
  if (azar() < 0.35) {
    const quien = operador();
    const cuando = alta + (0.5 + 0.3 * azar()) * (visto - alta);
    agregar("bloqueo/previo", cuando, "Account Blocked", quien, true);
    agregar(
      "desbloqueo/previo",
      cuando + (2 + Math.floor(azar() * 40)) * 60 * 60 * 1000,
      "Account Unblocked",
      quien,
    );
  }

  /* El estado de ahora, cuando no es el normal. La línea sale del estado que la
     cuenta tiene, así que no puede decir otra cosa que la ficha. */
  if (usuario.status !== "active") {
    agregar(
      "estado",
      visto + 6 * 60 * 60 * 1000,
      usuario.status === "blocked" ? "Account Blocked" : "Account Deactivated",
      operador(),
      true,
    );
  }

  /* La moderación. Un solo renglón con el total y no uno por mensaje: la lista
     de los mensajes frenados es la tabla de Messages Search, y repetirla acá en
     trescientas líneas la haría inútil en los dos lados. */
  if (usuario.blockedMessages > 0) {
    agregar(
      "moderacion",
      visto - 12 * 60 * 60 * 1000,
      `${usuario.blockedMessages.toLocaleString("en-US")} messages held by moderation`,
      "system",
      usuario.blockedMessages / Math.max(1, usuario.messages) >= 0.1,
    );
  }

  return filas.sort(
    (a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime(),
  );
}

/** Un importe como se lee. Los centavos se guardan enteros y se formatean acá,
 *  en un solo lugar: dos pestañas que escriban el mismo precio de dos maneras se
 *  leen como dos precios. */
const PLATA = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export const comoPlata = (centavos: number) => PLATA.format(centavos / 100);
