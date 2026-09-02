import { formaDe, type Foto } from "@/pages/foto";
import { type Usuario } from "@/pages/usuarios";

/* Las conversaciones de una cuenta: el fixture del que sale la sección
   Conversations del perfil.

   Vive aparte de `usuarios.ts` porque no es un atributo de la cuenta: una
   conversación es entre dos, y el día que venga de una API va a venir de otro
   lado —paginada, y no adentro del usuario—. Lo que sí se hace acá es lo que
   evita que dos cosas se contradigan: **cuántas conversaciones tiene una cuenta
   es cuántas hay en esta lista**, y no un número guardado en el modelo. */

/** De qué lado del hilo está un mensaje. `cuenta` es el usuario del perfil. */
export type Lado = "cuenta" | "contacto";

export interface Mensaje {
  id: string;
  de: Lado;
  /** Lo que dice. En una nota de voz es su transcripción, y no un renglón de
   *  relleno: esta consola existe para poder buscar qué se dijo, y una nota
   *  que la búsqueda no encuentra es un agujero del tamaño de todo lo que se
   *  dijo hablando. La transcripción es la que se busca; la onda es la que se
   *  escucha. */
  texto: string;
  /** ISO con hora: la burbuja muestra la hora y la lista, cuándo fue. */
  cuando: string;
  /** Presente sólo si el mensaje es una nota de voz. Que exista es lo que lo
   *  distingue de uno de texto —no hay un campo `tipo` al lado que pueda
   *  quedar diciendo otra cosa—, y lo que trae es lo que hace falta para
   *  dibujarla antes de escucharla. */
  voz?: NotaDeVoz;
  /** Presente sólo si el mensaje lleva una foto. Nunca junto con `voz`: un
   *  mensaje es una cosa, y el reparto de más abajo los hace excluyentes por
   *  construcción. Cuando está, `texto` es el pie de la foto. */
  foto?: Foto;
}

/** Una nota de voz. Por ahora sólo cuánto dura: el audio lo fabrica el
 *  fixture a partir del id del mensaje —ver `nota-de-voz.ts`—. El día que
 *  venga de una API, acá se agrega su URL y esa es toda la diferencia. */
export interface NotaDeVoz {
  segundos: number;
}

/** Si el mensaje es una nota de voz, y si lleva una foto. Se preguntan acá y no
 *  con un `!== undefined` repartido por tres pantallas: el día que una nota o
 *  una foto traigan algo más, la pregunta sigue siendo una sola. */
export const esNota = (m: Mensaje) => m.voz !== undefined;

/** Si el mensaje lleva una foto. */
export const esFoto = (m: Mensaje) => m.foto !== undefined;

export interface Conversacion {
  id: string;
  /** Con quién habla la cuenta. */
  contacto: string;
  /** Qué es esa persona de la cuenta: hija, sobrino, recepción. Va debajo del
   *  nombre en la cabecera del hilo, no en la lista: en la lista ese renglón
   *  es del último mensaje, que es lo que hace falta para elegir cuál abrir. */
  relacion: string;
  /** Sin leer del lado de la cuenta. Cero es lo normal; el badge sólo aparece
   *  cuando hay algo. */
  sinLeer: number;
  /** Si este hilo está cortado: no entra ni sale nada por él.
   *
   *  Hoy sale del estado de la cuenta —una cuenta bloqueada no está recibiendo
   *  nada, y eso vale para todos sus hilos por igual—, que es la misma regla
   *  con la que se apaga `sinLeer` dos líneas más abajo. Deriva y no se escribe
   *  en la plantilla: marcar un hilo suelto como bloqueado sería inventarle a
   *  esta casa una historia que no tiene, y un fixture que cuenta algo que
   *  nadie escribió se nota.
   *
   *  Existe como campo del hilo y no se lee de `usuario.status` en la pantalla
   *  porque son dos hechos que van a separarse: cortarle la comunicación a una
   *  residente entera no es lo mismo que cortarle **un** contacto —el sobrino
   *  que pide plata— y es lo segundo lo que el menú del hilo va a hacer. El día
   *  que eso se escriba, cambia de dónde sale este booleano y nada más.
   *
   *  Por ahora sólo decide qué dice ese menú, "Block" o "Unblock": nada lo
   *  cambia todavía. Ver la nota al pie de `UserConversations`. */
  bloqueada: boolean;
  /** Del más viejo al más nuevo, que es el orden en que se leen. */
  mensajes: Mensaje[];
}

