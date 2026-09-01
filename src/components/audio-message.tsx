"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Pause, Play, Trash, X } from "lucide-react";
import WaveSurfer from "wavesurfer.js";

import { PeekCard } from "@/components/peek-card";
import { usePapel } from "@/components/papel";

import { useEsMovil } from "@/hooks/use-es-movil";
import { temaDeAhora, useTemaOscuro } from "@/stores/tema";
import { useSizeVariant, useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { notaDeVoz, reloj } from "@/pages/nota-de-voz";

/**
 * AudioMessage — una nota de voz, con su onda. La dibuja `wavesurfer.js`.
 *
 * Tiene dos caras, y no son la misma achicada:
 *
 * - **En escritorio**, la misma anatomía en chico: un marco redondo que envuelve
 *   a la cápsula donde vive el contenido —tiempo a la izquierda, onda en el
 *   medio, botón a la derecha—. Los dos anillos son la mitad de lo que hace que
 *   se lea como un reproductor y no como texto adentro de una celda: el marco
 *   va tintado y la cápsula clara, así que el control se despega de la fila
 *   aunque la fila sea blanca. Lo que no lleva son el tacho y la ×, que son de
 *   la barra del teléfono. Su ancho crece con la duración —una nota de cuatro
 *   segundos no ocupa lo que una de treinta— y sus colores son los del sistema.
 *
 *   Al lado de la cápsula, adentro del mismo marco, puede ir el botón de la
 *   transcripción: es el hermano de la cápsula, no un control suelto al lado
 *   del reproductor, y por eso vive adentro del anillo. Sólo aparece donde hace
 *   falta —donde se le pasa el texto—: en el hilo del perfil la transcripción
 *   ya está escrita debajo de la burbuja, y un botón para mostrar lo que está a
 *   la vista es un botón que miente.
 *
 *   Lo que muestra es un `PeekCard`, que es exactamente el paso que hace falta
 *   acá: más de lo que entra en un tooltip, menos de lo que justifica tapar la
 *   pantalla. Y sobre todo, **no mueve la fila**: desplegado abajo, cada
 *   transcripción abierta empujaba a las treinta y nueve que tenía debajo, y
 *   una tabla que se acomoda sola mientras uno la lee deja de ser una lista.
 *   La tarjeta se abre encima y anclada al botón, así que la lista se queda
 *   quieta.
 *
 * - **En teléfono**, la barra del diseño de referencia, entera y con sus
 *   colores: la cápsula gris sobre la barra blanca, el tiempo grande a la
 *   izquierda, la onda punteada, el tacho, el botón azul y la × afuera. Ocupa
 *   todo el ancho, porque en un teléfono no hay ancho que repartir.
 *
 * Sobre los dos controles que el referente trae y esta consola no tenía dónde
 * poner —van implementados, y sin inventar una función que la consola no
 * hace—:
 *
 * - **La ×** cierra el reproductor: la barra se pliega y queda el chip para
 *   volver a abrirla. Es lo que una × promete —cerrar esto— y es reversible.
 * - **El tacho** descarta la escucha: para y vuelve al principio. No borra el
 *   mensaje: esta consola todavía no borra mensajes, y un tacho que dijera que
 *   sí sería la peor clase de botón. Si el tacho tiene que borrar de verdad,
 *   hace falta primero una tienda de mensajes —como la que `usuarios.ts` tiene
 *   para los estados— y esa decisión no es de este archivo.
 */

/* ─────────────────────────── Los colores ───────────────────────────

   `wavesurfer` pinta en un `canvas`, y ahí un `var(--muted-foreground)` no es
   un color: es un string que el navegador descarta. Por eso los tintes se
   escriben, y por eso hace falta saber en qué tema estamos —el CSS no lo puede
   contestar por nosotros—. */

/** Escritorio: el violeta 292 del sistema, el mismo de las burbujas y de la
 *  banda de las tablas. La onda sin escuchar va en gris; si la parte no
 *  escuchada fuera del color del acento no habría con qué leer el avance. */
const SISTEMA = {
  claro: { onda: "oklch(0.80 0.015 292)", avance: "oklch(0.55 0.19 292)" },
  oscuro: { onda: "oklch(0.45 0.02 292)", avance: "oklch(0.72 0.16 292)" },
} as const;

/** Teléfono: los del referente, tal cual, y los mismos en tema claro y en
 *  oscuro. Es lo que se pidió —"con los mismos colores"— y es coherente con lo
 *  que la foto muestra: una barra blanca. Si tiene que seguir al tema oscuro,
 *  lo que cambia es este objeto y nada más. */
const REFERENCIA = {
  barra: "#FFFFFF",
  pastilla: "#F1F3F4",
  tiempo: "#5F6368",
  /* Los puntos, un escalón más oscuros que el gris de la cápsula. En la foto se
     leen con claridad, y a un `#DADCE0` sobre un `#F1F3F4` —siete por ciento de
     diferencia— no se lo ve: la línea punteada es media foto, así que el color
     que la hace visible es el fiel. */
  onda: "#C9CDD2",
  avance: "#3A4ADE",
  tacho: "#E8EAED",
  glifo: "#3C4043",
} as const;

/* ─────────────────────────── Las medidas ─────────────────────────── */

/* Escritorio, por escalón de densidad: el marco entra en el alto de una fila de
   tabla en `compact` y en el de una burbuja en `default`, y todo lo de adentro
   baja con él —un botón que no se achica dentro de una cápsula que sí deja de
   estar centrado—.

   `marco` es el envoltorio y `pastilla` lo que va adentro. Los altos son
   explícitos en los dos y no un `h-full`: el marco centra a su hijo, así que un
   porcentaje ahí no resuelve contra nada. */
const MEDIDAS = {
  default: {
    marco: "h-14 p-2 gap-2",
    /** El alto de la cápsula, en px: lo comparte el botón de la transcripción,
     *  que es un círculo de ese mismo diámetro. Va como número y no como clase
     *  porque los dos lo leen y tienen que coincidir. */
    interior: 40,
    pastilla: "pl-3.5 pr-1 gap-2.5",
    boton: 30,
    glifo: 14,
    onda: 24,
    accion: 16,
  },
  compact: {
    marco: "h-10 p-1.5 gap-1.5",
    interior: 28,
    pastilla: "pl-3 pr-[3px] gap-2",
    boton: 22,
    glifo: 11,
    onda: 18,
    accion: 13,
  },
} as const;

/* Cuánto mide la cápsula de escritorio: una base más un poco por segundo, hasta
   un techo. Una nota de cuatro segundos y una de cuarenta no pueden ocupar lo
   mismo, y el largo de la cápsula es el único lugar donde eso se ve antes de
   tocar play. En el teléfono no aplica: la barra ocupa el ancho que hay. */
const ANCHO_BASE = 205;
const ANCHO_POR_SEGUNDO = 4;
const ANCHO_TECHO = 330;

/* Las barras de la onda. En el teléfono son más gruesas y más separadas: es lo
   que en los silencios las deja como la hilera de puntos que dibuja el
   referente, y en las sílabas como barras redondeadas. `barMinHeight` en 2
   para que el silencio se siga viendo —una barra de alto cero es un agujero en
   la línea, y la línea punteada es media foto—. */
const ONDA_MOVIL = { barWidth: 3, barGap: 4, barRadius: 3, barMinHeight: 2 };
const ONDA_ESCRITORIO = { barWidth: 2, barGap: 2, barRadius: 2, barMinHeight: 1 };

/* Cuál está sonando, en toda la app. Dos notas sonando encima no es una
   funcionalidad, es un accidente: la tabla puede tener ocho a la vista y el
   perfil un hilo entero. Tocar play en una pausa la que estaba. */
let sonando: WaveSurfer | null = null;

export function AudioMessage({
  /** El id del mensaje: es lo que ata la nota a su audio. */
  id,
  segundos,
  /** Lo que dice la nota. Con esto aparece el botón que la muestra; sin esto no
   *  hay botón —ver la nota de arriba—. */
  transcripcion,
  className,
}: {
  id: string;
  segundos: number;
  transcripcion?: string;
  className?: string;
}) {
  const variante = useSizeVariant();
  const escala = useTypeScale();
  const oscuro = useTemaOscuro();
  const papel = usePapel();
  const esMovil = useEsMovil();
  const medidas = MEDIDAS[variante];
  const tintes = esMovil
    ? { onda: REFERENCIA.onda, avance: REFERENCIA.avance }
    : oscuro
      ? SISTEMA.oscuro
      : SISTEMA.claro;
  /* La paleta de papel, compartida con la tarjeta de objetivos de una
     política: ver `papel.ts`. */
  const tarjeta = papel;

  const caja = useRef<HTMLDivElement>(null);
  const onda = useRef<WaveSurfer | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  /** Dónde está el cursor, en segundos. En cero mientras nadie tocó nada —y
   *  ahí el reloj muestra la duración, no el cero: cuánto dura es lo que se
   *  quiere saber *antes* de escucharla, y "0:00" en una nota que no arrancó
   *  se lee como una nota vacía. */
  const [cursor, setCursor] = useState(0);
  /** Si la barra del teléfono está desplegada. La × la pliega; el chip que
   *  queda la vuelve a abrir. En escritorio no se usa: ahí la cápsula *es* el
   *  reproductor y no hay nada que plegar. */
  const [abierta, setAbierta] = useState(true);
  /** Si la tarjeta de la transcripción está abierta. Se controla desde acá y no
   *  se deja suelta adentro del `PeekCard` porque el botón tiene que poder
   *  pintarse encendido mientras la tarjeta está a la vista: sin eso, abierta
   *  la tarjeta, nada dice de dónde salió. */
  const [leyendo, setLeyendo] = useState(false);

  const plegada = esMovil && !abierta;

  useEffect(() => {
    /* Plegada no hay dónde dibujar: el efecto no monta nada y el `wavesurfer`
       anterior ya se destruyó en la limpieza. Volver a abrirla lo rearma —la
       nota está en memoria, así que no se vuelve a sintetizar—. */
    if (plegada || !caja.current) return;

    const nota = notaDeVoz(id, segundos);
    /* Los colores del arranque se preguntan acá y no llegan como dependencia:
       si el tema entrara por las dependencias, tocar el interruptor reharía el
       reproductor entero y se perdería la posición —y la reproducción— cada
       vez. El efecto de abajo se los pasa al dibujante ya montado. */
    const inicial = esMovil
      ? { onda: REFERENCIA.onda, avance: REFERENCIA.avance }
      : temaDeAhora()
        ? SISTEMA.oscuro
        : SISTEMA.claro;

    const ws = WaveSurfer.create({
      container: caja.current,
      height: esMovil ? 20 : medidas.onda,
      ...(esMovil ? ONDA_MOVIL : ONDA_ESCRITORIO),
      /* Sin cursor: el avance ya se lee en el color, y una línea vertical sobre
         una onda de veinte píxeles de alto es más ruido que dato. */
      cursorWidth: 0,
      normalize: true,
      dragToSeek: true,
      waveColor: inicial.onda,
      progressColor: inicial.avance,
    });

    onda.current = ws;

    /* La URL y los picos juntos: con los picos servidos, `wavesurfer` no baja
       el archivo ni lo decodifica —se saltea el `AudioContext` por nota— y la
       URL queda sólo para que el `<audio>` de adentro tenga qué reproducir. */
    void ws.load(nota.url, [nota.onda], segundos);

    const sueltas = [
      ws.on("play", () => {
        if (sonando && sonando !== ws) sonando.pause();
        sonando = ws;
        setReproduciendo(true);
      }),
      ws.on("pause", () => setReproduciendo(false)),
      ws.on("finish", () => {
        setReproduciendo(false);
        /* De vuelta al principio y el reloj al total: una nota terminada que se
           queda mostrando su propio final parece trabada. */
        ws.setTime(0);
        setCursor(0);
      }),
      ws.on("timeupdate", (t) => setCursor(t)),
      /* Si el audio no carga, que no se caiga la fila: la cápsula se queda
         quieta con su duración y sin onda. */
      ws.on("error", () => setReproduciendo(false)),
    ];

    return () => {
      for (const soltar of sueltas) soltar();
      if (sonando === ws) sonando = null;
      onda.current = null;
      ws.destroy();
    };
  }, [id, segundos, medidas.onda, esMovil, plegada]);

  /* El tema cambió: se le pasan los colores nuevos al dibujante, que se repinta
     sin rehacer nada. */
  useEffect(() => {
    onda.current?.setOptions({
      waveColor: tintes.onda,
      progressColor: tintes.avance,
    });
  }, [tintes.onda, tintes.avance]);

  const alternar = () => void onda.current?.playPause();

  /* El tacho: descarta la escucha. Para y vuelve al principio — ver la nota de
     arriba sobre por qué no borra el mensaje. */
  const descartar = () => {
    onda.current?.stop();
    setReproduciendo(false);
    setCursor(0);
  };

  const reloj_ = reloj(reproduciendo || cursor > 0 ? cursor : segundos);

  /* ─────────────────── El teléfono: la barra del referente ─────────────────── */

  if (esMovil) {
    if (!abierta) {
      /* Plegada: queda el botón redondo con la duración al lado. Es lo mínimo
         que sigue diciendo "acá hay una nota de voz" y sigue siendo un blanco
         para el dedo. */
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAbierta(true);
          }}
          aria-label="Open voice note"
          className={cn(
            /* `w-fit`: el chip mide lo suyo. La burbuja que lo contiene es
               `w-full` en el teléfono —se lo pide la barra desplegada— y sin
               esto el chip se estiraría de punta a punta pretendiendo ser algo
               más grande de lo que es. */
            "flex h-10 w-fit max-w-full cursor-pointer items-center gap-2 rounded-full px-1 pr-4",
            className,
          )}
          style={{ background: REFERENCIA.pastilla }}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: REFERENCIA.avance }}
          >
            <Play size={14} strokeWidth={2} fill="currentColor" className="translate-x-px" />
          </span>
          <span className="tabular-nums" style={{ color: REFERENCIA.tiempo, fontSize: 15 }}>
            {reloj(segundos)}
          </span>
        </button>
      );
    }

    return (
      /* La barra blanca: lo que en la foto contiene a la cápsula y a la ×.
         Frena el clic porque vive adentro de cosas que se pueden tocar —una
         fila que abre el perfil—, y escuchar una nota no es pedir otra
         pantalla. */
      <div
        className={cn(
          "flex h-14 w-full min-w-0 items-center gap-1 rounded-[28px] px-2 shadow-sm",
          className,
        )}
        style={{ background: REFERENCIA.barra }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* La cápsula gris. Todo lo que es la nota vive acá adentro; la × queda
            afuera porque no es de la nota, es de la barra. */}
        <div
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full pl-3.5 pr-1"
          style={{ background: REFERENCIA.pastilla }}
        >
          {/* El tiempo, grande y a la izquierda, como en la foto. */}
          <span
            className="shrink-0 tabular-nums"
            style={{ color: REFERENCIA.tiempo, fontSize: 17 }}
          >
            {reloj_}
          </span>

          {/* La onda. `min-w-0` para que ceda: sin eso el `canvas` se planta en
              su ancho y empuja los botones fuera de la cápsula. */}
          <div ref={caja} className="min-w-0 flex-1 cursor-pointer" />

          <button
            type="button"
            onClick={descartar}
            aria-label="Discard playback"
            className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-[filter] duration-150 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
            style={{ background: REFERENCIA.tacho, color: REFERENCIA.glifo }}
          >
            <Trash size={16} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={alternar}
            aria-label={reproduciendo ? "Pause voice note" : "Play voice note"}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-[filter] duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
            style={{ background: REFERENCIA.avance }}
          >
            {/* El triángulo, corrido un pelo a la derecha: centrado por su caja
                se ve corrido a la izquierda —su peso está de ese lado—. La
                pausa son dos barras simétricas y no necesita el empujón. */}
            {reproduciendo ? (
              <Pause size={16} strokeWidth={2} fill="currentColor" />
            ) : (
              <Play size={16} strokeWidth={2} fill="currentColor" className="translate-x-px" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAbierta(false)}
          aria-label="Close player"
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-[background] duration-150 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
          style={{ color: REFERENCIA.glifo }}
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  /* ─────────────────── El escritorio: la cápsula angosta ─────────────────── */

  /* Lo que mide el conjunto: la cápsula, más el círculo de la transcripción y
     su aire cuando lo hay. Se suma después del techo y no antes: el techo es
     cuánto puede medir la *onda*, y un botón al lado no la hace más larga. */
  const ancho =
    Math.min(ANCHO_TECHO, ANCHO_BASE + segundos * ANCHO_POR_SEGUNDO) +
    (transcripcion ? medidas.interior + 8 : 0);

  return (
    /* El marco. Misma forma que lo que envuelve —redondo entero— y otro fondo:
       tintado contra la cápsula clara de adentro. El tintado va afuera y no
       adentro a propósito: las filas de la tabla son claras, así que un marco
       del color de la fila no sería un marco, sería nada.

       Frena el clic: vive adentro de cosas que se pueden tocar —una fila que
       abre el perfil— y escuchar o leer una nota no es pedir otra pantalla. La
       tarjeta va portalada al body, así que lo que pase adentro de ella no
       vuelve por acá. */
    <div
      className={cn(
        "flex max-w-full items-center rounded-full bg-muted",
        medidas.marco,
        className,
      )}
      style={{ width: ancho }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center rounded-full border border-border bg-card",
          medidas.pastilla,
        )}
        style={{ height: medidas.interior }}
      >
        {/* El reloj, a la izquierda: cuánto va mientras suena, cuánto dura
            mientras no. Es el mismo lugar y el mismo ancho para los dos
            —`tabular-nums`— así que el número cambia sin que se mueva nada
            alrededor. */}
        <span
          className="shrink-0 tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {reloj_}
        </span>

        {/* La onda. `min-w-0` para que ceda cuando la columna viene angosta:
            sin eso el `canvas` se planta en su ancho y empuja al botón fuera de
            la cápsula. */}
        <div ref={caja} className="min-w-0 flex-1 cursor-pointer" />

        <button
          type="button"
          onClick={alternar}
          aria-label={reproduciendo ? "Pause voice note" : "Play voice note"}
          className={cn(
            "flex shrink-0 cursor-pointer items-center justify-center rounded-full",
            "text-white transition-[filter] duration-150 hover:brightness-110",
            "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          )}
          style={{
            width: medidas.boton,
            height: medidas.boton,
            background: tintes.avance,
          }}
        >
          {/* El triángulo, corrido un pelo a la derecha: centrado por su caja se
              ve corrido a la izquierda —su peso está de ese lado—. La pausa son
              dos barras simétricas y no necesita el empujón. */}
          {reproduciendo ? (
            <Pause size={medidas.glifo} strokeWidth={2} fill="currentColor" />
          ) : (
            <Play
              size={medidas.glifo}
              strokeWidth={2}
              fill="currentColor"
              className="translate-x-px"
            />
          )}
        </button>
      </div>

      {/* El botón de la transcripción, y la tarjeta que abre.
          `align="end"`: el botón está pegado al borde derecho del marco y la
          tarjeta es mucho más ancha que él, así que alineada por la izquierda
          se le iría de la pantalla. Alineada por la derecha crece hacia
          adentro, sobre la lista.

          Una sola pestaña, así que el `PeekCard` no dibuja riel —lo decide él,
          ver el comentario allá— y la tarjeta queda en lo que tiene que estar:
          el título y el texto. El título es el que nombra lo que se está
          mostrando, que con el riel afuera es el único rótulo que queda. */}
      {transcripcion && (
        <PeekCard
          open={leyendo}
          onOpenChange={setLeyendo}
          title="Transcript"
          /* Sin ícono: en el diseño el título va solo con su chip al lado, y un
             glifo delante le corre el nombre del borde donde se lo busca. */
          align="end"
          width={340}
          /* El plato. El color va por `style` y no por clase: `Elevated` le
             pinta su propio `bg-surface-N`, y una utilidad de Tailwind pierde
             contra eso por especificidad.

             El aire del cuerpo se le achica desde acá con un selector de
             descendiente. `PeekCard` no expone el relleno de sus zonas —y está
             bien que no lo haga, es lo que hace que todas las tarjetas del
             sistema se vean iguales—, pero acá el panel tiene que llegar casi
             al borde: es el gesto del diseño, un papel que ocupa la tarjeta y
             no una nota en el medio de un margen. Es la misma manera en que las
             tablas de esta app se corren la sangría.

             Y los dos radios se acompañan: 18 afuera, 12 adentro, 6 de aire
             entre los dos. Un radio interior que no es el exterior menos el
             aire deja las dos curvas peleadas, y a esta distancia se ve. */
          className={cn(
            "rounded-[18px]",
            "[&_[data-slot=card-content]]:px-1.5",
            "[&_[data-slot=card-content]]:pt-1.5",
          )}
          style={{ background: tarjeta.fondo, color: tarjeta.titulo }}
          /* Cuánto dura, pegado al nombre: dice cuál de todas es esta. */
          badge={
            <span
              className="shrink-0 rounded-full px-2 py-0.5 tabular-nums"
              style={{
                background: tarjeta.chip,
                color: tarjeta.chipTexto,
                fontSize: escala.caption,
              }}
            >
              {reloj(segundos)}
            </span>
          }
          /* El pie: de dónde salió el texto. Una transcripción no es lo que
             alguien escribió, y en una consola que modera vale la pena que eso
             esté dicho y no supuesto. */
          footer={
            <span
              className="w-full text-center"
              style={{ color: tarjeta.apagado, fontSize: escala.caption }}
            >
              Transcribed from the voice note
            </span>
          }
          tabs={[
            {
              label: "Transcript",
              /* El texto en su propio panel, más claro que el plato: es el
                 gesto del diseño —un papel apoyado sobre la tarjeta— y es lo
                 que separa lo que se dijo del marco que lo presenta. Sin
                 sombra: el color alcanza, y la tarjeta entera mide dos
                 centímetros —una sombra ahí adentro es una segunda tarjeta
                 flotando dentro de la primera—.

                 El tamaño va escrito: un `<p>` pelado hereda los 16px del
                 documento, y en una tarjeta de región compacta eso es tres
                 escalones más grande que todo lo que tiene alrededor. Sale del
                 mismo escalón que lee la fila, que es el que la tarjeta hereda
                 —el `PeekCard` sigue al `SizeProvider` de acá afuera—. */
              content: (
                <p
                  className="rounded-[12px] px-3.5 py-3 leading-relaxed"
                  style={{
                    background: tarjeta.panel,
                    color: tarjeta.texto,
                    fontSize: escala.body,
                  }}
                >
                  {transcripcion}
                </p>
              ),
            },
          ]}
        >
          {/* Hermano de la cápsula y no un control pegado afuera: mismo
              diámetro que ella y misma cáscara —claro con filete— para que se
              lean como dos piezas del mismo anillo. Abierto se pinta con el
              acento, que es el único estado que hace falta: o está mostrando el
              texto o no. */}
          <button
            type="button"
            aria-label={leyendo ? "Hide transcript" : "Show transcript"}
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
              leyendo
                ? "border-transparent text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
            style={{
              width: medidas.interior,
              height: medidas.interior,
              ...(leyendo ? { background: tintes.avance } : null),
            }}
          >
            <Captions size={medidas.accion} strokeWidth={1.75} />
          </button>
        </PeekCard>
      )}
    </div>
  );
}
