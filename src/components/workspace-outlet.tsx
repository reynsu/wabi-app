"use client";

import {
  WorkspacePanel,
  type WorkspacePanelProps,
} from "@/components/workspace-panel";
import { useWorkspace } from "@/stores/workspace";

/**
 * WorkspaceOutlet — dónde se dibuja el panel. Suele haber uno, al lado del
 * sidebar.
 *
 * Es lo único que quedó del `WorkspaceProvider`: el estado se fue a
 * `stores/workspace` y esto es el enchufe entre esa tienda y el componente, que
 * sigue sin saber nada de ella —recibe sus pestañas por props y funciona solo—.
 */
type WorkspaceOutletProps = Omit<
  WorkspacePanelProps,
  "tabs" | "value" | "defaultValue" | "onValueChange" | "onTabClose"
>;

export function WorkspaceOutlet(props: WorkspaceOutletProps) {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const closeTab = useWorkspace((w) => w.closeTab);

  return (
    <WorkspacePanel
      tabs={tabs}
      /* `""` y no `undefined`: el panel lee `value === undefined` como "no
         controlado" y volvería a su estado interno cuando no hay ninguna
         activa. Un id vacío no coincide con nada y lo deja controlado. */
      value={activeId ?? ""}
      onValueChange={activateTab}
      onTabClose={closeTab}
      {...props}
    />
  );
}

export type { WorkspaceOutletProps };