/* ─────────────────────────── Las plantillas ───────────────────────────

   Ocho hilos escritos a mano. No se generan: un texto armado con piezas
   sueltas se nota enseguida —todas las frases tienen el mismo largo y ninguna
   contesta a la anterior—, y lo que esta pantalla tiene que probar es
   justamente cómo se lee una conversación de verdad, con mensajes de un
   renglón y de cinco.

   Lo que sí se reparte es cuáles le tocan a cada cuenta: ocho hilos por
   cuarenta y ocho usuarios daría lo mismo escrito cuarenta y ocho veces. */

interface Plantilla {
  /** El nombre de pila del contacto. El apellido lo pone la cuenta cuando es
   *  de la familia: la hija de Camila Ferreyra se apellida Ferreyra, y eso es
   *  la mitad de lo que hace que el fixture no se sienta armado. */
  nombre: string;
  relacion: string;
  familia: boolean;
  /** Sin leer, si a esta conversación le tocan. Sólo se aplica a la más
   *  reciente y sólo si la cuenta está activa: una cuenta bloqueada no está
   *  recibiendo nada. */
  sinLeer?: number;
  /** Cada mensaje con los minutos que pasaron desde el primero del hilo.
   *
   *  `voz` es ese mismo mensaje **dicho en voz alta**. Cuando el reparto elige
   *  que esta línea se mandó hablando, es el texto que va: la transcripción de
   *  la nota. Ver el comentario de las notas de voz más abajo. */
  mensajes: { de: Lado; texto: string; min: number; voz?: string }[];
}

