"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileChartColumn } from "lucide-react";

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
  useReporteDOC,
} from "@/pages/reportes-admin";
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
      reporte && formatoDeReporteDOC(reporte.tipo) === "csv"
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
    if (!reporte || formatoDeReporteDOC(reporte.tipo) !== "pdf") return;
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
