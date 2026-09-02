"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sileo } from "sileo";
import {
  Building2,
  Megaphone,
  Paperclip,
  Plus,
  Search,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

import { AIRE, CAMPO_PUESTO, Campo, Corte, Segmentado } from "@/components/ficha";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import type { WidgetDefinition } from "@/components/widget";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  DIA_DE_HOY,
  YO,
  mandarAnuncio,
  type Adjunto,
  type Destinatario,
} from "@/pages/anuncios";
import { useBuzones } from "@/pages/buzones";
import { fechaDia } from "@/pages/tiempo";
import { useUsuarios } from "@/pages/usuarios";
import { useBoards } from "@/stores/board";

/**
 * NuevoAnuncio — mandar un aviso, en el board y no en un diálogo.
 *
 * El mismo mueble que el alta de políticas, y por la misma razón: un diálogo
 * tapa la tabla justo cuando hace falta mirarla —para no repetir un aviso que ya
 * salió, para ver a quién se le mandó el anterior—, y es todo o nada. La ficha
 * vive en el riel, al costado de la tabla, y mientras está abierta la lista
 * sigue ahí para leerla y buscarla.
 *
 * La celda que la sostiene se pinta **cruda** —sin plano, sin cabecera y sin la
 * capa que abre un widget, y con el alto que el contenido pida—: ver `crudo` en
 * `widget.tsx`. Lo único que se ve en el riel es la hoja blanca.
 *
 * Lo que esta ficha tiene y la de políticas no es el **preview**. Una regla se
 * lee como se escribe: es una oración y una lista de nombres. Un anuncio se
 * lee como lo va a leer el que lo recibe —un título, un texto, unos archivos
 * colgados— y eso no se parece a un formulario. El interruptor del pie da vuelta
 * la hoja: los mismos datos, mirados desde el otro lado.
 */

/* El hook y las piezas que dibuja viven en el mismo archivo a propósito: son una
   sola cosa leída de una vez —lo que se está escribiendo, y los lugares donde
   eso se muestra o se toca—, y partirlo para contentar al fast refresh lo
   dejaría en dos. Es la misma decisión que toma el alta de políticas. */
/* oxlint-disable react/only-export-components */

/* ─────────────────────────── El borrador ─────────────────────────── */

interface Borrador {
  titulo: string;
  cuerpo: string;
  objetivos: Destinatario[];
  adjuntos: Adjunto[];
  /** Si se está mirando el preview.
   *
   *  Vive en el borrador y no adentro de la ficha, aunque sea estado de vista:
   *  la ficha se vuelve a armar con cada tecla —el board guarda nodos, no
   *  estado— y un `useState` de adentro se cae con el primer rearmado, dejando
   *  el interruptor puesto y la hoja del lado del formulario. */
  preview: boolean;
}

const VACIO: Borrador = {
  titulo: "",
  cuerpo: "",
  objetivos: [],
  adjuntos: [],
  preview: false,
};

/** Cuánto dura el destello de la fila recién mandada. Lo mismo que en Policies y
 *  Provisioning: lo suficiente para encontrarla con la vista, no tanto como para
 *  que quede distinta del resto. */
const DESTELLO_MS = 2000;

/** Qué entra como adjunto. Los dos números son del diseño y van juntos: el
 *  cartel de la zona de arrastre dice exactamente esto, y un tope que el cartel
 *  no anuncia es un archivo que desaparece sin explicación. */
const MAX_BYTES = 10 * 1024 * 1024;
const FORMATOS = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

/** Cuánto pesa, escrito para una persona. Bajo el mega va en KB —"340 KB" es más
 *  útil que "0.3 MB"— y de ahí para arriba con un decimal. */
