"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { FileText } from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { ScrollArea } from "@/components/ui/scroll-area";
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

/* ─────────────────────────── La planilla ─────────────────────────── */

/**
 * Filas y columnas, como en una planilla: la numeración a la izquierda y las
 * celdas tal cual vienen.
 *
 * **Con números de fila y sin encabezado en negrita.** La tentación es poner la
 * primera fila como cabecera, y en el reporte de esta app estaría mal: sus tres
 * primeras filas son la ficha del reporte —qué ventana, cuántas cuentas— y la
 * cabecera de la tabla recién aparece después del renglón en blanco. Un visor
 * que adivina cuál es la cabecera acierta en un archivo y miente en el
 * siguiente. Los números, en cambio, son verdad en todos, y son lo que uno
 * necesita para decir "mirá la fila 12".
 *
 * Las filas cortas se completan con celdas vacías hasta el ancho de la más
 * larga: son las columnas de la planilla, y una tabla con filas de distinto
 * largo se dibuja escalonada.
 *
 * El ancho no se reparte: cada columna mide lo que mide su contenido y la tabla
 * desborda a lo ancho adentro de su scroll. Repartir el ancho del panel entre
 * las columnas corta los nombres largos para dejarle lugar a una columna de
 * fechas que no lo necesita.
 */
function Planilla({ filas }: { filas: string[][] }) {
  const escala = useTypeScale();
  const columnas = filas.reduce((maximo, f) => Math.max(maximo, f.length), 0);

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade">
      <table
        className="w-max border-separate border-spacing-0 tabular-nums"
        style={{ fontSize: escala.body }}
      >
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="group/fila">
              {/* La numeración. Pegada a la izquierda para que siga estando
                  cuando la tabla se corre a lo ancho, que es cuando más falta
                  hace saber en qué fila se está. */}
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 border-b border-border/60 bg-surface-5 px-3 py-1.5",
                  "text-right font-normal text-muted-foreground select-none",
                )}
                style={{ fontSize: escala.caption }}
              >
                {i + 1}
              </th>

              {Array.from({ length: columnas }, (_, j) => (
                <td
                  key={j}
                  className={cn(
                    "border-b border-l border-border/60 px-3 py-1.5",
                    "whitespace-pre text-foreground",
                  )}
                >
                  {fila[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
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

function Documento({ url, nombre }: { url: string; nombre: string }) {
  const escala = useTypeScale();
  const [documento, setDocumento] = useState<PDFDocumentProxy | undefined>();
  const [fallo, setFallo] = useState(false);
  /* El ancho de la columna, para saber a qué escala dibujar. Empieza en cero y
     no en un número inventado: hasta que el contenedor no midió, dibujar sería
     dibujar dos veces. */
  const [ancho, setAncho] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) =>
      setAncho(entrada.contentRect.width),
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

  if (fallo) {
    return (
      <SinLector
        titulo="This PDF couldn’t be opened"
        detalle="The file may be damaged. It can still be downloaded and opened elsewhere."
      />
    );
  }

  return (
    /* Sin el desvanecido de las listas. Ahí dice "esto sigue"; acá se comía el
       borde de abajo de la hoja, y una página tiene bordes —es un objeto
       apoyado, no una lista que se corta—. Lo que dice que hay más es la página
       siguiente asomando. */
    <ScrollArea className="h-full">
      {/* La caja mide, las páginas se dibujan. El aire de abajo es el mismo que
          separa una página de la siguiente, para que la última no quede pegada
          al borde. */}
      <div ref={caja} className="flex flex-col items-center gap-3 pt-1 pb-3">
        {!documento || ancho === 0 ? (
          <p
            className="py-8 text-muted-foreground"
            style={{ fontSize: escala.body }}
          >
            Opening {nombre}…
          </p>
        ) : (
          Array.from({ length: documento.numPages }, (_, i) => (
            <PaginaDePdf
              key={i}
              documento={documento}
              numero={i + 1}
              ancho={ancho}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
}

/**
 * Una página, en un canvas.
 *
 * **A la resolución de la pantalla y no a la del CSS.** El canvas se dibuja
 * multiplicado por `devicePixelRatio` y se muestra al ancho de la columna: en
 * una pantalla densa, sin eso, el texto de un PDF sale borroso justo donde más
 * se nota que es texto.
 *
 * Se vuelve a dibujar cuando cambia el ancho —el panel se puede achicar— y el
 * dibujo anterior se cancela: `render` es asíncrono, y dos dibujos encima del
 * mismo canvas terminan en el que llegue último, que no siempre es el que
 * corresponde al ancho de ahora.
 */
function PaginaDePdf({
  documento,
  numero,
  ancho,
}: {
  documento: PDFDocumentProxy;
  numero: number;
  ancho: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let vivo = true;
    let tarea: { cancel: () => void } | undefined;

    (async () => {
      const pagina = await documento.getPage(numero);
      const nodo = canvas.current;
      if (!vivo || !nodo) return;

      const natural = pagina.getViewport({ scale: 1 });
      /* Una hoja no se agranda más allá de su tamaño real. Un PDF viene en
         puntos —A4 son 595 de ancho— y un punto es 1/72 de pulgada contra el
         1/96 de un píxel de CSS, así que el "cien por ciento" de esa hoja son
         `595 × 96/72`, unos 793 píxeles. Sin este techo, en un panel ancho la
         página se estiraba hasta llenarlo y un A4 salía con el cuerpo de texto
         del tamaño de un título. Más angosto que eso sí se achica: ahí la
         alternativa es cortar la hoja. */
      const aCienPorCiento = (natural.width * 96) / 72;
      const util = Math.min(ancho, aCienPorCiento);

      const dpr = window.devicePixelRatio || 1;
      const vista = pagina.getViewport({ scale: (util / natural.width) * dpr });

      nodo.width = Math.floor(vista.width);
      nodo.height = Math.floor(vista.height);
      nodo.style.width = `${util}px`;
      nodo.style.height = `${Math.floor(vista.height / dpr)}px`;

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
        /* Cancelado porque cambió el ancho: el dibujo que viene lo reemplaza. */
      }
    })();

    return () => {
      vivo = false;
      tarea?.cancel();
    };
  }, [documento, numero, ancho]);

  return (
    /* Blanco y con sombra, en los dos temas: una hoja de PDF **es** blanca, y
       teñirla en oscuro sería mostrar algo distinto de lo que el archivo dice.
       La sombra es la que separa una superficie de la de abajo en esta app, y
       acá dice lo mismo: esto es una hoja apoyada sobre el panel. */
    <canvas
      ref={canvas}
      aria-label={`Page ${numero}`}
      className="shadow-surface-2 bg-white"
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
  const medidas = useSize();
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
        <Glifo
          size={medidas.icon}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground"
        />

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
