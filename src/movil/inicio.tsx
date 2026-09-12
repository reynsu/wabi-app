import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";

import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { NAV, aPestaña, raiz } from "@/navigation";
import { useSesion } from "@/stores/sesion";
import { useWorkspace } from "@/stores/workspace";
import { mostrar } from "./navegacion";

/**
 * Inicio: lo que en el teléfono ocupa el lugar del sidebar y de la barra de
 * pestañas a la vez.
 *
 * Dos cosas, en este orden:
 *
 *  1. **Lo abierto**, como lista por última visita: la primera es la que se
 *     estaba mirando. Se cierran acá: es el único lugar del teléfono que
 *     muestra lo abierto.
 *  2. **Las pantallas**, agrupadas como en el sidebar y como íconos teñidos
 *     por sección: se reconocen por forma y color antes que por texto, y el
 *     nombre del grupo separa los dos Search y los dos Reports.
 *
 * Las dos se eligieron probando: la forma de Inicio salió de cuatro variantes
 * —rama `prototipo/shell-movil`— y la de lo abierto, de otras cuatro —fichas en
 * una fila, tarjetas, mosaico y pila, en `prototipo/abiertas-inicio`—.
 */

/**
 * El tono de cada grupo del árbol, como hue de oklch.
 *
 * Violeta es el del sistema —el 292 de los badges—, y los demás se reparten el
 * círculo lejos de él. Va por grupo y no por hoja: el color dice de qué sección
 * es una pantalla, y dos pantallas de la misma sección con colores distintos
 * dirían lo contrario.
 *
 * Es una decisión de esta app y por eso vive acá y no en `index.css`, que es
 * copia del showcase. Si otra pantalla necesita los mismos tonos, el lugar es
 * el registry.
 */
const TONO: Record<string, number> = {
  chat: 292,
  email: 245,
  sueltas: 65,
  admin: 170,
  ayuda: 15,
};

/**
 * Nombres que un grupo tiene sólo en Inicio.
 *
 * En el sidebar, Announcements y Tickets van en un grupo sin nombre y se
 * sostienen solas: son dos filas entre secciones con título, y el aire alcanza
 * para separarlas. En la grilla no: dos íconos sueltos entre Email y Admin se
 * leían como la cola de Email. Acá llevan nombre. Support sigue sin uno: es el
 * último, y no hay nada debajo con qué confundirlo.
 */
const NOMBRE_EN_INICIO: Record<string, string> = {
  sueltas: "Others",
};

/** Cuántas se ven sin pedir el resto. Tres es lo que cabe sin que la grilla de
 *  pantallas empiece abajo del pliegue en un teléfono chico. */
const A_LA_VISTA = 3;

const grupoDe = (id: string) => NAV.find((g) => g.items.some((h) => h.id === raiz(id)));

