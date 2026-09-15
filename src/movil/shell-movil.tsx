import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bookmark,
  Ellipsis,
  House,
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
import type { WorkspaceTab } from "@/components/workspace-panel";
import { WidgetDragProvider } from "@/components/widget-drag";
import type { WidgetDefinition } from "@/components/widget";
import { cn } from "@/lib/utils";
import { SurfaceProvider } from "@/lib/surface-context";
import { surfaceClasses } from "@/lib/surface-classes";
import { useBoardActivo, useBoards } from "@/stores/board";
import { usePreview, usePreviewActivo } from "@/stores/preview";
import { useSesion } from "@/stores/sesion";
import { COMO_INTERRUPTOR, sonar, useSonido } from "@/stores/sonido";
import { useTema } from "@/stores/tema";
import { useWorkspace } from "@/stores/workspace";
import { ActividadDeLaConsola } from "./actividad";
import { Guardados } from "./guardados";
import { Hoja } from "./hoja";
import { Inicio } from "./inicio";
import {
  irAInicio,
  useAtrasCierra,
  useHistorialMovil,
  useNavegacionMovil,
  volver,
} from "./navegacion";

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

/* El aire de la barra de inicio, y va en cada caja que scrollea y no en el plano
   que las contiene: un `inset-0` se mide contra la **caja de relleno**, así que
   un `padding` del plano queda tapado por sus propios hijos y no aparta nada.
   Puesto en el scroller, la última fila termina arriba de la barra y el plano
   sigue llegando al borde del aparato. */
const SIN_PISAR_LA_BARRA = { paddingBottom: "env(safe-area-inset-bottom)" };

/* El botón del header, sobre el plano de marca: la tinta y el realce del
   `login-block`, que es de donde sale el fondo. El `Button` saca su relleno de
   `--hover` y `--active`, negros sobre claro; acá el fondo es oscuro en los dos
   temas, así que se los pisa por blancos.

   El glifo va en 20 y no en los 16 del `size="icon"`: ésos son los de un botón
   de barra de herramientas, rodeado de texto y de otros controles que le dan
   escala. Acá son dos o tres glifos solos sobre un plano de color, con el
   nombre de la sección en el medio y nada más —y son lo único que se toca de
   toda la barra—. En 16 se leen como marquitas; en 20 pesan lo que pesa lo que
   hay que apretar. La caja sigue en 44, que es el escalón táctil. */
const EN_EL_PLANO = [
  "size-11 rounded-full [&_svg]:size-5",
  "[--hover:rgb(255_255_255_/_0.12)] [--active:rgb(255_255_255_/_0.2)]",
].join(" ");

