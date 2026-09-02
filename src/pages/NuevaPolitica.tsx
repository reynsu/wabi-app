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
  ChevronDown,
  CircleSlash,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { punto } from "@/components/color-dot";
import { AIRE, CAMPO_PUESTO, Campo, Corte, Segmentado } from "@/components/ficha";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { MenuItem } from "@/components/ui/menu-item";
import type { WidgetDefinition } from "@/components/widget";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { useBuzones } from "@/pages/buzones";
import {
  ALCANCES,
  GRUPOS,
  ORDEN_TIPOS,
  TIPOS_DE_POLITICA,
  YO,
  alcanceDe,
  claveDeAlcance,
  crearPolitica,
  editarPolitica,
  type ClaveDeAlcance,
  type Objetivo,
  type Permiso,
  type Politica,
  type Sentido,
  type TipoDePolitica,
} from "@/pages/politicas";
import { useUsuarios } from "@/pages/usuarios";
import { useBoards } from "@/stores/board";

/**
 * NuevaPolitica — escribir una regla **y corregirla**, en el board y no en un
 * diálogo.
 *
 * Un diálogo tapa la tabla justo cuando hace falta mirarla —para no repetir una
 * regla, para copiarle el nombre a otra—, ordena en pasos tres cosas que no
 * dependen entre sí, y es todo o nada: se cancela y no queda nada. La ficha vive
 * en el riel, al costado de la tabla, y mientras está abierta la lista sigue ahí
 * para leerla, buscarla y filtrarla.
 *
 * **Corregir usa esta misma ficha, llena.** Antes era un diálogo aparte
 * —`EditorDePolitica`— y eran dos formularios que no coincidían en nada: el
 * diálogo preguntaba el tipo y el grupo; la ficha, las direcciones y los
 * objetivos. Entre los dos no había una sola idea de qué es editable en una
 * regla, así que corregir una escrita desde acá no dejaba tocar lo que se había
 * escrito, y escribir una nueva no dejaba elegir lo que el diálogo sí. Un
 * formulario, lleno o vacío, es lo que hace que las dos cosas digan lo mismo. Es
 * la misma decisión que tomaron las cuentas DOC.
 *
 * Lo único que cambia entre las dos caras son dos campos, y aparecen sólo al
 * corregir: el **tipo** y el **grupo**. Al escribir una nueva no se preguntan
 * porque no preguntan nada —una regla hecha de remitentes y de permisos por
 * objetivo *es* una regla de acceso, y sin objetivos rige sobre todos—; al
 * corregir existen con un valor que la regla ya tiene, y una hoja que los
 * esconde los estaría pisando en silencio. Es la misma decisión, y por el mismo
 * motivo, que el campo Status de la ficha de una cuenta DOC.
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

/* El hook y las piezas que dibuja viven en el mismo archivo a propósito: son una
   sola cosa leída de una vez —lo que se está escribiendo, y los ocho lugares
   donde eso se muestra o se toca—, y partirlo para contentar al fast refresh lo
   dejaría en dos. Es la misma decisión que toma el alta de buzones. */
/* oxlint-disable react/only-export-components */

/* ─────────────────────────── El borrador ─────────────────────────── */

interface Borrador {
  nombre: string;
  /** De qué familia es. Sólo se pregunta al corregir; una regla nueva nace
   *  `access`, que es lo que una regla hecha de remitentes y permisos es. */
  tipo: TipoDePolitica;
  /** Sobre qué grupo rige, como la clave que el panel de filtros usa. Guardar la
   *  clave y no el `Alcance` es lo que deja que el desplegable sea una lista de
   *  opciones planas; se vuelve a `Alcance` al guardar, con `alcanceDe`.
   *
   *  Manda sólo cuando no hay objetivos: con objetivos rige la lista, que es lo
   *  que dice `claveDeAlcance`. */
  alcance: ClaveDeAlcance;
  direcciones: string[];
  objetivos: Objetivo[];
}

