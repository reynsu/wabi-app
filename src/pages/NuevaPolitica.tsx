"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sileo } from "sileo";
import {
  Building2,
  Check,
  CircleSlash,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import type { WidgetDefinition } from "@/components/widget";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { useBuzones } from "@/pages/buzones";
import {
  YO,
  crearPolitica,
  type Objetivo,
  type Permiso,
  type Sentido,
} from "@/pages/politicas";
import { useUsuarios } from "@/pages/usuarios";
import { useBoards } from "@/stores/board";

/**
 * NuevaPolitica — escribir una regla, en el board y no en un diálogo.
 *
 * Un diálogo tapa la tabla justo cuando hace falta mirarla —para no repetir una
 * regla, para copiarle el nombre a otra—, ordena en pasos tres cosas que no
 * dependen entre sí, y es todo o nada: se cancela y no queda nada. La ficha vive
 * en el riel, al costado de la tabla, y mientras está abierta la lista sigue ahí
 * para leerla, buscarla y filtrarla.
 *
 * La celda que la sostiene se pinta **cruda** —sin plano, sin cabecera y sin la
 * capa que abre un widget, y con el alto que el contenido pida—: ver `crudo` en
 * `widget.tsx`. Lo único que se ve en el riel es la hoja blanca.
 *
 * El color aparece en dos lugares y en ninguno más: el rojo de "Block", que es
 * la decisión con consecuencias, y el violeta del sistema en el único enlace.
 * Todo lo demás es la escalera de grises, que es lo que deja que esos dos se
 * lean.
 */

/* ─────────────────────────── El borrador ─────────────────────────── */

interface Borrador {
  nombre: string;
  direcciones: string[];
  objetivos: Objetivo[];
}

const VACIO: Borrador = { nombre: "", direcciones: [], objetivos: [] };

/** Cuánto dura el destello de la fila recién creada. Lo mismo que en
 *  Provisioning: lo suficiente para encontrarla con la vista, no tanto como para
 *  que quede distinta del resto. */
const DESTELLO_MS = 2000;

/** Lo que se está escribiendo, y las seis cosas que se le pueden hacer.
 *
 *  Vive en la pantalla que abre la ficha y no en una tienda: es un borrador, no
 *  un hecho de la casa. Dos pestañas de Policies tienen que poder estar
 *  escribiendo dos reglas distintas, y cerrar la pestaña se lo lleva —que es lo
 *  que uno espera de algo que nunca se guardó—. */
export function useBorradorDePolitica() {
  const [b, setB] = useState<Borrador>(VACIO);

  return {
    b,
    limpiar: () => setB(VACIO),
    nombrar: (nombre: string) => setB((x) => ({ ...x, nombre })),
    sumarDireccion: (d: string) =>
      setB((x) =>
        d.trim() && !x.direcciones.includes(d.trim())
          ? { ...x, direcciones: [...x.direcciones, d.trim()] }
          : x,
      ),
    sacarDireccion: (d: string) =>
      setB((x) => ({ ...x, direcciones: x.direcciones.filter((y) => y !== d) })),
    sumarObjetivo: (nombre: string, clase: Objetivo["clase"]) =>
      setB((x) =>
        x.objetivos.some((o) => o.nombre === nombre)
          ? x
          : {
              ...x,
              objetivos: [
                ...x.objetivos,
                /* Nace bloqueando lo que entra: es lo que se viene a escribir
                   nueve de cada diez veces, y las otras son un clic. */
                { id: `${clase}/${nombre}`, nombre, clase, permiso: "block", sentido: "in" },
              ],
            },
      ),
    sacarObjetivo: (id: string) =>
      setB((x) => ({ ...x, objetivos: x.objetivos.filter((o) => o.id !== id) })),
    cambiarObjetivo: (id: string, cambio: Partial<Objetivo>) =>
      setB((x) => ({
        ...x,
        objetivos: x.objetivos.map((o) => (o.id === id ? { ...o, ...cambio } : o)),
      })),
  };
}

type Draft = ReturnType<typeof useBorradorDePolitica>;

/** Lo que la ficha necesita saber del alta: cómo pedirla, cómo descartarla, y
 *  si está en curso. Se lo pasa el hook que la sostiene —ver `useAltaDePolitica`
 *  al final—, que es quien tiene la promesa. */
interface Curso {
  crear: () => void;
  cerrar: () => void;
  enviando: boolean;
}

/** La regla escrita como una oración. Es lo único que dice si lo que se armó es
 *  lo que se quiso armar: los campos dicen qué se puso, esto dice qué va a
 *  pasar.
 *
 *  `null` mientras no haya nada que decir. Una ficha recién abierta no necesita
 *  un renglón que anuncie que está vacía —eso ya se ve—, y el resumen aparece
 *  cuando aparece la primera decisión, que es cuando empieza a servir. */
export function comoSeLeeElBorrador(b: Borrador): string | null {
  if (b.objetivos.length === 0 && b.direcciones.length === 0) return null;
  const de =
    b.direcciones.length === 0
      ? "any sender"
      : b.direcciones.slice(0, 2).join(", ") +
        (b.direcciones.length > 2 ? ` +${b.direcciones.length - 2}` : "");
  const quienes =
    b.objetivos.length === 0
      ? "everyone"
      : b.objetivos.map((o) => o.nombre).slice(0, 2).join(", ") +
        (b.objetivos.length > 2 ? ` +${b.objetivos.length - 2}` : "");
  const bloquea = b.objetivos.some((o) => o.permiso === "block");
  return `${bloquea ? "Blocks" : "Allows"} mail from ${de} for ${quienes}.`;
}

/* ─────────────────────────── Las piezas ─────────────────────────── */

/* La escala vertical de la ficha, escrita una vez. Tres valores y no seis: entre
   el rótulo y su control (6), entre un campo y el siguiente (20), y a los lados
   de una regla (24). Una ficha donde cada bloque elige su aire propio se lee
   como varias fichas apiladas. */
const AIRE = { rotulo: "gap-1.5", campos: "gap-5", corte: "gap-6" };

/* Los campos arrancan con la cara que el sistema les da al pasarles el puntero
   —fondo `muted/50` y anillo— en vez de arrancar transparentes.
   
   En una barra de herramientas un campo transparente está bien: hay tres cosas
   en ese renglón y se sabe cuál es el buscador. En una ficha hay cinco campos
   uno abajo del otro, y transparentes se leen como texto suelto: no se ve dónde
   se escribe hasta que la mano pasa por encima, que es justo lo que un
   formulario no puede pedir.
   
   El foco se conserva: la regla del `focus-within` pesa más que la de reposo, y
   por eso el campo enfocado sigue subiendo a `bg-card` como en todo el resto de
   la app. */
const CAMPO_PUESTO = [
  "[&>div:has(>input)]:bg-muted/50",
  "[&>div:has(>input)]:ring-border",
  "[&:focus-within>div:has(>input)]:bg-card",
].join(" ");

/** Un control segmentado. El de la referencia —Allow/Block e In/Out/Both—:
 *  fondo gris, la elegida en blanco con su sombra, y el resto en el gris del
 *  texto secundario. El color aparece sólo donde significa algo: lo que bloquea
 *  se pinta, lo que permite no. */
function Segmentado<T extends string>({
  valor,
  opciones,
  onElegir,
  className,
}: {
  valor: T;
  opciones: { value: T; label: string; icon?: ReactNode; tinte?: string }[];
  onElegir: (v: T) => void;
  className?: string;
}) {
  const escala = useTypeScale();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-muted p-0.5",
        className,
      )}
    >
      {opciones.map((o) => {
        const puesta = o.value === valor;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onElegir(o.value)}
            className={cn(
              "inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1 transition-colors duration-80",
              puesta
                ? "bg-card text-foreground shadow-surface-2"
                : "text-muted-foreground hover:text-foreground",
              puesta && o.tinte,
            )}
            style={{ fontSize: escala.caption }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

const ALLOW_BLOCK: { value: Permiso; label: string; icon: ReactNode; tinte?: string }[] = [
  { value: "allow", label: "Allow", icon: <Check className="size-3" /> },
  {
    value: "block",
    label: "Block",
    icon: <CircleSlash className="size-3" />,
    tinte: "text-[oklch(0.58_0.2_18)] dark:text-[oklch(0.72_0.17_18)]",
  },
];

const SENTIDOS: { value: Sentido; label: string }[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
  { value: "both", label: "Both" },
];

/** Un objetivo puesto: quién es, y sus dos decisiones.
 *
 *  Va en una tarjeta gris y no suelto en la hoja: son dos controles y un nombre
 *  que forman una unidad, y sin la tarjeta el segundo objetivo se lee como una
 *  continuación del primero. Los dos segmentados en su propio renglón y a lo
 *  ancho —no apretados contra el nombre—: en una columna de trescientos píxeles
 *  es lo único que los deja tocables. */
function Objetivos({ d }: { d: Draft }) {
  const escala = useTypeScale();
  if (d.b.objetivos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {d.b.objetivos.map((o) => (
        <div
          key={o.id}
          className="flex flex-col gap-2 rounded-xl bg-muted/70 px-3 py-2.5"
        >
          <span
            className="flex items-center gap-2"
            style={{ fontSize: escala.caption }}
          >
            {o.clase === "facility" ? (
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{o.nombre}</span>
            <button
              type="button"
              onClick={() => d.sacarObjetivo(o.id)}
              className="shrink-0 cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              aria-label={`Remove ${o.nombre}`}
            >
              <X className="size-3.5" />
            </button>
          </span>

          <span className="flex gap-1.5">
            <Segmentado
              className="flex-1"
              valor={o.permiso}
              onElegir={(v) => d.cambiarObjetivo(o.id, { permiso: v })}
              opciones={ALLOW_BLOCK}
            />
            <Segmentado
              className="flex-1"
              valor={o.sentido}
              onElegir={(v) => d.cambiarObjetivo(o.id, { sentido: v })}
              opciones={SENTIDOS}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Buscar un objetivo y sumarlo. El conmutador Facilities/Residents arriba a la
 *  derecha del rótulo —como en la referencia—, el campo debajo, y las
 *  coincidencias en una lista que sólo aparece cuando hay algo que escribir:
 *  una lista siempre abierta empuja el resto de la ficha hacia abajo. */
function BuscarObjetivo({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  const [texto, setTexto] = useState("");
  const [clase, setClase] = useState<Objetivo["clase"]>("facility");
  /* La lista se abre con el foco y no siempre: tres renglones colgando debajo
     del campo en reposo empujan el resto de la ficha y se leen como si ya
     hubiera algo puesto. Con el foco es una respuesta a lo que se está
     haciendo. */
  const [buscando, setBuscando] = useState(false);
  const usuarios = useUsuarios();
  const buzones = useBuzones();

  /* Las instalaciones son los buzones de la casa —los que no son de nadie: la
     recepción, facturación, el equipo de cuidados—, sacados de la misma lista
     que muestra Provisioning. Escribirlas acá otra vez sería tener dos padrones
     de la casa, y el día que se dé de alta uno nuevo esta lista no se
     enteraría. */
  const instalaciones = useMemo(
    () => buzones.filter((b) => !b.usuario).map((b) => b.nombre),
    [buzones],
  );

  const candidatos = useMemo(() => {
    const lista =
      clase === "facility" ? instalaciones : usuarios.map((u) => u.name);
    const q = texto.trim().toLowerCase();
    return lista
      .filter((n) => (q ? n.toLowerCase().includes(q) : true))
      .filter((n) => !d.b.objetivos.some((o) => o.nombre === n))
      .slice(0, 3);
  }, [clase, texto, instalaciones, usuarios, d.b.objetivos]);

  return (
    <div className="flex flex-col gap-2">
      <Segmentado
        valor={clase}
        onElegir={setClase}
        opciones={[
          { value: "facility", label: "Facilities" },
          { value: "resident", label: "Residents" },
        ]}
      />

      {/* Compacto: 28px de alto en vez de 36. En una barra de herramientas un
          campo de 36 es un control entre otros; acá son tres apilados en una
          columna de 460px, y el escalón alto los convierte en tres bloques
          gordos que empujan la ficha hacia abajo. Y es el mismo escalón del
          botón que suma, así que los dos de la misma línea miden igual. */}
      <InputGroup size="compact">
        <InputField
          index={0}
          className={CAMPO_PUESTO}
          label="Add a target"
          labelHidden
          icon={Search}
          placeholder={clase === "facility" ? "Add a facility…" : "Add a resident…"}
          value={texto}
          onChange={setTexto}
          disabled={enviando}
          onFocus={() => setBuscando(true)}
          /* Con retraso: el clic sobre una fila de la lista pasa primero por el
             `blur` del campo, y cerrarla en ese instante se lleva la fila que se
             estaba por tocar. */
          onBlur={() => setTimeout(() => setBuscando(false), 120)}
        />
      </InputGroup>

      {(buscando || texto.trim().length > 0) && candidatos.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {candidatos.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                d.sumarObjetivo(n, clase);
                setTexto("");
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
              style={{ fontSize: escala.caption }}
            >
              {clase === "facility" ? (
                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{n}</span>
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Las direcciones: el campo con su botón pegado —como el `+` de la
 *  referencia— y debajo lo que ya se sumó, en chips que se sacan de a uno. */
function Direcciones({ d, enviando }: { d: Draft; enviando: boolean }) {
  const escala = useTypeScale();
  const [texto, setTexto] = useState("");

  const sumar = () => {
    d.sumarDireccion(texto);
    setTexto("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <InputGroup size="compact" className="min-w-0 flex-1">
          <InputField
            index={0}
            className={CAMPO_PUESTO}
            label="Address"
            labelHidden
            placeholder="email or @domain"
            value={texto}
            onChange={setTexto}
            disabled={enviando}
          />
        </InputGroup>
        <Button
          variant="secondary"
          size="icon-compact"
          aria-label="Add address"
          disabled={enviando || texto.trim().length === 0}
          onClick={sumar}
        >
          <Plus />
        </Button>
      </div>

      {/* Sin hueco cuando no hay ninguna: lo que falta ya lo dice el pie —"add an
          address or a target"— y un cartel punteado por campo vacío llena de
          bordes una ficha que todavía no tiene nada adentro. */}
      {d.b.direcciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.b.direcciones.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => d.sacarDireccion(x)}
              className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-muted py-1 pr-1.5 pl-2.5 transition-colors hover:bg-accent"
              style={{ fontSize: escala.caption }}
              aria-label={`Remove ${x}`}
            >
              <span className="min-w-0 truncate">{x}</span>
              <X className="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Nombre({ d, enviando }: { d: Draft; enviando: boolean }) {
  return (
    <InputGroup size="compact">
      <InputField
        index={0}
        className={CAMPO_PUESTO}
        label="Policy name"
        labelHidden
        placeholder="e.g. Block external spam domains"
        value={d.b.nombre}
        onChange={d.nombrar}
        disabled={enviando}
      />
    </InputGroup>
  );
}

/* ─────────────────────────── La ficha ─────────────────────────── */

/** Un campo: el rótulo encima, una línea de ayuda cuando hace falta, y el
 *  control debajo.
 *
 *  El rótulo va afuera y no adentro del campo: con el rótulo arriba, la columna
 *  se recorre de un vistazo —qué se pide, qué se puso— sin tener que enfocar
 *  cada control para acordarse de qué era. Es lo que hace la referencia y es lo
 *  que separa una ficha de un formulario de diálogo. */
function Campo({
  rotulo,
  ayuda,
  children,
}: {
  rotulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  const escala = useTypeScale();
  return (
    <div className={cn("flex min-w-0 flex-col", AIRE.rotulo)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium" style={{ fontSize: escala.caption }}>
          {rotulo}
        </span>
        {ayuda && (
          <span
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            {ayuda}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** La regla que parte la ficha. Punteada: separa partes de una misma hoja, no
 *  dos superficies distintas. */
const Corte = () => (
  <span aria-hidden className="h-px shrink-0 border-t border-dashed border-border" />
);

/**
 * La ficha: el formulario entero sobre una hoja blanca.
 *
 * Sin caja alrededor —la celda del board se pinta cruda—, así que lo único que
 * hay en el riel es esto: fondo plano, sin borde y sin sombra. Lo que ordena no
 * es un marco sino el aire y las dos reglas punteadas: encabezado, cuerpo, pie.
 *
 * El color aparece en dos lugares y en ninguno más: el rojo de "Block", que es
 * la decisión con consecuencias, y el violeta del sistema en el único enlace.
 * Todo lo demás es la escalera de grises, que es lo que deja que esos dos se
 * lean.
 */
function FichaDePolitica({ d, curso }: { d: Draft; curso: Curso }) {
  const escala = useTypeScale();
  /* Mientras el alta está en vuelo la ficha entera se apaga: lo que se escriba
     ahí ya no entra en lo que se está mandando, y ofrecerlo sería mentir sobre
     qué se está creando. */
  const listo = d.b.nombre.trim().length > 0 && !curso.enviando;
  const frase = comoSeLeeElBorrador(d.b);

  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-5", AIRE.corte)}>
      {/* El encabezado: qué es esto y para qué. Dos renglones, como la
          referencia —el título en la tinta del texto, la línea de abajo en
          gris—, y nada más: un ícono acá competiría con los de los campos. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="font-medium tracking-tight"
          style={{ fontSize: escala.title }}
        >
          New policy
        </h2>
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          What the rule says, and who it covers.
        </p>
      </div>

      <Corte />

      <div className={cn("flex min-w-0 flex-col", AIRE.campos)}>
        <Campo rotulo="Policy name">
          <Nombre d={d} enviando={curso.enviando} />
        </Campo>

        <Campo
          rotulo="Addresses"
          ayuda="Full emails (user@host.tld) or whole domains (@host.tld)."
        >
          <Direcciones d={d} enviando={curso.enviando} />
        </Campo>

        <Campo
          rotulo="Targets"
          ayuda="Who the rule governs, and what happens to their mail."
        >
          <BuscarObjetivo d={d} enviando={curso.enviando} />
        </Campo>

        <Objetivos d={d} />
      </div>

      <Corte />

      {/* El pie: la regla escrita en una frase —que es lo único que dice si lo
          armado es lo que se quiso armar—, la acción, y la ayuda. */}
      <div className="flex min-w-0 flex-col gap-3">
        {/* La frase va en su propia caja y no suelta entre los dos textos
            grises del pie: es la conclusión de todo lo de arriba —lo único que
            dice si lo armado es lo que se quiso armar— y suelta se lee como
            una nota al pie más. Aparece con la primera decisión: ver
            `comoSeLeeElBorrador`. */}
        {frase && (
          <p
            className="rounded-lg bg-muted/70 px-3 py-2"
            style={{ fontSize: escala.caption }}
          >
            {frase}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          {/* El `loading` del registry deja la etiqueta de fondo invisible y
              pone el spinner encima, así que el botón no cambia de ancho al
              salir: un pie que se reacomoda cuando lo tocás es un pie que se
              toca dos veces. Y deshabilitado mientras dura, que es lo que evita
              mandar la misma regla dos veces. Lo que salió mal lo cuenta el
              toast; acá sólo hay que mostrar que está pasando. */}
          <Button
            variant="primary"
            size="compact"
            disabled={!listo}
            loading={curso.enviando}
            onClick={curso.crear}
          >
            Create policy
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

        {/* Separada del renglón de los botones: es una salida lateral —irse a
            leer cómo funciona una regla— y pegada a "Create policy" se lee como
            una tercera acción de la misma fila. */}
        <p
          className="mt-3 text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          Not sure who a rule should cover?{" "}
          <button
            type="button"
            className="cursor-pointer text-[oklch(0.55_0.19_292)] underline decoration-dashed underline-offset-2 hover:decoration-solid dark:text-[oklch(0.72_0.16_292)]"
          >
            See how policies apply
          </button>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── El alta ─────────────────────────── */

/** La celda del board: una sola, cruda. El board no pinta nada alrededor —ni
 *  plano, ni cabecera, ni sombra— y la fila mide lo que la ficha pida. */
const celdaDeAlta = (d: Draft, curso: Curso): WidgetDefinition[] => [
  {
    id: "policies/nueva",
    label: "New policy",
    icon: ShieldCheck,
    crudo: true,
    glance: () => <FichaDePolitica d={d} curso={curso} />,
    full: () => <FichaDePolitica d={d} curso={curso} />,
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
export function useAltaDePolitica(tabId?: string) {
  const d = useBorradorDePolitica();
  const [abierta, setAbierta] = useState(false);
  /* Lo que pasa mientras. Lo lee la ficha entera —los campos se apagan, el botón
     cuenta que está en curso—, así que vive acá y no adentro del botón. Lo que
     salió mal no se guarda: lo cuenta el toast, y tenerlo en los dos lugares
     sería el mismo hecho dicho dos veces. */
  const [enviando, setEnviando] = useState(false);
  /* La que se acaba de crear, para que la tabla pueda señalarla cuando aparece.
     Se limpia sola: es un destello, no un estado. */
  const [recienCreada, setRecienCreada] = useState<string | null>(null);
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
  /* Si el riel lo abrimos nosotros. La tienda no tiene `cerrarBoard` a
     propósito —cerrarlo es de quien lo está mirando, y una pantalla que lo
     cierre sola le saca de la vista algo que no puso ella—, y esta es
     justamente la excepción que esa regla deja pasar: lo que hay adentro lo
     pusimos nosotros y lo estamos sacando. Fuera de eso no se toca: un board
     que alguien abrió desde la barra, con sus widgets, sigue como estaba. */
  const abrimos = useRef(false);

  /* Cerrar es descartar: un borrador que sobrevive escondido vuelve a aparecer
     media hora después con una regla que ya nadie se acuerda de haber escrito. */
  const cerrar = useCallback(() => {
    setAbierta(false);
    d.limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * El alta, de punta a punta.
   *
   * Vive en el hook y no en el botón porque no es del botón: mientras dura, la
   * ficha entera se apaga; cuando termina, se cierra y la tabla señala la fila
   * que llegó. Dos piezas de la pantalla mirando el mismo momento.
   *
   * La ficha no se cierra antes de tiempo: se cierra cuando el alta salió bien.
   * Si falla, lo escrito sigue ahí —volver a armar una regla porque el servidor
   * dijo que no es el peor final posible para esta pantalla—.
   */
  const crear = useCallback(async () => {
    const nombre = d.b.nombre.trim();
    if (!nombre || enviando) return;

    setEnviando(true);
    try {
      /* El toast se cuelga de la promesa y cuenta los tres momentos en un solo
         aviso: se está escribiendo, quedó escrita, no se pudo. Es lo que hace
         `sileo` con `promise`, y es donde va este relato —la ficha ya está
         ocupada mostrando lo que se armó, y un cartel adentro competiría con lo
         que justamente hay que leer—. Devuelve la misma promesa, así que lo que
         sigue se encadena igual. */
      const creada = await sileo.promise(
        crearPolitica({
          nombre,
          direcciones: d.b.direcciones,
          objetivos: d.b.objetivos,
          creador: YO,
        }),
        {
          /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
             "Creating the policy…" sale "Creating The Policy…". */
          loading: { title: "Creating policy…" },
          success: (hecha) => ({
            title: "Policy created",
            /* Sobre qué rige, que es lo que no se ve desde la tabla sin abrirla:
               el título ya dijo que existe. */
            description:
              hecha.objetivos.length > 0
                ? `${hecha.nombre} now covers ${hecha.objetivos.length} target${
                    hecha.objetivos.length > 1 ? "s" : ""
                  }.`
                : `${hecha.nombre} now covers every account.`,
          }),
          error: (falla) => ({
            title: "Nothing was created",
            description:
              falla instanceof Error
                ? falla.message
                : "The policy couldn't be created — try again.",
          }),
        },
      );

      setAbierta(false);
      d.limpiar();
      setRecienCreada(creada.id);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setRecienCreada(null), DESTELLO_MS);
    } catch {
      /* El toast ya lo contó. Lo que importa acá es lo que **no** pasa: el
         borrador no se toca. */
    } finally {
      setEnviando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.b, enviando]);

  useEffect(() => {
    if (!tabId) return;

    if (abierta) {
      mostrarWidgets(tabId, celdaDeAlta(d, { cerrar, crear, enviando }));
      abrirBoard(tabId);
      abrimos.current = true;
      return;
    }

    /* La ficha se fue —se creó la regla, o se descartó—: con ella se va el
       riel. Un board vacío abierto no es un lugar donde mirar algo, es un hueco
       que quedó; y lo que se acaba de crear está en la tabla, que es adonde hay
       que mirar ahora. */
    if (!abrimos.current) return;
    abrimos.current = false;
    editarBoard(tabId, (b) => ({ ...b, open: false, widgets: [] }));
  }, [
    tabId,
    abierta,
    d,
    cerrar,
    crear,
    enviando,
    mostrarWidgets,
    abrirBoard,
    editarBoard,
  ]);

  return {
    abierta,
    enviando,
    recienCreada,
    abrir: () => setAbierta(true),
    /* Para la pantalla que no tiene board —una copia sin `tabId`—: sin lugar
       donde poner la ficha, el botón no promete algo que no va a pasar. */
    disponible: tabId !== undefined,
  };
}
