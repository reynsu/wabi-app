"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
/* Sólo el tipo: se borra al compilar, así que nombrarlo no arrastra la
   biblioteca. Lo que la carga es el `import()` de adentro del efecto. */
import type { PDFDocumentProxy } from "pdfjs-dist";
/* Dónde está el worker.
 *
 * Con el `?url` de Vite, que resuelve el paquete y devuelve la dirección del
 * archivo emitido —con la base del deploy puesta: la GitHub Page cuelga de
 * `/wabi-app/`, y una ruta escrita a mano se rompería ahí—.
 *
 * Con `new URL("pdfjs-dist/…", import.meta.url)` **no** alcanza, y es un error
 * silencioso: eso resuelve como una ruta relativa al módulo, no como un
 * especificador de paquete, así que en desarrollo apunta a un archivo que no
 * existe. El lector falla al abrir cualquier PDF y lo único que se ve es un
 * `ERR_FILE_NOT_FOUND` en la consola.
 *
 * Import estático a propósito: lo que entra acá es la cadena con la dirección, no
 * la biblioteca. Lo que arrastra el megabyte es el `import()` de adentro del
 * efecto. */
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, FileText, Minus, Plus } from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Elevated } from "@/lib/elevated";
import {
  GLIFOS,
  claseDeArchivo,
  extensionDe,
  leerCsv,
  type ArchivoParaVer,
} from "@/lib/archivos";
import { useSize, useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";

/**
 * El visor de archivos.
 *
 * Muestra el contenido de un archivo adentro de la consola, en vez de bajarlo y
 * abrirlo en otro programa. Hoy lo usa Email Reports —un reporte es un CSV— y
 * está escrito para que sirva igual al día que haya que mostrar el adjunto de un
 * correo, que es el otro lugar de esta app donde hay archivos con nombre.
 *
 * ── Qué sabe leer, y qué no ───────────────────────────────────────────────
 *
 * Dos maneras de dibujar, no tres, porque son dos las formas que tiene un
 * archivo de mostrarse:
 *
 * - **Una planilla** —filas y columnas—, que es lo que son un CSV y una hoja de
 *   Excel. Se dibujan igual porque **son** lo mismo una vez leídas; lo único
 *   distinto es quién las lee.
 * - **Un documento** —un PDF—, que se dibuja solo: el navegador trae su lector,
 *   así que acá alcanza con darle la dirección y el lugar.
 *
 * Y por eso el visor **no lee bytes**: recibe lo ya leído. Un CSV llega como
 * texto y lo parte él —ver `leerCsv`, que es RFC 4180 y son treinta líneas—; un
 * PDF llega como dirección y lo dibuja el navegador; una hoja de Excel llega
 * como filas, porque un `.xlsx` es un zip de XML y sacarle las filas es un
 * parser entero, no una función.
 *
 * **Esta app no tiene ese parser ni tiene ningún `.xlsx`.** Un archivo de Excel
 * que llegue como dirección cae en `SinLector`, que lo dice con todas las
 * letras en vez de mostrar un panel vacío. El día que haya hojas de verdad, lo
 * que cambia es quien las abre —le pasa `filas`— y no este archivo: la planilla
 * ya está escrita y ya las dibuja.
 */

/* ─────────────────────────── La planilla ───────────────────────────
 *
 * Filas y columnas, como en una planilla de cálculo: la numeración a la
 * izquierda, las letras arriba, y la cuadrícula llenando todo el espacio aunque
 * el archivo no llegue hasta el borde.
 *
 * **Con números y letras, y sin encabezado en negrita.** La tentación es tomar
 * la primera fila como cabecera, y en el reporte de esta app estaría mal: sus
 * tres primeras filas son la ficha —qué ventana, cuántas cuentas— y la cabecera
 * de la tabla recién aparece después del renglón en blanco. Un visor que adivina
 * cuál es la cabecera acierta en un archivo y miente en el siguiente. Las letras,
 * en cambio, son verdad en todos, y son lo que deja decir "mirá la C7".
 *
 * **Y la cuadrícula sigue después del dato.** Un archivo de seis filas dibujado
 * como seis renglones sueltos sobre un panel vacío no se ve como una planilla:
 * se ve como una tabla chica perdida en el medio. Las celdas vacías son lo que
 * dice qué clase de archivo es esto, igual que en el programa donde va a
 * terminar abriéndose.
 */

/** El alto de una fila, fijo. Fijo y no medido porque de él salen dos cuentas
 *  —cuántas filas vacías entran abajo, y dónde cae cada renglón— y una altura
 *  que dependiera del contenido las haría distintas por fila. */
const ALTO_FILA = 28;

/** El ancho de una columna vacía. Las que tienen dato miden lo que mide su
 *  contenido; éstas no tienen contenido, así que miden lo que se les diga. */
const ANCHO_VACIA = 96;

/** El ancho de la columna de la numeración, que está pegada a la izquierda. Es
 *  también cuánto se aparta una celda de ella al llevarla a la vista con el
 *  teclado: si no, la celda enfocada queda justo debajo del número. */
const ANCHO_NUMERACION = 44;

/** La letra de una columna, como en una planilla: A…Z, después AA, AB. */
function letraDeColumna(i: number) {
  let n = i;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

function Planilla({ filas }: { filas: string[][] }) {
  const escala = useTypeScale();
  const caja = useRef<HTMLDivElement>(null);
  const tabla = useRef<HTMLTableElement>(null);
  const [medida, setMedida] = useState<{ ancho: number; alto: number }>();
  /* Cuántas columnas vacías hacen falta a la derecha. En estado porque depende
     de cuánto ocuparon las de dato, que sólo se sabe después de dibujarlas. */
  const [vacias, setVacias] = useState(0);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) =>
      setMedida({
        ancho: entrada.contentRect.width,
        alto: entrada.contentRect.height,
      }),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const conDato = filas.reduce((maximo, f) => Math.max(maximo, f.length), 0);

  /* Cuántas columnas vacías entran, sin medirlas dos veces.
   *
   * Lo que ocupan las de dato se **despeja** en vez de medirse aparte: el ancho
   * total de la tabla menos lo que ponen las vacías, que miden un número que
   * elegimos nosotros. Sin eso habría que medir un ancho que cambia al agregar
   * columnas, agregar columnas por lo que se midió, y volver a medir: un lazo
   * que no cierra nunca. */
  useEffect(() => {
    const nodo = tabla.current;
    if (!nodo || !medida) return;
    const anchoDeDatos = nodo.scrollWidth - vacias * ANCHO_VACIA;
    const faltan = Math.max(
      0,
      Math.ceil((medida.ancho - anchoDeDatos) / ANCHO_VACIA),
    );
    if (faltan !== vacias) setVacias(faltan);
  }, [medida, vacias, filas]);

  const columnas = conDato + vacias;
  /* Y las filas vacías de abajo, que son una cuenta directa porque el alto de
     fila es fijo. Se descuenta la banda de las letras. */
  const total = medida
    ? Math.max(filas.length, Math.ceil((medida.alto - ALTO_FILA) / ALTO_FILA))
    : filas.length;

  /* ── El teclado ────────────────────────────────────────────────────────
   *
   * Una planilla se recorre celda por celda, así que acá el foco es la celda y
   * no la fila: es lo que deja decir "andá a la C7" y llegar sin el mouse, y lo
   * que trae aprendido cualquiera que haya usado el programa donde este archivo
   * va a terminar abriéndose. Las flechas mueven de a una, `Inicio`/`Fin` van a
   * las puntas del renglón —con `Ctrl`, a las de la hoja entera— y `AvPág` baja
   * una pantalla.
   *
   * Una sola parada de tabulado para toda la cuadrícula: la celda donde
   * quedaste. Es lo que promete el `role="grid"` de abajo, y es lo que evita
   * que una hoja de cuarenta columnas sean cuarenta paradas por renglón.
   *
   * (Las tablas de la consola se recorren por fila y no por celda; el porqué de
   * esa diferencia está escrito en `pages/tabla-teclado`.) */
  const [cursor, setCursor] = useState({ fila: 0, columna: 0 });
  /* Recortado contra la hoja de ahora: la cuadrícula crece y se encoge con el
     panel —las filas y columnas vacías salen de cuánto lugar hay—, y una
     posición vieja dejaría la hoja sin ninguna celda tabulable. */
  const foco = {
    fila: Math.min(cursor.fila, Math.max(0, total - 1)),
    columna: Math.min(cursor.columna, Math.max(0, columnas - 1)),
  };

  const irA = (fila: number, columna: number) => {
    const f = Math.max(0, Math.min(fila, total - 1));
    const c = Math.max(0, Math.min(columna, columnas - 1));
    const destino = tabla.current?.querySelector<HTMLTableCellElement>(
      `td[data-fila="${f}"][data-columna="${c}"]`,
    );
    if (!destino) return;
    setCursor({ fila: f, columna: c });
    /* Enfocar sin mover y llevar a la vista después: el desplazamiento que hace
       el navegador al enfocar no conoce el `scroll-margin` con el que las
       celdas se apartan de la numeración y de las letras, que están pegadas. */
    destino.focus({ preventScroll: true });
    destino.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  const teclas = (evento: KeyboardEvent<HTMLTableElement>) => {
    const { fila, columna } = foco;
    /* Una pantalla de filas, menos una: la que queda a la vista es la
       referencia de dónde se estaba. */
    const pantalla = Math.max(
      1,
      Math.floor((medida?.alto ?? 0) / ALTO_FILA) - 1,
    );
    const salto: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      PageUp: [-pantalla, 0],
      PageDown: [pantalla, 0],
    };
    const paso = salto[evento.key];
    if (paso) {
      evento.preventDefault();
      return irA(fila + paso[0], columna + paso[1]);
    }
    /* `Inicio` y `Fin` son del renglón; con el modificador, de la hoja. Es lo
       que hace la planilla de escritorio, y la tecla del modificador la pone el
       sistema: `Cmd` en un Mac, `Ctrl` en el resto. */
    if (evento.key === "Home") {
      evento.preventDefault();
      const alPrincipio = evento.ctrlKey || evento.metaKey;
      return irA(alPrincipio ? 0 : fila, 0);
    }
    if (evento.key === "End") {
      evento.preventDefault();
      const alFinal = evento.ctrlKey || evento.metaKey;
      return irA(alFinal ? total - 1 : fila, columnas - 1);
    }
  };

  const celda = "border-r border-b border-border/60";
  const encabezado = cn(
    celda,
    "bg-muted text-center font-normal text-muted-foreground select-none",
  );

  return (
    /* Enmarcada, como la hoja del PDF está apoyada en su pozo: las dos son un
       archivo adentro de un panel, y las dos tienen que decir dónde terminan.
       La caja de afuera es la que mide —el `ScrollArea` mueve lo de adentro— y
       el de los dos ejes porque una planilla se corre para los dos lados. */
    <div
      ref={caja}
      className="h-full min-h-0 overflow-hidden rounded-xl border border-border"
    >
      <ScrollArea className="h-full" orientation="both">
      <table
        ref={tabla}
        /* `grid` y no la tabla que es: acá el teclado **reemplaza** al del
           lector de pantalla —se mueve celda por celda, que es lo que un lector
           hace con sus propios atajos en una tabla— y por eso conviene que lo
           anuncie como lo que se maneja así. Es al revés que en las tablas de
           la consola, donde el foco es la fila y la lectura nativa se deja
           intacta: ver `pages/tabla-teclado`. */
        role="grid"
        aria-label="Spreadsheet"
        onKeyDown={teclas}
        className="border-separate border-spacing-0 tabular-nums"
        style={{ fontSize: escala.body }}
      >
        {/* Las letras. Pegadas arriba, para que sigan estando cuando el archivo
            se recorre hacia abajo. */}
        <thead>
          <tr>
            {/* El rincón, donde se cruzan la numeración y las letras. Pegado a
                los dos lados a la vez, así que va un escalón más arriba: si no,
                al correr la tabla las letras le pasarían por encima. */}
            <th
              className={cn(encabezado, "sticky top-0 left-0 z-20")}
              style={{ height: ALTO_FILA, minWidth: ANCHO_NUMERACION }}
            />
            {Array.from({ length: columnas }, (_, j) => (
              <th
                key={j}
                scope="col"
                className={cn(encabezado, "sticky top-0 z-10 px-3")}
                style={{
                  height: ALTO_FILA,
                  fontSize: escala.caption,
                  ...(j >= conDato ? { minWidth: ANCHO_VACIA } : undefined),
                }}
              >
                {letraDeColumna(j)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: total }, (_, i) => {
            const fila = filas[i];
            return (
              <tr key={i}>
                {/* La numeración. Pegada a la izquierda para que siga estando
                    cuando la tabla se corre a lo ancho, que es cuando más falta
                    hace saber en qué fila se está. */}
                <th
                  scope="row"
                  className={cn(encabezado, "sticky left-0 z-10 px-3 text-right")}
                  style={{ height: ALTO_FILA, fontSize: escala.caption }}
                >
                  {i + 1}
                </th>

                {Array.from({ length: columnas }, (_, j) => (
                  <td
                    key={j}
                    data-fila={i}
                    data-columna={j}
                    /* Una sola celda tabulable —la del cursor—, y las demás
                       alcanzables sólo con las flechas. */
                    tabIndex={i === foco.fila && j === foco.columna ? 0 : -1}
                    /* El clic también mueve el cursor: la celda que se toca es
                       desde la que siguen las flechas. */
                    onFocus={() => setCursor({ fila: i, columna: j })}
                    className={cn(
                      celda,
                      "px-3 whitespace-pre text-foreground",
                      /* El recuadro del cursor. `focus` y no `focus-visible`:
                         en una planilla la celda parada es lo que se está
                         mirando, se haya llegado con el mouse o con la flecha
                         —es un cursor, no un aviso de tabulado—. Por dentro,
                         para no correr la cuadrícula un píxel.

                         Sin `outline-none` al lado: en Tailwind 4 esa clase
                         fija `--tw-outline-style: none` para el elemento, y de
                         esa misma variable sale el estilo de `outline-2`. Las
                         dos juntas dan un contorno que no se dibuja. */
                      "focus:outline-2 focus:-outline-offset-2",
                      "focus:outline-[color:var(--focus-ring,#6B97FF)]",
                    )}
                    style={{
                      height: ALTO_FILA,
                      /* Lo que se aparta de la numeración y de las letras al
                         llevar la celda a la vista: las dos están pegadas y una
                         celda contra el borde queda debajo de ellas. */
                      scrollMarginTop: ALTO_FILA,
                      scrollMarginLeft: ANCHO_NUMERACION,
                      ...(j >= conDato ? { minWidth: ANCHO_VACIA } : undefined),
                    }}
                  >
                    {fila?.[j] ?? ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </ScrollArea>
    </div>
  );
}

/* ─────────────────────────── El documento ───────────────────────────
 *
 * Un PDF, dibujado con PDF.js.
 *
 * **Y no con `<object>`**, que era lo primero que había acá. Un `<object
 * type="application/pdf">` le pasa el archivo al lector que trae el navegador, y
 * eso tiene dos problemas: no todos traen uno —el navegador embebido de un
 * editor, por ejemplo, ofrece bajar el archivo en vez de mostrarlo—, y cuando no
 * lo traen no siempre lo dicen: el contenido de reserva de la etiqueta aparece
 * si el navegador **rechaza** el tipo, no si lo acepta y después no pinta nada.
 * El resultado era un panel en blanco sin explicación.
 *
 * PDF.js dibuja en un canvas, así que se ve igual en todos lados y el resultado
 * no depende de lo que el navegador tenga instalado.
 *
 * **Se carga recién cuando hace falta.** El `import()` está adentro del efecto:
 * quien abre un CSV no baja el megabyte del lector, y en esta app la mayoría de
 * los reportes son CSV. El worker se pide con `?url`, que es lo que hace que
 * Vite lo emita como un archivo aparte y le ponga la base del deploy —la
 * GitHub Page cuelga de `/wabi-app/`, y una ruta escrita a mano se rompería
 * ahí—.
 */

/** Un punto de PDF contra un píxel de CSS: 1/72 de pulgada contra 1/96. Es lo
 *  que convierte el tamaño de una hoja en un tamaño de pantalla. */
const PT_A_PX = 96 / 72;

/** El aire alrededor de la hoja, y lo que se le reserva abajo a la barra de
 *  controles: la hoja entera tiene que entrar **arriba** de la barra, no debajo. */
const AIRE = 16;
const RESERVA = 52;

/** Los escalones del zoom. Discretos y no un deslizador: quien mira un
 *  documento quiere "un poco más grande", no elegir un número. El ajuste no está
 *  en la lista —es el que salga— y por eso los botones buscan el escalón
 *  siguiente al efectivo, en vez de moverse por índice. */
const ESCALONES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

function Documento({ url, nombre }: { url: string; nombre: string }) {
  const escala = useTypeScale();
  const medidas = useSize();
  const [documento, setDocumento] = useState<PDFDocumentProxy | undefined>();
  const [fallo, setFallo] = useState(false);
  /* Qué página se está mirando, y a qué tamaño. `zoom` en `undefined` es
     "ajustada", que es como abre: ver `ajuste`. */
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState<number>();
  /* El tamaño de la hoja actual, en puntos. Sale del documento porque un PDF
     puede traer páginas de distinto tamaño, así que el ajuste se calcula contra
     la que se está mirando y no contra la primera. */
  const [hoja, setHoja] = useState<{ ancho: number; alto: number }>();
  /* La caja donde entra. Empieza sin medir: hasta que no midió, dibujar sería
     dibujar dos veces. */
  const [caja, setCaja] = useState<{ ancho: number; alto: number }>();
  const marco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = marco.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) =>
      setCaja({
        ancho: entrada.contentRect.width,
        alto: entrada.contentRect.height,
      }),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    let vivo = true;
    /* Lo que se cierra es la **tarea de carga** y no el documento: es la que se
       lleva el worker. Cada PDF abierto tiene el suyo, así que sin esto abrir
       diez reportes deja diez colgados hasta que se recargue la página. */
    let carga: { destroy: () => Promise<void> } | undefined;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const tarea = pdfjs.getDocument({ url });
        carga = tarea;
        const doc = await tarea.promise;
        /* El panel se pudo cerrar mientras el lector cargaba. */
        if (!vivo) return;
        setDocumento(doc);
      } catch (error) {
        /* Y queda escrito en la consola. El cartel de abajo le dice a quien mira
           que no se pudo; esto le dice a quien la abre **por qué**, que es la
           diferencia entre un archivo dañado, un worker mal servido y un lector
           que no cargó. Tragarse el error deja las tres cosas iguales. */
        console.error("No se pudo abrir el PDF", nombre, error);
        if (vivo) setFallo(true);
      }
    })();

    return () => {
      vivo = false;
      void carga?.destroy();
    };
  }, [url, nombre]);

  /* Cuánto mide la hoja que se está mirando. */
  useEffect(() => {
    if (!documento) return;
    let vivo = true;
    void documento.getPage(pagina).then((p) => {
      const vista = p.getViewport({ scale: 1 });
      if (vivo) setHoja({ ancho: vista.width, alto: vista.height });
    });
    return () => {
      vivo = false;
    };
  }, [documento, pagina]);

  /**
   * A qué escala entra la hoja entera.
   *
   * Por el lado que sobre menos —el ancho o el alto—, que es lo que hace que
   * entre completa y no sólo la parte de arriba. Con la barra descontada del
   * alto: una hoja que "entra" pero termina detrás de los controles no entra.
   *
   * **Y nunca más grande que el original.** Una hoja no se agranda sola: en un
   * panel muy alto, ajustar sin techo la infla y un A4 sale con el cuerpo de
   * texto del tamaño de un título. Agrandar es una decisión de quien mira, y
   * para eso están los botones.
   */
  const ajuste =
    hoja && caja
      ? Math.min(
          (caja.ancho - AIRE * 2) / (hoja.ancho * PT_A_PX),
          (caja.alto - AIRE - RESERVA) / (hoja.alto * PT_A_PX),
          1,
        )
      : undefined;

  const efectivo = zoom ?? ajuste;

  const alejar = () => {
    if (efectivo === undefined) return;
    const menor = [...ESCALONES].reverse().find((e) => e < efectivo - 0.001);
    if (menor !== undefined) setZoom(menor);
  };

  const acercar = () => {
    if (efectivo === undefined) return;
    const mayor = ESCALONES.find((e) => e > efectivo + 0.001);
    if (mayor !== undefined) setZoom(mayor);
  };

  if (fallo) {
    return (
      <SinLector
        titulo="This PDF couldn’t be opened"
        detalle="The file may be damaged. It can still be downloaded and opened elsewhere."
      />
    );
  }

  return (
    /* El fondo donde se apoya la hoja.
     *
     * Sin él, en claro la página blanca queda sobre un panel blanco y lo único
     * que la separa es su sombra: el archivo se lee, pero no se ve dónde
     * empieza y dónde termina la hoja. Con el fondo apagado, lo blanco es el
     * documento y lo gris es el mueble, que es la misma división que hace
     * cualquier lector de PDF.
     *
     * `bg-muted`, que es el relleno tranquilo de esta app —el mismo del control
     * segmentado— y no un gris elegido acá. Anda en los dos temas por el mismo
     * motivo: en claro se hunde contra el blanco del panel, y en oscuro el papel
     * blanco resalta contra cualquier gris de este lado de la escala.
     *
     * Redondeado y con su filete, como un pozo: es una superficie distinta de la
     * del panel, no una franja pintada. */
    <div
      ref={marco}
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden",
        "rounded-xl border border-border bg-muted",
      )}
    >
      {/* Los dos ejes: ajustada la hoja no desborda, pero acercada sí, y en las
          dos direcciones. */}
      <ScrollArea className="h-full" orientation="both">
        <div
          className="flex min-h-full min-w-full items-center justify-center"
          style={{ padding: AIRE, paddingBottom: RESERVA }}
        >
          {!documento || efectivo === undefined || !hoja ? (
            <p className="text-muted-foreground" style={{ fontSize: escala.body }}>
              Opening {nombre}…
            </p>
          ) : (
            <PaginaDePdf
              /* La `key` con la página adentro: cambiar de hoja es cambiar de
                 dibujo, no redibujar el mismo. Sin esto, el canvas de la
                 anterior se queda a la vista hasta que termine el dibujo nuevo. */
              key={pagina}
              documento={documento}
              numero={pagina}
              hoja={hoja}
              escala={efectivo}
            />
          )}
        </div>
      </ScrollArea>

      {documento && efectivo !== undefined && (
        <Controles
          escalaTexto={escala.caption}
          icono={medidas.icon}
          pagina={pagina}
          paginas={documento.numPages}
          onPagina={setPagina}
          porciento={Math.round(efectivo * 100)}
          ajustada={zoom === undefined}
          onAlejar={alejar}
          onAcercar={acercar}
          onAjustar={() => setZoom(undefined)}
        />
      )}
    </div>
  );
}

/**
 * La barra de controles.
 *
 * Flota sobre la hoja en vez de ocupar una franja fija: una barra en el flujo le
 * come alto al documento para siempre, y acá el alto es justamente lo que decide
 * de qué tamaño se ve la página. Es el mismo argumento con el que flota la barra
 * de acciones de esta app.
 *
 * En reposo se aclara y con el puntero encima vuelve entera, porque tapa algo
 * que se está leyendo.
 *
 * **Las flechas de página no aparecen en un documento de una sola.** Un control
 * que nunca va a hacer nada es ruido, y casi todos los reportes son de una hoja.
 */
function Controles({
  escalaTexto,
  icono,
  pagina,
  paginas,
  onPagina,
  porciento,
  ajustada,
  onAlejar,
  onAcercar,
  onAjustar,
}: {
  escalaTexto: number;
  icono: number;
  pagina: number;
  paginas: number;
  onPagina: (n: number) => void;
  porciento: number;
  ajustada: boolean;
  onAlejar: () => void;
  onAcercar: () => void;
  onAjustar: () => void;
}) {
  const boton = cn(
    "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md",
    "text-muted-foreground transition-colors duration-80",
    "hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground",
    "outline-none disabled:pointer-events-none disabled:opacity-40",
  );

  return (
    /* Dos escalones sobre lo que tiene debajo, que es lo que esta app le da a lo
       que flota —un menú, un popover—: el plano y la sombra salen de ahí y no de
       clases escritas acá, así que la barra pesa lo que pesa cualquier cosa
       apoyada encima del contenido. */
    <Elevated
      offset={2}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 -translate-x-1/2",
        "flex items-center gap-1 rounded-xl border border-border p-1",
        "opacity-70 transition-opacity duration-150 hover:opacity-100",
      )}
      style={{ fontSize: escalaTexto }}
    >
        {paginas > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              disabled={pagina <= 1}
              onClick={() => onPagina(pagina - 1)}
              className={boton}
            >
              <ChevronLeft size={icono} strokeWidth={1.5} />
            </button>

            <span className="px-1 tabular-nums text-muted-foreground select-none">
              {pagina} / {paginas}
            </span>

            <button
              type="button"
              aria-label="Next page"
              disabled={pagina >= paginas}
              onClick={() => onPagina(pagina + 1)}
              className={boton}
            >
              <ChevronRight size={icono} strokeWidth={1.5} />
            </button>

            {/* El filete que separa las páginas del tamaño: son dos cosas
                distintas metidas en la misma barra. */}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          </>
        )}

        <button
          type="button"
          aria-label="Zoom out"
          onClick={onAlejar}
          className={boton}
        >
          <Minus size={icono} strokeWidth={1.5} />
        </button>

        {/* El número es el botón de volver al ajuste: es lo que uno toca cuando
            se perdió de zoom, y ahorra un control más en una barra que flota
            sobre lo que se está leyendo. Deshabilitado cuando ya está ajustada,
            que es lo que dice que ése es el estado de reposo. */}
        <button
          type="button"
          aria-label="Fit page"
          title="Fit page"
          disabled={ajustada}
          onClick={onAjustar}
          className={cn(
            "min-w-11 cursor-pointer rounded-md px-1 py-0.5 tabular-nums",
            "text-muted-foreground transition-colors duration-80 outline-none",
            "hover:bg-hover hover:text-foreground focus-visible:bg-hover",
            "disabled:pointer-events-none",
          )}
        >
          {porciento}%
        </button>

        <button
          type="button"
          aria-label="Zoom in"
          onClick={onAcercar}
          className={boton}
        >
          <Plus size={icono} strokeWidth={1.5} />
        </button>
    </Elevated>
  );
}

