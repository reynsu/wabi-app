"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Clock,
  Download,
  FileChartColumn,
  LoaderCircle,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { FileViewer } from "@/components/file-viewer";
import { Button } from "@/components/ui/button";
import type { ContenidoDeArchivo } from "@/lib/archivos";
import { SizeProvider } from "@/lib/size-context";
import { useBajadaDOC } from "@/pages/bajar-reporte-doc";
import { useCuentasDOC } from "@/pages/cuentas-doc";
import {
  archivoDeReporteDOC,
  csvDeReporteDOC,
  formatoDeReporteDOC,
  pdfDeReporteDOC,
  sePuedeBajar,
  useReporteDOC,
  type EstadoDeReporte,
  type ReporteDOC,
} from "@/pages/reportes-admin";
import { fechaLarga } from "@/pages/tiempo";
import { useUsuarios } from "@/pages/usuarios";

/**
 * Un reporte pedido, abierto.
 *
 * El gemelo de `VistaDeReporte`, para la otra clase de reporte que tiene esta
 * consola. Lo dibuja el mismo `FileViewer`: un archivo es un archivo, y que uno
 * se cierre solo los domingos y el otro lo haya pedido alguien un martes no
 * cambia cómo se mira.
 *
 * Lo que sí es de acá: de dónde sale el contenido —tres tipos de reporte, cada
 * uno con sus columnas— y que el formato lo decida el tipo.
 *
 * Se lleva el **id** y no el reporte, como el perfil de una cuenta: la pestaña se
 * guarda tal cual y no se vuelve a armar, así que lo que va adentro tiene que
 * poder envejecer. Con el reporte entero, una pestaña abierta seguiría mostrando
 * el estado de cuando se hizo clic —y estos reportes **cambian de estado**: se
 * piden en la cola y terminan minutos después—.
 */
export function VistaDeReporteDOC({ id }: { id: string }) {
  const reporte = useReporteDOC(id);
  const usuarios = useUsuarios();
  const cuentas = useCuentasDOC();

  /* El CSV, cuando el tipo se entrega como planilla: es texto y el visor lo
     parte. Memorizado contra el padrón y las cuentas DOC, que es de lo que
     depende lo que dice. */
  const texto = useMemo(
    () =>
      reporte && sePuedeBajar(reporte) && formatoDeReporteDOC(reporte.tipo) === "csv"
        ? csvDeReporteDOC(reporte, usuarios, cuentas)
        : undefined,
    [reporte, usuarios, cuentas],
  );

  /* El PDF, cuando se entrega como documento: una dirección `blob:`, porque lo
     dibuja un lector y lo que un lector recibe es una dirección.

     Adentro del efecto y no en un `useMemo`, por lo mismo que en Email ›
     Reports: es la misma pieza que hay que devolver al cerrar la pestaña, y en
     modo estricto React monta, limpia y vuelve a montar —con la dirección
     memorizada, el segundo montaje recibiría una URL ya revocada—. */
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!reporte || !sePuedeBajar(reporte)) return;
    if (formatoDeReporteDOC(reporte.tipo) !== "pdf") return;
    const bytes = pdfDeReporteDOC(reporte, usuarios, cuentas);
    const direccion = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    /* La regla pide derivar en vez de escribir estado desde un efecto, y su
       propia excepción es sincronizar con algo de afuera que tiene ciclo de
       vida. Una dirección `blob:` es exactamente eso: se crea, se usa y se
       devuelve. */
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(direccion);
    return () => URL.revokeObjectURL(direccion);
  }, [reporte, usuarios, cuentas]);

  const contenido: ContenidoDeArchivo | undefined =
    texto !== undefined
      ? { clase: "texto", texto }
      : url
        ? { clase: "url", url }
        : undefined;

  /* Los hooks van antes de cualquier salida: la bajada existe aunque el reporte
     no, y moverla adentro del `if` la haría condicional. */
  const { bajando, alTocar } = useBajadaDOC(reporte);

  /* Todavía no hay archivo, y eso no es un error: la pestaña abre igual y
     cuenta en qué anda. Antes de esto, la fila de un pedido sin terminar no se
     dejaba tocar; abrir y encontrar el motivo es más barato que descubrir que
     una fila no responde. Ver `EnQueAnda`. */
  if (reporte && !sePuedeBajar(reporte)) {
    return <EnQueAnda reporte={reporte} />;
  }

  if (!reporte || !contenido) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <FileChartColumn />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>Report not found</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              This report isn&rsquo;t on file any more. It may have been removed
              while the tab was open.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      </div>
    );
  }

  return (
    /* Densa, como la pantalla de la que sale. */
    <SizeProvider size="compact">
      <FileViewer
        archivo={{ nombre: archivoDeReporteDOC(reporte), contenido }}
        acciones={
          /* La misma bajada de la tabla —el mismo `useBajadaDOC`, el mismo
             aviso—, no otra. Acá es donde más sentido tiene: se mira primero y
             se decide después. */
          <Button
            variant="secondary"
            size="compact"
            leadingIcon={Download}
            loading={bajando}
            onClick={alTocar}
          >
            Download
          </Button>
        }
      />
    </SizeProvider>
  );
}