export function Inicio() {
  const tabs = useWorkspace((w) => w.tabs);
  const vistas = useWorkspace((w) => w.vistas);
  const email = useSesion((s) => s.email);
  const cerrar = useWorkspace((w) => w.closeTab);
  const [todas, setTodas] = useState(false);
  const hace = useHace();

  const recientes = [...tabs].sort((a, b) => (vistas[b.id] ?? 0) - (vistas[a.id] ?? 0));
  const abiertas = new Set(tabs.map((t) => raiz(t.id)));

  return (
    <div className="flex flex-col gap-6 px-4 pt-3 pb-10">
      <p className="px-1 text-[13px] text-muted-foreground">
        {saludo()}
        {email && `, ${email.split("@")[0]}`}
      </p>

      {/* Lo abierto, como lista y no como fichas en una fila que scrollea: un
          nombre entero se lee sin cortarse —"Support & feedback", "Camila's
          Profile"—, y al lado entran de qué sección es y cuándo se miró, que es
          lo que distingue dos pestañas de la misma pantalla.

          Tres a la vista y el resto detrás de "Show all": lo abierto crece sin
          límite y la grilla tiene que seguir empezando arriba del pliegue.

          La primera es la que se estaba mirando —de ahí "Viewing"— y volver a
          ella es el toque más frecuente de Inicio, así que es la de más arriba y
          la más cerca del pulgar que sube. */}
      {recientes.length > 0 && (
        <section className="-mt-2 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[12px] font-medium text-muted-foreground">
              Open <span className="opacity-60">{recientes.length}</span>
            </h2>
            {recientes.length > A_LA_VISTA && (
              <button
                type="button"
                onClick={() => setTodas((t) => !t)}
                data-cuelume-press="tick"
                className={cn(
                  "cursor-pointer text-[12px] font-medium outline-none",
                  "text-[oklch(0.55_0.19_292)] underline decoration-dashed underline-offset-2 dark:text-[oklch(0.72_0.16_292)]",
                  "hover:decoration-solid focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                )}
              >
                {todas ? "Show less" : `Show all ${recientes.length}`}
              </button>
            )}
          </div>

          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface-3 shadow-surface-3 [&>li+li]:border-t [&>li+li]:border-border">
            {(todas ? recientes : recientes.slice(0, A_LA_VISTA)).map((t, n) => {
              const grupo = grupoDe(t.id);
              return (
                <li key={t.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => mostrar(t)}
                    data-cuelume-press="tick"
                    className="flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left outline-none active:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                  >
                    <Plato icono={t.icon} tono={grupo && TONO[grupo.id]} className="size-8 rounded-lg" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-medium">{t.label}</span>
                      <span className="truncate text-[12px] text-muted-foreground">
                        {n === 0
                          ? "Viewing"
                          : [grupo?.label ?? NOMBRE_EN_INICIO[grupo?.id ?? ""], hace(vistas[t.id])]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${t.label}`}
                    onClick={() => cerrar(t.id)}
                    data-cuelume-press="droplet"
                    className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Las pantallas, agrupadas como en el sidebar: el mismo orden, el mismo
          nombre de grupo y en su misma voz —sin mayúsculas, a 12px—. Es el mismo
          árbol visto de otra forma, y quien lo aprendió en uno lo encuentra en
          el otro. Por eso cada grupo arma su propia grilla aunque deje una fila
          a medias: mezclar grupos en una fila los haría parecer uno.

          Entre grupos no hay filetes, ni siquiera antes de uno sin nombre
          —Support—: lo separa el aire, igual que en el sidebar. */}
      <div className="flex flex-col gap-5">
        {NAV.map((grupo) => {
          const nombre = grupo.label ?? NOMBRE_EN_INICIO[grupo.id];
          return (
            <section key={grupo.id} aria-label={nombre} className="flex flex-col gap-2.5">
              {nombre && <h2 className="px-1 text-[12px] font-medium text-muted-foreground">{nombre}</h2>}
              <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                {grupo.items.map((hoja) => (
                  <Baldosa
                    key={hoja.id}
                    label={hoja.label}
                    icono={hoja.icon}
                    tono={TONO[grupo.id]}
                    abierta={abiertas.has(hoja.id)}
                    onClick={() => mostrar(aPestaña(hoja))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Baldosa({
  label,
  icono,
  tono,
  abierta,
  onClick,
}: {
  label: string;
  icono: IconComponent;
  tono?: number;
  abierta: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cuelume-press="tick"
      className="group flex flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
    >
      <span className="relative transition-transform duration-80 group-active:scale-95">
        <Plato icono={icono} tono={tono} className="size-14 rounded-2xl [&>svg]:size-6" />
        {/* Abierta: conserva lo que tenía adentro. Un punto y no un número —
            cuántas copias hay es cosa de las fichas de arriba. */}
        {abierta && (
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-3 bg-[oklch(0.58_0.2_292)]" />
        )}
      </span>
      <span className="line-clamp-2 text-center text-[11px] leading-tight">{label}</span>
    </button>
  );
}

/** Un ícono sobre un plato del tono de su sección. */
function Plato({ icono: Icono, tono, className }: { icono?: IconComponent; tono?: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center",
        "bg-[oklch(0.95_0.035_var(--tono))] text-[oklch(0.45_0.13_var(--tono))]",
        "dark:bg-[oklch(0.32_0.05_var(--tono))] dark:text-[oklch(0.85_0.08_var(--tono))]",
        className,
      )}
      style={{ "--tono": tono ?? 260 } as CSSProperties}
    >
      {Icono && <Icono className="size-4" />}
    </span>
  );
}

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/** "just now", "4 min ago", "2 h ago": cuándo se miró por última vez una
 *  pestaña. Se refresca solo cada medio minuto mientras Inicio está a la vista;
 *  sin eso, un Inicio abierto un rato largo sigue diciendo "just now". */
function useHace() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (cuando?: number) => {
    if (!cuando) return "";
    const min = Math.floor((ahora - cuando) / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)} h ago`;
  };
}