export function ShellMovil() {
  useHistorialMovil();

  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const enInicio = useNavegacionMovil((n) => n.enInicio);
  const activa = tabs.find((t) => t.id === activeId);
  const openTab = useWorkspace((w) => w.openTab);

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

  /* Las dos hojas de la consola —lo que pasó, y lo guardado—. Son de la app y
     no de una pestaña, así que no viven en el workspace: no hay a qué pestaña
     atarlas y cambiar de pestaña no tiene por qué cerrarlas. */
  const [panel, setPanel] = useState<"actividad" | "guardados" | null>(null);

  /* Lo que una de esas hojas pidió abrir, mientras la hoja se va.
 
     No se abre en el mismo toque, y ésta es la razón: en el teléfono abrir una
     pestaña empuja una entrada del historial, y la hoja tiene la suya puesta
     encima. Abriendo primero, la entrada de la pestaña queda arriba de la de la
     hoja, y el `history.back()` con el que la hoja se despide se come la
     pestaña recién abierta en vez de su propia entrada: el toque abría el
     perfil y volvía solo a donde estaba.
 
     Así que la hoja se cierra **por el mismo camino que el atrás del sistema**
     —`volver()`— y la pestaña se abre recién cuando ese atrás llegó, que es
     dentro de `cerrarHoja`. Un ref y no estado: no se pinta, y se lee en el
     mismo turno en que se escribió. */
  const pendiente = useRef<WorkspaceTab | null>(null);

  const abrirDesdeLaHoja = (tab: WorkspaceTab) => {
    pendiente.current = tab;
    volver();
  };

  /* Y sí se abre cuando una pantalla lo pide. Escribir una política o una cuenta
     DOC no abre un diálogo: pone la ficha en el board y llama a `abrirBoard`,
     que en escritorio despliega el riel. En el teléfono el board es esta hoja, y
     sin esto tocar el `+` no hacía nada visible —la ficha quedaba puesta detrás
     del botón de la grilla, esperando que a alguien se le ocurriera abrirlo—.
     
     Se mira el cambio de `open` y no su valor: es la diferencia entre "lo
     acaban de pedir" y "vino puesto", que es lo que hace que Chat › Analytics
     no salte con la hoja en la cara apenas se entra. */
  useEffect(
    () =>
      useBoards.subscribe((b, antes) => {
        if (!activeId) return;
        const ahora = b.porPestaña[activeId]?.open;
        if (ahora && !antes.porPestaña[activeId]?.open) setBoardEn(activeId);
      }),
    [activeId],
  );

  /* El vistazo, en cambio, sí se abre solo: lo pidió una fila que se acaba de
     tocar, y es la respuesta a ese toque. */
  /* Las dos hojas de la consola suben también en Inicio: sus botones están ahí.
     El vistazo y el board no: los abre una pantalla, y en Inicio no hay. */
  const hojaAbierta = panel !== null || (!enInicio && (preview !== null || verBoard));

  const cerrarHoja = () => {
    if (preview !== null) {
      cerrarPreview();
      return;
    }
    if (panel !== null) {
      setPanel(null);
      /* Y si se cerró para ir a algún lado, se va: acá la entrada de la hoja ya
         se consumió, así que la de la pestaña queda arriba de la que había. */
      const tab = pendiente.current;
      pendiente.current = null;
      if (tab) openTab(tab);
      return;
    }
    setBoardEn(null);
    /* Y se le avisa a la tienda. El `open` del riel de escritorio queda puesto
       cuando una pantalla pide el board, y si no se lo baja al cerrar la hoja
       el próximo pedido no cambia nada —`abrirBoard` sale temprano si ya estaba
       abierto— y la hoja no vuelve a subir: corregir una política después de
       haber escrito una no abría nada. */
    if (activeId) editarBoard(activeId, (b) => ({ ...b, open: false }));
  };

  /* Y el atrás del sistema la cierra, como a cualquier cosa que se abra encima.
     Antes la hoja llegaba al 85% y dejaba ver la pantalla de abajo, así que se
     leía como algo puesto sobre otra cosa que seguía ahí; ahora tapa todo, y
     tapando todo el atrás tiene que devolver *esto*, no irse de la pestaña. Sin
     esto, un toque de atrás cambiaba de pestaña y de paso cerraba la hoja: dos
     cosas por un gesto, y ninguna de las dos pedida. */
  useAtrasCierra(hojaAbierta, cerrarHoja);

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

        {/* El header se corre abajo del notch. Con la app instalada en la
            pantalla de inicio, iOS deja el contenido pasar por debajo de la
            barra de estado —`black-translucent`— y el plano de marca, que está
            atrás de todo, la pinta; lo que se aparta es la fila de controles. */}
        <header
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          className={cn("flex h-12 shrink-0 items-center gap-0.5 px-1.5 box-content", PANEL_INK.ink)}
        >
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

          {/* El título: dónde se está, y nada más.
 
              Tuvo el grupo adelante —"Chat / Search"—, que es una miga de pan, y
              una miga de pan promete dos cosas que acá no existen: que hay un
              camino de vuelta por sus escalones —el grupo no es una pantalla, no
              se puede abrir— y que se está adentro de algo. En el teléfono no se
              entra por el árbol: se entra por Inicio, donde las secciones son
              baldosas sueltas. */}
          <h1 className="min-w-0 flex-1 truncate px-1 text-[16px] font-semibold">
            {enInicio ? "Home" : activa?.label}
          </h1>

          {/* A la derecha, las dos cosas que no son de esta pantalla sino de la
              consola entera: qué pasó últimamente y lo que uno dejó a mano. Van
              en el header y no adentro de una pantalla porque se preguntan
              desde cualquiera —y la respuesta es la misma se esté donde se
              esté—. **También en Inicio**, que es justo desde donde más se
              pregunta: ahí uno todavía no eligió pantalla, y la mitad de las
              veces lo que viene a buscar es una de estas dos.

              Acá estaba el board de la pestaña. Se fue: el board sigue
              subiendo solo cuando una pantalla lo pide —escribir una política
              pone su ficha ahí y la hoja aparece— y eso es lo que hace en el
              teléfono. Abrirlo a mano era la otra mitad, la de escritorio,
              donde el riel está a la vista y cuesta un clic. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Activity"
            {...COMO_INTERRUPTOR}
            aria-pressed={panel === "actividad"}
            onClick={() => setPanel("actividad")}
            className={cn(EN_EL_PLANO, PANEL_INK.knobOff)}
          >
            <Activity />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Bookmarks"
            {...COMO_INTERRUPTOR}
            aria-pressed={panel === "guardados"}
            onClick={() => setPanel("guardados")}
            className={cn(EN_EL_PLANO, PANEL_INK.knobOff)}
          >
            <Bookmark />
          </Button>

          {/* Y en Inicio, además, lo que es de la app. */}
          {enInicio && <MenuDeCuenta />}
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

            Abajo llega hasta el borde del aparato: si cediera él, quedaría una
            banda de degradado debajo de la mano. Lo que se aparta de la barra de
            inicio es lo que se apoya adentro —ver `SIN_PISAR_LA_BARRA`—.

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
          style={{
            /* Los 2px de aire, salvo que el aparato pida más: en horizontal, el
               notch se come un costado. */
            marginLeft: "max(2px, env(safe-area-inset-left))",
            marginRight: "max(2px, env(safe-area-inset-right))",
          }}
          className={cn(
            "relative min-h-0 flex-1 overflow-hidden rounded-t-[28px]",
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
                  style={SIN_PISAR_LA_BARRA}
                  className={cn("absolute inset-0 overflow-auto", oculta && "invisible")}
                >
                  {tab.content}
                </div>
              );
            })}

            {/* Inicio no scrollea entero: adentro, lo único que se corre es la
                lista de pantallas. Ver `inicio.tsx`. */}
            {enInicio && (
              <div
                style={SIN_PISAR_LA_BARRA}
                className="absolute inset-0 overflow-hidden animate-in fade-in-0 duration-150"
              >
                <Inicio />
              </div>
            )}
          </SurfaceProvider>
        </div>

        <Hoja
          abierta={hojaAbierta}
          onCerrar={cerrarHoja}
          titulo={
            preview !== null
              ? activa?.label
              : panel === "actividad"
                ? "Activity"
                : panel === "guardados"
                  ? "Bookmarks"
                  : "Board"
          }
        >
          {panel === "actividad" ? (
            <ActividadDeLaConsola alAbrir={abrirDesdeLaHoja} />
          ) : panel === "guardados" ? (
            <Guardados alAbrir={abrirDesdeLaHoja} />
          ) : (
            preview ?? (
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
            )
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
