"use client";

import { useMemo } from "react";
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
import { SizeProvider } from "@/lib/size-context";
import { useBajada } from "@/pages/bajar-reporte";
import { archivoDeReporte, csvDeReporte, useReporte } from "@/pages/reportes";
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

  /* El CSV se arma una vez por reporte y por padrón. Sin memorizar, cada
     pintada del panel volvería a recorrer las cuentas para escribir el mismo
     texto. */
  const texto = useMemo(
    () => (reporte ? csvDeReporte(reporte, usuarios) : ""),
    [reporte, usuarios],
  );

  /* Los hooks van antes de cualquier salida: la bajada existe aunque el reporte
     no, y moverla adentro del `if` la haría condicional. */
  const { bajando, alTocar } = useBajada(reporte);

  if (!reporte) {
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
        archivo={{
          nombre: archivoDeReporte(reporte),
          contenido: { clase: "texto", texto },
        }}
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
