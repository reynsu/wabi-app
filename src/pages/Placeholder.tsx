import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import type { IconComponent } from "@/lib/icon-context";

export interface PlaceholderProps {
  /** El ícono de la fila que abrió la pestaña: la pantalla vacía se reconoce
   *  por el mismo glifo con el que se la fue a buscar. */
  icon: IconComponent;
  label: string;
  /** La sección de la que cuelga, cuando cuelga de alguna. Dos secciones
   *  distintas tienen una fila "Search" cada una; el título dice cuál es. */
  section?: string;
}

/** La pantalla de lo que todavía no está. Es honesta a propósito: el shell —la
 *  pestaña, el riel, el board— ya está cableado, y lo que falta es el adentro.
 *  Cuando una de estas pantallas se escriba de verdad, se cambia el `render`
 *  de su hoja en `navigation.tsx` y nada más. */
export function Placeholder({ icon: Icon, label, section }: PlaceholderProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatedEmpty>
        <AnimatedEmptyHeader>
          <AnimatedEmptyMedia variant="figure" float>
            <Icon />
          </AnimatedEmptyMedia>
          <AnimatedEmptyTitle>
            {section ? `${section} · ${label}` : label}
          </AnimatedEmptyTitle>
          <AnimatedEmptyDescription>
            This screen isn&rsquo;t written yet. The tab, the rail and the board
            around it already are — what&rsquo;s missing is what goes inside.
          </AnimatedEmptyDescription>
        </AnimatedEmptyHeader>
      </AnimatedEmpty>
    </div>
  );
}