const PLANTILLAS: Plantilla[] = [
  {
    nombre: "Lucía",
    relacion: "Daughter",
    familia: true,
    sinLeer: 2,
    mensajes: [
      { de: "contacto", texto: "Hi! Did the pharmacy drop off the new box this morning?", voz: "Hi mum, sorry, I know it's early. I just wanted to check whether the pharmacy came by this morning with the new box, because they told me Tuesday and then they said Wednesday, and I never know with them. If it didn't arrive, don't worry about it, I'll call them myself — I just don't want you running out over the weekend.", min: 0 },
      { de: "cuenta", texto: "They did. The nurse left it on the shelf by the window.", voz: "Yes, it came. The nurse brought it up while I was having breakfast and she left it on the shelf by the window, next to the little plant. It's the same box as always, the white one with the blue lid. So don't call anybody, everything is where it should be.", min: 14 },
      { de: "contacto", texto: "Perfect. Same as last month — one in the morning, one after dinner.", voz: "Perfect, then it's the same as last month — one in the morning with breakfast and one after dinner, and nothing in between. Don't change anything on your own if you feel fine, and if something feels off, tell the nurse first and then tell me, in that order.", min: 16 },
      { de: "cuenta", texto: "I wrote it on the little card so I don't forget.", min: 41 },
      { de: "contacto", texto: "You're better at this than I am 😄", min: 43 },
      { de: "contacto", texto: "I'll call you Thursday to check.", min: 44 },
    ],
  },
  {
    nombre: "Front Desk",
    relacion: "Facility staff",
    familia: false,
    mensajes: [
      { de: "contacto", texto: "Good morning — a package arrived for you. We're holding it at reception.", voz: "Good morning, this is reception. A package arrived for you a few minutes ago, it came with the regular courier, and we're holding it down here for you. Whenever you want to come and get it we're open until seven, and if you'd rather we bring it up, just let us know and someone will take it over.", min: 0 },
      { de: "cuenta", texto: "Thank you. Is it big?", min: 22 },
      { de: "contacto", texto: "A shoebox, more or less. We can bring it up after lunch if that's easier.", voz: "It's about the size of a shoebox, so nothing heavy, and it doesn't say what's inside — just your name and the room number. If it's easier for you, we can bring it up after lunch, around two, when someone is going that way anyway. Otherwise it stays here and there's no rush at all.", min: 25 },
      { de: "cuenta", texto: "Yes please, that would be lovely.", min: 31 },
    ],
  },
  {
    nombre: "Mateo",
    relacion: "Son",
    familia: true,
    sinLeer: 1,
    mensajes: [
      { de: "cuenta", texto: "Are you still coming on Sunday?", min: 0 },
      { de: "contacto", texto: "Yes! We'll be there around eleven. Sofi is coming too.", min: 96 },
      { de: "cuenta", texto: "Wonderful. I'll ask the kitchen for a table by the garden.", voz: "That's wonderful, I'm so glad. I'll go down later and ask the kitchen to put us at a table by the garden, the one under the big window, because at that hour the light is lovely and it's quieter than the middle of the room. If they can't, we'll manage, but I'll ask.", min: 104 },
      { de: "contacto", texto: "She's been drawing you something all week. Won't let me see it.", voz: "So I have to tell you — she's been drawing you something all week. Every afternoon after school she sits at the kitchen table with the coloured pencils and she won't let anybody look, not even me. She keeps covering it with her arm. I have no idea what it is, but it's taken her four days, so prepare yourself.", min: 130 },
      { de: "cuenta", texto: "Now I'm curious.", min: 138 },
    ],
  },
  {
    nombre: "Housekeeping",
    relacion: "Facility staff",
    familia: false,
    mensajes: [
      { de: "contacto", texto: "Your laundry is back — we left it folded in the closet.", min: 0 },
      { de: "cuenta", texto: "The blue cardigan too? I couldn't find it last week.", min: 18 },
      { de: "contacto", texto: "It was in the wrong bin, sorry about that. It's back with the rest.", voz: "We found the blue cardigan — it had gone into the wrong bin on Monday, which is why it wasn't with the rest of your things. Sorry about that, it happens now and then when two rooms come down together. It's washed and folded and it's back in the closet with everything else.", min: 26 },
    ],
  },
  {
    nombre: "Valentina",
    relacion: "Granddaughter",
    familia: true,
    sinLeer: 3,
    mensajes: [
      { de: "contacto", texto: "grandma look 🐶", min: 0 },
      { de: "contacto", texto: "we got a puppy!!! his name is Tomás", min: 1 },
      { de: "cuenta", texto: "Tomás! Like your grandfather.", min: 47 },
      { de: "contacto", texto: "mom said the same thing hahaha", min: 52 },
      { de: "contacto", texto: "i'll bring him next time, he's tiny", voz: "okay so i'm bringing him next time, i already asked mom and she said yes if he stays in the carrier. he's so tiny grandma, he fits in like one hand, and he sleeps basically all day and then at night he decides it's time to run. anyway i think you're going to love him. see you saturday!", min: 54 },
    ],
  },
  {
    nombre: "Dr. Iriarte",
    relacion: "Care team",
    familia: false,
    mensajes: [
      { de: "contacto", texto: "Reminder: your check-up is Tuesday at 9:30, ground floor.", voz: "Good afternoon, this is a reminder from the care team about your check-up on Tuesday at half past nine, on the ground floor, in the room at the end of the corridor. There's nothing you need to bring and nothing you need to prepare. If Tuesday doesn't work for you, call us and we'll move it, it's not a problem.", min: 0 },
      { de: "cuenta", texto: "Noted. Should I skip breakfast?", min: 55 },
      { de: "contacto", texto: "No need this time — it's just blood pressure and a quick chat.", voz: "No, no need to skip breakfast this time. Have whatever you normally have. It's just blood pressure, we'll listen to your chest, and then we sit down for ten minutes and talk about how you've been sleeping. Nothing that needs you fasting, I promise. The bloodwork is the one in November.", min: 71 },
      { de: "cuenta", texto: "Good, because I wasn't going to.", min: 78 },
    ],
  },
  {
    nombre: "Ramiro",
    relacion: "Nephew",
    familia: true,
    mensajes: [
      { de: "cuenta", texto: "Did you find the photos from the trip?", min: 0 },
      { de: "contacto", texto: "Found them! The whole box was under the stairs.", min: 210 },
      { de: "contacto", texto: "I'm scanning them, I'll send a few every week so it's not all at once.", voz: "So I've started scanning them. There are more than I thought, something like two hundred, and a lot of them are stuck together, so it's slow. My plan is to send you a few every week instead of dumping all of them at once, because otherwise you look at forty photos in one sitting and you don't really see any of them.", min: 214 },
      { de: "cuenta", texto: "Start with the ones from the coast. Those are the ones I want.", min: 245 },
    ],
  },
  {
    nombre: "Elena",
    relacion: "Sister",
    familia: true,
    mensajes: [
      { de: "contacto", texto: "Happy birthday! 🎂 I called the front desk so they'd tell you first thing.", min: 0 },
      { de: "cuenta", texto: "They sang. All four of them. It was terrible and I loved it.", voz: "You won't believe what happened. They came up at eight in the morning, all four of them, and they sang — the whole song, in the doorway, completely out of tune, and one of them was holding a little cake with a candle in it. It was genuinely terrible and I have not stopped smiling since.", min: 33 },
      { de: "contacto", texto: "As it should be.", min: 40 },
      { de: "contacto", texto: "I'm coming Friday with the cake I promised last year.", voz: "I'm coming on Friday and I'm bringing the cake I promised you last year, so don't let anybody else bring one. I've already bought the walnuts. I'll be there in the afternoon, probably around four, and I can stay for dinner if they let me. Tell me if there's anything you want me to pick up on the way.", min: 41 },
      { de: "cuenta", texto: "I have not forgotten.", min: 62 },
    ],
  },
];