/**
 * Una página, en un canvas.
 *
 * **A la resolución de la pantalla y no a la del CSS.** El canvas se dibuja
 * multiplicado por `devicePixelRatio` y se muestra al tamaño que le toca: en una
 * pantalla densa, sin eso, el texto de un PDF sale borroso justo donde más se
 * nota que es texto.
 *
 * El tamaño de la caja se pone **antes** de dibujar, con lo que ya se sabe de la
 * hoja: así el hueco existe desde el primer pintado y la barra de controles no
 * salta de lugar cuando el dibujo llega.
 *
 * Se vuelve a dibujar cuando cambia la escala, y el dibujo anterior se cancela:
 * `render` es asíncrono, y dos dibujos encima del mismo canvas terminan en el
 * que llegue último, que no siempre es el que corresponde al tamaño de ahora.
 */
function PaginaDePdf({
  documento,
  numero,
  hoja,
  escala,
}: {
  documento: PDFDocumentProxy;
  numero: number;
  hoja: { ancho: number; alto: number };
  escala: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ancho = hoja.ancho * PT_A_PX * escala;
  const alto = hoja.alto * PT_A_PX * escala;

  useEffect(() => {
    let vivo = true;
    let tarea: { cancel: () => void } | undefined;

    (async () => {
      const pagina = await documento.getPage(numero);
      const nodo = canvas.current;
      if (!vivo || !nodo) return;

      const dpr = window.devicePixelRatio || 1;
      const vista = pagina.getViewport({ scale: PT_A_PX * escala * dpr });

      nodo.width = Math.floor(vista.width);
      nodo.height = Math.floor(vista.height);

      const contexto = nodo.getContext("2d");
      if (!contexto) return;

      const dibujo = pagina.render({
        canvas: nodo,
        canvasContext: contexto,
        viewport: vista,
      });
      tarea = dibujo;
      try {
        await dibujo.promise;
      } catch {
        /* Cancelado porque cambió la escala: el dibujo que viene lo reemplaza. */
      }
    })();

    return () => {
      vivo = false;
      tarea?.cancel();
    };
  }, [documento, numero, escala]);

  return (
    /* Blanca y con sombra, en los dos temas: una hoja de PDF **es** blanca, y
       teñirla en oscuro sería mostrar algo distinto de lo que el archivo dice.
       La sombra es la que separa una superficie de la de abajo en esta app, y
       acá dice lo mismo: esto es una hoja apoyada sobre el panel. */
    <canvas
      ref={canvas}
      aria-label={`Page ${numero}`}
      /* La sombra ya trae el filete: `shadow-surface-2` es un anillo de un píxel
         al seis por ciento de negro más un desplazamiento mínimo, así que sobre
         el fondo apagado el borde de la hoja queda dibujado sin agregarle nada.
         Le puse un `outline` encima y era una segunda línea sobre la primera. */
      className="shrink-0 bg-white shadow-surface-2"
      style={{ width: ancho, height: alto }}
    />
  );
}

/* ─────────────────────────── Lo que no se puede leer ─────────────────────── */

function SinLector({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <AnimatedEmpty>
      <AnimatedEmptyHeader>
        <AnimatedEmptyMedia variant="icon">
          <FileText />
        </AnimatedEmptyMedia>
        <AnimatedEmptyTitle>{titulo}</AnimatedEmptyTitle>
        <AnimatedEmptyDescription>{detalle}</AnimatedEmptyDescription>
      </AnimatedEmptyHeader>
    </AnimatedEmpty>
  );
}

/* ─────────────────────────── El visor ─────────────────────────── */

/**
 * Un archivo, abierto.
 *
 * Arriba dice qué archivo es y cuánto tiene; abajo, el contenido. Lo que se
 * puede hacer con él —bajarlo, mañana mandarlo— entra por `acciones`: el visor
 * muestra, no decide qué se hace con lo que muestra, y así el mismo componente
 * sirve para un reporte que se baja y para un adjunto que quizás no.
 */
export function FileViewer({
  archivo,
  acciones,
}: {
  archivo: ArchivoParaVer;
  acciones?: ReactNode;
}) {
  const escala = useTypeScale();
  const clase = claseDeArchivo(archivo.nombre);
  const Glifo = GLIFOS[clase];

  /* Las filas, vengan del texto o ya partidas. Memorizado contra el contenido:
     sin esto, cada pintada del panel volvería a partir el archivo entero. */
  const filas = useMemo(() => {
    if (archivo.contenido.clase === "filas") return archivo.contenido.filas;
    if (archivo.contenido.clase === "texto") {
      return leerCsv(
        archivo.contenido.texto,
        extensionDe(archivo.nombre) === "tsv" ? "\t" : ",",
      );
    }
    return undefined;
  }, [archivo.contenido, archivo.nombre]);

  /* Cuánto pesa, cuando se lo puede saber. Un `blob:` no dice su tamaño sin ir a
     buscarlo, así que ahí no se dice nada: un número que no se tiene es mejor
     callado que inventado. */
  const bytes = useMemo(
    () =>
      archivo.contenido.clase === "texto"
        ? new Blob([archivo.contenido.texto]).size
        : undefined,
    [archivo.contenido],
  );

  const columnas = filas?.reduce((m, f) => Math.max(m, f.length), 0) ?? 0;

  const cuenta = [
    filas && `${filas.length} ${filas.length === 1 ? "row" : "rows"}`,
    filas && `${columnas} ${columnas === 1 ? "column" : "columns"}`,
    bytes !== undefined && `${bytes} B`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* La cabecera. El mismo aire lateral que el header de una pantalla, para
          que el archivo empiece donde empiezan las cosas de esta app. */}
      <header className="flex shrink-0 items-center gap-3 px-6 py-4">
        {/* Veinticuatro, y no el `icon` del escalón —catorce—. Ése es el
            tamaño de un ícono de **control**, y esto no lo es: es la marca del
            archivo que se está mirando, al lado del bloque que lo nombra.
            Medido, ese bloque mide cuarenta y un píxeles de alto —el nombre a
            quince y la línea de conteos a once—, así que a catorce el glifo era
            un tercio de lo que rotula y se leía como una viñeta.
            
            Veinticuatro y no más: en la grilla de Email Reports el glifo va a
            cuarenta porque ahí **es** el objeto y no hay texto que lo acompañe;
            acá acompaña a un nombre, y pasarlo de largo lo pondría a competir
            con él. El trazo se queda en 1.5, que es el de los íconos de esta
            app: recién a cuarenta hizo falta bajarlo. */}
        <Glifo size={24} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />

        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className="truncate font-medium tracking-tight"
            style={{ fontSize: escala.title }}
            title={archivo.nombre}
          >
            {archivo.nombre}
          </h1>
          {cuenta.length > 0 && (
            <p
              className="text-muted-foreground tabular-nums"
              style={{ fontSize: escala.caption }}
            >
              {cuenta.join(" · ")}
            </p>
          )}
        </div>

        {acciones && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {acciones}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 px-6 pb-6">
        {filas ? (
          <Planilla filas={filas} />
        ) : archivo.contenido.clase === "url" && clase === "documento" ? (
          <Documento url={archivo.contenido.url} nombre={archivo.nombre} />
        ) : clase === "planilla" ? (
          /* Un `.xlsx` que llegó como dirección. Ver la nota de arriba: leerlo
             es un parser entero y esta app no lo tiene. */
          <SinLector
            titulo="Spreadsheet can’t be read here"
            detalle="Excel workbooks need a reader the console doesn’t carry yet. Download it to open it in a spreadsheet app."
          />
        ) : (
          <SinLector
            titulo="No preview for this file"
            detalle={`The console can show spreadsheets and PDFs. This one is a .${extensionDe(archivo.nombre)}.`}
          />
        )}
      </div>
    </div>
  );
}
