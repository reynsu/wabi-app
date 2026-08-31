import { useMemo, useSyncExternalStore } from "react";

import type { BadgeColor } from "@/components/ui/badge";
import { DOMINIO_CASA, direccionDe } from "@/pages/emails";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/* Los buzones de la casa: el fixture de la sección Email › Provisioning.

   Un buzón no es una cuenta. La cuenta es con quién se habla —la de `usuarios.ts`,
   la que se bloquea desde Accounts—; el buzón es una dirección que la casa dio de
   alta, y hay buzones que no son de nadie: el de facturación, el de la recepción,
   el de mantenimiento. Por eso esto es un modelo aparte y no dos campos más
   colgados del usuario.

   Lo que sí se toma prestado es la dirección: `direccionDe` ya sabe cuál es el
   buzón de un residente —lo usa la pantalla de correos para saber quién escribió—
   y volver a armarla acá sería tener dos lugares donde arreglar un apellido mal
   escrito. */

/** En qué estado está un buzón, en un solo lugar: la etiqueta que se lee en la
 *  tabla, el color del badge y el punto del panel de filtros. Tres vistas del
 *  mismo dato, como los estados de una cuenta en `ESTADOS`.
 *
 *  El orden es el del ciclo de vida: el que anda, el que se frenó, y el que
 *  quedó. `suspended` es un acto —alguien lo frenó— e `inactive` es lo que pasa
 *  solo: el buzón sigue existiendo y ya no lo usa nadie. */
export const ESTADOS_BUZON = {
  active: { label: "Active", tinte: "#22c55e", color: "green" },
  suspended: { label: "Suspended", tinte: "#f59e0b", color: "amber" },
  inactive: { label: "Inactive", tinte: "#a3a3a3", color: "gray" },
} as const satisfies Record<
  string,
  { label: string; tinte: string; color: BadgeColor }
>;

export type EstadoBuzon = keyof typeof ESTADOS_BUZON;

export const ORDEN_ESTADOS_BUZON = Object.keys(ESTADOS_BUZON) as EstadoBuzon[];

export interface Buzon {
  /** La identidad de un buzón es su dirección: no hay dos con la misma, y un id
   *  al lado sería un segundo nombre para lo mismo. Es también la `key` de la
   *  fila. */
  direccion: string;
  /** Cómo se llama: la persona de la que es, o el área a la que contesta. */
  nombre: string;
  /** Quién lo dio de alta. Un nombre y no un id: el que lee esta tabla conoce a
   *  las cuatro personas que provisionan buzones en esta casa, y un `ADM-3` lo
   *  obligaría a ir a buscar de quién es. */
  creador: string;
  /** Cuándo se lo dio de alta, sin hora: nadie pregunta a qué hora se creó un
   *  buzón. Día suelto —`2026-03-04`— como el `addedAt` de una cuenta. */
  creadoEl: string;
  estado: EstadoBuzon;
  /** La cuenta de la que es el buzón, cuando es de alguien. Los de la casa no
   *  son de nadie, y por eso esto es opcional y no un usuario inventado: una
   *  fila de `reception@` con una ficha de residente detrás sería falsa. */
  usuario?: Usuario;
}

/** Quiénes dan de alta buzones en esta casa. Es el equipo de la consola y no la
 *  gente que vive acá: un residente no se crea el buzón solo. */
export const CREADORES = [
  "Irene Bustos",
  "Néstor Ojeda",
  "Marcela Vidal",
  "Hugo Sarmiento",
];

/* Cuál buzón está en qué estado. Se reparte por el número del id —el mismo
   truco que usa `emails.ts` con sus plantillas— y **no** se deriva del estado de
   la cuenta: bloquear el chat de alguien no le apaga el correo. Son dos actos
   distintos, hechos desde dos lugares distintos de la consola, y derivar uno del
   otro sería inventar que son el mismo.

   Trece entradas, que no divide a ninguna de las listas de las que se reparte:
   con un largo redondo el estado terminaría cayendo siempre sobre las mismas
   filas. La mayoría anda, que es como está una casa que funciona. */
const RUEDA_ESTADOS: EstadoBuzon[] = [
  "active",
  "active",
  "active",
  "suspended",
  "active",
  "active",
  "inactive",
  "active",
  "active",
  "suspended",
  "active",
  "inactive",
  "active",
];

const numeroDe = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/* Los buzones de la casa: los que no son de nadie. Son los mismos desde los que
   la casa escribe en `emails.ts` —facturación, recepción, el equipo de cuidados,
   mantenimiento, actividades, la farmacia—, así que la consola muestra el mismo
   buzón del que después se ve salir un correo.

   Van escritos a mano y no repartidos: son siete, cada uno con su fecha y su
   historia, y una regla que los generara diría menos que la lista. */
interface BuzonDeLaCasa {
  nombre: string;
  /** La parte de la izquierda de la dirección; el dominio es el de la casa. */
  buzon: string;
  creador: string;
  creadoEl: string;
  estado: EstadoBuzon;
}

