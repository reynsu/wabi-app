import { Contact } from "lucide-react";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { UserProfile } from "@/pages/UserProfile";
import type { Usuario } from "@/pages/usuarios";

/* El perfil de un usuario, como pestaña del workspace.
 *
 * En un archivo propio y no adentro de la tabla que lo abría: desde que Email
 * Search también manda a un perfil, son dos las pantallas que lo abren, y dos
 * maneras de armar la misma pestaña son dos ids que un día dejan de coincidir
 * —y `openTab`, que deja ganar a la que ya está, terminaría abriendo dos
 * pestañas para la misma cuenta—.
 *
 * Tampoco adentro de `UserProfile`: ese archivo exporta un componente, y un
 * módulo que exporta las dos cosas le rompe el refresco en caliente a la
 * pantalla entera.
 *
 * El id lleva el del usuario adentro, así que abrir dos veces el mismo perfil
 * no abre dos pestañas. Y la etiqueta es el primer nombre —"Camila's
 * Profile"—, no el nombre entero: en una barra de pestañas compiten por el
 * ancho, y el apellido no distingue nada que el nombre no distinga ya. */

/** Con qué sección abre el perfil. Los valores son los de `SECCIONES` en
 *  `UserProfile`, y el que llega sin par abre con la primera —el perfil lo
 *  valida—: nombrar acá una sección que allá se renombró tiene que llevar igual
 *  a la cuenta, no romperse. */
export type SeccionDePerfil = "conversations" | "emails" | "tickets";

export const tabDePerfil = (
  usuario: Usuario,
  seccion?: SeccionDePerfil,
  /** Qué cosa de esa sección venía a ver —el id de un correo—. Lo interpreta
   *  la sección; acá sólo viaja. */
  foco?: string,
): WorkspaceTab => {
  const nombre = usuario.name.split(" ")[0];
  const titulo = `${nombre}’s Profile`;
  /* El id se arma una sola vez y viaja también adentro del contenido: el perfil
     lo necesita para poner sus widgets en el board de *esta* pestaña. Armarlo
     dos veces sería tener dos lugares donde equivocarse con el mismo string. */
  const id = `profile/${usuario.id}`;

  return {
    id,
    label: titulo,
    icon: Contact,
    /* La pestaña se guarda tal cual en el workspace y no se vuelve a armar, así
       que lo que va acá tiene que poder envejecer: por eso el perfil se lleva
       el id y no el usuario, y lee él mismo la lista viva. Con el usuario
       entero, bloquear desde la tabla dejaría al perfil abierto mostrando el
       estado de cuando se hizo clic. */
    /* La sección va sólo en el contenido y no en el id: el id es la identidad
       de la pestaña, y un `profile/USR-1042#emails` al lado de un
       `profile/USR-1042` serían dos pestañas para la misma cuenta. La
       contracara es que pedir el perfil de una cuenta que ya está abierta lo
       trae a donde estaba: la sección es del que lo está mirando. */
    content: (
      <UserProfile id={usuario.id} tabId={id} seccion={seccion} foco={foco} />
    ),
  };
};