const VACIO: Borrador = {
  nombre: "",
  /* Los mismos dos valores con los que nace una política escrita desde acá —ver
     `crearPolitica`—, y no otros: la ficha vacía tiene que decir lo que el alta
     va a guardar. */
  tipo: "access",
  alcance: "todas",
  direcciones: [],
  objetivos: [],
};

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
    /* Cargar una política adentro del borrador. Es lo único que separa corregir
       de escribir de cero: el mismo formulario, con algo escrito.

       El alcance entra como la clave que el panel usa —no como el `Alcance`
       guardado— porque es lo que el desplegable elige. Y sale de la política
       entera y no de su `alcance`: una regla con objetivos rige sobre ellos,
       diga lo que diga el alcance que quedó por defecto. */
    cargar: (p: Politica) =>
      setB({
        nombre: p.nombre,
        tipo: p.tipo,
        alcance: claveDeAlcance(p),
        direcciones: [...p.direcciones],
        objetivos: p.objetivos.map((o) => ({ ...o })),
      }),
    nombrar: (nombre: string) => setB((x) => ({ ...x, nombre })),
    elegirTipo: (tipo: TipoDePolitica) => setB((x) => ({ ...x, tipo })),
    elegirAlcance: (alcance: ClaveDeAlcance) => setB((x) => ({ ...x, alcance })),
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

/** Lo que la ficha necesita saber del alta: a cuál se lo está haciendo, cómo
 *  pedirla, cómo descartarla, y si está en curso. Se lo pasa el hook que la
 *  sostiene —ver `useAltaDePolitica` al final—, que es quien tiene la promesa. */
interface Curso {
  /** A cuál política se le está haciendo esto, o `null` si se está escribiendo
   *  una. Es lo único que separa las dos caras de la ficha, y por eso viaja como
   *  un dato y no como un booleano `esEdicion`: el que corrige necesita **cuál**
   *  —para el subtítulo, y para conservar el alcance que la regla ya tenía—. */
  corrigiendo: Politica | null;
  guardar: () => void;
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
  /* Sin objetivos manda el grupo, y la frase lo dice con el nombre del grupo y
     no con un "everyone" fijo: desde que el grupo se puede elegir, decir
     "everyone" sobre una regla puesta en House mailboxes sería la frase
     contradiciendo al campo que está tres renglones más arriba. */
  const quienes =
    b.objetivos.length === 0
      ? ALCANCES[b.alcance].toLowerCase()
      : b.objetivos.map((o) => o.nombre).slice(0, 2).join(", ") +
        (b.objetivos.length > 2 ? ` +${b.objetivos.length - 2}` : "");
  const bloquea = b.objetivos.some((o) => o.permiso === "block");
  return `${bloquea ? "Blocks" : "Allows"} mail from ${de} for ${quienes}.`;
}

/* ─────────────────────────── Las piezas ─────────────────────────── */

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

/** Un desplegable de una sola elección: el rótulo puesto, el chevron, y las
 *  opciones marcando cuál está.
 *
 *  Es el mismo mueble que los campos Role y Organizations de la ficha de una
 *  cuenta DOC —un `tertiary` compacto que ocupa el ancho del campo, con el
 *  valor a la izquierda y el chevron contra el borde—: son dos fichas del mismo
 *  riel, y un desplegable con otra cara acá se leería como otro control.
 *
 *  El tilde marca el puesto y va como ícono, no al final: es la misma columna en
 *  la que las otras opciones tienen su lugar vacío, así que las filas siguen
 *  alineadas. Cuando la opción trae punto de color, el punto se queda con esa
 *  columna y el puesto se marca con el fondo del `MenuItem`. */
