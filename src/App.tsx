import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sileo";
import {
  ChevronsLeftRight,
  ChevronsUpDown,
  CircleQuestionMark,
  LayoutGrid,
  LifeBuoy,
  Moon,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TravelTooltipItem } from "@/components/travel-tooltip";
import { WindowControls } from "@/components/window-controls";
import { WidgetDragProvider } from "@/components/widget-drag";
import { WidgetRail, type WidgetRailControl } from "@/components/widget-rail";
import { WorkspaceOutlet } from "@/components/workspace-outlet";
import type { WidgetDefinition } from "@/components/widget";
import { useBoardActivo, useBoards } from "@/stores/board";
import { usePreviewActivo } from "@/stores/preview";
import { useTema } from "@/stores/tema";
import { useWorkspace } from "@/stores/workspace";
import type { WorkspaceTab } from "@/components/workspace-panel";
import { useShape } from "@/lib/shape-context";
import { cn } from "@/lib/utils";
import { INICIO, NAV, buscarHoja, type NavLeaf } from "@/navigation";

/* Los controles de la barra del panel: `Button` en su escalón compacto, con el
   ícono en gris y el plano blanco de la escalera de superficies. Se pisa
   `--btn-bg` sobre la capa del botón —no sobre su raíz— porque la variante
   declara esa variable ahí, y la que el elemento define para sí mismo gana. */
const CONTROL = [
  "rounded-full",
  "text-muted-foreground hover:text-foreground",
  "shadow-surface-3",
  "[&>span:first-child]:[--btn-bg:var(--surface-3)]",
].join(" ");

/* Cada pantalla se ocupa de su propio aire: el `ChangelogPage` es la página
   entera y un `max-w` acá se lo comería. */
/* El id de la pestaña se pasa además al contenido: una pantalla que pone algo
   en el board tiene que poder decir en cuál. Por defecto es el de la hoja, y
   una copia le pasa el suyo —`tickets#2` es otra pestaña con otro board—. */
const toTab = (hoja: NavLeaf, id: string = hoja.id): WorkspaceTab => ({
  id,
  label: hoja.label,
  icon: hoja.icon,
  content: hoja.render(id),
});

/** La pestaña con la que abre la app: la fila que el diseño muestra
 *  encendida. */
const INICIAL = buscarHoja(INICIO) ?? NAV[0].items[0];

/* El id de una copia es el de su hoja más un sufijo (`chat/search#2`). `raiz` lo
   saca: preguntar si la fila del sidebar está encendida se hace con la raíz y no
   con la copia. */
const raiz = (id: string) => id.split("#")[0];

/* La pestaña con la que abre la app, puesta una sola vez y acá afuera.
   `openTab` no duplica por id, así que si el refresco en caliente vuelve a
   evaluar este módulo esto no agrega una segunda. */
useWorkspace.getState().openTab(toTab(INICIAL));

export default function App() {
  return <Shell />;
}

