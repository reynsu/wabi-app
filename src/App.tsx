import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ChevronsLeftRight,
  LayoutDashboard,
  LayoutGrid,
  Moon,
  ScrollText,
  Sun,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TravelTooltipItem } from "@/components/travel-tooltip";
import { WindowControls } from "@/components/window-controls";
import { PreviewProvider, usePreview } from "@/components/preview-context";
import { WidgetDragProvider } from "@/components/widget-drag";
import { WidgetRail, type WidgetRailControl } from "@/components/widget-rail";
import type { WidgetDefinition } from "@/components/widget";
import {
  WorkspaceOutlet,
  WorkspaceProvider,
  useWorkspace,
} from "@/components/workspace-context";
import type { WorkspaceTab } from "@/components/workspace-panel";
import { cn } from "@/lib/utils";
import { WIDGETS } from "@/widgets";
import { Customers } from "@/pages/Customers";
import { Overview } from "@/pages/Overview";
import { Releases } from "@/pages/Releases";

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

const PAGES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, render: () => <Overview /> },
  { id: "customers", label: "Customers", icon: Users, render: () => <Customers /> },
  { id: "releases", label: "Releases", icon: ScrollText, render: () => <Releases /> },
] as const;

type Page = (typeof PAGES)[number];

/* Cada pantalla se ocupa de su propio aire: el `ChangelogPage` es la página
   entera y un `max-w` acá se lo comería. */
const toTab = (p: Page): WorkspaceTab => ({
  id: p.id,
  label: p.label,
  icon: p.icon,
  content: p.render(),
});

/** Lo que una pestaña tiene en el riel. */
interface BoardState {
  open: boolean;
  widgets: WidgetDefinition[];
}

const SIN_BOARD: BoardState = { open: false, widgets: [] };

/* Qué pantallas vienen con board puesto: una decisión de la app, no del
   componente. El resto empieza sin board y lo abre desde la barra. */
const CON_BOARD = new Set(["overview"]);

const estrena = (id: string | undefined): BoardState =>
  id && CON_BOARD.has(id) ? { open: true, widgets: WIDGETS } : SIN_BOARD;

export default function App() {
  return (
    <WorkspaceProvider defaultTabs={[toTab(PAGES[0])]}>
      <PreviewScope>
        <Shell />
      </PreviewScope>
    </WorkspaceProvider>
  );
}

/* El preview del riel es de la pestaña que lo abrió: `scope` dice cuál está
   puesto. Va adentro del WorkspaceProvider porque necesita saberlo. */
function PreviewScope({ children }: { children: ReactNode }) {
  const { activeId } = useWorkspace();

  return <PreviewProvider scope={activeId}>{children}</PreviewProvider>;
}

function Shell() {
  const { openTab, activeId } = useWorkspace();
  const { preview } = usePreview();
  const [dark, setDark] = useState(false);
  const [apuntado, setApuntado] = useState(false);
  const [redimensionando, setRedimensionando] = useState(false);
  const riel = useRef<WidgetRailControl | null>(null);

  /* Un board por pestaña; acá sólo están las que ya se tocaron y la que falta
     se lee con `estrena`. */
  const [boards, setBoards] = useState<Record<string, BoardState>>({});
  const board = (activeId ? boards[activeId] : undefined) ?? estrena(activeId);

  const editarBoard = useCallback(
    (fn: (b: BoardState) => BoardState) =>
      setBoards((bs) => {
        if (!activeId) return bs;
        return { ...bs, [activeId]: fn(bs[activeId] ?? estrena(activeId)) };
      }),
    [activeId],
  );

  const rielVisible = board.open || preview !== null;

  const toggleTheme = () =>
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });

  return (
    <SidebarProvider defaultOpen className="h-screen overflow-hidden bg-surface-1">
      <Sidebar variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">
              W
            </div>
            <span className="text-[13px] font-medium">Wabi App</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Product</SidebarGroupLabel>
            <SidebarMenu>
              {PAGES.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    icon={p.icon}
                    isActive={p.id === activeId}
                    onClick={() => openTab(toTab(p))}
                  >
                    {p.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
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
                  onClick={toggleTheme}
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
                  onClick={() => editarBoard((b) => ({ ...b, open: !b.open }))}
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
              onBoardClose={() => editarBoard((b) => ({ ...b, open: false }))}
              onWidgetClose={(id) =>
                editarBoard((b) => ({
                  ...b,
                  widgets: b.widgets.filter((w) => w.id !== id),
                }))
              }
              onWidgetReorder={(ids) =>
                editarBoard((b) => ({
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
                editarBoard((b) => {
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
                editarBoard((b) => ({
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
    </SidebarProvider>
  );
}
