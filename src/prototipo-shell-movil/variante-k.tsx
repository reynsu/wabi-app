/**
 * PROTOTIPO — Variante K: hojas apiladas.
 *
 * La profundidad se ve. Cada detalle que se abre desde una pantalla es una hoja
 * nueva encima de la anterior, y las de abajo **asoman arriba como lomos**:
 * Accounts › Item 3 › Item 5 no es una miga de texto, son tres hojas. Tocar un
 * lomo vuelve a ese nivel de un salto; bajar la hoja de arriba con el pulgar la
 * cierra y deja la de abajo —el gesto de las hojas de iOS—.
 *
 * Lo que no es profundidad —otra pantalla, otra sección— va por el costado: un
 * menú y un contador arriba, sin competir con la pila.
 */

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { LayoutGrid, Menu, X } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { cerrar, reconstruir, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";

const LOMO = 34;

/** Los niveles de una pestaña: la pantalla y cada detalle abierto desde ella. */
const niveles = (id: string) => {
  const partes = id.split("/item-");
  return partes.map((_, n) => partes.slice(0, n + 1).join("/item-"));
};

export function VarianteK() {
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const openTab = useWorkspace((w) => w.openTab);
  const { setOpenMobile } = useSidebar();
  const [lista, setLista] = useState(false);
  const [board, setBoard] = useState(false);
  const arrastre = useDragControls();

  const activa = tabs.find((t) => t.id === activeId);
  const pila = activeId ? niveles(activeId) : [];
  const debajo = pila.slice(0, -1);
  const padre = debajo.at(-1);
  // Las pantallas raíz abiertas: lo que hay "al costado" de esta pila.
  const raices = new Set(tabs.map((t) => niveles(t.id)[0]));

  const irA = (id: string) => {
    if (tabs.some((t) => t.id === id)) activateTab(id);
    else {
      const tab = reconstruir(id);
      if (tab) openTab(tab);
    }
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-1">
      <header className="flex h-12 shrink-0 items-center gap-1 px-1">
        <button type="button" aria-label="Menú" onClick={() => setOpenMobile(true)} className="grid size-11 place-items-center">
          <Menu className="size-5" />
        </button>
        <span className="flex-1" />
        <button type="button" aria-label="Board" onClick={() => setBoard(true)} className="grid size-11 place-items-center">
          <LayoutGrid className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setLista(true)}
          className="mr-1 flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-[13px] font-medium shadow-surface-3"
        >
          {raices.size} {raices.size === 1 ? "pila" : "pilas"}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col px-2">
        {/* Los lomos: cada nivel de abajo, cada vez más angosto y más atrás. */}
        {debajo.map((id, n) => {
          const t = reconstruir(id);
          const I = t?.icon;
          const inset = (debajo.length - n) * 6;
          return (
            <motion.button
              layout
              key={id}
              type="button"
              onClick={() => irA(id)}
              className="relative flex shrink-0 items-center gap-2 rounded-t-2xl border border-b-0 border-border bg-surface-2 px-4 text-left"
              style={{ height: LOMO, marginLeft: inset, marginRight: inset, marginBottom: -10, paddingBottom: 10, zIndex: n }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {I && <I className="size-3.5 text-muted-foreground" />}
              <span className="truncate text-[13px] text-muted-foreground">{t?.label}</span>
            </motion.button>
          );
        })}

        {/* La hoja de arriba: el contenido vivo. */}
        {/* Sin `key`: remontarla con cada pestaña remontaría los planos, y con
            ellos lo que cada pestaña tenía adentro. */}
        <motion.section
          layout="position"
          className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl bg-surface-3 shadow-surface-5"
          drag={padre ? "y" : false}
          dragControls={arrastre}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, i) => {
            if (padre && activeId && (i.offset.y > 110 || i.velocity.y > 600)) cerrar(activeId, padre);
          }}
        >
          <div
            className={cn("flex shrink-0 flex-col items-center", padre && "touch-none")}
            onPointerDown={(e) => padre && arrastre.start(e)}
          >
            {padre && <span className="mt-1.5 h-1 w-9 rounded-full bg-foreground/20" />}
            <div className="flex h-11 w-full items-center gap-2 px-4">
              {activa?.icon && <activa.icon className="size-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{activa?.label}</span>
              {padre && activeId && (
                <button type="button" aria-label="Cerrar hoja" onClick={() => cerrar(activeId, padre)} className="-mr-2 grid size-10 place-items-center text-muted-foreground">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          <Planos className="border-t border-border" />
        </motion.section>
      </div>

      <HojaInferior abierta={lista} onCerrar={() => setLista(false)} titulo="Pilas abiertas">
        <ul className="mx-3 mb-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface-3 shadow-surface-3">
          {[...raices].map((raiz) => {
            const t = reconstruir(raiz);
            const hojas = tabs.filter((x) => niveles(x.id)[0] === raiz);
            const tope = hojas.map((x) => x.id).sort((a, b) => b.length - a.length)[0];
            const I = t?.icon;
            return (
              <li key={raiz} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    irA(useProto.getState().mru.find((id) => niveles(id)[0] === raiz && tabs.some((x) => x.id === id)) ?? tope);
                    setLista(false);
                  }}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left"
                >
                  {I && <I className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("truncate text-[15px]", pila[0] === raiz && "font-semibold")}>{t?.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {hojas.length} {hojas.length === 1 ? "hoja" : "hojas"}
                    </span>
                  </span>
                  {/* La pila en miniatura. */}
                  <span className="ml-auto flex flex-col items-center">
                    {hojas.slice(0, 4).map((x, n) => (
                      <span key={x.id} className="h-1 rounded-t-sm bg-foreground/20" style={{ width: 22 - (hojas.length - 1 - n) * 4, marginTop: n ? 1 : 0 }} />
                    ))}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Cerrar ${t?.label}`}
                  onClick={() => hojas.forEach((x) => cerrar(x.id))}
                  className="grid size-12 shrink-0 place-items-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </HojaInferior>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}
