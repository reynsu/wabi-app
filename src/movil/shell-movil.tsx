import { useState } from "react";
import {
  ChevronLeft,
  Ellipsis,
  House,
  LayoutGrid,
  LogOut,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { WidgetBoard } from "@/components/widget-board";
import { WidgetDragProvider } from "@/components/widget-drag";
import type { WidgetDefinition } from "@/components/widget";
import { cn } from "@/lib/utils";
import { SurfaceProvider } from "@/lib/surface-context";
import { surfaceClasses } from "@/lib/surface-classes";
import { NAV, raiz } from "@/navigation";
import { useBoardActivo, useBoards } from "@/stores/board";
import { usePreview, usePreviewActivo } from "@/stores/preview";
import { useSesion } from "@/stores/sesion";
import { COMO_INTERRUPTOR, sonar, useSonido } from "@/stores/sonido";
import { useTema } from "@/stores/tema";
import { useWorkspace } from "@/stores/workspace";
import { Hoja } from "./hoja";
import { Inicio } from "./inicio";
import { irAInicio, useHistorialMovil, useNavegacionMovil, volver } from "./navegacion";

/**
 * El shell del teléfono: lo que por debajo de 768px ocupa el lugar del
 * `WorkspaceOutlet` y del riel.
 *
 * El modelo del workspace sigue entero —las pestañas, su estado, su board, su
 * vistazo— y lo que cambia es el marco. No hay barra de pestañas: no entra en
 * 375px y dos barras de pestañas, la de la app adentro de la del navegador, no
 * las espera nadie. En su lugar hay **Inicio**, a un toque desde cualquier
 * lado, y **atrás**, que es el del sistema. Mientras se trabaja, el marco es
 * una fila de 48px.
 *
 * Se llegó acá por prototipo: doce formas de shell y cuatro de Inicio,
 * probadas en el teléfono. Están en la rama `prototipo/shell-movil`.
 */

/** El plano: el mismo escalón que el del panel de escritorio —el sustrato
 *  más dos—, para que lo que se monta adentro se levante igual en los dos. */
const PLANO = 3;

export function ShellMovil() {
  useHistorialMovil();

  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const enInicio = useNavegacionMovil((n) => n.enInicio);
  const puedeVolver = useNavegacionMovil((n) => n.indice > 0);
  const activa = tabs.find((t) => t.id === activeId);
  const grupo = activeId ? NAV.find((g) => g.items.some((h) => h.id === raiz(activeId))) : undefined;

  const board = useBoardActivo();
  const editarBoard = useBoards((b) => b.editarBoard);
  const preview = usePreviewActivo();
  const { close: cerrarPreview } = usePreview();

  /* El board se pide con un toque y es de la pestaña en la que se pidió: se
     guarda en cuál, y cambiar de pestaña lo cierra solo sin un efecto que lo
     persiga. No se usa el `open` de la tienda: ése es el del riel de
     escritorio, y Chat › Analytics viene con él puesto —en el teléfono eso
     sería una hoja saltando en la cara apenas se entra—. */
  const [boardEn, setBoardEn] = useState<string | null>(null);
  const verBoard = boardEn !== null && boardEn === activeId;

  /* El vistazo, en cambio, sí se abre solo: lo pidió una fila que se acaba de
     tocar, y es la respuesta a ese toque. */
  const hojaAbierta = !enInicio && (preview !== null || verBoard);

  const cerrarHoja = () => {
    if (preview !== null) cerrarPreview();
    else setBoardEn(null);
  };

  /* Lo que el riel hace con el board, contra el de la pestaña que se mira. */
  const editar = (fn: Parameters<typeof editarBoard>[1]) => activeId && editarBoard(activeId, fn);

  return (
    <WidgetDragProvider>
      <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-0.5 px-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Home"
            aria-current={enInicio ? "page" : undefined}
            onClick={irAInicio}
            className={cn("size-11 rounded-full", enInicio ? "text-foreground" : "text-muted-foreground")}
          >
            <House />
          </Button>

          {!enInicio && puedeVolver && (
            <Button variant="ghost" size="icon" aria-label="Back" onClick={volver} className="-ml-1.5 size-11 rounded-full">
              <ChevronLeft />
            </Button>
          )}

          {/* El título: dónde se está. La sección va antes cuando dice algo —hay
              dos Search y dos Reports—; los grupos sin nombre no tienen qué
              poner. */}
          <h1 className="flex min-w-0 flex-1 items-baseline gap-1.5 px-1">
            {!enInicio && grupo?.label && (
              <span className="shrink-0 text-[13px] text-muted-foreground">{grupo.label} /</span>
            )}
            <span className="truncate text-[16px] font-semibold">{enInicio ? "Home" : activa?.label}</span>
          </h1>

          {enInicio ? (
            <MenuDeCuenta />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Show the board"
              {...COMO_INTERRUPTOR}
              onClick={() => setBoardEn(activeId ?? null)}
              className="relative size-11 rounded-full text-muted-foreground"
            >
              <LayoutGrid />
              {board.widgets.length > 0 && (
                <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-[oklch(0.58_0.2_292)]" />
              )}
            </Button>
          )}
        </header>

        {/* El plano, a lo ancho y con las esquinas de arriba redondeadas: el
            mismo gesto que el panel de escritorio —una superficie levantada
            sobre el sustrato—, sin la pestaña que se le funde. */}
        <div className={cn("relative min-h-0 flex-1 overflow-hidden rounded-t-2xl", surfaceClasses(PLANO, PLANO))}>
          <SurfaceProvider value={PLANO}>
            {/* Todas las pestañas montadas y sólo la de adelante visible, como
                en el panel —ver ahí por qué `visibility` y no `display`—. Con
                Inicio a la vista, ninguna. */}
            {tabs.map((tab) => {
              const oculta = enInicio || tab.id !== activeId;
              return (
                <div
                  key={tab.id}
                  role="region"
                  aria-label={tab.label}
                  inert={oculta}
                  className={cn("absolute inset-0 overflow-auto", oculta && "invisible")}
                >
                  {tab.content}
                </div>
              );
            })}

            {enInicio && (
              <div className="absolute inset-0 overflow-y-auto overscroll-contain animate-in fade-in-0 duration-150">
                <Inicio />
              </div>
            )}
          </SurfaceProvider>
        </div>

        <Hoja
          abierta={hojaAbierta}
          onCerrar={cerrarHoja}
          titulo={preview !== null ? activa?.label : "Board"}
          sinCabecera={preview !== null}
        >
          {preview ?? (
            <WidgetBoard
              widgets={board.widgets}
              onWidgetClose={(id) => editar((b) => ({ ...b, widgets: b.widgets.filter((w) => w.id !== id) }))}
              onReorder={(ids) =>
                editar((b) => ({
                  ...b,
                  widgets: ids
                    .map((id) => b.widgets.find((w) => w.id === id))
                    .filter((w): w is WidgetDefinition => w !== undefined),
                }))
              }
              className="min-h-40"
            />
          )}
        </Hoja>
      </main>
    </WidgetDragProvider>
  );
}

/**
 * Lo que en escritorio está en el menú de la marca y en la barra del panel —el
 * tema, el sonido, salir—, que en el teléfono se quedaba sin lugar: no hay
 * sidebar ni barra. Va en el header de Inicio porque son cosas de la app y no
 * de una pantalla. What's new, FAQ y Support no están acá: son pantallas, y ya
 * están en la grilla.
 */
function MenuDeCuenta() {
  const oscuro = useTema((t) => t.oscuro);
  const alternarTema = useTema((t) => t.alternar);
  const suena = useSonido((s) => s.activo);
  const alternarSonido = useSonido((s) => s.alternar);
  const salir = useSesion((s) => s.salir);

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="More" className="size-11 rounded-full text-muted-foreground" />
        }
      >
        <Ellipsis />
      </DropdownTrigger>
      <DropdownContent align="end" side="bottom" sideOffset={4} className="w-auto">
        <MenuItem
          index={0}
          icon={oscuro ? Sun : Moon}
          label={oscuro ? "Light mode" : "Dark mode"}
          closeOnClick={false}
          onSelect={alternarTema}
        />
        {/* El click-clack después de alternar, igual que en escritorio: sólo se
            escucha al encender, que es cuando hace falta. */}
        <MenuItem
          index={1}
          icon={suena ? Volume2 : VolumeX}
          label={suena ? "Mute sounds" : "Unmute sounds"}
          closeOnClick={false}
          onSelect={() => {
            alternarSonido();
            sonar("toggle");
          }}
        />
        <DropdownSeparator />
        <MenuItem index={2} icon={LogOut} label="Sign out" onSelect={salir} />
      </DropdownContent>
    </DropdownMenu>
  );
}
