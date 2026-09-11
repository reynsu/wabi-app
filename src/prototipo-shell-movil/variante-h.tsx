/**
 * PROTOTIPO — Variante H: omnibar.
 *
 * Una sola barra abajo que es buscador, sidebar y conmutador a la vez, como la
 * paleta de comandos de Linear o Raycast puesta al alcance del pulgar. Tocarla
 * abre la paleta con el teclado ya arriba: sin escribir nada muestra lo
 * reciente; escribiendo, filtra pantallas, lo abierto y acciones en la misma
 * lista. Ir a cualquier lugar de la app son dos toques y tres letras, sin saber
 * en qué sección vive.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  ChevronLeft,
  CircleX,
  CornerDownLeft,
  History,
  LayoutGrid,
  Moon,
  Search,
  X,
} from "lucide-react";

import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { NAV } from "@/navigation";
import { useTema } from "@/stores/tema";
import { useWorkspace } from "@/stores/workspace";
import { atras, cerrar, useProto } from "./historial";
import { BoardFalso, HojaInferior, Planos } from "./comun";
import { abrirHoja } from "./dock";

interface Resultado {
  id: string;
  grupo: "Recientes" | "Pantallas" | "Acciones";
  label: string;
  detalle?: string;
  icon?: IconComponent;
  hacer: () => void;
  cerrable?: boolean;
}

export function VarianteH() {
  const activa = useWorkspace((w) => w.tabs.find((t) => t.id === w.activeId));
  const puedeVolver = useProto((p) => p.indice > 0);
  const [paleta, setPaleta] = useState(false);
  const [board, setBoard] = useState(false);
  const Icono = activa?.icon;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center gap-1 px-1">
        {puedeVolver ? (
          <button type="button" onClick={atras} aria-label="Atrás" className="grid size-11 place-items-center">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="truncate text-[16px] font-semibold">{activa?.label}</span>
      </header>

      <Planos className="border-t border-border" />

      <div className="shrink-0 bg-surface-2 px-3 pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaleta(true)}
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-surface-3 px-4 text-left shadow-surface-3"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">Ir a…</span>
            {Icono && (
              <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-1 px-2 py-1 text-[12px] text-muted-foreground">
                <Icono className="size-3.5 shrink-0" />
                <span className="truncate">{activa?.label}</span>
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Board"
            onClick={() => setBoard(true)}
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-3 shadow-surface-3"
          >
            <LayoutGrid className="size-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {paleta && <Paleta onCerrar={() => setPaleta(false)} onBoard={() => setBoard(true)} />}
      </AnimatePresence>

      <HojaInferior abierta={board} onCerrar={() => setBoard(false)} titulo={`Board · ${activa?.label}`}>
        <BoardFalso />
      </HojaInferior>
    </div>
  );
}

function Paleta({ onCerrar, onBoard }: { onCerrar: () => void; onBoard: () => void }) {
  const [q, setQ] = useState("");
  const tabs = useWorkspace((w) => w.tabs);
  const activeId = useWorkspace((w) => w.activeId);
  const activateTab = useWorkspace((w) => w.activateTab);
  const mru = useProto((p) => p.mru);
  const alternarTema = useTema((t) => t.alternar);
  const input = useRef<HTMLInputElement>(null);

  const todos = useMemo<Resultado[]>(() => {
    const abiertas = new Set(tabs.map((t) => t.id));
    const recientes = mru
      .filter((id) => abiertas.has(id) && id !== activeId)
      .map((id) => tabs.find((t) => t.id === id)!)
      .map<Resultado>((t) => ({
        id: `tab:${t.id}`,
        grupo: "Recientes",
        label: t.label,
        detalle: `/${t.id}`,
        icon: t.icon,
        hacer: () => activateTab(t.id),
        cerrable: true,
      }));
    const pantallas = NAV.flatMap((g) =>
      g.items.map<Resultado>((h) => ({
        id: `nav:${h.id}`,
        grupo: "Pantallas",
        label: h.label,
        detalle: g.label,
        icon: h.icon,
        hacer: () => abrirHoja(h),
      })),
    );
    const acciones: Resultado[] = [
      { id: "a:board", grupo: "Acciones", label: "Ver el board", icon: LayoutGrid, hacer: onBoard },
      { id: "a:tema", grupo: "Acciones", label: "Cambiar tema", icon: Moon, hacer: alternarTema },
      {
        id: "a:cerrar",
        grupo: "Acciones",
        label: "Cerrar esta pantalla",
        icon: CircleX,
        hacer: () => activeId && cerrar(activeId),
      },
      {
        id: "a:demas",
        grupo: "Acciones",
        label: "Cerrar las demás",
        detalle: `${Math.max(tabs.length - 1, 0)} abiertas`,
        icon: History,
        hacer: () => tabs.forEach((t) => t.id !== activeId && cerrar(t.id)),
      },
    ];
    return [...recientes, ...pantallas, ...acciones];
  }, [tabs, mru, activeId, activateTab, alternarTema, onBoard]);

  // Sin texto, lo reciente y las acciones. Con texto, todo lo que tenga esas
  // letras en orden, pero rankeado: primero lo que *empieza* así, después lo que
  // lo contiene, y al final las coincidencias sueltas —si no, "pol" le da el
  // primer lugar a "Provisioning" por tener una p, una o y una l—.
  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    if (!texto) return todos.filter((r) => r.grupo !== "Pantallas").slice(0, 9);
    const suelta = new RegExp(texto.split("").map(escapar).join(".*"), "i");
    const puntaje = (r: Resultado) => {
      const label = r.label.toLowerCase();
      if (label.startsWith(texto) || label.split(" ").some((p) => p.startsWith(texto))) return 0;
      if (label.includes(texto)) return 1;
      if (`${label} ${r.detalle ?? ""}`.toLowerCase().includes(texto)) return 2;
      return suelta.test(`${r.label} ${r.detalle ?? ""}`) ? 3 : 9;
    };
    return todos
      .map((r) => ({ r, p: puntaje(r) }))
      .filter((x) => x.p < 9)
      .sort((a, b) => a.p - b.p)
      .map((x) => x.r);
  }, [q, todos]);

  const elegir = (r: Resultado) => {
    r.hacer();
    onCerrar();
  };

  return (
    <motion.div
      className="fixed inset-x-0 top-8 bottom-0 z-40 flex flex-col bg-surface-1"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.16 }}
      onAnimationComplete={() => input.current?.focus()}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visibles[0]) elegir(visibles[0]);
            if (e.key === "Escape") onCerrar();
          }}
          placeholder="Pantallas, abiertas, acciones…"
          enterKeyHint="go"
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
        />
        <button type="button" onClick={onCerrar} className="h-11 px-2 text-[15px] text-[#7c5cff]">
          Cancelar
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto pb-6">
        {visibles.length === 0 && (
          <li className="px-5 py-8 text-center text-[14px] text-muted-foreground">Nada con «{q}».</li>
        )}
        {visibles.map((r, i) => {
          // Buscando, el orden es por relevancia y no por grupo: sin títulos.
          const titulo = !q.trim() && visibles[i - 1]?.grupo !== r.grupo ? r.grupo : null;
          return (
            <Fila key={r.id} titulo={titulo}>
              <div className={cn("flex items-center", i === 0 && q && "bg-surface-2")}>
                <button type="button" onClick={() => elegir(r)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left active:bg-hover">
                  {r.icon && <r.icon className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-[15px]">{r.label}</span>
                  {r.detalle && <span className="max-w-[45%] shrink truncate text-[12px] text-muted-foreground">{r.detalle}</span>}
                  {i === 0 && q ? (
                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : r.grupo === "Pantallas" ? (
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
                {r.cerrable && (
                  <button
                    type="button"
                    aria-label={`Cerrar ${r.label}`}
                    onClick={() => cerrar(r.id.slice(4))}
                    className="grid size-11 shrink-0 place-items-center text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </Fila>
          );
        })}
      </ul>
    </motion.div>
  );
}

function Fila({ titulo, children }: { titulo: string | null; children: ReactNode }) {
  return (
    <li>
      {titulo && (
        <div className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</div>
      )}
      {children}
    </li>
  );
}

const escapar = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