const DE_LA_CASA: BuzonDeLaCasa[] = [
  {
    nombre: "Billing",
    buzon: "billing",
    creador: "Irene Bustos",
    creadoEl: "2025-04-14",
    estado: "active",
  },
  {
    nombre: "Front Desk",
    buzon: "reception",
    creador: "Irene Bustos",
    creadoEl: "2025-04-14",
    estado: "active",
  },
  {
    nombre: "Care Team",
    buzon: "care",
    creador: "Marcela Vidal",
    creadoEl: "2025-04-21",
    estado: "active",
  },
  {
    nombre: "Maintenance",
    buzon: "maintenance",
    creador: "Hugo Sarmiento",
    creadoEl: "2025-05-06",
    estado: "active",
  },
  {
    nombre: "Activities",
    buzon: "activities",
    creador: "Marcela Vidal",
    creadoEl: "2025-05-06",
    estado: "active",
  },
  {
    /* Frenado, y no dado de baja: la farmacia cambió de proveedor y el buzón
       queda ahí mientras se termina de mudar lo que llegaba a él. Eso es
       `suspended` —alguien lo frenó— y no `inactive`. */
    nombre: "Pharmacy",
    buzon: "pharmacy",
    creador: "Néstor Ojeda",
    creadoEl: "2025-06-18",
    estado: "suspended",
  },
  {
    /* El que quedó: el programa de voluntarios terminó y nadie apagó el buzón.
       Es exactamente lo que "Inactive" quiere decir, y por eso está en el
       fixture. */
    nombre: "Volunteers",
    buzon: "volunteers",
    creador: "Hugo Sarmiento",
    creadoEl: "2025-07-02",
    estado: "inactive",
  },
];

/* Todos los buzones de la casa, del último dado de alta al primero.

   Sale de la lista viva de usuarios y no de una constante, igual que
   `todosLosEmails`: el día que se dé de baja a alguien, su buzón se va con él
   sin que la pantalla tenga que enterarse. Y como cada fila se lleva su
   `usuario`, el estado de comunicación que muestre su ficha es el de ahora y no
   el de cuando se armó la lista.

   `tocados` es lo que la consola cambió —ver la tienda, abajo—: se aplica acá,
   sobre el estado con el que el buzón nace, y no en la pantalla que lo pinta.
   Puesto allá, el badge de la fila diría una cosa y los conteos del panel de
   filtros otra. */
function armar(usuarios: Usuario[], tocados: Cambios): Buzon[] {
  const propios: Buzon[] = usuarios.map((usuario) => {
    const direccion = direccionDe(usuario);
    return {
      direccion,
      nombre: usuario.name,
      creador: CREADORES[numeroDe(usuario.id) % CREADORES.length],
      /* El buzón se da de alta con la cuenta: no es un hecho aparte, es el
         mismo día. Guardarle una fecha propia sería tener dos que van a
         discrepar la primera vez que alguien corrija una. */
      creadoEl: usuario.addedAt,
      estado:
        tocados[direccion] ??
        RUEDA_ESTADOS[numeroDe(usuario.id) % RUEDA_ESTADOS.length],
      usuario,
    };
  });

  const casa: Buzon[] = DE_LA_CASA.map((b) => {
    const direccion = `${b.buzon}@${DOMINIO_CASA}`;
    return {
      direccion,
      nombre: b.nombre,
      creador: b.creador,
      creadoEl: b.creadoEl,
      estado: tocados[direccion] ?? b.estado,
    };
  });

  /* Los días sueltos se comparan como texto: en ISO el orden alfabético es el
     cronológico, y no hay `Date` que construir para ordenar cincuenta filas. */
  return [...casa, ...propios].sort((a, b) =>
    b.creadoEl.localeCompare(a.creadoEl),
  );
}

/* ─────────────────────────── La tienda ─────────────────────────── */

/* De un buzón se puede cambiar el estado, y nada más: el resto de la fila —de
   quién es, quién lo creó, cuándo— es historia, y la historia no se edita desde
   una tabla.

   Que exista esta tienda es la diferencia con los correos, que no la tienen: un
   correo no cambia desde la consola y un buzón sí, así que el estado tiene que
   vivir en algún lado donde dos pestañas de esta pantalla vean lo mismo.
   Suspender un buzón no es una decisión de la vista.

   Es la misma tienda mínima de `usuarios.ts` —una variable, un `Set` de oyentes
   y `useSyncExternalStore`—, pero guarda **sólo lo que se cambió** y no la lista
   entera: la lista se arma de los usuarios vivos, y una copia acá se despegaría
   de ellos el día que se dé de baja a alguien. La clave es la dirección, que es
   la identidad del buzón. */

type Cambios = Record<string, EstadoBuzon>;

let tocados: Cambios = {};

const oyentes = new Set<() => void>();

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/** Suspender un buzón, apagarlo, volverlo a encender.

    Toma la fila y no la dirección sola porque también necesita el estado que
    tiene ahora: pedir el que ya tiene no es un cambio, y sin esa comparación un
    clic en la opción marcada volvería a pintar la tabla para nada. */
export function cambiarEstadoBuzon(buzon: Buzon, estado: EstadoBuzon) {
  if (buzon.estado === estado) return;
  tocados = { ...tocados, [buzon.direccion]: estado };
  for (const avisar of oyentes) avisar();
}

/** La lista viva. Todo lo que la lee se vuelve a pintar cuando cambia —porque
 *  cambió un buzón, o porque cambió la lista de cuentas de la que sale. */
export function useBuzones(): Buzon[] {
  const usuarios = useUsuarios();
  const cambios = useSyncExternalStore(suscribir, () => tocados);
  return useMemo(() => armar(usuarios, cambios), [usuarios, cambios]);
}
