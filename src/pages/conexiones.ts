import { conversacionesDe } from "@/pages/conversaciones";
import type { Usuario } from "@/pages/usuarios";

/* Con quién está conectada una cuenta, y a través de quién.
 *
 * **El grafo no se inventa: ya estaba escrito.** Sale de las conversaciones, que
 * es donde vive el único hecho que hay sobre quién habla con quién. Una lista de
 * conexiones aparte sería una segunda fuente para lo mismo, y la primera vez que
 * alguien agregue un hilo el mapa mostraría una casa que no existe.
 *
 * Lo que lo hace un grafo y no una estrella es que **algunos contactos son
 * compartidos**. La hija de una cuenta es de esa cuenta y de nadie más —lleva su
 * apellido—, pero la recepción, la limpieza y el médico son los mismos para toda
 * la residencia. Eso es lo que conecta a dos residentes que no se escribieron
 * nunca: los dos hablan con el mismo mostrador. Y es cierto en la casa de
 * verdad, no un truco para que el dibujo tenga aristas.
 *
 * De ahí salen los tres niveles:
 *
 *   1°  los contactos de la cuenta — con quién habla
 *   2°  las cuentas que comparten uno de esos contactos — a quién llega por ahí
 *   3°  los contactos de esas cuentas — hasta dónde alcanza
 */

/** De qué es cada nodo. La forma que lo dibuja sale de acá: una cuenta de la
 *  consola es una cosa que se puede abrir, y un contacto es un nombre. */
export type TipoDeNodo = "cuenta" | "contacto";

export interface Nodo {
  id: string;
  nombre: string;
  /** A cuántos saltos está del centro. El centro es `0` y no se rotula. */
  grado: 0 | 1 | 2 | 3;
  tipo: TipoDeNodo;
  /** La cuenta, cuando el nodo es una. Es lo que deja abrir su perfil desde el
   *  mapa sin volver a buscarla. */
  usuario?: Usuario;
}

export interface Enlace {
  origen: string;
  destino: string;
}

export interface Red {
  nodos: Nodo[];
  enlaces: Enlace[];
}

/* Quiénes son los mismos para toda la casa. Sale de la relación y no de una
   lista de nombres: `relacion` ya dice qué es esa persona de la cuenta, y una
   lista aparte se despega el día que se agregue un hilo con la cocina. */
const DE_LA_CASA = new Set(["Facility staff", "Care team"]);

const esDeLaCasa = (relacion: string) => DE_LA_CASA.has(relacion);

/** El id de un contacto. Los de la casa lo tienen compartido —son la misma
 *  persona para todos— y los de la familia lo llevan colgado de su cuenta: dos
 *  "Lucía" de dos residentes distintos son dos personas. */
const idDeContacto = (usuario: Usuario, contacto: string, relacion: string) =>
  esDeLaCasa(relacion) ? `casa/${contacto}` : `${usuario.id}/${contacto}`;

/* Cuánto se abre el mapa en cada nivel. Sin topes el segundo nivel se lleva a
   las cuarenta y ocho cuentas de la casa —todas hablan con la recepción— y lo
   que sale no es un mapa, es una mancha. Los cortes son los que dejan el dibujo
   en el orden de veinte nodos, que es lo que una persona puede recorrer con la
   vista sin perder de dónde salió cada línea. */
const CUENTAS_POR_PUENTE = 3;
const CONTACTOS_POR_CUENTA_LEJANA = 2;

/** La red de una cuenta, hasta tres saltos.
 *
 *  El recorrido es a lo ancho y por niveles, así que el grado de un nodo es la
 *  distancia más corta al centro y no por dónde se lo alcanzó primero: si
 *  alguien es 1° y además se llega a él por un rodeo, es 1°. */
export function conexionesDe(usuario: Usuario, usuarios: Usuario[]): Red {
  const nodos = new Map<string, Nodo>();
  const enlaces: Enlace[] = [];
  const vistos = new Set<string>();

  const agregar = (nodo: Nodo) => {
    if (!nodos.has(nodo.id)) nodos.set(nodo.id, nodo);
  };
  const unir = (origen: string, destino: string) => {
    enlaces.push({ origen, destino });
  };

  agregar({ id: usuario.id, nombre: usuario.name, grado: 0, tipo: "cuenta", usuario });
  vistos.add(usuario.id);

  /* ── 1°: con quién habla ── */
  const puentes: { id: string; contacto: string }[] = [];

  for (const c of conversacionesDe(usuario)) {
    const id = idDeContacto(usuario, c.contacto, c.relacion);
    agregar({ id, nombre: c.contacto, grado: 1, tipo: "contacto" });
    unir(usuario.id, id);
    vistos.add(id);
    /* Sólo los de la casa siguen: por la hija de alguien no se llega a nadie
       más, y decir lo contrario sería inventar una conexión. */
    if (esDeLaCasa(c.relacion)) puentes.push({ id, contacto: c.contacto });
  }

  /* ── 2°: a quién se llega por esos contactos ── */
  const lejanas: Usuario[] = [];

  for (const puente of puentes) {
    const comparten = usuarios.filter(
      (u) =>
        u.id !== usuario.id &&
        !vistos.has(u.id) &&
        conversacionesDe(u).some(
          (c) =>
            esDeLaCasa(c.relacion) &&
            idDeContacto(u, c.contacto, c.relacion) === puente.id,
        ),
    );

    for (const u of comparten.slice(0, CUENTAS_POR_PUENTE)) {
      agregar({ id: u.id, nombre: u.name, grado: 2, tipo: "cuenta", usuario: u });
      unir(puente.id, u.id);
      vistos.add(u.id);
      lejanas.push(u);
    }
  }

  /* ── 3°: hasta dónde alcanza ── */
  for (const u of lejanas) {
    const suyos = conversacionesDe(u)
      /* Los de la casa ya están dibujados como puente: volver a colgarlos de
         acá los duplicaría con otro grado. Lo que suma en el tercer nivel es la
         gente de esa cuenta, que es la que todavía no está. */
      .filter((c) => !esDeLaCasa(c.relacion))
      .slice(0, CONTACTOS_POR_CUENTA_LEJANA);

    for (const c of suyos) {
      const id = idDeContacto(u, c.contacto, c.relacion);
      if (vistos.has(id)) continue;
      agregar({ id, nombre: c.contacto, grado: 3, tipo: "contacto" });
      unir(u.id, id);
      vistos.add(id);
    }
  }

  return { nodos: [...nodos.values()], enlaces };
}
