import { Badge } from "@/components/ui/badge";

/** La pantalla con la que abre la app. Es el lugar donde va lo de verdad; por
 *  ahora dice qué hay puesto y qué falta. */
export function Overview() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-medium tracking-tight">Wabi App</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Una app nueva armada con los componentes y blocks del registry
          <code className="text-foreground"> @wabi</code>. El shell ya está: el
          sidebar, el panel con pestañas y el riel de widgets del costado.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[13px] font-medium">Lo que ya está puesto</h2>
        <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground">
          {[
            ["WorkspacePanel", "el marco con pestañas, y el contexto que las abre desde cualquier parte"],
            ["WidgetRail + WidgetBoard", "la región del costado, con su board atado a la pestaña"],
            ["LateralPreview", "el vistazo a una sola cosa, en el mismo lugar que el board"],
            ["ChangelogPage", "la página de notas de la versión, en la pestaña Releases"],
            ["Pagination", "el paginador de un número y dos flechas, en la pestaña Customers"],
          ].map(([nombre, que]) => (
            <li key={nombre} className="flex items-start gap-2">
              <Badge size="compact">{nombre}</Badge>
              <span className="min-w-0 leading-relaxed">{que}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Los cuatro sistemas —motion, tamaños, superficies y figuras— están
        cableados en <code className="text-foreground">src/main.tsx</code>, así
        que cualquier pieza que se agregue después ya cae adentro de ellos.
      </p>
    </div>
  );
}
