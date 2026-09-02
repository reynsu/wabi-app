"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { Check, FileText } from "lucide-react";

import { AIRE, Campo, Corte } from "@/components/ficha";
import { Button } from "@/components/ui/button";
import type { WidgetDefinition } from "@/components/widget";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  ORDEN_TIPOS_DOC,
  TIPOS_DE_REPORTE_DOC,
  pedirReporte,
  type TipoDeReporteDOC,
} from "@/pages/reportes-admin";
import { useBoards } from "@/stores/board";

/**
 * NuevoReporte — pedir un reporte, en el board y no en un diálogo.
 *
 * El mismo mueble que el alta de políticas, la de cuentas DOC y la de anuncios,
 * y por la misma razón: un diálogo tapa la tabla justo cuando hace falta
 * mirarla —para no volver a pedir uno que ya está, para ver en qué anda la
 * cola— y es todo o nada. La ficha vive en el riel, al costado de la tabla, y
 * mientras está abierta la lista sigue ahí para leerla y buscarla.
 *
 * La celda que la sostiene se pinta **cruda** —sin plano, sin cabecera y sin la
 * capa que abre un widget, y con el alto que el contenido pida—: ver `crudo` en
 * `widget.tsx`. Lo único que se ve en el riel es la hoja blanca.
 *
 * Lo que esta ficha tiene y las otras tres no es que **pregunta una sola cosa**.
 * Un reporte pedido no tiene período ni destinatarios: es una foto de la casa al
 * momento de pedirla, y lo único que hay que elegir es de qué habla. Eso empuja
 * dos decisiones:
 *
 * 1. Los tres tipos van **a la vista**, uno abajo del otro y con lo que trae
 *    cada uno escrito al lado. Metidos en un menú, la ficha entera sería un
 *    desplegable con un botón debajo —un menú disfrazado de hoja— y elegir
 *    pediría abrir algo para leer tres renglones que entran de sobra.
 * 2. No hay nada elegido de entrada. El primero de la lista puesto por defecto
 *    haría que tocar "Request report" sin leer saque el reporte de IDs, que es
 *    justo lo que este formulario existe para preguntar.
 */

/* El hook y las piezas que dibuja viven en el mismo archivo a propósito: son una
   sola cosa leída de una vez —lo que se está pidiendo, y los lugares donde eso
   se muestra o se toca—, y partirlo para contentar al fast refresh lo dejaría en
   dos. Es la misma decisión que toman las otras tres altas. */
/* oxlint-disable react/only-export-components */

/* ─────────────────────────── El borrador ─────────────────────────── */

/** Lo que se está pidiendo. Un solo campo, y aun así un borrador con su hook:
 *  es la misma forma que las otras tres altas, y el día que un pedido tenga un
 *  segundo campo —una ventana, una lista de cuentas— lo que cambia es esto y no
 *  la ficha ni el hook que la sostiene.
 *
 *  Vive en la pantalla que abre la ficha y no en una tienda: es un borrador, no
 *  un hecho de la casa. Dos pestañas de Reports tienen que poder estar pidiendo
 *  dos cosas distintas, y cerrar la pestaña se lo lleva. */
export function useBorradorDeReporte() {
  const [tipo, setTipo] = useState<TipoDeReporteDOC | null>(null);
  return { tipo, elegir: setTipo, limpiar: () => setTipo(null) };
}

type Draft = ReturnType<typeof useBorradorDeReporte>;

/** Lo que la ficha necesita saber del pedido: cómo pedirlo, cómo descartarlo, y
 *  si está en curso. Se lo pasa el hook que la sostiene —ver `useAltaDeReporte`
 *  al final—, que es quien tiene la promesa. */
interface Curso {
  pedir: () => void;
  cerrar: () => void;
  enviando: boolean;
}

/** Cuánto dura el destello de la fila recién pedida. Lo mismo que en las otras
 *  altas: lo suficiente para encontrarla con la vista, no tanto como para que
 *  quede distinta del resto. */
const DESTELLO_MS = 2000;

/* ─────────────────────────── Las piezas ─────────────────────────── */

/**
 * De qué es — las tres opciones, cada una con lo que trae.
 *
 * Filas y no un menú: son tres, tienen una línea de explicación cada una, y lo
 * que se elige acá decide qué columnas trae el archivo. Esconder eso detrás de
 * un desplegable es pedir un clic para leer lo único que la ficha pregunta.
 *
 * El punto de color es el mismo con el que el panel de filtros distingue cada
 * tipo: es el mismo valor, y dos maneras de distinguirlo se leen como dos cosas.
 *
 * El tilde marca la elegida y ocupa su lugar en las tres: sin el hueco
 * reservado, elegir una corre el texto de esa fila y las tres dejan de estar
 * alineadas.
 */
