import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  Contact,
  History,
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
import { Badge, type BadgeColor } from "@/components/ui/badge";
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
import type { IconComponent } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";

/* La pantalla de usuarios: un header con la búsqueda y el `FilterMenu`, y la
   tabla debajo. Los tres filtran lo mismo —la búsqueda por nombre, el panel
   por atributo— y la tabla se recalcula con lo que quede. */

/* Hoy es un valor fijo y no `new Date()`: las fechas de estas filas son de
   mentira, y con un hoy que se mueve solo la fila de "hace 2 horas" pasa a
   decir "hace tres meses" sin que nadie toque nada. Cuando los usuarios salgan
   de una API, esto se va con ellos. */
const HOY = new Date("2026-08-28T12:00:00Z");

const DIA = 24 * 60 * 60 * 1000;

/* Un punto de color como ícono de un valor: `FilterOption.icon` es un
   componente y no un color justamente para esto — el atributo decide con qué
   se distingue cada valor. */
const punto =
  (color: string): IconComponent =>
  ({ size = 16, className }) => (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
    </span>
  );

/** Los estados de comunicación, en un solo lugar: la etiqueta que ve el que
 *  lee la tabla, el color con el que se lo distingue en el panel de filtros y
 *  el color del badge. Tres vistas de un mismo dato, y por eso no viven en
 *  tres constantes distintas que se contradicen. */
const ESTADOS = {
  active: { label: "Active", tinte: "#22c55e", color: "green" },
  deactivated: { label: "Deactivated", tinte: "#a3a3a3", color: "gray" },
  blocked: { label: "Blocked", tinte: "#f43f5e", color: "rose" },
} as const satisfies Record<string, { label: string; tinte: string; color: BadgeColor }>;

type Estado = keyof typeof ESTADOS;

/* Las iniciales para el `AvatarFallback`: primera del nombre, primera del
   apellido. Sin foto no hay nada más que mostrar, y dos letras es lo que
   entra en un círculo de 24px. */