/* ─────────────────────── Lo que todavía no es ───────────────────────

   Un pedido que espera, uno que se está armando y uno que se cayó abren la
   misma pestaña que los demás, pero adentro no hay archivo que mirar: hay un
   motivo. Va en el mismo bloque vacío que usa el resto de la consola —el de
   "no hay reportes" de la tabla, el de "no está más en el archivo" de acá
   arriba— porque es la misma clase de respuesta: no falló nada, no hay nada
   que mostrar todavía.

   La figura es el mismo ícono que la fila le cuelga al archivo en la lista del
   teléfono: el reloj, la rueda y el signo. Lo que se tocó y lo que se abre
   tienen que verse como lo mismo.

   Y dice **cuándo se lo pidió**, que es lo único que uno puede querer saber
   acá: si lo pidió hace dos minutos, esperar; si fue anteayer, algo se trabó.

   El mapa es exhaustivo —`completed` va escrito, con su `null`—: el día que la
   cola tenga un quinto estado, esto no compila hasta que alguien diga qué se
   ve mientras tanto. */

const EN_QUE_ANDA: Record<
  EstadoDeReporte,
  { icono: typeof Clock; titulo: string; dice: (cuando: string) => string } | null
> = {
  pending: {
    icono: Clock,
    titulo: "Waiting in the queue",
    dice: (cuando) =>
      `This one hasn't started yet. It was asked for on ${cuando}, and the file shows up here as soon as it's built.`,
  },
  processing: {
    icono: LoaderCircle,
    titulo: "Being put together",
    dice: (cuando) =>
      `The console is pulling this one now. It was asked for on ${cuando} — this page turns into the file when it lands.`,
  },
  completed: null,
  failed: {
    icono: CircleAlert,
    titulo: "This one didn't make it",
    dice: (cuando) =>
      `Something broke while building it, so there's no file. It was asked for on ${cuando}; asking again is the way to get one.`,
  },
};

function EnQueAnda({ reporte }: { reporte: ReporteDOC }) {
  const queda = EN_QUE_ANDA[reporte.estado];

  if (!queda) return null;

  const Icono = queda.icono;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatedEmpty>
        <AnimatedEmptyHeader>
          <AnimatedEmptyMedia variant="icon">
            <Icono />
          </AnimatedEmptyMedia>
          <AnimatedEmptyTitle>{queda.titulo}</AnimatedEmptyTitle>
          <AnimatedEmptyDescription>
            {queda.dice(fechaLarga(reporte.pedidoEl))}
          </AnimatedEmptyDescription>
        </AnimatedEmptyHeader>
      </AnimatedEmpty>
    </div>
  );
}