function Tipos({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();

  return (
    /* `radiogroup` y no una lista de botones sueltos: son tres valores de una
       misma pregunta y sólo uno puede estar puesto, que es lo que un lector de
       pantalla necesita oír antes de recorrerlos. */
    <div role="radiogroup" aria-label="Report type" className="flex flex-col gap-1.5">
      {ORDEN_TIPOS_DOC.map((valor) => {
        const tipo = TIPOS_DE_REPORTE_DOC[valor];
        const puesto = d.tipo === valor;

        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={puesto}
            disabled={enviando}
            onClick={() => d.elegir(valor)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-80",
              "disabled:pointer-events-none disabled:opacity-50",
              /* Puesta, la fila sube a la hoja y se le marca el canto; en reposo
                 va sobre el gris de un campo, que es lo que la hace verse como
                 algo que se toca. Es la misma pareja de superficies que usa el
                 control segmentado de la ficha. */
              puesto
                ? "bg-card text-foreground shadow-surface-2"
                : "bg-muted/50 hover:bg-muted",
            )}
          >
            <span
              aria-hidden
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ background: tipo.tinte }}
            />

            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium" style={{ fontSize: escala.caption }}>
                {tipo.label}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: escala.caption }}
              >
                {tipo.ayuda}
              </span>
            </span>

            <Check
              aria-hidden
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                puesto ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── La hoja ─────────────────────────── */

function FichaDeReporte({ d, curso }: { d: Draft; curso: Curso }) {
  const escala = useTypeScale();
  /* Qué hace falta para que esto sea un pedido: de qué es. Nada más, y por eso
     el botón se enciende con el primer clic. */
  const listo = d.tipo !== null && !curso.enviando;

  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-5", AIRE.corte)}>
      {/* El encabezado: qué es esto y para qué. Dos renglones, y nada más: un
          ícono acá competiría con los puntos de las tres opciones. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="font-medium tracking-tight"
          style={{ fontSize: escala.title }}
        >
          New report
        </h2>
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          {/* Lo que el pedido promete y lo que no: entra a una cola, así que la
              fila no va a traer un archivo en el mismo gesto. Decirlo acá es lo
              que evita que alguien mire la tabla buscando una bajada que todavía
              no existe. */}
          Pick what to pull. It goes into the queue and shows up in the table.
        </p>
      </div>

      <Corte />

      <div className={cn("flex min-w-0 flex-col", AIRE.campos)}>
        <Campo
          rotulo="Report type"
          ayuda="What it covers, and the columns the file comes back with."
        >
          <Tipos d={d} enviando={curso.enviando} />
        </Campo>
      </div>

      <Corte />

      {/* El pie: la acción, y lo que descarta. El mismo de las otras tres
          fichas, hasta el orden —lo que crea primero, lo que descarta después,
          los dos contra el margen izquierdo—. */}
      <div className="flex items-center gap-1.5">
        {/* El `loading` del registry deja la etiqueta de fondo invisible y pone
            el spinner encima, así que el botón no cambia de ancho al salir. Y
            deshabilitado mientras dura, que es lo que evita mandar el mismo
            pedido dos veces. */}
        <Button
          variant="primary"
          size="compact"
          disabled={!listo}
          loading={curso.enviando}
          onClick={curso.pedir}
        >
          Request report
        </Button>
        <Button
          variant="ghost"
          size="compact"
          disabled={curso.enviando}
          onClick={curso.cerrar}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── El alta ─────────────────────────── */

/** El id de la celda. Lo usan el widget y el selector que pregunta si la ficha
 *  está puesta, así que se escribe una vez. */
const CELDA = "admin-reports/nuevo";

/** La celda del board: una sola, cruda. El board no pinta nada alrededor —ni
 *  plano, ni cabecera, ni sombra— y la fila mide lo que la ficha pida. */
const celdaDeAlta = (d: Draft, curso: Curso): WidgetDefinition[] => [
  {
    id: CELDA,
    label: "New report",
    icon: FileText,
    crudo: true,
    glance: () => <FichaDeReporte d={d} curso={curso} />,
    full: () => <FichaDeReporte d={d} curso={curso} />,
  },
];

/**
 * Abrir y cerrar el alta desde la pantalla.
 *
 * Los widgets se vuelven a armar con cada cambio —el board guarda nodos, no
 * estado— y se empujan **con el id de la pestaña**: las que no se miran siguen
 * montadas, y escribir contra "la activa" le pondría la ficha en la cara a otra
 * pestaña.
 */
export function useAltaDeReporte(tabId?: string) {
  const d = useBorradorDeReporte();

  /* **Si la ficha está abierta lo sabe el board, no este hook.** Una copia en un
     `useState` de acá se desincroniza en cuanto el riel se cierra por otro lado
     —su ×, que va directo a la tienda—: el board queda cerrado y el hook
     creyendo que sigue abierto, así que el siguiente clic pide abrir algo que
     para él ya está abierto y el botón deja de responder. Es un bug que el alta
     de políticas ya pagó; derivado no puede pasar. */
  const abierta = useBoards((b) => {
    const board = tabId ? b.porPestaña[tabId] : undefined;
    return Boolean(board?.open && board.widgets.some((w) => w.id === CELDA));
  });

  const [enviando, setEnviando] = useState(false);
  /* El que se acaba de pedir, para que la tabla pueda señalarlo cuando aparece.
     Se limpia solo: es un destello, no un estado. */
  const [recienPedido, setRecienPedido] = useState<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current);
    },
    [],
  );

  const mostrarWidgets = useBoards((b) => b.mostrarWidgets);
  const abrirBoard = useBoards((b) => b.abrirBoard);
  const editarBoard = useBoards((b) => b.editarBoard);

  /* Cerrar es sacar la ficha del board. La tienda no tiene `cerrarBoard` a
     propósito —cerrarlo es de quien lo está mirando—, y ésta es la excepción que
     esa regla deja pasar: lo que hay adentro lo pusimos nosotros y lo estamos
     sacando. */
  const cerrar = useCallback(() => {
    if (!tabId) return;
    editarBoard(tabId, (b) => ({ ...b, open: false, widgets: [] }));
  }, [tabId, editarBoard]);

  /**
   * El pedido, de punta a punta.
   *
   * La ficha no se cierra antes de tiempo: se cierra cuando el pedido entró. Si
   * falla, lo elegido sigue ahí —volver a elegir porque el servidor dijo que no
   * es el peor final posible para esta hoja—.
   */
  const pedir = useCallback(async () => {
    if (!d.tipo || enviando) return;

    setEnviando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: está entrando, entró, no se pudo. */
      const pedido = await sileo.promise(pedirReporte(d.tipo), {
        /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
           "Requesting the report…" sale "Requesting The Report…". */
        loading: { title: "Requesting report…" },
        success: (hecho) => ({
          title: "Report requested",
          /* Qué va a pasar ahora, que es lo que la fila nueva todavía no puede
             contar: entró a la cola y por eso no tiene archivo. */
          description: `${hecho.nombre} is in the queue — it'll be ready to download once it's built.`,
        }),
        error: (falla) => ({
          title: "Nothing was requested",
          description:
            falla instanceof Error
              ? falla.message
              : "The report couldn't be requested — try again.",
        }),
      });

      cerrar();
      setRecienPedido(pedido.id);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setRecienPedido(null), DESTELLO_MS);
    } catch {
      /* El toast ya lo contó. Lo que importa acá es lo que **no** pasa: lo
         elegido no se toca. */
    } finally {
      setEnviando(false);
    }
  }, [d.tipo, enviando, cerrar]);

  /* Mientras está abierta, la ficha se vuelve a armar con cada cambio: el board
     guarda nodos, no estado. */
  useEffect(() => {
    if (!tabId || !abierta) return;
    mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, pedir, enviando }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, abierta, d.tipo, cerrar, pedir, enviando, mostrarWidgets]);

  /* Y cuando se cierra —por la ×, por Discard, o porque el pedido entró— el
     borrador se limpia. Un borrador que sobrevive escondido vuelve a abrir la
     hoja con algo elegido media hora atrás. */
  useEffect(() => {
    if (!abierta) d.limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  /** Abrir es poner la ficha y abrir el riel, en ese orden: si el riel se abre
   *  antes, hay un cuadro con el board vacío. */
  const abrir = useCallback(() => {
    if (!tabId) return;
    mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, pedir, enviando }));
    abrirBoard(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, d.tipo, cerrar, pedir, enviando, mostrarWidgets, abrirBoard]);

  return {
    abierta,
    enviando,
    recienPedido,
    abrir,
    /* Para la pantalla que no tiene board —una copia sin `tabId`—: sin lugar
       donde poner la ficha, el botón no promete algo que no va a pasar. */
    disponible: tabId !== undefined,
  };
}
