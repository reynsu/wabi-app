import type { ReactNode } from "react";
import { create } from "zustand";

import { useWorkspace } from "@/stores/workspace";

/**
 * Qué está mostrando el riel, por pestaña.
 *
 * **Un vistazo es de quien lo abrió.** El riel es un lugar del shell, pero lo
 * que muestra contesta una pregunta que se hizo adentro de una pestaña —esta
 * fila, este registro, esta cosa—. Guardado como un vistazo para toda la app,
 * abrir un perfil en una pestaña y moverse a otra deja ese perfil parado sobre
 * una pantalla que nunca lo pidió. Así que se guarda **uno por pestaña**, y el
 * que se ve es el de la que está activa.
 *
 * Antes esto era un proveedor con un `scope` que había que pasarle desde
 * afuera, y afuera era `App`, que lo sacaba del contexto del workspace. Con las
 * dos cosas en tiendas, el scope se lee de donde vive —la pestaña activa— y no
 * hay nada que pasar ni un orden de montaje que respetar.
 *
 * Nada se barre nunca: sólo se lee el de la pestaña activa, así que lo de las
 * otras simplemente no se muestra. Una pestaña que vuelve —reabierta con el
 * mismo id— encuentra su vistazo donde lo dejó, que es la misma regla que ya
 * juega el workspace: **el id es la identidad**.
 */

/** El balde del que no tiene pestaña. Un id vacío no nombra a nadie, que es lo
 *  que corresponde mientras no hay ninguna activa. */
const SOLO = "";

interface Previews {
  /** Lo que hay en el riel, por pestaña. */
  porPestaña: Record<string, ReactNode>;
  show: (scope: string, preview: ReactNode) => void;
  close: (scope: string) => void;
}

const useTiendaDePreviews = create<Previews>()((set) => ({
  porPestaña: {},

  show: (scope, preview) =>
    set((p) => ({ porPestaña: { ...p.porPestaña, [scope]: preview } })),

  close: (scope) =>
    set((p) => {
      if (!(scope in p.porPestaña)) return p;
      const { [scope]: _fuera, ...resto } = p.porPestaña;
      return { porPestaña: resto };
    }),
}));

/** Lo que el riel está mostrando **en la pestaña que está puesta**, o `null` si
 *  está mostrando el board. */
export function usePreviewActivo(): ReactNode | null {
  const scope = useWorkspace((s) => s.activeId) ?? SOLO;
  return useTiendaDePreviews((p) => p.porPestaña[scope] ?? null);
}

/** Poner algo en el riel, y devolvérselo al board.
 *
 *  Las dos van contra la pestaña activa, que es la que está pidiendo: quien
 *  llama a esto está pintando adentro de ella. Las funciones son estables —salen
 *  de la tienda— así que sirven de dependencia sin volver a crear callbacks. */
export function usePreview() {
  const scope = useWorkspace((s) => s.activeId) ?? SOLO;
  const show = useTiendaDePreviews((p) => p.show);
  const close = useTiendaDePreviews((p) => p.close);

  return {
    show: (preview: ReactNode) => show(scope, preview),
    close: () => close(scope),
  };
}