/* Cuántas conversaciones tiene cada cuenta y cuáles: sale del número del id,
   así que es el mismo reparto en cada pintada y en cada recarga. Entre dos y
   cinco — la lista tiene que poder verse llena y verse corta. */
const numeroDe = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Cuánto separa a una conversación de la siguiente en el tiempo. Un poco
 *  menos de un día, para que la lista caiga sobre fechas distintas y el hilo
 *  tenga separadores de día de verdad. */
const PASO_ENTRE_HILOS = 19 * 60 * 60 * 1000;

const MINUTO = 60 * 1000;

/* ─────────────────────────── Las notas de voz ───────────────────────────

   Cuáles de los mensajes se mandaron hablando. Como todo el reparto de este
   archivo, sale de los números que ya hay —el de la cuenta, el de la
   conversación, el del mensaje— y no de un `Math.random()`: la misma nota tiene
   que ser una nota en cada recarga, porque su audio se fabrica a partir de su
   id y una nota que aparece y desaparece se llevaría su onda con ella.

   Qué puede ser cada línea está escrito en la plantilla, no medido:

   - **Nota de voz, la que tiene `voz`.** Y ahí está lo importante: la
     transcripción **no es el mensaje escrito**, es otro texto, escrito aparte y
     a mano. Una nota de voz de veinte segundos no dice "Wonderful, I'll ask the
     kitchen for a table by the garden" —eso se tipea en cuatro segundos—: dice
     lo mismo hablando, que son cuatro renglones, con la frase que arranca de
     nuevo a la mitad y el detalle que a nadie se le ocurriría escribir. Usar el
     mensaje corto como transcripción daba notas de cuatro segundos y una
     tarjeta con un renglón adentro, que es exactamente lo que una transcripción
     no parece.

   - **Foto, la corta que no tiene `voz`.** Un pie de foto es corto —"grandma
     look 🐶"— porque la foto ya dijo el resto. Un párrafo de cinco renglones
     debajo de una imagen es un mensaje que no necesitaba la imagen.

   Las dos preguntas se hacen en orden y la primera gana, así que ninguna línea
   puede ser las dos cosas. */
const LARGO_MINIMO = 34;

const esHablado = (
  m: { texto: string; voz?: string },
  cuenta: number,
  hilo: number,
  i: number,
) => m.voz !== undefined && (cuenta + hilo * 3 + i * 7) % 3 === 0;

const esFotografiado = (
  m: { texto: string; voz?: string },
  cuenta: number,
  hilo: number,
  i: number,
) => m.texto.length < LARGO_MINIMO && (cuenta + hilo * 3 + i * 7) % 3 === 0;

/** Cuánto dura decir eso en voz alta. Sale de las palabras de la transcripción,
 *  así que la duración y el texto no pueden contradecirse: una nota que dice
 *  cuatro renglones no puede durar cuatro segundos.
 *
 *  Dos palabras y media por segundo es el ritmo de alguien hablando tranquilo,
 *  y el segundo que se suma es el que se va en arrancar y en cortar.
 *
 *  El techo son treinta segundos, que es para lo que están escritas las
 *  transcripciones: más que eso deja de ser una nota de voz y pasa a ser un
 *  audio, que se escucha de otra manera y se muestra de otra manera. El piso son
 *  tres, para que la onda tenga de dónde dibujarse. */
