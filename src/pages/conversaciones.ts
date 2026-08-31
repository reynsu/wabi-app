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
  texto: string;
  /** ISO con hora: la burbuja muestra la hora y la lista, cuándo fue. */
  cuando: string;
}

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
  /** Cada mensaje con los minutos que pasaron desde el primero del hilo. */
  mensajes: { de: Lado; texto: string; min: number }[];
}

const PLANTILLAS: Plantilla[] = [
  {
    nombre: "Lucía",
    relacion: "Daughter",
    familia: true,
    sinLeer: 2,
    mensajes: [
      { de: "contacto", texto: "Hi! Did the pharmacy drop off the new box this morning?", min: 0 },
      { de: "cuenta", texto: "They did. The nurse left it on the shelf by the window.", min: 14 },
      { de: "contacto", texto: "Perfect. Same as last month — one in the morning, one after dinner.", min: 16 },
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
      { de: "contacto", texto: "Good morning — a package arrived for you. We're holding it at reception.", min: 0 },
      { de: "cuenta", texto: "Thank you. Is it big?", min: 22 },
      { de: "contacto", texto: "A shoebox, more or less. We can bring it up after lunch if that's easier.", min: 25 },
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
      { de: "cuenta", texto: "Wonderful. I'll ask the kitchen for a table by the garden.", min: 104 },
      { de: "contacto", texto: "She's been drawing you something all week. Won't let me see it.", min: 130 },
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
      { de: "contacto", texto: "It was in the wrong bin, sorry about that. It's back with the rest.", min: 26 },
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
      { de: "contacto", texto: "i'll bring him next time, he's tiny", min: 54 },
    ],
  },
  {
    nombre: "Dr. Iriarte",
    relacion: "Care team",
    familia: false,
    mensajes: [
      { de: "contacto", texto: "Reminder: your check-up is Tuesday at 9:30, ground floor.", min: 0 },
      { de: "cuenta", texto: "Noted. Should I skip breakfast?", min: 55 },
      { de: "contacto", texto: "No need this time — it's just blood pressure and a quick chat.", min: 71 },
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
      { de: "contacto", texto: "I'm scanning them, I'll send a few every week so it's not all at once.", min: 214 },
      { de: "cuenta", texto: "Start with the ones from the coast. Those are the ones I want.", min: 245 },
    ],
  },
  {
    nombre: "Elena",
    relacion: "Sister",
    familia: true,
    mensajes: [
      { de: "contacto", texto: "Happy birthday! 🎂 I called the front desk so they'd tell you first thing.", min: 0 },
      { de: "cuenta", texto: "They sang. All four of them. It was terrible and I loved it.", min: 33 },
      { de: "contacto", texto: "As it should be.", min: 40 },
      { de: "contacto", texto: "I'm coming Friday with the cake I promised last year.", min: 41 },
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
      mensajes: plantilla.mensajes.map((m, i) => ({
        id: `${usuario.id}/c${k}/m${i}`,
        de: m.de,
        texto: m.texto,
        cuando: new Date(finDelHilo - (largo - m.min) * MINUTO).toISOString(),
      })),
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
