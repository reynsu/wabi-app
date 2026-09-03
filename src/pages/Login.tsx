"use client";

import { useState } from "react";

import { LoginBlock, useSystemScheme } from "@/components/login-block";
import { useTema } from "@/stores/tema";
import { entrar } from "@/stores/sesion";

/* La pantalla de entrada: lo único que se ve antes de la consola.
 *
 * El bloque es el del registry —`login-block`— y esto es lo que lo ata a esta
 * app: qué dice, qué pasa al mandar el formulario, y de dónde sale el tema.
 * Todo lo demás —las dos mitades, el plano de marca, el cartel de error que
 * empuja en vez de tapar— es del bloque y no se toca acá.
 *
 * Va antes del `SidebarProvider` y no adentro: no es una sección de la consola
 * sino lo que hay en su lugar mientras no haya nadie adentro. Ver `App`.
 */

/* Lo que la casa dice de sí misma en la puerta. La promesa es la del producto y
   no la de la pantalla: quien llega acá ya sabe que va a escribir un correo y
   una contraseña, lo que no sabe es a qué está entrando. */
const TITULO = "The house's console";
const DESCRIPCION =
  "Mail, messages and tickets for everyone who lives here — in one place, and with a record of who looked.";

export function Login() {
  const oscuro = useTema((t) => t.oscuro);
  const alternar = useTema((t) => t.alternar);
  const delSistema = useSystemScheme();

  /* Los dos estados del envío. Viven acá y no en una tienda: son de esta
     pantalla y se van con ella cuando la sesión se abre. */
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <LoginBlock
      className="h-screen"
      title={TITULO}
      description={DESCRIPCION}
      /* El mismo cuadrado con la W del header del sidebar, para que la marca de
         la puerta y la de adentro sean la misma. Sobre el plano oscuro va en
         blanco: la tinta de ese plano no depende del tema —los dos tonos del
         plano son oscuros— y por eso no lleva `dark:`. */
      logo={
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/95 text-[15px] font-semibold text-neutral-900">
          W
        </span>
      }
      error={error}
      pending={entrando}
      /* El tema arranca en el de la app y el bloque lo maneja de ahí en más: así
         su control de tres —claro, oscuro, el del sistema— sigue haciendo lo
         que hace, en vez de quedar recortado a dos por controlarlo desde acá.
         Lo que se elija se le pasa a la tienda, que es la que escribe la clase
         del `<html>`: elegir oscuro en la puerta entra a una consola oscura. */
      defaultTheme={oscuro ? "dark" : "light"}
      onThemeChange={(tema) => {
        const quiere = tema === "system" ? delSistema : tema;
        if ((quiere === "dark") !== oscuro) alternar();
      }}
      onSubmit={async ({ email, password }) => {
        if (entrando) return;
        setEntrando(true);
        /* El error de antes se va al reintentar: dejarlo puesto mientras el
           segundo intento está en vuelo dice que ya falló otra vez. */
        setError(null);
        try {
          await entrar(email, password);
          /* No hay nada que hacer después: abrir la sesión desmonta esta
             pantalla entera. */
        } catch (falla) {
          setError(
            falla instanceof Error
              ? falla.message
              : "We couldn't sign you in — try again.",
          );
          setEntrando(false);
        }
      }}
    />
  );
}

/* ─────────────────────────── Lo que falta ───────────────────────────

   **Todo lo que no sea entrar.** El bloque ofrece cuatro salidas más —GitHub,
   "olvidé mi contraseña", "crear cuenta" y el enlace de los términos— y esta
   pantalla no le pasa handler a ninguna, así que no hacen nada. Es a propósito:
   las cuatro terminan en un servidor que no existe, y un botón que abre un
   formulario de recuperación que nadie va a leer es peor que uno que todavía
   no hace nada.

   **Y la sesión no sobrevive a un reload.** Ver `stores/sesion.ts`: guardar un
   booleano en `localStorage` sería fingir una sesión que ningún servidor
   emitió. */
