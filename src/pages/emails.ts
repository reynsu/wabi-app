import { Inbox, PencilLine, Send, ShieldAlert } from "lucide-react";

import type { BadgeColor } from "@/components/ui/badge";
import type { IconComponent } from "@/lib/icon-context";
import { type Usuario } from "@/pages/usuarios";

/* Los correos de una cuenta: el fixture de la sección Emails del perfil.

   Mismo trato que `conversaciones.ts` —escritos a mano, repartidos por el
   número del id, y **cuántos tiene una cuenta es cuántos hay en esta lista**—,
   pero el modelo no es el mismo y no se lo fuerza a serlo. Un correo no es un
   hilo de burbujas: tiene asunto, tiene una dirección de la que vino, se lee
   entero de una vez y a veces trae algo colgado. Meterlo en la forma del chat
   habría hecho que las dos secciones se vieran iguales cuando no lo son. */

/** En qué carpeta está. Es el dato que se guarda; de qué lado salió el correo
 *  se deduce de acá —lo escribió la cuenta si está en `sent` o en `draft`— y
 *  no se guarda aparte: son el mismo hecho, y con los dos guardados el primer
 *  correo que cambie de carpeta los deja contradiciéndose.
 *
 *  El orden es el que tienen en la lista, y es el de siempre: primero lo que
 *  llegó, después lo que salió, después lo que no salió, y último lo que no
 *  debería haber llegado. */
export const CARPETAS = {
  inbox: { label: "Inbox", icon: Inbox },
  sent: { label: "Sent", icon: Send },
  draft: { label: "Draft", icon: PencilLine },
  spam: { label: "Spam", icon: ShieldAlert },
} as const satisfies Record<string, { label: string; icon: IconComponent }>;

export type Carpeta = keyof typeof CARPETAS;

export const ORDEN_CARPETAS = Object.keys(CARPETAS) as Carpeta[];

/** Quién lo escribió. Se deriva de la carpeta. */
export const loEscribioLaCuenta = (carpeta: Carpeta) =>
  carpeta === "sent" || carpeta === "draft";

/** De qué es el correo. Casi todo es `standard` —el correo de todos los días,
 *  el que no hay que marcar—; `legal` es lo que va o viene de un estudio, y se
 *  marca porque se trata distinto: se archiva, se cita y no se borra.
 *
 *  El tipo va con su color acá y no en la pantalla que lo pinta, por lo mismo
 *  que los estados de una cuenta: la etiqueta que se lee y el color con el que
 *  se la distingue son dos vistas del mismo dato. `standard` no tiene color
 *  porque no se pinta: lo normal no lleva insignia. */
export const TIPOS_EMAIL = {
  standard: { label: "Standard" },
  legal: { label: "Legal", tinte: "#8b5cf6", color: "violet" },
} as const satisfies Record<
  string,
  { label: string; tinte?: string; color?: BadgeColor }
>;

export type TipoEmail = keyof typeof TIPOS_EMAIL;

export const ORDEN_TIPOS = Object.keys(TIPOS_EMAIL) as TipoEmail[];

/** Qué pasó cuando se lo quiso entregar. No es un campo del modelo: es cómo se
 *  lee el `rechazado` de un correo —dos palabras para un booleano—, y vive acá
 *  para que la etiqueta y el color sean los mismos en la tabla y en el panel
 *  que filtra por ellos. */