function Shell() {
  const openTab = useWorkspace((w) => w.openTab);
  const activeId = useWorkspace((w) => w.activeId);
  const tabs = useWorkspace((w) => w.tabs);
  const preview = usePreviewActivo();
  const board = useBoardActivo();
  const editarBoard = useBoards((b) => b.editarBoard);
  const dark = useTema((t) => t.oscuro);
  const alternarTema = useTema((t) => t.alternar);
  const [apuntado, setApuntado] = useState(false);
  const [redimensionando, setRedimensionando] = useState(false);
  const shape = useShape();
  const riel = useRef<WidgetRailControl | null>(null);

  /* Ir a una fila por id, para los lugares que la nombran sin tenerla a mano
     —el dropdown del header. */
  const irA = (id: string) => {
    const destino = buscarHoja(id);
    if (destino) openTab(toTab(destino));
  };

  /* Duplicar una fila. La pestaña se identifica por id y `openTab` deja ganar
     a la que ya está abierta —para no remontar su contenido y perder lo que
     hubiera adentro—, así que una copia es la misma hoja con un id nuevo.
     Busca el número más chico libre: cerrar la #2 y volver a duplicar reusa
     ese lugar en vez de irse a la #3. Cada copia arma su propio contenido, y
     por eso tiene su propio estado: su página del paginador, su board, su
     preview. */
  const duplicar = (hoja: NavLeaf) => {
    const usados = new Set(tabs.map((t) => t.id));
    let id = hoja.id;
    for (let n = 2; usados.has(id); n++) id = `${hoja.id}#${n}`;
    openTab(toTab(hoja, id));
  };

  const rielVisible = board.open || preview !== null;

  return (
    <SidebarProvider
      defaultOpen
      className="h-screen overflow-hidden bg-surface-1"
    >
      <Sidebar variant="inset">
        {/* El header es un dropdown, y la marca se apila horizontal: la
              insignia y el nombre en una fila, y el chevron al final. No lleva
              acciones al lado —lo que el header ofrece está adentro del menú, no
              desparramado en botones. Los tres destinos son filas del árbol: el
              menú es un atajo, no un lugar aparte. */}
        <SidebarHeader>
          <DropdownMenu size="compact">
            <DropdownTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex h-8 w-full cursor-pointer select-none items-center gap-2 px-2 text-left outline-none",
                    "transition-colors duration-80 hover:bg-hover",
                    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    shape.item,
                  )}
                />
              }
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">
                W
              </span>
              <span className="min-w-0 truncate text-[13px] font-medium">
                Wabi App
              </span>
              <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </DropdownTrigger>

            <DropdownContent align="start" side="bottom" sideOffset={6}>
              <MenuItem
                index={0}
                icon={Sparkles}
                label="What's new"
                onSelect={() => irA("admin/whats-new")}
              />
              <MenuItem
                index={1}
                icon={CircleQuestionMark}
                label="FAQ"
                onSelect={() => irA("admin/faq")}
              />
              <DropdownSeparator />
              <MenuItem
                index={2}
                icon={LifeBuoy}
                label="Support & feedback"
                onSelect={() => irA("support")}
              />
            </DropdownContent>
          </DropdownMenu>
        </SidebarHeader>

        {/* Un grupo por sección y las hojas como filas de primer nivel: el
              árbol es el mismo, cambió quién lo contiene. El label del grupo es
              el que colapsa —`collapsible` se lo pide— así que los grupos
              sueltos, los que no tienen nombre, no se colapsan: no hay de dónde
              agarrarlos, y aplanar tres filas no gana nada. */}
        <SidebarContent>
          {NAV.map((grupo) => (
            <SidebarGroup
              key={grupo.id}
              collapsible={grupo.label !== undefined}
            >
              {grupo.label && (
                <SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>
              )}

              <SidebarMenu>
                {grupo.items.map((hoja) => (
                  <SidebarMenuItem key={hoja.id}>
                    <SidebarMenuButton
                      icon={hoja.icon}
                      isActive={
                        activeId !== undefined && raiz(activeId) === hoja.id
                      }
                      onClick={() => openTab(toTab(hoja))}
                    >
                      {hoja.label}
                    </SidebarMenuButton>

                    {/* La acción de la fila: otra copia de la misma pantalla.
                          El clic en la fila lleva a la que ya está abierta; el
                          `+` abre una más, y ahí sí hay dos pestañas de lo
                          mismo, cada una con su estado. Aparece con el hover, y
                          la fila le reserva el lugar sola. */}
                    <Tooltip content="Open another one" side="right">
                      <SidebarMenuAction
                        showOnHover
                        aria-label={`Open another ${hoja.label} tab`}
                        onClick={() => duplicar(hoja)}
                      >
                        <Plus />
                      </SidebarMenuAction>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1">
            <p className="min-w-0 text-[12px] text-muted-foreground">
              Built with the @wabi registry
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Un solo contexto de arrastre para el panel y el riel: sin esto una
            tarjeta no podría cruzar de uno al otro. */}
      <WidgetDragProvider>
        <WorkspaceOutlet
          as="main"
          lifted={apuntado || redimensionando}
          controls={
            <WindowControls
              sidebar={false}
              more={false}
              size="compact"
              className="[&>div]:gap-1.5"
            >
              <TravelTooltipItem label={dark ? "Light mode" : "Dark mode"}>
                <Button
                  variant="secondary"
                  size="icon-compact"
                  className={CONTROL}
                  aria-label="Toggle theme"
                  onClick={alternarTema}
                >
                  {dark ? <Sun /> : <Moon />}
                </Button>
              </TravelTooltipItem>

              {rielVisible && (
                <TravelTooltipItem label="Hold to resize">
                  <Button
                    variant="secondary"
                    size="icon-compact"
                    className={cn(CONTROL, "cursor-col-resize")}
                    aria-label="Resize the panel"
                    onPointerDown={(e) => riel.current?.beginResize(e)}
                    onPointerEnter={() => setApuntado(true)}
                    onPointerLeave={() => setApuntado(false)}
                    onFocus={() => setApuntado(true)}
                    onBlur={() => setApuntado(false)}
                    onKeyDown={(e) => {
                      const manija = riel.current;
                      if (!manija) return;
                      const paso =
                        e.key === "ArrowRight"
                          ? -manija.step
                          : e.key === "ArrowLeft"
                            ? manija.step
                            : 0;
                      if (!paso) return;
                      e.preventDefault();
                      manija.nudge(paso);
                    }}
                  >
                    <ChevronsLeftRight />
                  </Button>
                </TravelTooltipItem>
              )}

              <TravelTooltipItem
                label={board.open ? "Hide the board" : "Show the board"}
              >
                <Button
                  variant="secondary"
                  size="icon-compact"
                  className={CONTROL}
                  aria-label={board.open ? "Hide the board" : "Show the board"}
                  aria-pressed={board.open}
                  onClick={() =>
                    activeId &&
                    editarBoard(activeId, (b) => ({ ...b, open: !b.open }))
                  }
                >
                  <LayoutGrid />
                </Button>
              </TravelTooltipItem>
            </WindowControls>
          }
          className="m-2 ml-0 min-h-0 w-full min-w-0 flex-1 transition-[margin] duration-80 peer-data-[state=collapsed]:ml-2"
        />

        {/* El riel va *después* del panel en el DOM: mide a su hermano anterior
              para saber cuánto se están repartiendo. */}
        <AnimatePresence initial={false}>
          {rielVisible && (
            <WidgetRail
              widgets={board.widgets}
              preview={preview}
              contentKey={activeId}
              onBoardClose={() =>
                editarBoard(activeId!, (b) => ({ ...b, open: false }))
              }
              onWidgetClose={(id) =>
                editarBoard(activeId!, (b) => ({
                  ...b,
                  widgets: b.widgets.filter((w) => w.id !== id),
                }))
              }
              onWidgetReorder={(ids) =>
                editarBoard(activeId!, (b) => ({
                  ...b,
                  widgets: ids
                    .map((id) => b.widgets.find((w) => w.id === id))
                    .filter((w) => w !== undefined),
                }))
              }
              onWidgetAdd={(id, index, data) => {
                const widget = data as WidgetDefinition | undefined;
                if (!widget?.id) return false;
                let puesto = false;
                editarBoard(activeId!, (b) => {
                  if (b.widgets.some((w) => w.id === id)) return b;
                  puesto = true;
                  const llega = { ...widget, id };
                  return {
                    ...b,
                    widgets: [
                      ...b.widgets.slice(0, index),
                      llega,
                      ...b.widgets.slice(index),
                    ],
                  };
                });
                return puesto;
              }}
              onWidgetRemove={(id) =>
                editarBoard(activeId!, (b) => ({
                  ...b,
                  widgets: b.widgets.filter((w) => w.id !== id),
                }))
              }
              controlRef={riel}
              onResizingChange={setRedimensionando}
            />
          )}
        </AnimatePresence>
      </WidgetDragProvider>

      {/* Los toasts, montados una sola vez para toda la app: son del shell,
            como el riel y las pestañas, y una pantalla que montara el suyo
            tendría dos pilas de avisos apiladas en el mismo lugar.

            Arriba y al centro: es donde el aviso cruza por encima de la barra de
            pestañas sin taparle nada a la pantalla —el trabajo pasa abajo, en la
            tabla— y donde se lo encuentra sin buscarlo, que es lo que hace falta
            cuando lo que cuenta es que algo terminó.

            El tema va explícito y atado al toggle de la cabecera: el modo
            `"system"` de Sileo sigue al sistema operativo, y acá el tema lo
            decide la clase `.dark` en `<html>` —quedarían desincronizados—. */}
      <Toaster
        position="top-center"
        offset={16}
        theme={dark ? "dark" : "light"}
      />
    </SidebarProvider>
  );
}
