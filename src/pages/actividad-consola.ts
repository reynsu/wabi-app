import { useMemo } from "react";

import { registrosDe, type Registro } from "@/pages/actividad";
import { useUsuarios, type Usuario } from "@/pages/usuarios";

/* Lo que pasó en la consola, todo junto y de lo último a lo primero.
 *
 * **No hay fixture acá.** Cada renglón ya existe: es el registro administrativo
 * de una cuenta —`registrosDe`, lo que alguien le hizo: el alta, un reseteo, un
 * bloqueo, lo que frenó la moderación—. Lo único que agrega este módulo es
 * mirarlos todos a la vez en vez de de a una cuenta.
 *
 * Escribir una segunda lista sería tener dos fuentes para el mismo hecho, y la
 * primera vez que alguien cambie el estado de una cuenta el registro de su
 * perfil diría una cosa y esta pantalla otra. Es la misma regla que sigue el
 * resto de los fixtures de esta app.
 *
 * De ahí sale también qué le falta a un renglón de acá que el de un perfil no
 * necesita: **a quién le pasó**. Adentro de una cuenta eso es el título de la
 * pantalla; en la consola entera es la mitad de la noticia.
 */

export interface AsientoDeConsola {
  registro: Registro;
  /** A quién le pasó. La cuenta viva, no una copia: el asiento nombra a la
   *  cuenta como se llama ahora. */
  usuario: Usuario;
}

/** Cuántos asientos entran. Cuarenta y una cuentas con su historia dan más de
 *  quinientos renglones, y una pantalla que se recorre con el pulgar no es
 *  donde se audita medio año: para eso está el registro de cada cuenta, con su
 *  panel de filtros. Acá se viene a ver qué pasó últimamente. */
const CUANTOS = 60;

export function useActividadDeConsola(cuantos = CUANTOS): AsientoDeConsola[] {
  const usuarios = useUsuarios();

  return useMemo(
    () =>
      usuarios
        .flatMap((usuario) =>
          registrosDe(usuario).map((registro) => ({ registro, usuario })),
        )
        .sort((a, b) => b.registro.cuando.localeCompare(a.registro.cuando))
        .slice(0, cuantos),
    [usuarios, cuantos],
  );
}
