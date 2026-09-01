"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { conexionesDe, type Nodo } from "@/pages/conexiones";
import { iniciales, type Usuario } from "@/pages/usuarios";

/**
 * ConnectionMap — con quién está conectada una cuenta, dibujado.
 *
 * El cálculo lo hace `d3-force` y el dibujo lo hace React. Es a propósito y es
 * la mitad del diseño de este archivo: d3 sabe repartir nodos en un plano —eso
 * es lo que se le vino a pedir— pero también sabe crear elementos y meterlos en
 * el DOM, y ahí se pisa con React, que cree que ese pedazo del árbol es suyo.
 * Dos dueños del mismo nodo terminan en el bug de siempre: algo que React
 * remonta y d3 vuelve a dibujar encima.
 *
 * Así que la simulación corre sin tocar el documento —le da coordenadas a un
 * arreglo de objetos— y esas coordenadas entran como estado. React pinta el SVG
 * y d3 nunca lo ve.
 *
 * Se importan los módulos de `d3-force` y no el paquete `d3` entero: lo que hace
 * falta es el motor de fuerzas, y traer las escalas, los ejes, las geo-
 * proyecciones y el selector para usar cinco funciones es cargar el camión otra
 * vez.
 */

/* Cuántos pasos se le dan a la simulación antes de mostrar nada. Corrida hasta
   el final de una y pintada después, el mapa aparece **acomodado**: verlo
   temblar hasta encontrar su forma es bonito una vez y molesto las otras
   cuarenta, y sobre todo no dice nada del dato. Trescientos es donde esta red
   —del orden de veinte nodos— deja de moverse. */
const PASOS = 300;

/* Cuánto se separan y cuánto se atraen. Los tres números salen de probar sobre
   la red real y no de un default: con la repulsión de fábrica los nodos de tres
   grados se van a los bordes y las etiquetas se pisan contra el marco. */
const REPULSION = -420;
const LARGO_DEL_ENLACE = 78;
/** Cuánto aire pide cada nodo alrededor del suyo. No es su radio: es el radio
 *  más lo que ocupan su nombre y su grado debajo. Sin sumarlo, dos nodos no se
 *  tocan pero sus etiquetas sí, que para quien mira es el mismo problema. */
const AIRE_DE_LA_ETIQUETA = 32;

/* Cuánto mide media etiqueta. Es lo que el acotado necesita saber para que el
   nombre no se salga del marco, y va de la mano de cómo se lo abrevia —ver
   `comoSeLlama`—: acortar más los nombres sin bajar esto deja aire de sobra, y
   al revés los parte contra el borde. */
const MEDIA_ETIQUETA = 40;

/** El nombre como lo lleva un nodo: el primero entero y el apellido en una
 *  inicial. En un grafo el nombre no está para leerlo, está para reconocer de
 *  quién es el nodo, y "Valentina F." reconoce igual de bien que "Valentina
 *  Ferreyra" ocupando la mitad — que en una columna de cuatrocientos píxeles es
 *  la diferencia entre veinte etiquetas que se leen y veinte que se pisan.
 *
 *  Los de una sola palabra —"Housekeeping", "Front Desk"— quedan como están: no
 *  hay apellido que abreviar, y son los que la casa nombra así. */
function comoSeLlama(nombre: string) {
  const partes = nombre.split(" ");
  if (partes.length < 2) return nombre;
  const apellido = partes[partes.length - 1];
  return `${partes.slice(0, -1).join(" ")} ${apellido[0]}.`;
}

/** El tamaño de un nodo según cuán lejos está. El centro es el más grande y de
 *  ahí baja: el tamaño dice la distancia antes de que nadie lea un número. */
const RADIO: Record<number, number> = { 0: 26, 1: 21, 2: 19, 3: 16 };

/* Cuánto alto pide el mapa. Se calcula y no se hereda: el cuerpo del riel
   scrollea, así que ahí adentro un `flex-1` no recibe nada y el mapa nacía de
   alto cero —dibujado, pero de un píxel—. Sale de cuántos nodos hay, entre un
   piso y un techo: una red de cinco no necesita media pantalla vacía y una de
   veinticinco no entra en trescientos. */
const ALTO_MINIMO = 380;
const ALTO_MAXIMO = 760;
const ALTO_POR_NODO = 36;

interface NodoSim extends Nodo, SimulationNodeDatum {}
type EnlaceSim = SimulationLinkDatum<NodoSim>;

/* El violeta del sistema para el centro; el resto en el gris de los gráficos,
   escrito y no como token porque acá se pinta un SVG. */
const ACENTO = "#7c4ddb";

