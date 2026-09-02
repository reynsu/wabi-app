import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Ban,
  CalendarPlus,
  CircleCheck,
  Contact,
  History,
  IdCard,
  KeyRound,
  Loader,
  Search,
  SearchX,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { punto } from "@/components/color-dot";
import { Datos } from "@/components/data-rows";
import { PeekCard } from "@/components/peek-card";
import { useWorkspace } from "@/stores/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShape } from "@/lib/shape-context";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { tabDePerfil } from "@/pages/perfil-tab";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import {
  DIA,
  ESTADOS,
  HOY,
  TIPOS,
  UBICACION_POR_DEFECTO,
  cambiarEstado,
  iniciales,
  useUsuarios,
  type Estado,
  type Tipo,
  type Usuario,
} from "@/pages/usuarios";
import { conversacionesDe } from "@/pages/conversaciones";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de usuarios: un header con la búsqueda y el `FilterMenu`, y la
   tabla debajo. Los tres filtran lo mismo —la búsqueda por nombre, el panel
   por atributo— y la tabla se recalcula con lo que quede. */

/* Una métrica: la etiqueta chica arriba, el número grande, y la lectura debajo
   —qué es ese número, no cómo se llama—. Los tres tamaños salen de la escala de
   tipos, así que la tarjeta sigue el escalón de la región como el resto. */
function Metrica({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: string;
}) {
  const escala = useTypeScale();

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className="truncate text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        {etiqueta}
      </span>
      <span
        className="font-medium tabular-nums"
        style={{ fontSize: escala.title }}
      >
        {valor}
      </span>
      {nota && (
        <span
          className="text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {nota}
        </span>
      )}
    </div>
  );
}

/* Cómo se mueve la cuenta. Se exporta porque la miran dos: la pestaña
   Analytics de la tarjeta —el vistazo desde la tabla— y el widget que el perfil
   pone en el board. Es el mismo hecho, así que es el mismo componente: dos
   copias de estas cinco métricas son dos que un día dicen cosas distintas. */