const PALABRAS_POR_SEGUNDO = 2.5;
const MAXIMO_SEGUNDOS = 30;

const duracionDe = (texto: string, jitter: number) => {
  const palabras = texto.trim().split(/\s+/).length;
  const bruto =
    Math.round(palabras / PALABRAS_POR_SEGUNDO + 1) + (jitter % 3);
  return Math.min(MAXIMO_SEGUNDOS, Math.max(3, bruto));
};

function construir(usuario: Usuario): Conversacion[] {
  const n = numeroDe(usuario.id);
  const cuantas = 2 + (n % 4);
  const desde = n % PLANTILLAS.length;
  const apellido = usuario.name.split(" ").slice(-1)[0];
  /* El hilo más reciente termina cuando se vio a la cuenta por última vez: es
     el mismo hecho que la columna "Last Activity" de la tabla, y si no
     coincidieran una de las dos estaría mintiendo. */
  const ultimaActividad = new Date(usuario.lastActivity).getTime();

  return Array.from({ length: cuantas }, (_, k) => {
    const plantilla = PLANTILLAS[(desde + k) % PLANTILLAS.length];
    const finDelHilo = ultimaActividad - k * PASO_ENTRE_HILOS;
    const largo = plantilla.mensajes[plantilla.mensajes.length - 1].min;

    return {
      id: `${usuario.id}/c${k}`,
      contacto: plantilla.familia
        ? `${plantilla.nombre} ${apellido}`
        : plantilla.nombre,
      relacion: plantilla.relacion,
      /* Sin leer sólo en la más reciente, y sólo si la cuenta está activa: una
         bloqueada no está recibiendo nada, y un badge sobre una cuenta apagada
         dice que algo la está esperando cuando no es cierto. */
      sinLeer:
        k === 0 && usuario.status === "active" ? plantilla.sinLeer ?? 0 : 0,
      bloqueada: usuario.status === "blocked",
      mensajes: plantilla.mensajes.map((m, i) => {
        const hablado = esHablado(m, n, k, i);
        /* La foto sólo si no es nota: las dos preguntas en orden y la primera
           gana, que es lo que las hace excluyentes sin un chequeo aparte. */
        const fotografiado = !hablado && esFotografiado(m, n, k, i);
        /* Hablado, el mensaje **es** su transcripción: el texto largo es lo que
           se dijo, y es lo que la búsqueda encuentra y lo que la tarjeta
           muestra. El corto de la plantilla es la versión escrita de la misma
           idea, y no se usa. */
        const texto = hablado ? m.voz! : m.texto;

        return {
          id: `${usuario.id}/c${k}/m${i}`,
          de: m.de,
          texto,
          cuando: new Date(finDelHilo - (largo - m.min) * MINUTO).toISOString(),
          /* La duración y la forma se calculan acá, una vez, y viajan en el
             modelo: si las sacara cada pantalla por su cuenta, dos de ellas
             terminarían mostrando dos duraciones para la misma nota, o
             reservando dos huecos distintos para la misma foto. */
          ...(hablado ? { voz: { segundos: duracionDe(texto, n + i) } } : {}),
          ...(fotografiado
            ? { foto: formaDe(`${usuario.id}/c${k}/m${i}`) }
            : {}),
        };
      }),
    };
  });
}

/* Construido una vez por cuenta y guardado. No es por velocidad: es para que
   los objetos no cambien de identidad entre pintadas — la sección guarda cuál
   conversación está abierta, y una lista nueva en cada render la perdería. */
const memoria = new Map<string, Conversacion[]>();

export function conversacionesDe(usuario: Usuario): Conversacion[] {
  const guardada = memoria.get(usuario.id);
  if (guardada) return guardada;
  const armadas = construir(usuario);
  memoria.set(usuario.id, armadas);
  return armadas;
}

/** El último mensaje del hilo: es lo que la lista muestra como vistazo y lo
 *  que la ordena. */
export const ultimo = (c: Conversacion) => c.mensajes[c.mensajes.length - 1];