export function peso(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

/** Lo que se está escribiendo, y las cosas que se le pueden hacer.
 *
 *  Vive en la pantalla que abre la ficha y no en una tienda: es un borrador, no
 *  un hecho de la casa. Dos pestañas de Announcements tienen que poder estar
 *  escribiendo dos avisos distintos, y cerrar la pestaña se lo lleva —que es lo
 *  que uno espera de algo que nunca se mandó—. */
export function useBorradorDeAnuncio() {
  const [b, setB] = useState<Borrador>(VACIO);

  return {
    b,
    limpiar: () => setB(VACIO),
    titular: (titulo: string) => setB((x) => ({ ...x, titulo })),
    escribir: (cuerpo: string) => setB((x) => ({ ...x, cuerpo })),
    verPreview: (preview: boolean) => setB((x) => ({ ...x, preview })),
    sumarObjetivo: (o: Destinatario) =>
      setB((x) =>
        x.objetivos.some((y) => y.id === o.id)
          ? x
          : { ...x, objetivos: [...x.objetivos, o] },
      ),
    sacarObjetivo: (id: string) =>
      setB((x) => ({ ...x, objetivos: x.objetivos.filter((o) => o.id !== id) })),
    /* Los archivos entran de a montones —el `input` acepta varios y el arrastre
       también—, así que la acción toma una lista y no uno. Los que no entran se
       cuentan de una vez: un toast por archivo, arrastrando una carpeta, es una
       columna de carteles. */
    sumarAdjuntos: (archivos: File[]) => {
      const pesados = archivos.filter((f) => f.size > MAX_BYTES);
      if (pesados.length > 0) {
        sileo.error({
          title:
            pesados.length === 1
              ? "That file is too big"
              : `${pesados.length} files are too big`,
          description: `The limit is ${peso(MAX_BYTES)} per file.`,
        });
      }
      const entran = archivos.filter((f) => f.size <= MAX_BYTES);
      if (entran.length === 0) return;
      setB((x) => {
        /* La identidad de un adjunto es su nombre y su tamaño: es lo que hay a
           mano y alcanza para no colgar el mismo archivo dos veces por arrastrar
           dos veces. */
        const nuevos = entran
          .map((f) => ({
            id: `${f.name}/${f.size}`,
            nombre: f.name,
            bytes: f.size,
            tipo: f.type,
          }))
          .filter((a) => !x.adjuntos.some((y) => y.id === a.id));
        return { ...x, adjuntos: [...x.adjuntos, ...nuevos] };
      });
    },
    sacarAdjunto: (id: string) =>
      setB((x) => ({ ...x, adjuntos: x.adjuntos.filter((a) => a.id !== id) })),
  };
}

type Draft = ReturnType<typeof useBorradorDeAnuncio>;

/** Lo que la ficha necesita saber del envío: cómo pedirlo, cómo descartarlo, y
 *  si está en curso. Se lo pasa el hook que la sostiene —ver `useAltaDeAnuncio`
 *  al final—, que es quien tiene la promesa. */
interface Curso {
  mandar: () => void;
  cerrar: () => void;
  enviando: boolean;
}

/** A quiénes va, escrito en una línea. Es lo que el preview pone bajo el título
 *  y lo que el pie usa para decir qué está por pasar. */
export function aQuienesVa(objetivos: Destinatario[]): string {
  if (objetivos.length === 0) return "no one yet";
  const [uno, ...otros] = objetivos;
  return otros.length > 0 ? `${uno.nombre} +${otros.length}` : uno.nombre;
}

/* ─────────────────────────── Las piezas ─────────────────────────── */

const Glifo = ({ clase }: { clase: Destinatario["clase"] }) =>
  clase === "facility" ? (
    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
  ) : (
    <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
  );

/** Buscar a quién mandárselo y sumarlo. El conmutador Facilities/Users a la
 *  derecha del campo —como en la referencia—, y las coincidencias en una lista
 *  que sólo aparece cuando hay algo que mostrar: una lista siempre abierta
 *  empuja el resto de la ficha hacia abajo. */
function BuscarDestinatario({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  const [texto, setTexto] = useState("");
  const [clase, setClase] = useState<Destinatario["clase"]>("facility");
  /* La lista se abre con el foco y no siempre: tres renglones colgando debajo
     del campo en reposo empujan el resto de la ficha y se leen como si ya
     hubiera algo puesto. */
  const [buscando, setBuscando] = useState(false);
  const usuarios = useUsuarios();
  const buzones = useBuzones();

  /* Las instalaciones son los buzones de la casa —los que no son de nadie: la
     recepción, facturación, el equipo de cuidados—, sacados de la misma lista
     que muestra Provisioning. Escribirlas acá otra vez sería tener dos padrones
     de la casa, y el día que se dé de alta uno nuevo esta lista no se
     enteraría. */
  const candidatos = useMemo(() => {
    const lista: Destinatario[] =
      clase === "facility"
        ? buzones
            .filter((b) => !b.usuario)
            .map((b) => ({
              id: `facility/${b.nombre}`,
              nombre: b.nombre,
              clase: "facility" as const,
            }))
        : usuarios.map((u) => ({
            id: `user/${u.id}`,
            nombre: u.name,
            clase: "user" as const,
            cuenta: u.id,
          }));

    const q = texto.trim().toLowerCase();
    return lista
      .filter((o) => (q ? o.nombre.toLowerCase().includes(q) : true))
      .filter((o) => !d.b.objetivos.some((y) => y.id === o.id))
      .slice(0, 3);
  }, [clase, texto, buzones, usuarios, d.b.objetivos]);

  return (
    <div className="flex flex-col gap-2">
      {/* El campo y el conmutador en el mismo renglón: el conmutador dice en qué
          padrón se está buscando, y puesto arriba —lejos del campo— se lee como
          un filtro de otra cosa. */}
      <div className="flex items-center gap-1.5">
        <InputGroup size="compact" className="min-w-0 flex-1">
          <InputField
            index={0}
            className={CAMPO_PUESTO}
            label="Search recipients"
            labelHidden
            icon={Search}
            placeholder={
              clase === "facility" ? "Search facilities…" : "Search users…"
            }
            value={texto}
            onChange={setTexto}
            disabled={enviando}
            onFocus={() => setBuscando(true)}
            /* Con retraso: el clic sobre una fila de la lista pasa primero por el
               `blur` del campo, y cerrarla en ese instante se lleva la fila que
               se estaba por tocar. */
            onBlur={() => setTimeout(() => setBuscando(false), 120)}
          />
        </InputGroup>

        <Segmentado
          className="shrink-0"
          valor={clase}
          onElegir={setClase}
          opciones={[
            { value: "facility", label: "Facilities" },
            { value: "user", label: "Users" },
          ]}
        />
      </div>

      {(buscando || texto.trim().length > 0) && candidatos.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {candidatos.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                d.sumarObjetivo(o);
                setTexto("");
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
              style={{ fontSize: escala.caption }}
            >
              <Glifo clase={o.clase} />
              <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Los que ya están, en chips que se sacan de a uno. Sin hueco cuando no
          hay ninguno: lo que falta ya lo dice el botón apagado del pie, y un
          cartel punteado por campo vacío llena de bordes una ficha que todavía
          no tiene nada adentro. */}
      {d.b.objetivos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.b.objetivos.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => d.sacarObjetivo(o.id)}
              disabled={enviando}
              className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-muted py-1 pr-1.5 pl-2 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              style={{ fontSize: escala.caption }}
              aria-label={`Remove ${o.nombre}`}
            >
              <Glifo clase={o.clase} />
              <span className="min-w-0 truncate">{o.nombre}</span>
              <X className="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** El cuerpo del aviso. Un `textarea` y no un editor: lo que esta casa manda son
 *  cuatro renglones —el agua se corta el martes—, y una barra de formato encima
 *  pide decidir cómo se ve algo que nadie va a formatear.
 *
 *  Va vestido a mano y no con `InputField`, que es de una línea. Las tres capas
 *  son las mismas que las de un campo puesto —reposo en `muted/50`, foco en
 *  `card`— para que no se lea como otra cosa. */
function Cuerpo({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  return (
    <textarea
      rows={5}
      value={d.b.cuerpo}
      onChange={(e) => d.escribir(e.target.value)}
      disabled={enviando}
      placeholder="Write your announcement content here…"
      aria-label="Message content"
      className={cn(
        "w-full resize-none rounded-lg bg-muted/50 px-3 py-2 leading-relaxed",
        "text-foreground ring-1 ring-border outline-none transition-colors",
        "placeholder:text-muted-foreground",
        "focus:bg-card focus:ring-[color:var(--focus-ring,#6B97FF)]",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      style={{ fontSize: escala.body }}
    />
  );
}

/** La zona de arrastre y lo que ya se colgó.
 *
 *  Es un `<button>` con un `<input type=file>` escondido adentro y no un `<label>`
 *  suelto: así se llega tabulando y se activa con Enter, que es lo que un
 *  rectángulo punteado no ofrece por su cuenta.
 *
 *  El borde se pinta mientras algo está sobrevolando. Sin eso, arrastrar un
 *  archivo encima no dice nada y no hay manera de saber si se lo va a soltar
 *  adentro o al lado. */
function Adjuntos({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const soltar = (archivos: FileList | null) => {
    if (archivos && archivos.length > 0) d.sumarAdjuntos(Array.from(archivos));
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          soltar(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors",
          encima
            ? "border-foreground/30 bg-muted"
            : "border-border bg-muted/40 hover:bg-muted",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-card shadow-surface-2">
          <UploadCloud className="size-4 text-muted-foreground" />
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="font-medium" style={{ fontSize: escala.caption }}>
            Click to upload or drag and drop
          </span>
          <span
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            PDF, JPG, PNG or DOC (max. {peso(MAX_BYTES)})
          </span>
        </span>
      </button>

      <input
        ref={entrada}
        type="file"
        multiple
        accept={FORMATOS}
        className="hidden"
        onChange={(e) => {
          soltar(e.target.files);
          /* Se limpia para que volver a elegir el mismo archivo dispare el
             `change`: sin esto, sacar uno y volver a colgarlo no hace nada. */
          e.target.value = "";
        }}
      />

      {d.b.adjuntos.length > 0 && (
        <ListaDeAdjuntos adjuntos={d.b.adjuntos} onSacar={d.sacarAdjunto} />
      )}
    </div>
  );
}

/** Lo colgado, en renglones. La usan la ficha —con su × para sacarlos— y el
 *  preview —sin ella, porque ahí no se edita—. */
function ListaDeAdjuntos({
  adjuntos,
  onSacar,
}: {
  adjuntos: Adjunto[];
  onSacar?: (id: string) => void;
}) {
  const escala = useTypeScale();
  return (
    <ul className="flex flex-col gap-1">
      {adjuntos.map((a) => (
        <li
          key={a.id}
          className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-1.5"
          style={{ fontSize: escala.caption }}
        >
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {peso(a.bytes)}
          </span>
          {onSacar && (
            <button
              type="button"
              onClick={() => onSacar(a.id)}
              className="shrink-0 cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              aria-label={`Remove ${a.nombre}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────── El preview ─────────────────────────── */

/**
 * El aviso como lo va a leer el que lo recibe.
 *
 * No es un resumen del formulario —eso sería repetir lo que está tres
 * centímetros más arriba— sino el otro lado: el título como título, el texto
 * como texto y los archivos colgados abajo. Es la única manera de darse cuenta
 * de que el cuerpo quedó en dos renglones sueltos o de que el título dice
 * "Water" y nada más.
 *
 * Lo que falta se dice en gris y en su lugar, no como un error: un preview de
 * algo a medio escribir tiene que poder mostrarse a medio escribir.
 */
function Vista({ d }: { d: Draft }) {
  const escala = useTypeScale();
  const { titulo, cuerpo, objetivos, adjuntos } = d.b;

  return (
    /* El mismo papel gris con el que la ficha de políticas agrupa un objetivo
       —`rounded-xl bg-muted/70`—: adentro de la hoja blanca es lo que dice "esto
       es una cosa aparte", y acá lo que separa es que esto no es un campo sino
       una cita de lo que se va a mandar. */
    <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-muted/70 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className={cn(
            "font-medium tracking-tight",
            !titulo.trim() && "text-muted-foreground",
          )}
          style={{ fontSize: escala.subtitle }}
        >
          {titulo.trim() || "Untitled announcement"}
        </h3>
        {/* De quién y para quiénes, en el renglón que en un correo va debajo del
            asunto. La fecha es la de hoy porque es cuando va a salir: un
            anuncio no se programa desde esta ficha. */}
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          {YO} · to {aQuienesVa(objetivos)} · {fechaDia(DIA_DE_HOY)}
        </p>
      </div>

      <p
        className={cn(
          "whitespace-pre-wrap",
          cuerpo.trim() ? "text-foreground" : "text-muted-foreground italic",
        )}
        style={{ fontSize: escala.body }}
      >
        {cuerpo.trim() || "No message content yet."}
      </p>

      {adjuntos.length > 0 && <ListaDeAdjuntos adjuntos={adjuntos} />}
    </div>
  );
}

/* ─────────────────────────── La ficha ─────────────────────────── */

function FichaDeAnuncio({ d, curso }: { d: Draft; curso: Curso }) {
  const escala = useTypeScale();
  /* Mientras el envío está en vuelo la ficha entera se apaga: lo que se escriba
     ahí ya no entra en lo que se está mandando, y ofrecerlo sería mentir sobre
     qué está saliendo. */
  const listo =
    d.b.titulo.trim().length > 0 &&
    d.b.objetivos.length > 0 &&
    !curso.enviando;

  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-5", AIRE.corte)}>
      {/* El encabezado: qué es esto y para qué. Dos renglones, y nada más: un
          ícono acá competiría con los de los campos. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="font-medium tracking-tight"
          style={{ fontSize: escala.title }}
        >
          New announcement
        </h2>
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          What the house is telling, and who hears it.
        </p>
      </div>

      <Corte />

      {/* La hoja se da vuelta entera y no se parte en dos columnas: en el riel no
          hay ancho para poner el formulario y su preview uno al lado del otro, y
          partido en dos ninguno de los dos entra. */}
      {d.b.preview ? (
        <Vista d={d} />
      ) : (
        <div className={cn("flex min-w-0 flex-col", AIRE.campos)}>
          {/* El título no está en la referencia —el recorte empieza debajo— pero
              la tabla se lee por su primera columna y se busca por ella, así que
              un anuncio sin título es una fila que nadie puede encontrar. Va
              primero, que es donde cae lo que uno escribe antes de pensar a
              quién mandárselo. */}
          <Campo rotulo="Announcement title">
            <InputGroup size="compact">
              <InputField
                index={0}
                className={CAMPO_PUESTO}
                label="Announcement title"
                labelHidden
                placeholder="e.g. Water will be off Tuesday from 9 to 12"
                value={d.b.titulo}
                onChange={d.titular}
                disabled={curso.enviando}
              />
            </InputGroup>
          </Campo>

          <Campo
            rotulo="Recipient targeting"
            ayuda="House mailboxes, accounts, or both."
          >
            <BuscarDestinatario d={d} enviando={curso.enviando} />
          </Campo>

          <Campo rotulo="Message content">
            <Cuerpo d={d} enviando={curso.enviando} />
          </Campo>

          <Campo rotulo="Attachments">
            <Adjuntos d={d} enviando={curso.enviando} />
          </Campo>
        </div>
      )}

      <Corte />

      {/* El pie: la acción, y la salida lateral. Es el mismo de la ficha de
          políticas, hasta el orden —lo que crea primero, lo que descarta después,
          los dos contra el margen izquierdo—.

          Sin banda. La tenía: un rectángulo gris pegado al borde de abajo. Eso
          convertía la hoja en dos superficies —el formulario arriba, una barra de
          diálogo abajo— y una ficha del riel no es un diálogo: es una hoja sola,
          y lo único que la ordena es el aire y las dos reglas punteadas. */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-1.5">
          {/* El `loading` del registry deja la etiqueta de fondo invisible y pone
              el spinner encima, así que el botón no cambia de ancho al salir: un
              pie que se reacomoda cuando lo tocás es un pie que se toca dos
              veces. Y deshabilitado mientras dura, que es lo que evita mandar el
              mismo aviso dos veces. */}
          <Button
            variant="primary"
            size="compact"
            disabled={!listo}
            loading={curso.enviando}
            onClick={curso.mandar}
          >
            Send announcement
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

        {/* El preview, donde la ficha de políticas pone su único enlace y con la
            misma cara: una frase en gris, la salida en el violeta del sistema y
            subrayada de puntos.

            Era un interruptor en la banda, y eso lo contaba mal de dos maneras.
            Un interruptor es un ajuste —algo que queda puesto, como "mandar una
            copia"— y esto no queda puesto: es ir a mirar y volver. Y estando al
            lado de los botones se leía como una tercera acción de la misma fila,
            que es justo lo que esta hoja separa con ese `mt-3`.

            La frase cambia con el lado en el que se está: desde el formulario
            invita a mirar, y desde el preview invita a volver. Es el mismo enlace
            haciendo el viaje de ida y el de vuelta. */}
        <p
          className="mt-3 text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {d.b.preview
            ? "This is how it will reach them. "
            : "Not sure how it will read? "}
          <button
            type="button"
            disabled={curso.enviando}
            onClick={() => d.verPreview(!d.b.preview)}
            className="cursor-pointer text-[oklch(0.55_0.19_292)] underline decoration-dashed underline-offset-2 hover:decoration-solid disabled:pointer-events-none disabled:opacity-50 dark:text-[oklch(0.72_0.16_292)]"
          >
            {d.b.preview ? "Back to editing" : "Preview it"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── El alta ─────────────────────────── */

/** El id de la celda. Lo usan el widget y el selector que pregunta si la ficha
 *  está puesta, así que se escribe una vez. */
const CELDA = "announcements/nuevo";

/** La celda del board: una sola, cruda. El board no pinta nada alrededor —ni
 *  plano, ni cabecera, ni sombra— y la fila mide lo que la ficha pida. */
const celdaDeAlta = (d: Draft, curso: Curso): WidgetDefinition[] => [
  {
    id: CELDA,
    label: "New announcement",
    icon: Megaphone,
    crudo: true,
    glance: () => <FichaDeAnuncio d={d} curso={curso} />,
    full: () => <FichaDeAnuncio d={d} curso={curso} />,
  },
];

/**
 * Abrir y cerrar el alta desde la pantalla.
 *
 * Los widgets se vuelven a armar con cada tecla —el board guarda nodos, no
 * estado— y se empujan **con el id de la pestaña**: las que no se miran siguen
 * montadas, y escribir contra "la activa" le pondría la ficha en la cara a otra
 * pestaña.
 */
export function useAltaDeAnuncio(tabId?: string) {
  const d = useBorradorDeAnuncio();

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

  /* Lo que pasa mientras. Lo lee la ficha entera —los campos se apagan, el botón
     cuenta que está en curso—, así que vive acá y no adentro del botón. Lo que
     salió mal no se guarda: lo cuenta el toast, y tenerlo en los dos lugares
     sería el mismo hecho dicho dos veces. */
  const [enviando, setEnviando] = useState(false);
  /* El que se acaba de mandar, para que la tabla pueda señalarlo cuando aparece.
     Se limpia solo: es un destello, no un estado. */
  const [recienMandado, setRecienMandado] = useState<string | null>(null);
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
   * El envío, de punta a punta.
   *
   * La ficha no se cierra antes de tiempo: se cierra cuando el anuncio salió. Si
   * falla, lo escrito sigue ahí —volver a redactar un aviso porque el servidor
   * dijo que no es el peor final posible para esta pantalla—.
   */
  const mandar = useCallback(async () => {
    const titulo = d.b.titulo.trim();
    if (!titulo || d.b.objetivos.length === 0 || enviando) return;

    setEnviando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: está saliendo, salió, no se pudo. La ficha ya está ocupada
         mostrando lo que se armó, y un cartel adentro competiría con lo que
         justamente hay que leer. */
      const mandado = await sileo.promise(
        mandarAnuncio({
          titulo,
          cuerpo: d.b.cuerpo,
          objetivos: d.b.objetivos,
          adjuntos: d.b.adjuntos,
          remitente: YO,
        }),
        {
          /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
             "Sending the announcement…" sale "Sending The Announcement…". */
          loading: { title: "Sending announcement…" },
          success: (hecho) => ({
            title: "Announcement sent",
            /* A cuántos les llegó, que es lo que no se ve desde la tabla sin
               abrirla: el título ya dijo que salió. */
            description: `${hecho.titulo} went out to ${hecho.objetivos.length} recipient${
              hecho.objetivos.length > 1 ? "s" : ""
            }.`,
          }),
          error: (falla) => ({
            title: "Nothing was sent",
            description:
              falla instanceof Error
                ? falla.message
                : "The announcement couldn't be sent — try again.",
          }),
        },
      );

      cerrar();
      setRecienMandado(mandado.id);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setRecienMandado(null), DESTELLO_MS);
    } catch {
      /* El toast ya lo contó. Lo que importa acá es lo que **no** pasa: el
         borrador no se toca. */
    } finally {
      setEnviando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.b, enviando, cerrar]);

  /* Mientras está abierta, la ficha se vuelve a armar con cada tecla: el board
     guarda nodos, no estado. */
  useEffect(() => {
    if (!tabId || !abierta) return;
    mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, mandar, enviando }));
  }, [tabId, abierta, d, cerrar, mandar, enviando, mostrarWidgets]);

  /* Y cuando se cierra —por la ×, por Discard, o porque el envío terminó— el
     borrador se limpia. Un borrador que sobrevive escondido vuelve a aparecer
     media hora después con un aviso que ya nadie se acuerda de haber escrito. */
  useEffect(() => {
    if (!abierta) d.limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  /** Abrir es poner la ficha y abrir el riel, en ese orden: si el riel se abre
   *  antes, hay un cuadro con el board vacío. */
  const abrir = useCallback(() => {
    if (!tabId) return;
    mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, mandar, enviando }));
    abrirBoard(tabId);
  }, [tabId, d, cerrar, mandar, enviando, mostrarWidgets, abrirBoard]);

  return {
    abierta,
    enviando,
    recienMandado,
    abrir,
    /* Para la pantalla que no tiene board —una copia sin `tabId`—: sin lugar
       donde poner la ficha, el botón no promete algo que no va a pasar. */
    disponible: tabId !== undefined,
  };
}