export function Analiticas({
  usuario,
  /** Sólo los cuatro números, sin las lecturas de abajo y sin la comparación.
   *
   *  Es la versión de vistazo, la del board: ahí la baldosa mide lo que mide y
   *  el contenido entero no entra —se corta justo la fila que compara, que es
   *  la que más falta hace—. Antes que dejar algo cortado, se muestra menos:
   *  quien quiera el detalle abre la baldosa, y ahí está entero. Es lo mismo
   *  que hace la historia de un ticket con su `completa`. */
  resumida,
}: {
  usuario: Usuario;
  resumida?: boolean;
}) {
  const escala = useTypeScale();
  const cambio = variacion(usuario.last30, usuario.prev30);
  /* Las lecturas se van con la comparación: son del mismo párrafo. Cuatro
     números con su etiqueta se entienden solos; lo que explican las notas es
     con qué se los está midiendo, y eso es lectura de detalle. */
  const nota = (texto: string) => (resumida ? undefined : texto);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {/* Las conversaciones se cuentan sobre la lista que existe —la misma que
          abre el perfil— y no sobre un número guardado al lado: dos fuentes
          para el mismo hecho terminan diciendo cosas distintas. */}
      <Metrica
        etiqueta="Conversations"
        valor={conversacionesDe(usuario).length}
        nota={nota("all time")}
      />
      <Metrica
        etiqueta="Messages"
        valor={usuario.messages.toLocaleString("en-US")}
        nota={nota("all time")}
      />
      <Metrica
        etiqueta="Reply rate"
        valor={`${Math.round(usuario.replyRate * 100)}%`}
        nota={nota("of messages get an answer")}
      />
      <Metrica
        etiqueta="Avg. response"
        valor={duracion(usuario.avgResponseMin)}
        nota={nota("average across replies")}
      />

      {/* La única fila que compara: el resto son totales. Va entera y abajo
          porque el número solo no dice nada sin contra qué. El signo va en un
          badge, que es donde este sistema gasta el color. */}
      {!resumida && (
        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className="text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              Last 30 days
            </span>
            <span className="tabular-nums" style={{ fontSize: escala.body }}>
              {usuario.last30.toLocaleString("en-US")} messages
            </span>
          </span>
          {cambio !== null && (
            <Badge size="compact" color={cambio < 0 ? "rose" : "green"}>
              {cambio > 0 ? "+" : ""}
              {cambio}%
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/* El vistazo a un usuario, con lo que la fila muestre de él como disparador. Se
   abre con el hover porque no es un destino: es mirar sin irse de la lista.

   Muestra quién es la cuenta y nada más. Tenía tres pestañas —quién es, cómo se
   mueve, y cuándo pasaron sus cosas— y las otras dos se fueron: una tarjeta que
   se abre al pasar el puntero por encima se lee de un vistazo o no se lee, y
   pedir un clic adentro de algo que se cierra cuando el puntero se va es pedir
   dos gestos por un dato.

   Lo que se llevaron es distinto en cada caso. Las analíticas siguen enteras en
   el board de la cuenta —la fila Analytics del perfil, `Analiticas`—, que es
   donde hay lugar y donde nada se cierra solo. La historia no: eran los dos
   mismos hechos que la tabla ya tiene en columna —Last Activity y Date Added—,
   escritos con la fecha entera y un "hace tanto" al lado. Lo que se pierde es
   esa precisión, no el dato; el día que haga falta, el lugar es el perfil y no
   una pestaña adentro de un hover.

   Con una sola pestaña el `PeekCard` no dibuja riel —un control segmentado con
   una opción no ofrece nada—, así que lo que queda es la tarjeta con sus cuatro
   hechos. El pie lleva las dos acciones, que son las mismas del menú del perfil:
   acá se las tiene a mano sin irse de la lista, y allá son las de la pantalla de
   la cuenta.

   Se exporta porque la abren dos tablas: acá desde el nombre, y en Email Search
   desde la dirección del autor. Es la misma cuenta y por lo tanto la misma
   tarjeta —dos copias serían dos fichas de lo mismo que un día dicen cosas
   distintas—; lo único que cambia es qué texto la dispara, que es `children`. */
export function TarjetaUsuario({
  usuario,
  onEstado,
  onPerfil,
  children,
}: {
  usuario: Usuario;
  onEstado: (id: string, status: Estado) => void;
  onPerfil: (usuario: Usuario) => void;
  /** El disparador. Sin esto, el nombre de la cuenta: es lo que muestra la
   *  tabla que la abría primero. */
  children?: ReactNode;
}) {
  const estado = ESTADOS[usuario.status];
  const bloqueado = usuario.status === "blocked";
  const shape = useShape();
  const escala = useTypeScale();
  /* La apertura se controla desde acá para poder cerrarla en el clic. Con
     `openOn="hover"` el clic también abre —es lo único que le queda a un
     táctil—, y sin esto la tarjeta se quedaba flotando sobre la pestaña recién
     abierta: el popup va portalado al body, así que esconder el panel de
     Accounts no lo esconde a él.

     Cerrarla dentro del `onClick` no alcanza: el handler de Base UI corre en
     el mismo evento y pide abrir, y el último que escribe gana. El cierre va
     en un `setTimeout(0)`, que corre cuando el evento ya terminó y los dos
     pedidos ya se escribieron. Con el puntero quieto Base UI no vuelve a
     abrirla: su hover ya disparó. */
  const [abierta, setAbierta] = useState(false);

  return (
    <PeekCard
      openOn="hover"
      open={abierta}
      onOpenChange={setAbierta}
      side="right"
      title={usuario.name}
      /* El mismo avatar de la fila y no un glifo genérico: la tarjeta se abre
         desde ahí, y repetir la cara es lo que la ata a la fila que la disparó.
         Un escalón más chico que en la tabla, para no pesar más que el nombre
         que tiene al lado. */
      media={
        <Avatar
          size="sm"
          className={cn("shrink-0", shape.item, "after:rounded-[inherit]")}
        >
          <AvatarFallback
            className="rounded-[inherit]"
            style={{ fontSize: escala.caption }}
          >
            {iniciales(usuario.name)}
          </AvatarFallback>
        </Avatar>
      }
      /* Las acciones van al pie y no al header: ahí entra un botón corto, y
         acá son dos. Bloquear y desbloquear son la misma fila —una cuenta está
         de un lado o del otro, nunca de los dos—, así que el botón cambia de
         etiqueta y de ícono en vez de aparecer al lado de su contrario. */
      footer={
        <>
          <Button variant="secondary" leadingIcon={KeyRound} className="flex-1">
            Reset Password
          </Button>
          <Button
            variant="secondary"
            leadingIcon={bloqueado ? CircleCheck : Ban}
            className="flex-1"
            onClick={() =>
              onEstado(usuario.id, bloqueado ? "active" : "blocked")
            }
          >
            {bloqueado ? "Unblock" : "Block"}
          </Button>
        </>
      }
      /* Una sola, así que sin `icon`: el glifo de una pestaña sólo se ve en el
         riel, y sin riel sería un dato que nadie pinta. */
      tabs={[
        {
          label: "Details",
          content: (
            <Datos
              filas={[
                { k: "Account type", v: TIPOS[usuario.accountType] },
                /* La ubicación es de los residentes y de nadie más: a alguien
                   de afuera no se lo ubica adentro, y una fila que dijera
                   "Facility Base" para un familiar sería falsa. */
                ...(usuario.accountType === "resident"
                  ? [
                      {
                        k: "Location",
                        v: usuario.location ?? UBICACION_POR_DEFECTO,
                      },
                    ]
                  : []),
                { k: "Account ID", v: usuario.id },
                {
                  k: "Communication",
                  v: (
                    <Badge variant="dot" color={estado.color}>
                      {estado.label}
                    </Badge>
                  ),
                },
              ]}
            />
          ),
        },
      ]}
    >
      <span
        className="w-fit max-w-full cursor-pointer truncate decoration-dotted decoration-muted-foreground underline-offset-2 hover:underline aria-expanded:underline"
        onClick={() => {
          onPerfil(usuario);
          setTimeout(() => setAbierta(false), 0);
        }}
      >
        {children ?? usuario.name}
      </span>
    </PeekCard>
  );
}

/* Las fechas se guardan una sola vez y en ISO. La etiqueta que se ve y el
   tramo con el que filtra el panel salen las dos de ahí, así que no pueden
   contradecirse: no hay manera de que la fila diga "yesterday" y el filtro de
   "Last 7 days" la deje afuera. */

const DIA_Y_MES = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/* Minutos a algo que se lea de un vistazo: "40m", "2h 40m", "1d 3h". Nadie
   compara tiempos de respuesta en minutos cuando pasan de una hora. */
function duracion(minutos: number) {
  if (minutos < 60) return `${minutos}m`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto ? `${horas}h ${resto}m` : `${horas}h`;
  const dias = Math.floor(horas / 24);
  const sobran = horas % 24;
  return sobran ? `${dias}d ${sobran}h` : `${dias}d`;
}

/** La variación de los últimos 30 días contra los 30 anteriores, en porcentaje.
 *  `null` cuando no hay contra qué comparar: sin base, un "+100%" es ruido. */
function variacion(last30: number, prev30: number) {
  if (prev30 === 0) return null;
  return Math.round(((last30 - prev30) / prev30) * 100);
}

function cuandoFue(iso: string) {
  const pasado = HOY.getTime() - new Date(iso).getTime();
  const horas = Math.floor(pasado / (60 * 60 * 1000));
  if (horas < 1) return "Just now";
  if (horas < 24) return `${horas} h ago`;
  const dias = Math.floor(pasado / DIA);
  if (dias === 1) return "Yesterday";
  if (dias < 7) return `${dias} d ago`;
  return DIA_Y_MES.format(new Date(iso));
}

const tramoActividad = (iso: string) => {
  const dias = (HOY.getTime() - new Date(iso).getTime()) / DIA;
  if (dias < 1) return "today";
  if (dias < 7) return "week";
  if (dias < 30) return "month";
  return "older";
};

/* Los conteos del panel salen de la lista viva y no de la constante: bloquear
   a alguien mueve dos números, y un panel que sigue diciendo los de antes
   miente sobre lo que va a devolver. */
const opcionesEstado = (usuarios: Usuario[]): FilterOption[] =>
  (Object.entries(ESTADOS) as [Estado, (typeof ESTADOS)[Estado]][]).map(
    ([value, e]) => ({
      value,
      label: e.label,
      icon: punto(e.tinte),
      hint: String(usuarios.filter((u) => u.status === value).length),
    }),
  );

/* Los tipos también cuentan sobre la lista viva. Hoy nada cambia de tipo, así
   que estos dos números no se mueven; que salgan de la misma fuente que los
   del estado es lo que evita que un día uno cuente el fixture y el otro la
   lista, y el panel diga dos totales distintos. */
const opcionesTipo = (usuarios: Usuario[]): FilterOption[] =>
  (Object.entries(TIPOS) as [Tipo, string][]).map(([value, label]) => ({
    value,
    label,
    hint: String(usuarios.filter((u) => u.accountType === value).length),
  }));

const OPCIONES_ACTIVIDAD: FilterOption[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "older", label: "Older" },
];

const OPCIONES_ALTA: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (usuarios: Usuario[]): FilterGroup[] => [
  {
    label: "The user",
    attributes: [
      { id: "name", label: "User name", icon: Contact, type: "text" },
      /* Sin `single`: marcar los dos tipos es no filtrar por tipo, que es
         exactamente lo que uno espera al destildar. Igual que el estado. */
      {
        id: "type",
        label: "Account type",
        icon: IdCard,
        options: opcionesTipo(usuarios),
      },
      {
        id: "status",
        label: "Communication status",
        icon: Loader,
        options: opcionesEstado(usuarios),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      // `single`: un tramo de tiempo no se acumula con otro — "hoy o esta
      // semana" es "esta semana. Elegir uno reemplaza al anterior.
      {
        id: "activity",
        label: "Last activity",
        icon: History,
        options: OPCIONES_ACTIVIDAD,
        single: true,
      },
      {
        id: "added",
        label: "Date added",
        icon: CalendarPlus,
        options: OPCIONES_ALTA,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada usuario para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O — que es como
 *  cualquiera lee un filtro: "activo **o** esperando respuesta", pero "activo
 *  **y** de esta semana". */
const CAMPOS: Record<string, (u: Usuario) => string[]> = {
  type: (u) => [u.accountType],
  status: (u) => [u.status],
  activity: (u) => [tramoActividad(u.lastActivity)],
  added: (u) => [tramoAlta(u.addedAt)],
};

function pasa(usuario: Usuario, busqueda: string, filtros: FilterSelection) {
  const texto = busqueda.trim().toLowerCase();
  if (
    texto &&
    !usuario.name.toLowerCase().includes(texto) &&
    !usuario.id.toLowerCase().includes(texto)
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    // El atributo de texto del panel no tiene opciones: el valor es lo que se
    // escribió, y se busca adentro del nombre igual que la barra de arriba.
    if (id === "name") {
      return valores.some((v) =>
        usuario.name.toLowerCase().includes(v.toLowerCase()),
      );
    }
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(usuario);
    return valores.some((v) => tiene.includes(v));
  });
}

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas. */
const COLUMNAS = [
  { id: "name", ancho: "40%" },
  { id: "status", ancho: "20%" },
  { id: "activity", ancho: "20%" },
  { id: "added", ancho: "20%" },
];

function Columnas() {
  return (
    <colgroup>
      {COLUMNAS.map((c) => (
        <col key={c.id} style={{ width: c.ancho }} />
      ))}
    </colgroup>
  );
}

/** Cuántas filas se agregan cada vez que el final entra en pantalla. */
const PASO = 12;

/* La caja que scrollea, buscada subiendo desde el centinela. Se la busca en
   vez de nombrar al panel de la pestaña: esta pantalla no tiene por qué saber
   quién la está conteniendo, y así funciona igual el día que la metan en un
   diálogo o en el riel del costado. */
function scrollerDe(el: HTMLElement | null) {
  for (let padre = el?.parentElement; padre; padre = padre.parentElement) {
    const desborde = getComputedStyle(padre).overflowY;
    if (desborde === "auto" || desborde === "scroll") return padre;
  }
  return null;
}

export function Users() {
  return (
    /* Una región densa entera, declarada una vez: el buscador, el panel de
       filtros y la tabla leen el escalón de acá y no lo reciben cada uno por
       su cuenta. Es lo que dice el sistema de tamaños —envolver la región, no
       repetir `size="compact"` en cada pieza—, y de paso pasar la pantalla a
       la densidad normal es cambiar esta palabra. */
    <SizeProvider size="compact">
      <Pantalla />
    </SizeProvider>
  );
}

function Pantalla() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  /* La lista viva, de la tienda del módulo y no de un `useState` de acá: el
     perfil que abre esta pantalla es una pestaña hermana y no un hijo, así que
     un estado local no le llegaría —ver `usuarios.ts`—. */
  const usuarios = useUsuarios();
  const escala = useTypeScale();
  const shape = useShape();
  /* Lo que mide la cabecera, para que el scroller reserve ese alto arriba: la
     cabecera flota encima, así que sin la reserva las primeras filas nacerían
     tapadas. Medido y no una constante, porque el alto sale del escalón de
     tamaños y cambia con él. */
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const encontrados = useMemo(
    () => usuarios.filter((u) => pasa(u, busqueda, filtros)),
    [usuarios, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(usuarios), [usuarios]);

  const openTab = useWorkspace((w) => w.openTab);

  const abrirPerfil = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* La ventana lleva puesta la clave de lo que estaba filtrado cuando creció.
     Cambiar el filtro la vuelve a `PASO` sin pasar por un efecto: el ajuste se
     hace al derivar, en el mismo render, y no después de pintar cuarenta filas
     que ya no corresponden. Es el mismo patrón que usa `Pagination` para
     saber desde qué dígito rueda. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const [ventana, setVentana] = useState({ clave, cuantas: PASO });
  const cuantas = ventana.clave === clave ? ventana.cuantas : PASO;
  if (ventana.clave !== clave) setVentana({ clave, cuantas: PASO });

  const filas = encontrados.slice(0, cuantas);
  const quedan = cuantas < encontrados.length;

  /* Scroll infinito: un centinela al final de la lista y un observer que pide
     el próximo tramo cuando se acerca. */
  const centinela = useRef<HTMLDivElement>(null);

  /* Cambiar lo filtrado vuelve arriba. Sin esto, filtrar desde el fondo de la
     lista deja la vista a la altura de la fila 40 de un resultado que recién
     empieza, y el centinela —que sigue ahí abajo— pide tramo tras tramo hasta
     alcanzarla: con una API detrás, media tabla traída para nada. */
  useEffect(() => {
    scrollerDe(centinela.current)?.scrollTo({ top: 0 });
  }, [clave]);

  useEffect(() => {
    const el = centinela.current;
    if (!el || !quedan) return;

    /* La raíz es la caja que scrollea y no el viewport: contra el viewport el
       `rootMargin` no sirve de nada, porque un ancestro que recorta deja al
       centinela fuera de la intersección aunque caiga adentro del margen, y el
       tramo llegaba recién al tocar fondo. */
    const scroller = scrollerDe(el);

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        /* Una pestaña que no estás mirando sigue montada y escondida con
           `visibility`, y un IntersectionObserver no mira la visibilidad: sin
           esto, una copia de esta pantalla en segundo plano se traería la
           tabla entera sin que nadie scrollee. Con una API detrás serían
           páginas pedidas de gusto. */
        if (getComputedStyle(el).visibility === "hidden") return;
        setVentana((v) =>
          v.clave === clave ? { ...v, cuantas: v.cuantas + PASO } : v,
        );
      },
      // Pide el tramo antes de llegar al final, así la lista no se corta.
      { root: scroller, rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    /* `cuantas` va en las dependencias aunque el efecto no lo lea: un
       IntersectionObserver avisa cuando la intersección *cambia*, y después de
       agregar un tramo el centinela sigue visible, así que no vuelve a avisar
       nunca. Rearmando el observer se lo pregunta de nuevo, y la lista se
       sigue llenando hasta tapar la pantalla —que es donde el centinela por
       fin sale de cuadro y esto se queda quieto esperando que scrollees. */
  }, [clave, quedan, cuantas]);

  return (
    /* La pantalla mide lo que mide la pestaña y no scrollea: el header se
       queda quieto y lo único que se mueve es el cuerpo de la tabla. Sin
       `max-w` ni `mx-auto` — el que decide cuánto aire hay a los costados es
       el panel, y una tabla centrada adentro de un panel que ya está centrado
       deja dos márgenes peleando. */
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* El aire lateral es del header, no de la pantalla: así la tabla llega
          a los dos bordes y son sus celdas las que se alinean con él. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-6 py-4">
        {/* De qué es esta pantalla. El título no repite la etiqueta de la fila
            del sidebar: la fila nombra el lugar —Accounts— y acá se dice qué
            se hace ahí. Los dos tamaños salen de la escala de tipos —`title` y
            `caption`—, así que siguen el escalón de la región como todo lo
            demás. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: escala.title }}
          >
            Accounts Search
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Search across every account, and see where each one&rsquo;s
            communication stands.
          </p>
        </div>

        {/* Los controles, juntos contra el borde derecho. */}
        <div className="flex items-center gap-2">
          {/* El campo se muestra siempre con la caja puesta. `InputField` la deja
              invisible en reposo —es un campo de toolbar, y el marco aparece al
              tocarlo— y acá queremos lo contrario: que se vea que hay dónde
              escribir sin tener que buscarlo. El selector va al contenedor que
              tiene el input adentro, no a un `:last-child` que se rompe el día
              que el campo muestre un error. */}
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search users"
              labelHidden
              icon={Search}
              placeholder="Search users"
              value={busqueda}
              onChange={setBusqueda}
              className="[&>div:has(>input)]:bg-card [&>div:has(>input)]:ring-border"
            />
          </InputGroup>

          <FilterMenu
            groups={GRUPOS}
            align="end"
            variant="secondary"
            value={filtros}
            onValueChange={setFiltros}
          />
        </div>
      </header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <SearchX />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No users</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              Nothing matches what you&rsquo;re looking for. Try fewer letters,
              or drop a filter.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      ) : (
        <div className="relative min-h-0 flex-1">
          {/* Los títulos van afuera del scroller y flotando encima. Adentro no
              pueden: `scroll-fade` desvanece el borde de arriba en cuanto hay
              filas por encima, y una cabecera pegada cae justo ahí — quedaría
              fantasma cada vez que scrolleás. Acá se queda entera, y encima es
              lo que le da sentido al desenfoque: las filas le pasan por
              debajo. Las dos tablas se alinean porque comparten `Columnas` y
              van las dos en `table-fixed`. */}
          <div ref={medirCabecera} className="absolute inset-x-0 top-0 z-10">
            <Table
              className={cn(
                "table-fixed",
                BANDA_TITULOS,
                SANGRIA,
                AIRE_TITULOS,
              )}
            >
              <Columnas />
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Communication Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Date Added</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* La única caja que scrollea de toda la pantalla, con el scrollbar
              del sistema —`ScrollArea` sobre Base UI, que en un táctil se
              corre sola y deja el overflow nativo— y con `scroll-fade` en el
              viewport: la lista se disuelve contra el borde que todavía tiene
              contenido, y se queda nítida en el principio y en el final de
              verdad. Sin marco: ni radio, ni sombra, ni escalón propio; la
              tabla llega a los dos bordes del panel. */}
          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            {/* La reserva para la cabecera que flota encima. */}
            <div style={{ paddingTop: altoCabecera ?? 0 }} />
            <Table className={cn("table-fixed", SANGRIA, AIRE_FILA)}>
              <Columnas />
              <TableBody>
                {filas.map((usuario, i) => (
                  <TableRow key={usuario.id} index={i}>
                    <TableCell className="text-foreground">
                      <div className="flex items-center gap-2.5">
                        {/* El escalón normal del avatar —32px— y no el chico:
                            es lo que mide la celda de dos líneas que tiene al
                            lado. El radio sale del sistema de figuras en vez de
                            ser redondo: `after` y el fallback lo heredan, así
                            que el aro y el plato siguen la misma esquina. */}
                        <Avatar
                          className={cn(shape.item, "after:rounded-[inherit]")}
                        >
                          {/* Las iniciales bajan al escalón del texto de la
                              fila. El `text-sm` que trae el componente para
                              este tamaño de plato pesa más que el nombre que
                              tiene al lado, y las iniciales terminan leyéndose
                              como una insignia en vez de como parte de la
                              fila. */}
                          <AvatarFallback
                            className="rounded-[inherit]"
                            style={{ fontSize: escala.body }}
                          >
                            {iniciales(usuario.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col leading-tight">
                          {/* El nombre hace las dos cosas: el hover lo mira,
                              el clic lo abre. El subrayado aparece con el
                              hover y se queda mientras la tarjeta está abierta
                              —de ahí el `aria-expanded`, que es lo que el
                              disparador de Base UI marca—. En reposo es texto:
                              una lista de 48 filas subrayadas es una lista de
                              48 enlaces que no lo son. */}
                          <TarjetaUsuario
                            usuario={usuario}
                            onEstado={cambiarEstado}
                            onPerfil={abrirPerfil}
                          />
                          <span
                            className="truncate text-muted-foreground"
                            style={{ fontSize: escala.caption }}
                          >
                            {usuario.id}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="dot"
                        color={ESTADOS[usuario.status].color}
                      >
                        {ESTADOS[usuario.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{cuandoFue(usuario.lastActivity)}</TableCell>
                    <TableCell>{fechaDia(usuario.addedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* El final de la lista, adentro de la caja que scrollea: es lo
                que el observer mira para pedir el próximo tramo. La tabla no
                se pagina, se sigue. */}
            <div ref={centinela} aria-hidden className="h-px" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
