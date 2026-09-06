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
import type { ContenidoDeArchivo } from "@/lib/archivos";
import { Button } from "@/components/ui/button";
import { SizeProvider } from "@/lib/size-context";
import { useBajada } from "@/pages/bajar-reporte";
import {
  archivoDeReporte,
  csvDeReporte,
  pdfDeReporte,
  useReporte,
} from "@/pages/reportes";
import { useUsuarios } from "@/pages/usuarios";

/**
 * Un reporte, abierto.
 *
 * Es el archivo que la fila prometía, mostrado adentro de la consola en vez de
 * bajado y abierto en otro programa. Lo dibuja `FileViewer`; lo único que esta
 * pantalla hace es **conseguir el archivo** y decir qué se puede hacer con él.
 *
 * **El archivo es el mismo que se baja.** Sale de `csvDeReporte`, que es la
 * única definición del reporte como archivo: si el visor armara su propia
 * versión "para mostrar", lo que se ve y lo que se baja serían dos cosas que un
 * día dejan de coincidir, y eso en una pantalla que se llama Reports es lo peor
 * que puede pasar.
 *
 * Se lleva el **id** y no el reporte, como el perfil de una cuenta: la pestaña
 * se guarda tal cual y no se vuelve a armar, así que lo que va adentro tiene que
 * poder envejecer. Con el reporte entero, una pestaña abierta seguiría mostrando
 * el estado de cuando se hizo clic.
 */
export function VistaDeReporte({ id }: { id: string }) {
  const reporte = useReporte(id);
  const usuarios = useUsuarios();

  /* El CSV, cuando el reporte es un CSV: es texto y el visor lo parte. Se arma
     una vez por reporte y por padrón; sin memorizar, cada pintada del panel
     volvería a recorrer las cuentas para escribir lo mismo. */
  const texto = useMemo(
    () =>
      reporte && reporte.formato === "csv"
        ? csvDeReporte(reporte, usuarios)
        : undefined,
    [reporte, usuarios],
  );

  /* El PDF, cuando es un PDF: una dirección `blob:`, porque lo dibuja un lector
     y lo que un lector recibe es una dirección.
     
     **Se arma adentro del efecto y no en un `useMemo`.** Es la misma pieza que
     hay que devolver al cerrar la pestaña —un `blob:` que nadie revoca deja el
     archivo colgado en memoria hasta que se recargue la página—, y en modo
     estricto React monta, limpia y vuelve a montar: con la dirección en un
     `useMemo`, la limpieza del primer montaje revocaba una URL que el memo no
     volvía a crear, y el segundo montaje recibía una dirección muerta. El
     síntoma era "Unexpected server response (0)" y un cartel de archivo dañado
     sobre un archivo sano.
     
     Creándola donde se la devuelve, cada montaje tiene la suya y la del anterior
     ya no le sirve a nadie. */
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    /* Sin limpiar la de antes al salir por acá: la pestaña es de un reporte y el
       formato de un reporte sale de su ventana, así que no cambia mientras está
       abierta. Y si el reporte dejó de existir, la pantalla ya salió antes por
       el cartel de "no está". */
    if (!reporte || reporte.formato !== "pdf") return;
    const bytes = pdfDeReporte(reporte, usuarios);
    const direccion = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    /* La regla pide derivar en vez de escribir estado desde un efecto, y tiene
       razón casi siempre; su propia excepción es sincronizar con algo de afuera
       que tiene ciclo de vida, y una dirección `blob:` es exactamente eso: se
       crea, se usa y se devuelve. Derivarla en el render es lo que traía el bug
       de arriba. */
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(direccion);
    return () => URL.revokeObjectURL(direccion);
  }, [reporte, usuarios]);

  const contenido: ContenidoDeArchivo | undefined =
    texto !== undefined
      ? { clase: "texto", texto }
      : url
        ? { clase: "url", url }
        : undefined;

  /* Los hooks van antes de cualquier salida: la bajada existe aunque el reporte
     no, y moverla adentro del `if` la haría condicional. */
  const { bajando, alTocar } = useBajada(reporte);

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
    /* Densa, como la pantalla de la que sale: un archivo abierto al lado de la
       lista que lo abrió tiene que leerse con el mismo escalón. */
    <SizeProvider size="compact">
      <FileViewer
        archivo={{ nombre: archivoDeReporte(reporte), contenido }}
        acciones={
          /* Bajarlo sigue estando, y acá es donde más sentido tiene: se mira
             primero y se decide después. Es la misma bajada de la lista —el
             mismo `useBajada`, el mismo aviso—, no otra. */
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
