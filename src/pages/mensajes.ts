import {
  conversacionesDe,
  type Conversacion,
  type Mensaje,
} from "@/pages/conversaciones";
import { type Usuario } from "@/pages/usuarios";

/* Los mensajes de toda la casa, sueltos.

   `conversaciones.ts` los guarda como corresponde —adentro del hilo, en orden,
   porque así es como se leen—, y eso es lo que necesita el perfil. Messages
   Search hace la otra pregunta: no "qué se dijeron estos dos" sino "quién dijo
   esto, cuándo". Para contestarla el hilo estorba, así que acá se lo aplana.

   Vive aparte y no adentro de la pantalla por lo mismo que `emails.ts` tiene su
   `todosLosEmails`: el día que los mensajes vengan de una API, van a venir ya
   aplanados y paginados, y lo que cambia es este archivo. La pantalla no se
   entera. */

/** Quién está de un lado de un mensaje.
 *
 *  `usuario` sólo lo trae el lado de la cuenta. Del otro lado hay un contacto
 *  —la hija, la recepción, el médico—, que en esta consola es un nombre y nada
 *  más: no tiene ficha, no tiene perfil y no se lo puede bloquear. Por eso el
 *  campo es opcional y no un `Usuario` inventado: una tarjeta con datos vacíos
 *  promete algo que no existe. */
export interface Participante {
  nombre: string;
  usuario?: Usuario;
}

/** Un mensaje con todo lo que hace falta para leer su fila: de qué hilo salió
 *  y de qué cuenta es ese hilo. Sin eso, un mensaje suelto no sabe con quién
 *  fue. */
export interface MensajeEnContexto {
  mensaje: Mensaje;
  conversacion: Conversacion;
  /** La cuenta dueña del hilo. Es una de las dos puntas del mensaje —cuál, lo
   *  dice `mensaje.de`— y también de quién es el registro que se está
   *  auditando. */
  usuario: Usuario;
}

/** Quién lo escribió. Sale de `de` y no de un campo guardado: el hilo ya sabe
 *  de qué lado está cada burbuja, y guardarlo otra vez sería tener dos fuentes
 *  para el mismo hecho. */
export const remitenteDe = ({
  mensaje,
  conversacion,
  usuario,
}: MensajeEnContexto): Participante =>
  mensaje.de === "cuenta"
    ? { nombre: usuario.name, usuario }
    : { nombre: conversacion.contacto };

/** Y quién lo recibió: el otro. Un mensaje de este fixture es entre dos, así
 *  que el destinatario es exactamente el que no lo escribió. */
export const destinatarioDe = ({
  mensaje,
  conversacion,
  usuario,
}: MensajeEnContexto): Participante =>
  mensaje.de === "cuenta"
    ? { nombre: conversacion.contacto }
    : { nombre: usuario.name, usuario };

/** De qué lado salió, como valor de filtro: lo que la cuenta escribió, o lo
 *  que le llegó. Es la misma distinción que hace la burbuja al elegir su lado
 *  del hilo, escrita en las palabras con las que se la busca. */
export type Direccion = "sent" | "received";

export const DIRECCIONES = {
  sent: { label: "Sent by account", tinte: "#8b5cf6" },
  received: { label: "Received", tinte: "#a3a3a3" },
} as const satisfies Record<Direccion, { label: string; tinte: string }>;

export const ORDEN_DIRECCIONES: Direccion[] = ["sent", "received"];

export const direccionDe = ({ mensaje }: MensajeEnContexto): Direccion =>
  mensaje.de === "cuenta" ? "sent" : "received";

/** Todos los mensajes de la casa, del más nuevo al más viejo. Es el único
 *  orden que tiene sentido en una búsqueda: lo último que se dijo, arriba.
 *
 *  Sin tienda ni `useSyncExternalStore`, igual que los correos: un mensaje no
 *  cambia desde la consola, y `conversacionesDe` devuelve siempre la misma
 *  lista, así que alcanza con memorizar esto contra `usuarios`. */
export function todosLosMensajes(usuarios: Usuario[]): MensajeEnContexto[] {
  return usuarios
    .flatMap((usuario) =>
      conversacionesDe(usuario).flatMap((conversacion) =>
        conversacion.mensajes.map((mensaje) => ({
          mensaje,
          conversacion,
          usuario,
        })),
      ),
    )
    .sort(
      (a, b) =>
        new Date(b.mensaje.cuando).getTime() -
        new Date(a.mensaje.cuando).getTime(),
    );
}

/** Las relaciones que hay de verdad en la lista, ordenadas alfabéticamente. El
 *  panel de filtros ofrece éstas y no una constante escrita al lado: una lista
 *  de opciones que no sale de los datos es la que un día ofrece un valor que
 *  ya no existe. */
export const relacionesDe = (filas: MensajeEnContexto[]): string[] =>
  [...new Set(filas.map((f) => f.conversacion.relacion))].sort();