function iniciales(nombre: string) {
  const partes = nombre.split(" ").filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

interface Usuario {
  /** El id que se ve: va debajo del nombre, así que es el de la cuenta y no un
   *  número de fila. También es por donde busca la barra de arriba: si está a
   *  la vista, alguien lo va a pegar ahí. */
  id: string;
  name: string;
  status: Estado;
  /** Cuándo se lo vio por última vez, con hora: la columna dice "3 h ago". */
  lastActivity: string;
  /** Cuándo entró. Sin hora: nadie pregunta a qué hora se dio de alta. */
  addedAt: string;
}

const USUARIOS: Usuario[] = [
  { id: "USR-1042", name: "Camila Ferreyra", status: "active", lastActivity: "2026-08-28T09:10:00Z", addedAt: "2026-03-04" },
  { id: "USR-1088", name: "Bruno Salas", status: "active", lastActivity: "2026-08-28T07:45:00Z", addedAt: "2026-05-19" },
  { id: "USR-1153", name: "Lucía Otero", status: "active", lastActivity: "2026-08-27T16:20:00Z", addedAt: "2025-11-02" },
  { id: "USR-1207", name: "Martín Quiroga", status: "deactivated", lastActivity: "2026-08-24T11:00:00Z", addedAt: "2026-08-12" },
  { id: "USR-1264", name: "Sofía Bermúdez", status: "active", lastActivity: "2026-08-26T18:05:00Z", addedAt: "2026-01-28" },
  { id: "USR-1319", name: "Iván Palacios", status: "blocked", lastActivity: "2026-07-30T09:00:00Z", addedAt: "2025-09-15" },
  { id: "USR-1372", name: "Renata Bianchi", status: "active", lastActivity: "2026-08-28T11:30:00Z", addedAt: "2026-06-30" },
  { id: "USR-1428", name: "Diego Miralles", status: "active", lastActivity: "2026-08-25T14:10:00Z", addedAt: "2026-04-08" },
  { id: "USR-1490", name: "Paula Genovese", status: "deactivated", lastActivity: "2026-08-14T10:00:00Z", addedAt: "2026-02-11" },
  { id: "USR-1533", name: "Andrés Lupo", status: "active", lastActivity: "2026-08-27T20:40:00Z", addedAt: "2026-08-20" },
  { id: "USR-1586", name: "Valentina Roldán", status: "deactivated", lastActivity: "2026-06-02T08:30:00Z", addedAt: "2025-07-21" },
  { id: "USR-1641", name: "Tomás Iriarte", status: "active", lastActivity: "2026-08-23T09:15:00Z", addedAt: "2026-08-01" },
  { id: "USR-1705", name: "Milena Costas", status: "active", lastActivity: "2026-08-28T06:05:00Z", addedAt: "2026-07-14" },
  { id: "USR-1768", name: "Facundo Arrieta", status: "deactivated", lastActivity: "2026-08-18T17:50:00Z", addedAt: "2026-03-27" },
  { id: "USR-1822", name: "Julieta Ponce", status: "blocked", lastActivity: "2026-08-09T12:00:00Z", addedAt: "2025-12-09" },
  { id: "USR-1899", name: "Nahuel Vidal", status: "active", lastActivity: "2026-08-26T09:35:00Z", addedAt: "2026-08-26" },
  { id: "USR-1955", name: "Agustín Ferrari", status: "active", lastActivity: "2026-08-28T05:20:00Z", addedAt: "2026-08-24" },
  { id: "USR-2018", name: "Delfina Sosa", status: "active", lastActivity: "2026-08-28T02:10:00Z", addedAt: "2026-08-18" },
  { id: "USR-2074", name: "Emilia Navarro", status: "active", lastActivity: "2026-08-27T22:45:00Z", addedAt: "2026-08-05" },
  { id: "USR-2131", name: "Joaquín Peralta", status: "deactivated", lastActivity: "2026-08-27T13:05:00Z", addedAt: "2026-07-29" },
  { id: "USR-2196", name: "Micaela Duarte", status: "active", lastActivity: "2026-08-26T21:30:00Z", addedAt: "2026-07-19" },
  { id: "USR-2240", name: "Santiago Aguirre", status: "blocked", lastActivity: "2026-08-26T08:15:00Z", addedAt: "2026-07-02" },
  { id: "USR-2307", name: "Carla Benítez", status: "active", lastActivity: "2026-08-25T19:40:00Z", addedAt: "2026-06-21" },
  { id: "USR-2365", name: "Federico Ocampo", status: "active", lastActivity: "2026-08-25T07:55:00Z", addedAt: "2026-06-09" },
  { id: "USR-2418", name: "Rocío Maldonado", status: "active", lastActivity: "2026-08-24T16:25:00Z", addedAt: "2026-05-27" },
  { id: "USR-2473", name: "Lautaro Vega", status: "deactivated", lastActivity: "2026-08-23T18:35:00Z", addedAt: "2026-05-14" },
  { id: "USR-2529", name: "Antonella Ríos", status: "active", lastActivity: "2026-08-22T09:50:00Z", addedAt: "2026-04-30" },
  { id: "USR-2588", name: "Gonzalo Cabrera", status: "deactivated", lastActivity: "2026-08-21T14:05:00Z", addedAt: "2026-04-16" },
  { id: "USR-2641", name: "Belén Ibarra", status: "active", lastActivity: "2026-08-20T11:20:00Z", addedAt: "2026-04-02" },
  { id: "USR-2705", name: "Mateo Sandoval", status: "active", lastActivity: "2026-08-19T15:45:00Z", addedAt: "2026-03-19" },
  { id: "USR-2764", name: "Florencia Acuña", status: "active", lastActivity: "2026-08-17T08:30:00Z", addedAt: "2026-03-05" },
  { id: "USR-2812", name: "Ezequiel Moyano", status: "deactivated", lastActivity: "2026-08-15T12:10:00Z", addedAt: "2026-02-20" },
  { id: "USR-2879", name: "Guadalupe Cáceres", status: "active", lastActivity: "2026-08-13T17:00:00Z", addedAt: "2026-02-06" },
  { id: "USR-2933", name: "Rodrigo Ledesma", status: "blocked", lastActivity: "2026-08-11T10:40:00Z", addedAt: "2026-01-22" },
  { id: "USR-2990", name: "Malena Ferreyra", status: "active", lastActivity: "2026-08-08T13:25:00Z", addedAt: "2026-01-08" },
  { id: "USR-3046", name: "Nicolás Bustos", status: "active", lastActivity: "2026-08-05T09:05:00Z", addedAt: "2025-12-27" },
  { id: "USR-3108", name: "Ariana Godoy", status: "active", lastActivity: "2026-08-02T16:50:00Z", addedAt: "2025-12-15" },
  { id: "USR-3167", name: "Franco Villalba", status: "deactivated", lastActivity: "2026-07-28T11:15:00Z", addedAt: "2025-11-28" },
  { id: "USR-3221", name: "Pilar Escobar", status: "active", lastActivity: "2026-07-22T14:35:00Z", addedAt: "2025-11-14" },
  { id: "USR-3284", name: "Bautista Ramos", status: "deactivated", lastActivity: "2026-07-15T08:45:00Z", addedAt: "2025-10-30" },
  { id: "USR-3340", name: "Sol Medina", status: "active", lastActivity: "2026-07-06T19:20:00Z", addedAt: "2025-10-16" },
  { id: "USR-3399", name: "Ignacio Farías", status: "active", lastActivity: "2026-06-27T10:10:00Z", addedAt: "2025-10-01" },
  { id: "USR-3452", name: "Abril Rivero", status: "active", lastActivity: "2026-06-18T15:30:00Z", addedAt: "2025-09-18" },
  { id: "USR-3518", name: "Thiago Cortés", status: "deactivated", lastActivity: "2026-06-04T12:55:00Z", addedAt: "2025-09-03" },
  { id: "USR-3575", name: "Catalina Núñez", status: "active", lastActivity: "2026-05-21T09:40:00Z", addedAt: "2025-08-20" },
  { id: "USR-3630", name: "Emanuel Paz", status: "blocked", lastActivity: "2026-05-08T17:15:00Z", addedAt: "2025-08-06" },
  { id: "USR-3694", name: "Zoe Barrios", status: "active", lastActivity: "2026-04-24T11:05:00Z", addedAt: "2025-07-15" },
  { id: "USR-3751", name: "Lucas Herrera", status: "active", lastActivity: "2026-04-09T14:20:00Z", addedAt: "2025-06-24" },
];

/* Las fechas se guardan una sola vez y en ISO. La etiqueta que se ve y el
   tramo con el que filtra el panel salen las dos de ahí, así que no pueden
   contradecirse: no hay manera de que la fila diga "yesterday" y el filtro de
   "Last 7 days" la deje afuera. */

const FECHA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DIA_Y_MES = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

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

const tramoAlta = (iso: string) => {
  const dias = (HOY.getTime() - new Date(`${iso}T12:00:00Z`).getTime()) / DIA;
  if (dias <= 30) return "30d";
  if (dias <= 90) return "90d";
  if (dias <= 365) return "year";
  return "older";
};

const OPCIONES_ESTADO: FilterOption[] = (
  Object.entries(ESTADOS) as [Estado, (typeof ESTADOS)[Estado]][]
).map(([value, e]) => ({
  value,
  label: e.label,
  icon: punto(e.tinte),
  hint: String(USUARIOS.filter((u) => u.status === value).length),
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

const GRUPOS: FilterGroup[] = [
  {
    label: "The user",
    attributes: [
      { id: "name", label: "User name", icon: Contact, type: "text" },
      {
        id: "status",
        label: "Communication status",
        icon: Loader,
        options: OPCIONES_ESTADO,
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

/* La sangría de las columnas de los extremos: es lo que alinea la tabla con el
   header sin meterle un contenedor con padding, que le sacaría los bordes. */
const SANGRIA =
  "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6";

/* Aire propio, arriba del que trae el escalón compacto.
   Las filas: el escalón compacto las deja en 5px de padding, que con una celda
   de dos líneas y un avatar de 32px es una lista apretada. 8px las suelta sin
   sacarlas de la densidad —el texto sigue en el escalón compacto, lo que
   cambia es cuánto respiran.
   Los títulos: 10px los lleva a 36px de alto, que es justo el escalón normal
   de la escalera de tamaños. La cabecera queda en la altura de un control y no
   aplastada contra la primera fila. */
const AIRE_FILA = "[&_td]:py-2";
const AIRE_TITULOS = "[&_th]:py-2.5";

/* La banda de la cabecera. No sale de la escalera de superficies: en el modo
   claro la escalera es plana en blanco de la tercera para arriba, así que un
   escalón no la separaría ni de las filas ni del header de la pestaña, que
   están sobre el mismo plano.

   Es un violeta muy lavado, en el tono del violeta de los badges —hue 292—
   para que sea el mismo púrpura del sistema y no otro traído de afuera. En el
   modo claro va a la altura del `--muted` que reemplaza, apenas 0.022 de croma
   sobre el blanco; en el oscuro sube un poco por encima del plano, porque una
   banda más oscura que lo que la rodea se lee como un hueco y no como una
   cabecera.

   Translúcida y con desenfoque detrás: es lo que la vuelve una banda apoyada
   sobre la lista y no un bloque pintado al lado. Para que el desenfoque tenga
   algo que desenfocar, la cabecera va por encima del scroller y no antes —ver
   `Pantalla`—, y las filas le pasan por debajo.

   Va acá y no como token en `index.css` a propósito: ese archivo es copia byte
   a byte del showcase y una variable de más lo desalinea. Si el violeta le
   sirve a otra pantalla, el lugar es el registry. */
const BANDA_TITULOS = [
  "bg-[oklch(0.966_0.022_292)]/70",
  "dark:bg-[oklch(0.34_0.03_292)]/70",
  "backdrop-blur-md",
].join(" ");

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
  const escala = useTypeScale();
  const shape = useShape();
  /* Lo que mide la cabecera, para que el scroller reserve ese alto arriba: la
     cabecera flota encima, así que sin la reserva las primeras filas nacerían
     tapadas. Medido y no una constante, porque el alto sale del escalón de
     tamaños y cambia con él. */
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const encontrados = useMemo(
    () => USUARIOS.filter((u) => pasa(u, busqueda, filtros)),
    [busqueda, filtros],
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
        {/* De qué es esta pantalla. El título repite la etiqueta de la fila del
            sidebar a propósito: la pestaña la nombra de paso, arriba de todo y
            entre otras; acá es el encabezado de lo que estás mirando. Los dos
            tamaños salen de la escala de tipos —`title` y `caption`—, así que
            siguen el escalón de la región como todo lo demás. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: escala.title }}
          >
            Accounts
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Everyone with an account, and the state of their communication.
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
          <div
            ref={medirCabecera}
            className="absolute inset-x-0 top-0 z-10"
          >
            <Table
              className={cn("table-fixed", BANDA_TITULOS, SANGRIA, AIRE_TITULOS)}
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
                          <span className="truncate">{usuario.name}</span>
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
                    <TableCell>
                      {FECHA.format(new Date(`${usuario.addedAt}T12:00:00Z`))}
                    </TableCell>
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