export const ENTREGAS = {
  delivered: { label: "Delivered", tinte: "#22c55e", color: "green" },
  rejected: { label: "Rejected", tinte: "#f43f5e", color: "rose" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

export type Entrega = keyof typeof ENTREGAS;

export const ORDEN_ENTREGAS = Object.keys(ENTREGAS) as Entrega[];

export interface Adjunto {
  nombre: string;
  /** Ya escrito: nadie guarda bytes para mostrar "1.2 MB" y volver a
   *  calcularlo cada vez que se pinta una fila. */
  tamano: string;
}

export interface Email {
  id: string;
  carpeta: Carpeta;
  /** Con quién es el correo: el que lo mandó, o al que se lo mandaron. */
  contacto: string;
  direccion: string;
  asunto: string;
  /** El cuerpo en párrafos y no en un string con saltos: el que lo muestra
   *  decide cuánto aire va entre uno y otro, y no un `\n` metido en el dato. */
  cuerpo: string[];
  cuando: string;
  /** Sin abrir. Sólo puede estarlo uno que entró: los que mandó la cuenta se
   *  leyeron al escribirlos. */
  leido: boolean;
  tipo: TipoEmail;
  /** La moderación lo frenó: el correo existe, se lo ve entero en la consola, y
   *  no llegó a destino. Es un hecho aparte del tipo y de la carpeta —un legal
   *  puede rebotar y uno cualquiera también—, así que se guarda aparte. */
  rechazado: boolean;
  adjuntos: Adjunto[];
}

/* ─────────────────────────── Las plantillas ─────────────────────────── */

interface Plantilla {
  carpeta: Carpeta;
  nombre: string;
  /** La parte de la izquierda de la dirección. La de la derecha sale de
   *  `familia` —la gente de su gente escribe desde un correo cualquiera— o de
   *  `dominio`, para el de afuera que no es ni la casa ni la familia. */
  buzon: string;
  familia: boolean;
  /** El dominio de quien escribe, cuando no es el de la residencia: un estudio
   *  de abogados, o el lugar de donde sea que venga el spam. Sin esto, la
   *  dirección es del dominio de la casa. */
  dominio?: string;
  asunto: string;
  cuerpo: string[];
  /** Sin valor, `standard`: lo normal no se declara en cada plantilla. */
  tipo?: TipoEmail;
  /** Sin valor, salió: lo que se frena es la excepción. */
  rechazado?: boolean;
  adjuntos?: Adjunto[];
}

const DOMINIO_CASA = "wabihouse.example";

const PLANTILLAS: Plantilla[] = [
  {
    carpeta: "inbox",
    nombre: "Billing",
    buzon: "billing",
    familia: false,
    asunto: "Your August statement is ready",
    cuerpo: [
      "Hello,",
      "Your statement for August is attached. The balance is unchanged from last month, and the small credit from the July adjustment has been applied.",
      "If anything looks off, reply to this message and we'll take a look before the next cycle closes.",
      "— Billing, Wabi House",
    ],
    adjuntos: [{ nombre: "statement-august.pdf", tamano: "84 KB" }],
  },
  {
    carpeta: "inbox",
    nombre: "Lucía",
    buzon: "lucia",
    familia: true,
    asunto: "Photos from Sunday",
    cuerpo: [
      "Hi mum,",
      "Here are the ones that came out well. The one of you and Sofi by the window is my favourite — I'm getting it printed for the hallway.",
      "I'll bring the rest on a USB stick next time so you can look at them on the big screen.",
      "Love you.",
    ],
    adjuntos: [
      { nombre: "sunday-01.jpg", tamano: "2.1 MB" },
      { nombre: "sunday-02.jpg", tamano: "1.8 MB" },
    ],
  },
  {
    carpeta: "sent",
    nombre: "Front Desk",
    buzon: "reception",
    familia: false,
    asunto: "Re: Visitor parking on Saturday",
    cuerpo: [
      "Good afternoon,",
      "Two cars, both arriving around eleven. They'll be gone by four.",
      "Thank you for arranging it.",
    ],
  },
  {
    carpeta: "inbox",
    nombre: "Care Team",
    buzon: "care",
    familia: false,
    asunto: "Care plan review — next steps",
    cuerpo: [
      "Good morning,",
      "Following Tuesday's review, we've made two small changes to the plan: the afternoon walk moves to 4pm, and the physiotherapy session goes from weekly to fortnightly.",
      "Nothing else changes. The updated plan is attached for your records.",
    ],
    adjuntos: [{ nombre: "care-plan-rev4.pdf", tamano: "162 KB" }],
  },
  {
    carpeta: "inbox",
    nombre: "Maintenance",
    buzon: "maintenance",
    familia: false,
    asunto: "Water shut-off, Thursday morning",
    cuerpo: [
      "Notice for all residents in the east wing.",
      "Water will be off between 9am and noon on Thursday while the riser is replaced. Kettles will be filled in the common room beforehand.",
      "We're sorry for the disruption.",
    ],
  },
  {
    /* Un borrador: lo escribió la cuenta y no salió. Cortado a la mitad a
       propósito — así es como se ve un borrador de verdad, y una sección que
       los muestra terminados no está mostrando borradores. */
    carpeta: "draft",
    nombre: "Activities",
    buzon: "activities",
    familia: false,
    asunto: "Re: September calendar",
    cuerpo: [
      "Hello,",
      "I'd like to sign up for the Thursday reading group. Also, about the garden session on Mondays — is it",
    ],
  },
  {
    /* Lo que no debería haber llegado. Va con el nombre y la dirección que
       trae, sin arreglar: media pantalla de un correo de estos es justamente
       la dirección que no se parece a ninguna de las otras. Y no llegó: el
       filtro lo frenó, que es lo que lo dejó en esta carpeta. */
    carpeta: "spam",
    nombre: "Prize Department",
    buzon: "claims",
    familia: false,
    dominio: "rewards-center-intl.example",
    rechazado: true,
    asunto: "CONGRATULATIONS — your reward is waiting",
    cuerpo: [
      "Dear Valued Resident,",
      "You have been selected in our monthly draw. To release your reward, confirm your details within 48 hours by replying to this message.",
      "Congratulations once again!",
    ],
  },
  {
    carpeta: "sent",
    nombre: "Ramiro",
    buzon: "ramiro",
    familia: true,
    asunto: "The box under the stairs",
    cuerpo: [
      "Found it?",
      "If the coast ones are in there, start with those. The rest can wait.",
      "Don't throw anything out without asking me first.",
    ],
  },
  {
    carpeta: "inbox",
    nombre: "Pharmacy",
    buzon: "pharmacy",
    familia: false,
    asunto: "Prescription ready for collection",
    cuerpo: [
      "Your repeat prescription is ready and has been sent to the facility's front desk.",
      "No changes to the dosage this cycle.",
    ],
  },
  {
    carpeta: "inbox",
    nombre: "Activities",
    buzon: "activities",
    familia: false,
    asunto: "September calendar",
    cuerpo: [
      "Hello everyone,",
      "The September calendar is attached. New this month: a Thursday reading group at 5pm and a second garden session on Mondays, since the first one filled up.",
      "Sign-up sheets are by the lift.",
    ],
    adjuntos: [{ nombre: "september.pdf", tamano: "310 KB" }],
  },
  {
    /* Correspondencia legal que entra. No es de la casa ni de la familia: viene
       del estudio, con su dominio, y por eso el correo va marcado. */
    carpeta: "inbox",
    nombre: "Ferrán & Sosa",
    buzon: "notificaciones",
    familia: false,
    dominio: "ferran-sosa.example",
    tipo: "legal",
    asunto: "Power of attorney — signed copy enclosed",
    cuerpo: [
      "Good morning,",
      "The signed power of attorney is attached, together with the schedule of assets referred to in clause four.",
      "Please confirm receipt. The original stays in our file.",
    ],
    adjuntos: [
      { nombre: "power-of-attorney-signed.pdf", tamano: "412 KB" },
      { nombre: "schedule-of-assets.pdf", tamano: "128 KB" },
    ],
  },
  {
    /* La contestación de la cuenta al estudio: sigue siendo legal, y sale. Que
       el tipo no dependa de la carpeta es justamente el punto. */
    carpeta: "sent",
    nombre: "Ferrán & Sosa",
    buzon: "notificaciones",
    familia: false,
    dominio: "ferran-sosa.example",
    tipo: "legal",
    asunto: "Re: Estate paperwork — pages three and four",
    cuerpo: [
      "Good afternoon,",
      "Attached are the two pages you asked for, signed and dated.",
      "I'd rather go over clause seven in person before signing anything else.",
    ],
    adjuntos: [{ nombre: "pages-3-4-signed.pdf", tamano: "96 KB" }],
  },
  {
    /* Lo que la moderación frenó de este lado: salió de la cuenta, y no llegó.
       Es el caso que justifica la consola —un residente escribiendo el número
       de una tarjeta— y por eso está en el fixture. */
    carpeta: "sent",
    nombre: "Ramiro",
    buzon: "ramiro",
    familia: true,
    rechazado: true,
    asunto: "The card number for the deposit",
    cuerpo: [
      "It's the blue one, in the drawer by the bed.",
      "I'm writing the number here so you don't have to come all the way over for it.",
    ],
  },
];

const numeroDe = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Cuánto separa un correo del siguiente. Más de medio día, para que la lista
 *  caiga sobre fechas distintas y no sean ocho renglones del mismo martes. */
const PASO = 14 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

function construir(usuario: Usuario): Email[] {
  const n = numeroDe(usuario.id);
  const cuantos = 3 + (n % 5);
  const desde = n % PLANTILLAS.length;
  const apellido = usuario.name.split(" ").slice(-1)[0].toLowerCase();
  /* El más reciente llega un rato antes de la última vez que se vio a la
     cuenta: un correo que entró después de la última actividad es un correo
     que nadie abrió todavía, y eso ya lo dice `leido`. */
  const masReciente = new Date(usuario.lastActivity).getTime() - 2 * HORA_MS;

  return Array.from({ length: cuantos }, (_, k) => {
    const plantilla = PLANTILLAS[(desde + k) % PLANTILLAS.length];
    const familia = plantilla.familia;

    return {
      id: `${usuario.id}/e${k}`,
      carpeta: plantilla.carpeta,
      contacto: familia
        ? `${plantilla.nombre} ${usuario.name.split(" ").slice(-1)[0]}`
        : plantilla.nombre,
      /* La dirección: la familia escribe desde un correo cualquiera, la
         residencia desde el suyo, y el de afuera desde el dominio que declare
         su plantilla —el estudio de abogados, o donde sea que venga el spam,
         que es medio mensaje en sí mismo—. */
      direccion: familia
        ? `${plantilla.buzon}.${apellido}@example.com`
        : `${plantilla.buzon}@${plantilla.dominio ?? DOMINIO_CASA}`,
      asunto: plantilla.asunto,
      cuerpo: plantilla.cuerpo,
      cuando: new Date(masReciente - k * PASO).toISOString(),
      /* Sin abrir sólo los dos primeros que entraron, y sólo si la cuenta
         está activa: lo que escribió la cuenta se leyó al escribirlo —de ahí
         `loEscribioLaCuenta`— y una cuenta apagada no tiene correo
         esperándola. */
      leido:
        loEscribioLaCuenta(plantilla.carpeta) ||
        usuario.status !== "active" ||
        k > 1,
      tipo: plantilla.tipo ?? "standard",
      rechazado: plantilla.rechazado ?? false,
      adjuntos: plantilla.adjuntos ?? [],
    };
  });
}

/* Construido una vez por cuenta y guardado: la sección se acuerda de cuál
   correo está abierto, y una lista nueva en cada pintada lo perdería. */
const memoria = new Map<string, Email[]>();

export function emailsDe(usuario: Usuario): Email[] {
  const guardado = memoria.get(usuario.id);
  if (guardado) return guardado;
  const armados = construir(usuario);
  memoria.set(usuario.id, armados);
  return armados;
}

/** La dirección de la cuenta, derivada del nombre. No se guarda en el modelo
 *  porque no es un hecho aparte: en esta residencia el buzón de un residente
 *  es su nombre, y guardarlo además sería tener dos lugares donde arreglar un
 *  apellido mal escrito. */
export function direccionDe(usuario: Usuario) {
  const partes = usuario.name.toLowerCase().split(" ").filter(Boolean);
  return `${partes.join(".")}@${DOMINIO_CASA}`;
}

/** Quién lo escribió, como dirección. Se deriva de la carpeta y del dueño del
 *  buzón: si lo escribió la cuenta, el autor es la cuenta; si no, es el de
 *  afuera que aparece en `direccion`. No se guarda: sería el mismo hecho dos
 *  veces, y el primer correo que cambie de carpeta los deja peleados. */
export const autorDe = (email: Email, usuario: Usuario) =>
  loEscribioLaCuenta(email.carpeta) ? direccionDe(usuario) : email.direccion;

/** Cómo terminó el intento de entrega. */
export const entregaDe = (email: Email): Entrega =>
  email.rechazado ? "rejected" : "delivered";

/** Cuántos hay sin abrir. Es lo que el header de la sección podría contar el
 *  día que haga falta, y lo que hoy decide si la fila va en negrita. */
export const sinAbrir = (emails: Email[]) =>
  emails.filter((e) => !e.leido).length;

/** Un correo con la cuenta de la que es. La pantalla de Email Search los mira
 *  a todos y no a los de una: sin la cuenta al lado, una fila no sabría de
 *  quién es el buzón que está mostrando. */
export interface EmailConDueno {
  email: Email;
  usuario: Usuario;
}

/** Todos los correos de la casa, del más nuevo al más viejo. El orden es el
 *  único que tiene sentido en una bandeja: lo último que pasó, arriba.
 *
 *  Sin tienda ni `useSyncExternalStore` —a diferencia de los tickets—: un
 *  correo no cambia desde la consola, así que `emailsDe` devuelve siempre la
 *  misma lista y alcanza con memorizar esto contra `usuarios`. */
export function todosLosEmails(usuarios: Usuario[]): EmailConDueno[] {
  return usuarios
    .flatMap((usuario) => emailsDe(usuario).map((email) => ({ email, usuario })))
    .sort(
      (a, b) =>
        new Date(b.email.cuando).getTime() - new Date(a.email.cuando).getTime(),
    );
}
