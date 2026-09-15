import { useMemo } from "react";

import { useReportesDOC, type ReporteDOC } from "@/pages/reportes-admin";
import { useReportes, type Reporte } from "@/pages/reportes";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/* Lo que alguien guardó para volver: los marcadores de la consola.
 *
 * Es el único fixture de esta app que **no** se puede derivar de otra cosa. Una
 * cuenta existe, un reporte existe; que a alguien le importe volver a uno de
 * ellos es un hecho nuevo, y no hay nada de lo que ya está de donde sacarlo. Por
 * eso se escribe, y se escribe corto: seis marcadores son los que junta alguien
 * que usa esto todos los días, y una lista de treinta sería un archivo y no un
 * atajo.
 *
 * **Lo que se guarda es una referencia, no una copia.** Un marcador tiene el id
 * de la cuenta o del reporte y nada más: el nombre, el estado y la fecha salen
 * del padrón vivo cada vez que se lee. Guardar el nombre al lado del id sería
 * tener dos fuentes para el mismo hecho, y el primer marcador de una cuenta a la
 * que le corrigieron el nombre mostraría el viejo. Es lo mismo que hace un
 * reporte con las cuentas que cubre.
 *
 * Y de ahí sale que **un marcador pueda caerse**: si lo que apuntaba dejó de
 * existir, no se muestra. Un atajo que lleva a nada es peor que no tenerlo.
 *
 * El día que esto venga de una API se borra el archivo: la pantalla pide los
 * marcadores de quien está mirando y de dónde salen no es asunto suyo.
 */

/** De qué es un marcador. Tres, que son las tres cosas de esta consola que se
 *  abren en una pestaña propia y a las que se vuelve: una cuenta, un reporte
 *  semanal y un reporte pedido.
 *
 *  Los hilos no están: una conversación se abre adentro del perfil de su cuenta
 *  —no tiene pestaña propia— así que guardarla es guardar la cuenta y después
 *  buscarla, y eso no es un atajo. */
export type ClaseDeGuardado = "cuenta" | "reporte" | "reporte-doc";

interface Marcador {
  /** A qué apunta: el id de la cuenta o del reporte, tal cual lo escribe su
   *  propio fixture. */
  ref: string;
  clase: ClaseDeGuardado;
  /** Por qué lo guardó, escrito por quien lo guardó. No siempre hay: un atajo
   *  a la cuenta que uno mira todos los días no necesita explicación. */
  nota?: string;
  guardadoEl: string;
}

/* Seis, con un motivo cada uno. Escritos y no sorteados, como las políticas y
   las cuentas DOC: un marcador es una decisión de una persona, y una regla
   generadora no puede inventar por qué a alguien le importó algo. */
const MARCADORES: Marcador[] = [
  /* La cuenta que está en el medio de algo. Martín Quiroga está desactivado
     —lo dice el padrón— y alguien lo dejó a mano para no buscarlo cada mañana. */
  {
    ref: "USR-1207",
    clase: "cuenta",
    nota: "Waiting on the family to call back",
    guardadoEl: "2026-08-27T09:12",
  },
  /* La cuenta de la que cuelga un ticket abierto. */
  {
    ref: "USR-1319",
    clase: "cuenta",
    nota: "Photos not sending",
    guardadoEl: "2026-08-26T15:40",
  },
  /* El reporte pedido que se cayó: mientras no vuelva a salir, queda a mano. */
  {
    ref: "doc-rep/blocked/2026-08-24T11:05",
    clase: "reporte-doc",
    nota: "Ask for it again",
    guardadoEl: "2026-08-24T11:22",
  },
  /* El padrón del martes: el que se baja todos los meses para el contador. */
  {
    ref: "doc-rep/user-id/2026-08-21T10:22",
    clase: "reporte-doc",
    guardadoEl: "2026-08-21T10:30",
  },
  /* Una semana de correo que alguien quiere tener cerca. Los ids de los
     reportes semanales salen del padrón —`rep/0` es el más nuevo—, así que dos
     de los primeros son los que un lector va a reconocer. */
  {
    ref: "rep/2",
    clase: "reporte",
    nota: "The week the mail piled up",
    guardadoEl: "2026-08-19T08:05",
  },
  {
    ref: "rep/7",
    clase: "reporte",
    guardadoEl: "2026-07-31T17:48",
  },
];

/** Un marcador con lo que apunta, ya resuelto. */
export type Guardado =
  | { ref: string; clase: "cuenta"; nota?: string; guardadoEl: string; usuario: Usuario }
  | { ref: string; clase: "reporte"; nota?: string; guardadoEl: string; reporte: Reporte }
  | {
      ref: string;
      clase: "reporte-doc";
      nota?: string;
      guardadoEl: string;
      reporte: ReporteDOC;
    };

/** Los marcadores de ahora, de lo último guardado a lo primero, y sólo los que
 *  siguen apuntando a algo. */
export function useGuardados(): Guardado[] {
  const usuarios = useUsuarios();
  const reportes = useReportes();
  const reportesDOC = useReportesDOC();

  return useMemo(() => {
    const vivos = MARCADORES.flatMap((m): Guardado[] => {
      if (m.clase === "cuenta") {
        const usuario = usuarios.find((u) => u.id === m.ref);
        return usuario ? [{ ...m, clase: "cuenta", usuario }] : [];
      }
      if (m.clase === "reporte") {
        const reporte = reportes.find((r) => r.id === m.ref);
        return reporte ? [{ ...m, clase: "reporte", reporte }] : [];
      }
      const reporte = reportesDOC.find((r) => r.id === m.ref);
      return reporte ? [{ ...m, clase: "reporte-doc", reporte }] : [];
    });

    return vivos.sort((a, b) => b.guardadoEl.localeCompare(a.guardadoEl));
  }, [usuarios, reportes, reportesDOC]);
}
