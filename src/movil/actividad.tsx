import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTypeScale } from "@/lib/size-context";
import { ListaMovil, FilaMovil } from "@/movil/lista";
import { useActividadDeConsola } from "@/pages/actividad-consola";
import { tabDePerfil } from "@/pages/perfil-tab";
import { haceCuanto } from "@/pages/tiempo";
import type { WorkspaceTab } from "@/components/workspace-panel";

/**
 * Lo que pasó en la consola, en una hoja del teléfono.
 *
 * Es el registro administrativo de todas las cuentas mirado junto —ver
 * `actividad-consola`—: el alta de un buzón, un reseteo de contraseña, un
 * bloqueo, lo que frenó la moderación. Los mismos renglones que cada perfil
 * muestra en su pestaña Logs, y por eso se escriben igual: qué pasó arriba,
 * quién y a quién abajo, cuándo a la derecha, y la marca de "Review" nada más
 * que en lo que hay que mirar.
 *
 * **Lo que un renglón de acá agrega es a quién le pasó.** Adentro de una cuenta
 * eso es el título de la pantalla; en la consola entera es la mitad de la
 * noticia, y es también lo que hace que el renglón tenga adónde llevar: tocarlo
 * abre el perfil de esa cuenta, que es donde está el resto de su historia con
 * su panel de filtros.
 *
 * Tocar un renglón cierra la hoja: lo que abre queda debajo de ella.
 *
 * No busca ni filtra. Esto no es la pantalla donde se audita medio año —para
 * eso está el registro de cada cuenta—: es la de qué pasó últimamente, y una
 * barra de búsqueda arriba de sesenta renglones ordenados por fecha promete una
 * pregunta que no es la que se viene a hacer acá.
 */
export function ActividadDeLaConsola({
  /** Abrir lo que un renglón señala. Lo hace el shell y no esta lista: en el
   *  teléfono abrir una pestaña **es** navegar —empuja una entrada del
   *  historial— y la hoja tiene la suya puesta encima. Quien sabe en qué orden
   *  se sacan las dos es el que las puso. */
  alAbrir,
}: {
  alAbrir: (tab: WorkspaceTab) => void;
}) {
  const escala = useTypeScale();
  const asientos = useActividadDeConsola();

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade scrollbar-hide">
      <ListaMovil>
        {asientos.map(({ registro, usuario }) => (
          <FilaMovil
            key={registro.id}
            titulo={registro.que}
            detalle={
              <>
                {usuario.name}
                <span className="text-muted-foreground/60"> · </span>
                {registro.quien}
              </>
            }
            extra={
              <>
                {/* Sólo lo que hay que mirar lleva marca: un registro donde
                    cada renglón está señalado es un registro sin señales. Es
                    la misma marca que pone la pestaña Logs de un perfil. */}
                {registro.atencion && (
                  <Badge variant="dot" size="compact" color="rose">
                    Review
                  </Badge>
                )}
                <span style={{ fontSize: escala.caption }}>
                  {haceCuanto(registro.cuando)}
                </span>
              </>
            }
            onClick={() => alAbrir(tabDePerfil(usuario))}
          />
        ))}
      </ListaMovil>
    </ScrollArea>
  );
}