export function ConnectionMap({ usuario, usuarios }: { usuario: Usuario; usuarios: Usuario[] }) {
  const escala = useTypeScale();
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  const red = useMemo(
    () => conexionesDe(usuario, usuarios),
    [usuario, usuarios],
  );

  const alto = Math.min(
    ALTO_MAXIMO,
    Math.max(ALTO_MINIMO, red.nodos.length * ALTO_POR_NODO),
  );

  /* El ancho se mide en vez de asumirse: el riel es redimensionable, y un mapa
     calculado contra un ancho que no es el que tiene sale corrido. */
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(nodo);
    return () => ro.disconnect();
  }, []);

  const alcanza = ancho > 0;

  /* Las posiciones. La simulación se corre entera acá adentro y lo que sale es
     una lista de nodos con `x` e `y`: a partir de ese punto es dato, no
     animación. */
  const puestos = useMemo(() => {
    if (!alcanza) return null;

    const nodos: NodoSim[] = red.nodos.map((n) => ({ ...n }));
    const enlaces: EnlaceSim[] = red.enlaces.map((e) => ({
      source: e.origen,
      target: e.destino,
    }));

    const sim: Simulation<NodoSim, EnlaceSim> = forceSimulation(nodos)
      .force(
        "enlace",
        forceLink<NodoSim, EnlaceSim>(enlaces)
          .id((n) => n.id)
          .distance(LARGO_DEL_ENLACE),
      )
      .force("repulsion", forceManyBody().strength(REPULSION))
      .force("centro", forceCenter(ancho / 2, alto / 2))
      .force(
        "choque",
        forceCollide<NodoSim>((n) => RADIO[n.grado] + AIRE_DE_LA_ETIQUETA),
      )
      .stop();

    sim.tick(PASOS);

    /* Adentro del marco, siempre. La simulación no conoce los bordes, así que
       un nodo con pocas conexiones se va afuera y desaparece.

       Y lo que tiene que entrar no es el nodo: es el nodo **con su etiqueta**.
       El nombre va centrado debajo, así que sobresale a los dos lados y el
       margen horizontal es medio nombre; el vertical es el radio más los dos
       renglones que cuelgan. Acotando por el nodo a secas, los de los bordes
       salían con el nombre partido contra el marco. */
    const margenX = MEDIA_ETIQUETA;
    const margenY = 46;
    for (const n of nodos) {
      n.x = Math.max(margenX, Math.min(ancho - margenX, n.x ?? 0));
      n.y = Math.max(margenY, Math.min(alto - margenY, n.y ?? 0));
    }

    return { nodos, enlaces };
  }, [red, ancho, alto, alcanza]);

  return (
    <div ref={caja} className="relative w-full" style={{ height: alto }}>
      {puestos && (
        <svg width={ancho} height={alto}>
          {/* Las líneas primero: van debajo de todo, que es donde va algo que
              sólo está para decir qué toca qué. */}
          <g>
            {puestos.enlaces.map((e, i) => {
              const a = e.source as NodoSim;
              const b = e.target as NodoSim;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-border"
                  strokeWidth={1}
                />
              );
            })}
          </g>

          {puestos.nodos.map((n) => (
            <Nodo key={n.id} nodo={n} escala={escala} />
          ))}
        </svg>
      )}
    </div>
  );
}

/* Un nodo: la figura, la inicial adentro, el nombre debajo y el grado debajo del
   nombre. Va en un `<g>` trasladado y no con coordenadas absolutas en cada hijo:
   así lo de adentro se escribe desde el cero y mover el nodo es mover una cosa.

   Las cuentas van redondas y los contactos cuadrados. No es decoración: una
   cuenta es algo que la consola conoce —tiene perfil, estado, historial— y un
   contacto es un nombre en una conversación. Que se distingan de lejos es lo que
   evita tener que leer veinte etiquetas para encontrar a las que se puede
   abrir. */
function Nodo({
  nodo,
  escala,
}: {
  nodo: NodoSim;
  escala: ReturnType<typeof useTypeScale>;
}) {
  const r = RADIO[nodo.grado];
  const centro = nodo.grado === 0;
  const cuenta = nodo.tipo === "cuenta";

  return (
    <g transform={`translate(${nodo.x ?? 0}, ${nodo.y ?? 0})`}>
      {cuenta ? (
        <circle
          r={r}
          className={cn("fill-card", centro ? "stroke-2" : "stroke-1")}
          stroke={centro ? ACENTO : "var(--border)"}
        />
      ) : (
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={r / 2.4}
          className="fill-card stroke-1"
          stroke="var(--border)"
        />
      )}

      <text
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground font-medium"
        style={{ fontSize: escala.caption }}
      >
        {iniciales(nodo.nombre)}
      </text>

      {/* El nombre, cortado por palabras y no por caracteres: "Christopher
          Besse…" es lo que el diseño muestra, y partir a la mitad de una
          palabra se lee peor que no mostrarla. */}
      <text
        y={r + 14}
        textAnchor="middle"
        className={cn("fill-foreground", centro && "font-medium")}
        style={{ fontSize: escala.caption }}
      >
        {comoSeLlama(nodo.nombre)}
      </text>

      {/* El grado. El centro no lo lleva: nadie está a cero saltos de sí mismo,
          y un "0°" debajo del nombre propio es una etiqueta que hay que
          explicar. */}
      {!centro && (
        <text
          y={r + 26}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: escala.caption - 1 }}
        >
          {nodo.grado}°
        </text>
      )}
      {/* El nombre entero a un hover de distancia, para los que se cortaron. */}
      <title>{`${nodo.nombre}${centro ? "" : ` · ${nodo.grado}°`}`}</title>
    </g>
  );
}
