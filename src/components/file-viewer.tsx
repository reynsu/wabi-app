"use client";

import { useMemo, type ReactNode } from "react";
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

/* ─────────────────────────── El documento ─────────────────────────── */

/**
 * Un PDF. Lo dibuja el navegador y no nosotros: `<object>` monta el lector que
 * ya viene puesto, con su zoom, su búsqueda y sus páginas.
 *
 * Sin `<iframe>` porque `<object>` tiene lo de adentro: cuando el navegador no
 * sabe dibujar un PDF —o lo tiene deshabilitado— muestra lo que va adentro de la
 * etiqueta en vez de un rectángulo blanco.
 */
function Documento({ url, nombre }: { url: string; nombre: string }) {
  return (
    <object
      data={url}
      type="application/pdf"
      title={nombre}
      className="h-full w-full"
    >
      <SinLector
        titulo="This browser won’t show the PDF"
        detalle="It can still be downloaded and opened outside the console."
      />
    </object>
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
