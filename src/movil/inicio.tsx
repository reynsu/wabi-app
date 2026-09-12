import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { IconComponent } from "@/lib/icon-context";
import { spring } from "@/lib/springs";
import { SurfaceProvider, useSurface } from "@/lib/surface-context";
import { SURFACE_SHADOW, surfaceClasses } from "@/lib/surface-classes";
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

/**
 * Cuánto se levanta un plato sobre lo que lo sostiene.
 *
 * Dos escalones, que es lo que la escalera de superficies reserva para algo
 * apoyado encima de un plano —el mismo salto que hace un popover sobre su
 * sustrato—. El fondo del plato **no** sale de la escalera: es el tono de su
 * sección. De la escalera se toma sólo la sombra, y relativa al sustrato en el
 * que esté montado y no como número fijo: el mismo plato dentro de la lista
 * —que ya subió un escalón— levanta desde ahí, y el día que Inicio viva adentro
 * de una hoja, también.
 *
 * Apretado baja a un escalón: el plato se acerca a la superficie en vez de
 * cambiar de color, que es como esta app dice "lo estás tocando".
 */
const PLATO_SUBE = 2;
const PLATO_APRETADO = 1;

/* La mitad apretada, escrita entera y no armada con una plantilla: Tailwind
   busca las clases como texto en el archivo, y un `group-active:${...}` no
   genera ninguna. Es la misma razón por la que `surface-classes` tiene sus
   tablas literales. */
const SOMBRA_APRETADA: Record<number, string> = {
  1: "group-active:shadow-surface-1",
  2: "group-active:shadow-surface-2",
  3: "group-active:shadow-surface-3",
  4: "group-active:shadow-surface-4",
  5: "group-active:shadow-surface-5",
  6: "group-active:shadow-surface-6",
  7: "group-active:shadow-surface-7",
  8: "group-active:shadow-surface-8",
};

/* La entrada de Inicio, en cascada corta: el saludo, lo abierto y después cada
   grupo, cada uno veinte milisegundos detrás del anterior. Con seis bloques, el
   último termina cerca de los 280ms: Inicio se abre muchas veces por sesión y
   una entrada de medio segundo cansa a la tercera. El escalón es `moderate`,
   el mismo con el que se abren las pestañas y los popups.

   Con `reducedMotion="user"` —puesto en `main`— el desplazamiento se va solo y
   queda el fundido. */
const CASCADA = {
  puesto: { transition: { staggerChildren: 0.02, delayChildren: 0.01 } },
};

const SUBE = {
  oculto: { opacity: 0, y: 8 },
  puesto: { opacity: 1, y: 0, transition: spring.moderate },
};

const grupoDe = (id: string) => NAV.find((g) => g.items.some((h) => h.id === raiz(id)));

const nombreDe = (grupo?: (typeof NAV)[number]) =>
  grupo ? (grupo.label ?? NOMBRE_EN_INICIO[grupo.id]) : undefined;