function Elegir({
  rotulo,
  valor,
  opciones,
  onElegir,
  enviando,
}: {
  rotulo: string;
  valor: string;
  opciones: { value: string; label: string; icon?: ReturnType<typeof punto> }[];
  onElegir: (v: string) => void;
  enviando: boolean;
}) {
  const puesta = opciones.find((o) => o.value === valor);

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button
            variant="tertiary"
            size="compact"
            trailingIcon={ChevronDown}
            disabled={enviando}
            aria-label={`${rotulo}: ${puesta?.label ?? ""}`}
            className="w-full [&>span:last-child]:w-full [&>span:last-child]:justify-between"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {puesta?.icon && <puesta.icon size={12} aria-hidden />}
          <span className="min-w-0 truncate">{puesta?.label}</span>
        </span>
      </DropdownTrigger>

      <DropdownContent
        side="bottom"
        align="start"
        className="w-auto min-w-52"
        checkedIndex={opciones.findIndex((o) => o.value === valor)}
      >
        {opciones.map((o, i) => (
          <MenuItem
            key={o.value}
            index={i}
            icon={o.icon ?? (o.value === valor ? Check : undefined)}
            label={o.label}
            /* `checked` lo vuelve una opción de un grupo —`menuitemradio`— y no
               una acción suelta: elegir una reemplaza a la que había. */
            checked={o.value === valor}
            onSelect={() => onElegir(o.value)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

/** Las opciones del grupo. Los cuatro que se pueden elegir, más —cuando la regla
 *  que se corrige ya no es un grupo— lo que esa regla es: se puede dejar donde
 *  está, no elegir uno nuevo. Sin eso, abrir a corregir una excepción escrita
 *  sobre una cuenta mostraría un desplegable con un valor que no está en su
 *  propia lista. */
const opcionesDeAlcance = (puesto: ClaveDeAlcance) => [
  ...GRUPOS.map((value) => ({ value, label: ALCANCES[value] })),
  ...(GRUPOS.includes(puesto)
    ? []
    : [{ value: puesto, label: ALCANCES[puesto] }]),
];

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

/* El hook y las piezas que dibuja viven en el mismo archivo a propósito: son una
   sola cosa leída de una vez —lo que se está escribiendo, y los ocho lugares
   donde eso se muestra o se toca—, y partirlo para contentar al fast refresh lo
   dejaría en dos. Es la misma decisión que toma el alta de buzones. */
/* oxlint-disable react/only-export-components */
function FichaDePolitica({ d, curso }: { d: Draft; curso: Curso }) {
  const corrigiendo = curso.corrigiendo;
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
          {corrigiendo ? "Edit policy" : "New policy"}
        </h2>
        {/* Corrigiendo, el subtítulo dice **qué se conserva**: la hoja llega
            llena y lo que hay que saber antes de tocar nada es qué queda fuera
            de este formulario. Escribiendo, dice qué se está por armar. */}
        <p className="text-muted-foreground" style={{ fontSize: escala.caption }}>
          {corrigiendo
            ? "Rewrite what the rule says, or move who it covers. When it was written stays."
            : "What the rule says, and who it covers."}
        </p>
      </div>

      <Corte />

      <div className={cn("flex min-w-0 flex-col", AIRE.campos)}>
        <Campo rotulo="Policy name">
          <Nombre d={d} enviando={curso.enviando} />
        </Campo>

        {/* Sólo al corregir. Una regla escrita desde acá nace `access` y sin
            grupo —lo dice `crearPolitica`—, así que en el alta serían dos campos
            con un valor fijo, que no preguntan nada. Al corregir la regla ya los
            tiene, y una hoja que no los muestra los estaría guardando en
            silencio sin que nadie los haya visto. Es la misma decisión que el
            campo Status de la ficha de una cuenta DOC. */}
        {corrigiendo && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            <Campo rotulo="Type">
              <Elegir
                rotulo="Type"
                valor={d.b.tipo}
                enviando={curso.enviando}
                opciones={ORDEN_TIPOS.map((value) => ({
                  value,
                  label: TIPOS_DE_POLITICA[value].label,
                  icon: punto(TIPOS_DE_POLITICA[value].tinte),
                }))}
                onElegir={(v) => d.elegirTipo(v as TipoDePolitica)}
              />
            </Campo>

            <Campo rotulo="Applies to">
              <Elegir
                rotulo="Applies to"
                valor={d.b.alcance}
                enviando={curso.enviando}
                opciones={opcionesDeAlcance(claveDeAlcance(corrigiendo))}
                onElegir={(v) => d.elegirAlcance(v as ClaveDeAlcance)}
              />
            </Campo>

            {/* El grupo manda sólo mientras no haya nadie nombrado abajo, y eso
                hay que decirlo donde se decide: con un objetivo puesto, el
                desplegable sigue teniendo un valor y ya no gobierna nada. Es lo
                mismo que hace `claveDeAlcance`, escrito para quien mira la
                hoja. */}
            {d.b.objetivos.length > 0 && (
              <p
                className="col-span-2 text-muted-foreground"
                style={{ fontSize: escala.caption }}
              >
                The targets below take over: while there is at least one, the
                group is not what the rule follows.
              </p>
            )}
          </div>
        )}

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
            onClick={curso.guardar}
          >
            {corrigiendo ? "Save changes" : "Create policy"}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            disabled={curso.enviando}
            onClick={curso.cerrar}
          >
            {/* "Discard" descarta un borrador; corrigiendo no hay borrador que
                descartar sino cambios que no se guardan. */}
            {corrigiendo ? "Cancel" : "Discard"}
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
/** El id de la celda. Lo usan el widget y el selector que pregunta si la ficha
 *  está puesta, así que se escribe una vez. */
const CELDA = "policies/nueva";

const celdaDeAlta = (d: Draft, curso: Curso): WidgetDefinition[] => [
  {
    id: CELDA,
    label: curso.corrigiendo ? "Edit policy" : "New policy",
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
  /* A cuál política se le está corrigiendo, o `null` si se está escribiendo una.
     Vive acá y no en el borrador: el borrador es lo que se escribió, y esto es
     contra qué se va a guardar. */
  const [corrigiendo, setCorrigiendo] = useState<Politica | null>(null);

  /* **Si la ficha está abierta lo sabe el board, no este hook.**
     
     Estaba copiado en un `useState` de acá, y esa copia se desincronizaba en
     cuanto el riel se cerraba por otro lado —su ×, que va directo a la tienda—:
     el board quedaba cerrado y el hook creyendo que seguía abierto, así que el
     siguiente clic en "New policy" pedía abrir algo que para él ya estaba
     abierto, no cambiaba ningún estado, y el efecto que llama a `abrirBoard`
     nunca volvía a correr. El botón dejaba de responder hasta que alguien abría
     el riel desde la barra —y ahí aparecía la ficha, que nunca se había ido—.
     
     Derivado no puede pasar: hay un solo lugar donde vive el hecho. Se lee con
     un selector que devuelve un booleano, así que reescribir los widgets en cada
     tecla no vuelve a renderizar esta pantalla. */
  const abierta = useBoards((b) => {
    const board = tabId ? b.porPestaña[tabId] : undefined;
    return Boolean(board?.open && board.widgets.some((w) => w.id === CELDA));
  });
  /* Lo que pasa mientras. Lo lee la ficha entera —los campos se apagan, el botón
     cuenta que está en curso—, así que vive acá y no adentro del botón. Lo que
     salió mal no se guarda: lo cuenta el toast, y tenerlo en los dos lugares
     sería el mismo hecho dicho dos veces. */
  const [enviando, setEnviando] = useState(false);
  /* La que se acaba de tocar, para que la tabla pueda señalarla. Vale para las
     dos: una fila corregida se busca con la vista igual que una nueva, y más
     todavía acá, donde la tabla se ordena por una fecha que la fila corregida no
     mueve —así que puede quedar en cualquier parte de las dos páginas—. Se
     limpia sola: es un destello, no un estado. */
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

  /* Cerrar es sacar la ficha del board. La tienda no tiene `cerrarBoard` a
     propósito —cerrarlo es de quien lo está mirando, y una pantalla que lo
     cierre sola le saca de la vista algo que no puso ella—, y ésta es la
     excepción que esa regla deja pasar: lo que hay adentro lo pusimos nosotros
     y lo estamos sacando. */
  const cerrar = useCallback(() => {
    if (!tabId) return;
    editarBoard(tabId, (b) => ({ ...b, open: false, widgets: [] }));
  }, [tabId, editarBoard]);

  /**
   * Guardar, de punta a punta. Las dos caras por el mismo camino: escribir una
   * regla nueva y corregir una son la misma promesa contra otra función del
   * modelo, y el único quiebre está en las tres líneas del medio.
   *
   * Vive en el hook y no en el botón porque no es del botón: mientras dura, la
   * ficha entera se apaga; cuando termina, se cierra y la tabla señala la fila
   * que quedó. Dos piezas de la pantalla mirando el mismo momento.
   *
   * La ficha no se cierra antes de tiempo: se cierra cuando salió bien. Si
   * falla, lo escrito sigue ahí —volver a armar una regla porque el servidor
   * dijo que no es el peor final posible para esta pantalla—.
   */
  const guardar = useCallback(async () => {
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
      const hecha = await sileo.promise(
        corrigiendo
          ? editarPolitica(corrigiendo.id, {
              nombre,
              tipo: d.b.tipo,
              /* El alcance vuelve a su forma guardada, y con el original a mano:
                 una regla que ya regía sobre una cuenta o sobre sus objetivos
                 conserva eso mientras nadie la mueva a un grupo. Ver
                 `alcanceDe`. */
              alcance: alcanceDe(d.b.alcance, corrigiendo.alcance),
              direcciones: d.b.direcciones,
              objetivos: d.b.objetivos,
            })
          : crearPolitica({
              nombre,
              direcciones: d.b.direcciones,
              objetivos: d.b.objetivos,
              creador: YO,
            }),
        {
          /* Sin artículos: Sileo capitaliza el título palabra por palabra, y
             "Creating the policy…" sale "Creating The Policy…". */
          loading: {
            title: corrigiendo ? "Saving policy…" : "Creating policy…",
          },
          success: (quedo) => ({
            title: corrigiendo ? "Policy saved" : "Policy created",
            /* Sobre qué rige, que es lo que el título no dice. Sin objetivos sale
               del grupo y no de un "every account" fijo: desde que corregir pasa
               por acá, una regla que sigue rigiendo sobre una sola cuenta se
               guarda igual, y el aviso diría lo contrario de lo que dice su
               propia fila dos centímetros más allá. Es el vocabulario del panel
               de filtros, que es donde ese grupo ya tiene nombre. */
            description:
              quedo.objetivos.length > 0
                ? `${quedo.nombre} now covers ${quedo.objetivos.length} target${
                    quedo.objetivos.length > 1 ? "s" : ""
                  }.`
                : `${quedo.nombre} now covers ${ALCANCES[
                    claveDeAlcance(quedo)
                  ].toLowerCase()}.`,
          }),
          error: (falla) => ({
            title: corrigiendo ? "Nothing was saved" : "Nothing was created",
            description:
              falla instanceof Error
                ? falla.message
                : "The policy couldn't be saved — try again.",
          }),
        },
      );

      cerrar();
      setRecienCreada(hecha.id);
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setRecienCreada(null), DESTELLO_MS);
    } catch {
      /* El toast ya lo contó. Lo que importa acá es lo que **no** pasa: el
         borrador no se toca. */
    } finally {
      setEnviando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.b, enviando, cerrar, corrigiendo]);

  /* Mientras está abierta, la ficha se vuelve a armar con cada tecla: el board
     guarda nodos, no estado. Va con el id de la pestaña —las que no se miran
     siguen montadas, y escribir contra "la activa" le pondría la ficha en la
     cara a otra—. */
  useEffect(() => {
    if (!tabId || !abierta) return;
    mostrarWidgets(
      tabId,
      celdaDeAlta(d, { cerrar, guardar, enviando, corrigiendo }),
    );
  }, [tabId, abierta, d, cerrar, guardar, enviando, corrigiendo, mostrarWidgets]);

  /* Y cuando se cierra —por la ×, por Discard, o porque el alta terminó— el
     borrador se limpia. Un borrador que sobrevive escondido vuelve a aparecer
     media hora después con una regla que ya nadie se acuerda de haber escrito.
     Sobre un borrador ya vacío no hace nada: `setState` con el mismo objeto no
     vuelve a renderizar. */
  useEffect(() => {
    if (!abierta) {
      d.limpiar();
      /* Y deja de estar corrigiendo. Sin esto, cerrar el editor de una regla y
         tocar "New policy" abriría una hoja vacía que al guardar pisaría la
         política de la vez anterior. */
      setCorrigiendo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  /** Abrir es poner la ficha y abrir el riel, en ese orden: si el riel se abre
   *  antes, hay un cuadro con el board vacío.
   *
   *  Con una política, la ficha llega llena y guarda contra ella; sin ella,
   *  vacía. Es la misma ficha: escribir una regla y corregirla son el mismo
   *  formulario con el mismo contenido, uno vacío y el otro lleno. */
  const abrirCon = useCallback(
    (politica: Politica | null) => {
      if (!tabId) return;
      /* El orden importa: primero se dice contra qué se guarda y qué hay
         escrito, y recién después se pone la ficha. Al revés, el primer cuadro
         mostraría la hoja vacía y los campos aparecerían un instante después. */
      setCorrigiendo(politica);
      if (politica) d.cargar(politica);
      else d.limpiar();
      mostrarWidgets(
        tabId,
        celdaDeAlta(d, { cerrar, guardar, enviando, corrigiendo: politica }),
      );
      abrirBoard(tabId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabId, d, cerrar, guardar, enviando, mostrarWidgets, abrirBoard],
  );

  return {
    abierta,
    enviando,
    recienCreada,
    corrigiendo,
    /** Abrir la ficha vacía, para escribir una regla.
     *
     *  No toma parámetros y `abrirCon` no se exporta, a propósito: colgada
     *  directo de un `onClick`, una función que acepta una política recibe el
     *  evento del clic y trata de leerle el nombre. La firma es lo que lo hace
     *  imposible. Es la misma precaución que toma el alta de cuentas DOC. */
    abrir: () => abrirCon(null),
    /** Abrir la ficha sobre una política que ya existe, para corregirla. Es la
     *  misma ficha: quien la llama —el menú de una fila— no tiene por qué saber
     *  que es el mismo formulario. */
    editar: (politica: Politica) => abrirCon(politica),
    /* Para la pantalla que no tiene board —una copia sin `tabId`—: sin lugar
       donde poner la ficha, el botón no promete algo que no va a pasar. */
    disponible: tabId !== undefined,
  };
}
