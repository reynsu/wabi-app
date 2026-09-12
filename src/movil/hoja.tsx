import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SurfaceProvider } from "@/lib/surface-context";

/**
 * Una hoja que sube desde abajo: donde el teléfono pone lo que en escritorio va
 * en el riel —el board de la pestaña, o el vistazo que abrió una fila—.
 *
 * Es el `Dialog` de Base UI con otra forma, y no una caja propia: el diálogo ya
 * trae lo que una hoja modal necesita y es fácil hacer mal a mano —el foco
 * atrapado adentro y devuelto al cerrar, Escape, el portal, el fondo que no se
 * toca—. Lo único que cambia es de dónde entra y cómo se va.
 *
 * **Se baja con el pulgar**, desde la manija o desde el título, nunca desde el
 * cuerpo: el cuerpo scrollea, y si el gesto de bajar la hoja empezara ahí se
 * comería el de scrollear. Pasados 90px —o soltada con envión— se cierra; si
 * no, vuelve a su lugar.
 */

const UMBRAL = 90;

interface HojaProps {
  abierta: boolean;
  onCerrar: () => void;
  /** El nombre de la hoja. Siempre hace falta —es lo que un lector de pantalla
   *  anuncia al abrir—, aunque no siempre se vea. */
  titulo: ReactNode;
  /** Sin cabecera propia: sólo la manija. Para lo que ya trae la suya —el
   *  `LateralPreview` tiene título y botón de cerrar—, que con dos se leería
   *  como una hoja adentro de otra. */
  sinCabecera?: boolean;
  children: ReactNode;
}

export function Hoja({ abierta, onCerrar, titulo, sinCabecera, children }: HojaProps) {
  const popup = useRef<HTMLDivElement>(null);

  /* La hoja se va con lo que mostraba. Casi siempre se cierra *porque* cambió
     lo que hay abajo —un widget que abre su pestaña—, y sin esto, durante los
     200ms de bajada, se ve el board de la pestaña nueva en la hoja vieja. */
  const ahora = { titulo, children, sinCabecera };
  const ultimo = useRef(ahora);
  useLayoutEffect(() => {
    if (abierta) ultimo.current = ahora;
  });
  // Se lee sólo cerrada, que es justo cuando ya no tiene que cambiar.
  // oxlint-disable-next-line react/refs
  const muestra = abierta ? ahora : ultimo.current;
  const tiron = useRef<{ y: number; t: number } | null>(null);

  const mover = (dy: number, suave: boolean) => {
    const el = popup.current;
    if (!el) return;
    el.style.transition = suave ? "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)" : "none";
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  return (
    <DialogPrimitive.Root open={abierta} onOpenChange={(abre) => !abre && onCerrar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/25 duration-200",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          )}
        />
        <DialogPrimitive.Popup
          ref={popup}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface-2 shadow-surface-5 outline-none",
            "data-open:animate-in data-open:slide-in-from-bottom data-open:duration-250",
            "data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-200",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div
            className="shrink-0 cursor-grab touch-none select-none"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              tiron.current = { y: e.clientY, t: e.timeStamp };
            }}
            onPointerMove={(e) => {
              if (tiron.current) mover(e.clientY - tiron.current.y, false);
            }}
            onPointerUp={(e) => {
              const t = tiron.current;
              tiron.current = null;
              if (!t) return;
              const dy = e.clientY - t.y;
              const envion = dy / Math.max(e.timeStamp - t.t, 1);
              if (dy > UMBRAL || envion > 0.6) onCerrar();
              else mover(0, true);
            }}
            onPointerCancel={() => {
              tiron.current = null;
              mover(0, true);
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <span className="h-1 w-9 rounded-full bg-foreground/20" />
            </div>
            {muestra.sinCabecera ? (
              <DialogPrimitive.Title className="sr-only">{muestra.titulo}</DialogPrimitive.Title>
            ) : (
              <div className="flex items-center justify-between gap-3 pr-2 pb-1 pl-4">
                <DialogPrimitive.Title className="min-w-0 truncate text-[15px] font-semibold">
                  {muestra.titulo}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  render={<Button variant="ghost" size="icon" className="size-11 rounded-full" />}
                  aria-label="Close"
                >
                  <X />
                </DialogPrimitive.Close>
              </div>
            )}
          </div>

          {/* Adentro todo arranca del escalón de la hoja: un popover en el
              board sigue subiendo desde acá. */}
          <SurfaceProvider value={2}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{muestra.children}</div>
          </SurfaceProvider>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