export function Inicio() {
  const tabs = useWorkspace((w) => w.tabs);
  const vistas = useWorkspace((w) => w.vistas);
  const email = useSesion((s) => s.email);
  const cerrar = useWorkspace((w) => w.closeTab);
  const [todas, setTodas] = useState(false);
  const hace = useHace();
  const plano = useSurface();

  const recientes = [...tabs].sort((a, b) => (vistas[b.id] ?? 0) - (vistas[a.id] ?? 0));
  const abiertas = new Set(tabs.map((t) => raiz(t.id)));
  const visibles = todas ? recientes : recientes.slice(0, A_LA_VISTA);

  return (
    <motion.div
      variants={CASCADA}
      initial="oculto"
      animate="puesto"
      className="flex h-full min-h-0 flex-col gap-6 pt-3"
    >
      <motion.p variants={SUBE} className="px-5 text-[13px] text-muted-foreground">
        {saludo()}
        {email && `, ${email.split("@")[0]}`}
      </motion.p>

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
        <motion.section variants={SUBE} className="-mt-2 flex shrink-0 flex-col gap-2.5 px-4">
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

          {/* La tarjeta sube un escalón sobre el plano, y lo que monta adentro
              —los platos— sube desde ahí: por eso el `SurfaceProvider`, y no una
              clase con el número puesto a mano. */}
          <SurfaceProvider value={plano + 1}>
            <motion.ul
              layout
              transition={spring.moderate}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl",
                surfaceClasses(plano + 1),
                "[&>li+li]:border-t [&>li+li]:border-border",
              )}
            >
              {/* Cerrar una saca su fila y las de abajo suben a ocupar el lugar,
                  en vez de saltar: es el único aviso de que se cerró la que
                  correspondía y no otra. `popLayout` la saca del flujo antes de
                  mover al resto, así nada se pisa mientras se va. */}
              <AnimatePresence initial={false} mode="popLayout">
                {visibles.map((t, n) => {
                  const grupo = grupoDe(t.id);
                  return (
                    <motion.li
                      key={t.id}
                      layout
                      variants={SUBE}
                      exit={{ opacity: 0, scale: 0.97, transition: spring.moderate }}
                      transition={spring.moderate}
                      className="flex items-center"
                    >
                      <motion.button
                        type="button"
                        onClick={() => mostrar(t)}
                        whileTap={{ scale: 0.985 }}
                        data-cuelume-press="tick"
                        className="group flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                      >
                        <Plato icono={t.icon} tono={grupo && TONO[grupo.id]} className="size-9 rounded-xl" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-medium">{t.label}</span>
                          <span className="truncate text-[12px] text-muted-foreground">
                            {n === 0
                              ? "Viewing"
                              : [nombreDe(grupo), hace(vistas[t.id])].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </motion.button>
                      <motion.button
                        type="button"
                        aria-label={`Close ${t.label}`}
                        onClick={() => cerrar(t.id)}
                        whileTap={{ scale: 0.86 }}
                        data-cuelume-press="droplet"
                        className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                      >
                        <X className="size-4" />
                      </motion.button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </motion.ul>
          </SurfaceProvider>
        </motion.section>
      )}

      {/* Las pantallas, agrupadas como en el sidebar: el mismo orden, el mismo
          nombre de grupo y en su misma voz —sin mayúsculas, a 12px—. Es el mismo
          árbol visto de otra forma, y quien lo aprendió en uno lo encuentra en
          el otro. Por eso cada grupo arma su propia grilla aunque deje una fila
          a medias: mezclar grupos en una fila los haría parecer uno.

          Entre grupos no hay filetes, ni siquiera antes de uno sin nombre
          —Support—: lo separa el aire, igual que en el sidebar. */}
      {/* Lo único que scrollea. Arriba quedan fijos el saludo y lo abierto: son
          cortos, y son a lo que se vuelve —si se fueran de la vista al buscar
          una pantalla, volver a la que estabas pediría scrollear para arriba.

          Con el scroller del sistema —`ScrollArea` sobre Base UI, que en un
          táctil se corre sola y deja el overflow nativo— y `scroll-fade` en el
          viewport: la lista se disuelve contra el borde que todavía tiene
          contenido y se queda nítida en el principio y en el final de verdad.
          Es el mismo tratamiento que la tabla de Accounts.

          La grilla lleva `w-full`: el primitivo envuelve al contenido en un
          medidor que se ajusta a lo que mide, y sin eso cuatro columnas de
          ancho libre se acomodan a lo que ocupan y no al viewport. */}
      <ScrollArea
        className={cn(
          "min-h-0 flex-1",
          /* La barra aparece sólo mientras se scrollea. El componente del
             registry la muestra además con el puntero encima, que en una
             pantalla de escritorio es lo correcto —hay un puntero que se acerca
             a agarrarla—; acá el gesto es el dedo sobre el contenido, y una
             barra que se enciende cuando el mouse pasa por la grilla es una
             barra prendida todo el tiempo. */
          "[&_[data-slot=scroll-area-scrollbar]:not([data-scrolling])]:!opacity-0",
        )}
        /* En un táctil el área no usa la maquinaria de Base UI sino el overflow
           nativo —mejor física— y ahí la barra la pinta el navegador: en el
           teléfono es un indicador que se va solo, pero en un Chromium de
           escritorio emulando un teléfono se queda puesta. `scrollbar-hide` la
           saca sin sacar el scroll; lo que dice que hay más abajo es el
           `scroll-fade`, que es el tratamiento de borde de la casa. */
        viewportClassName="scroll-fade scrollbar-hide"
      >
        <div className="flex w-full flex-col gap-5 px-4 pb-10">
          {NAV.map((grupo) => {
            const nombre = nombreDe(grupo);
            return (
              <motion.section
                key={grupo.id}
                variants={SUBE}
                aria-label={nombre}
                className="flex flex-col gap-2.5"
              >
                {nombre && <h2 className="px-1 text-[12px] font-medium text-muted-foreground">{nombre}</h2>}
                {/* El aire entre columnas es el mínimo que separa dos platos de
                    56px: con más, "DOC Accounts" no entra en una línea. */}
                <div className="grid grid-cols-4 gap-x-1.5 gap-y-4">
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
              </motion.section>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
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
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={spring.fast}
      data-cuelume-press="tick"
      className="group flex flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
    >
      <span className="relative">
        <Plato icono={icono} tono={tono} className="size-14 rounded-2xl [&>svg]:size-6" />
        {/* Abierta: conserva lo que tenía adentro. Un punto y no un número —
            cuántas copias hay es cosa de la lista de arriba—. Aparece creciendo
            desde el centro: abrir una pantalla desde acá enciende su punto, y el
            movimiento es lo que ata las dos cosas. */}
        <AnimatePresence>
          {abierta && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={spring.slow}
              className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-3 bg-[oklch(0.58_0.2_292)]"
            />
          )}
        </AnimatePresence>
      </span>
      <span className="line-clamp-2 text-center text-[11px] leading-tight">{label}</span>
    </motion.button>
  );
}

/** Un ícono sobre un plato del tono de su sección, levantado de la superficie
 *  que lo sostiene —ver `PLATO_SUBE`—. */
function Plato({ icono: Icono, tono, className }: { icono?: IconComponent; tono?: number; className?: string }) {
  const sustrato = useSurface();
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center transition-shadow duration-80",
        SURFACE_SHADOW[Math.min(sustrato + PLATO_SUBE, 8)],
        SOMBRA_APRETADA[Math.min(sustrato + PLATO_APRETADO, 8)],
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

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
