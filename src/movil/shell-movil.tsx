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
import { PANEL_ART, PANEL_INK } from "@/components/login-block";
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

/* El botón del header, sobre el plano de marca: la tinta y el realce del
   `login-block`, que es de donde sale el fondo. El `Button` saca su relleno de
   `--hover` y `--active`, negros sobre claro; acá el fondo es oscuro en los dos
   temas, así que se los pisa por blancos. */
const EN_EL_PLANO = [
  "size-11 rounded-full",
  "[--hover:rgb(255_255_255_/_0.12)] [--active:rgb(255_255_255_/_0.2)]",
].join(" ");

export function ShellMovil() {
  useHistorialMovil();

  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const enInicio = useNavegacionMovil((n) => n.enInicio);
  const puedeVolver = useNavegacionMovil((n) => n.indice > 0);
  const activa = tabs.find((t) => t.id === activeId);
  const grupo = activeId ? NAV.find((g) => g.items.some((h) => h.id === raiz(activeId))) : undefined;

  const oscuro = useTema((t) => t.oscuro);
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
      {/* El shell toma la ventana entera, y con las unidades dinámicas: en el
          teléfono `100vh` cuenta la barra de direcciones esté o no a la vista, y
          el pie del plano quedaba abajo de ella. Es lo mismo que hace
          `MobileAuthBlock`, que es la otra pantalla de esta app pensada para una
          mano —la puerta— y de la que sale el resto de la forma de acá. */}
      <main className="relative isolate flex h-dvh w-dvw min-h-0 min-w-0 flex-col overflow-hidden bg-surface-1">
        {/* El plano de marca, el mismo que la puerta: `PANEL_ART`, importado y
            no copiado —dos degradados iguales escritos dos veces son dos que se
            van a separar—. Va detrás de todo y no envolviendo al contenido: lo
            que se apoya encima no tiene por qué saber que hay una imagen.

            Es oscuro en los dos temas, a propósito —lo dice el bloque—, así que
            lo que queda encima va siempre en tinta clara. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: PANEL_ART[oscuro ? "dark" : "light"] }}
        />

        <header className={cn("flex h-12 shrink-0 items-center gap-0.5 px-1.5", PANEL_INK.ink)}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Home"
            aria-current={enInicio ? "page" : undefined}
            onClick={irAInicio}
            className={cn(EN_EL_PLANO, enInicio ? PANEL_INK.ink : PANEL_INK.knobOff)}
          >
            <House />
          </Button>

          {!enInicio && puedeVolver && (
            <Button variant="ghost" size="icon" aria-label="Back" onClick={volver} className={cn("-ml-1.5", EN_EL_PLANO)}>
              <ChevronLeft />
            </Button>
          )}

          {/* El título: dónde se está. La sección va antes cuando dice algo —hay
              dos Search y dos Reports—; los grupos sin nombre no tienen qué
              poner. */}
          <h1 className="flex min-w-0 flex-1 items-baseline gap-1.5 px-1">
            {!enInicio && grupo?.label && (
              <span className={cn("shrink-0 text-[13px]", PANEL_INK.body)}>{grupo.label} /</span>
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
              className={cn("relative", EN_EL_PLANO, PANEL_INK.knobOff)}
            >
              <LayoutGrid />
              {board.widgets.length > 0 && (
                <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-[oklch(0.58_0.2_292)]" />
              )}
            </Button>
          )}
        </header>

        {/* El plano: el mismo gesto que el panel de escritorio —una superficie
            levantada sobre el sustrato—, sin la pestaña que se le funde, y con
            la forma de la tarjeta de `MobileAuthBlock`.

            Va despegado 2px de los costados para que el plano de marca se vea
            pasar por detrás: así se lee como una hoja apoyada y no como el fondo
            de la ventana. Es un cuarto del aire que se toma en escritorio —ahí
            el panel va con 8px—, porque en 375px cada píxel de ancho es de la
            tabla que hay adentro, y con el degradado detrás alcanza un filo para
            que se entienda que son dos capas.

            Abajo llega hasta el borde. Lo que cede ante la barra de inicio es el
            **relleno** y no el margen: la superficie sigue hasta el fondo del
            aparato —si no, queda una banda de degradado bajo la mano— y lo que
            se apoya adentro empieza más arriba. Va como `padding` del plano, y
            los planos de las pestañas lo respetan porque un `inset-0` se mide
            contra la caja de relleno.

            **Sólo se redondean las esquinas de arriba.** Ése es el borde libre
            —el que hace que el plano se lea levantado, y el número sale de la
            tarjeta de la puerta, un escalón más chico porque acá el aire
            también lo es—. Abajo no: a 2px del borde del teléfono, una curva
            propia queda adentro de la curva de la pantalla y se leen las dos
            desalineadas. Cuadrada, el corte lo pone el borde del aparato.

            La sombra sube dos escalones sobre el fondo del plano y no acompaña
            al relleno: lo que lo separa del sustrato es la sombra, porque en
            claro la escalera es plana en blanco de la tercera para arriba. */}
        <div
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className={cn(
            "relative mx-0.5 min-h-0 flex-1 overflow-hidden rounded-t-[28px]",
            surfaceClasses(PLANO, PLANO + 2),
          )}
        >
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

            {/* Inicio no scrollea entero: adentro, lo único que se corre es la
                lista de pantallas. Ver `inicio.tsx`. */}
            {enInicio && (
              <div className="absolute inset-0 overflow-hidden animate-in fade-in-0 duration-150">
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
          <Button variant="ghost" size="icon" aria-label="More" className={cn(EN_EL_PLANO, PANEL_INK.knobOff)} />
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
