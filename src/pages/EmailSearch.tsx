import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AtSign,
  CalendarClock,
  Folder,
  Mail,
  MailX,
  Paperclip,
  Scale,
  Search,
  ShieldCheck,
  Text,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { punto } from "@/components/color-dot";
import { LateralPreview } from "@/components/lateral-preview";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import { usePreview } from "@/stores/preview";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { useWorkspace } from "@/stores/workspace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { usePaginacion } from "@/hooks/use-paginacion";
import { useShape } from "@/lib/shape-context";
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  CARPETAS,
  ENTREGAS,
  ORDEN_CARPETAS,
  ORDEN_ENTREGAS,
  ORDEN_TIPOS,
  TIPOS_EMAIL,
  autorDe,
  entregaDe,
  loEscribioLaCuenta,
  todosLosEmails,
  type Adjunto,
  type Email,
  type EmailConDueno,
} from "@/pages/emails";
import { tabDePerfil } from "@/pages/perfil-tab";
import { diasDesde, fechaLarga, haceCuanto } from "@/pages/tiempo";
import { TarjetaUsuario } from "@/pages/Users";
import {
  cambiarEstado,
  iniciales,
  useUsuarios,
  type Usuario,
} from "@/pages/usuarios";

/* La pantalla de Email Search: los correos de toda la residencia, no los de una
   cuenta.

   Es el mismo mueble que Accounts Search —un header con la búsqueda y el
   `FilterMenu`, y la tabla debajo— porque son dos maneras de buscar en la misma
   consola y cambiar de fila del sidebar no debería cambiar de mueble. Lo que no
   comparte con Accounts es cómo se recorre: allá la lista se sigue, y acá se
   pagina —igual que en Provisioning, con el mismo `usePaginacion`—. Lo que cambia es qué hay adentro, que es lo único
   que tiene por qué cambiar.

   Tres columnas y no seis: quién lo escribió, de qué es, y cuándo salió. El
   asunto se lleva el ancho porque es lo que uno lee para decidir —el resto de
   la fila sólo lo ubica—. Lo que se mira sin irse de la lista es la cuenta, y
   se la mira desde la dirección: es la misma tarjeta que abre el nombre en
   Accounts Search. */

/* ─────────────────────────── El movimiento ───────────────────────────

   Los escalones salen de `lib/springs` y no de duraciones inventadas acá: abrir
   esta pantalla es una **reacción** —alguien tocó una fila del sidebar y esto
   tiene que contestar enseguida—, que es para lo que ese archivo está.

   Acá no hay cascada: las filas no se muestran una detrás de la otra. Una
   cascada cuenta un orden —"esto llegó primero, después esto"— y en una tabla
   de búsqueda ese orden es mentira: los resultados no llegaron en fila india,
   estaban todos ahí. Lo que entra es la tabla, como un plano: se acerca un
   punto y se enciende, y las filas se encienden con ella, todas al mismo
   tiempo.

   El zoom es corto a propósito —de 0.985 a 1, kilómetro y medio de nada—: lo
   que tiene que leerse es que la tabla se apoya, no que se agranda. Un zoom
   grande sobre texto lo deja borroso mientras dura, y esto es una lista para
   leer.

   La animación entera se apaga sola con `prefers-reduced-motion`: `main.tsx`
   monta `MotionConfig reducedMotion="user"`, que le saca a estas variantes lo
   que se mueve y le deja lo que se enciende. */

const cascadaPantalla = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.04 } },
} as const;

/** Un bloque de la pantalla —el header—: se enciende y se acerca. */
const entraBloque = {
  oculto: { opacity: 0, scale: 0.99 },
  visible: { opacity: 1, scale: 1, transition: spring.moderate },
} as const;

/** La tabla: sólo se enciende. Nada de acercarla —una tabla que se agranda
 *  arrastra sus líneas y su banda con ella, y eso es un mueble moviéndose, no
 *  una lista apareciendo—. Lo que se mueve es lo que se lee. */
const entraTabla = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: spring.moderate },
} as const;

/** El texto de una celda: entra desenfocado y se enfoca. Es el gesto de algo
 *  que termina de resolverse —una lista de resultados que se asienta—, y no el
 *  de algo que llega de otro lado.
 *
 *  Todas las celdas lo hacen al mismo tiempo, y a propósito: en una tabla de
 *  búsqueda los resultados no llegaron uno detrás del otro, estaban todos ahí.
 *  Una cascada contaría un orden que no existe.
 *
 *  Va en el texto y no en la fila: la fila es la línea, el borde y el fondo del
 *  hover, y desenfocar un borde de un píxel lo hace desaparecer. Lo que se
 *  enfoca es lo que se lee. */
const entraCelda = {
  oculto: { opacity: 0, filter: "blur(5px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: spring.slow },
} as const;

/** Las marcas del asunto —los adjuntos, el tipo, el rechazo—: llegan con un
 *  zoom más marcado que el de la tabla. Son chicas y son insignias: un badge
 *  que aparece creciendo se lee como algo que se le puso encima a la fila, que
 *  es exactamente lo que es. */
const entraMarca = {
  oculto: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: spring.slow },
} as const;

/* El badge, animado. Se envuelve el componente del registry en vez de escribir
   un `motion.span`: es el que sigue el escalón de tamaños y la figura del
   sistema, y perder eso para ganar una animación sería cambiar una cosa por
   otra.

   La fila no necesita envoltorio: lo que se anima es el contenido de sus
   celdas, y el estado le llega igual —las variantes viajan por el contexto de
   Framer, que la `Table` y el `tbody` del registry dejan pasar sin ser ellos
   mismos componentes de movimiento—.

   El tramo que trae el scroll infinito entra solo: monta adentro de una tabla
   que ya está en `visible`, hereda el `oculto` de la pantalla y se enfoca donde
   aparece. Sin turnos que repartir, no hay nada que esperar ni sincronizar. */
const MarcaAnimada = motion.create(Badge);

/* ─────────────────────────── El vistazo ─────────────────────────── */

/* Los adjuntos, como en la sección Emails del perfil: una tira de chips con el
   nombre y el peso. No son botones —no hay de dónde bajarlos— y un botón que no
   descarga es peor que ninguno. */
function AdjuntosDelCorreo({ adjuntos }: { adjuntos: Adjunto[] }) {
  const escala = useTypeScale();
  const shape = useShape();

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {adjuntos.map((a) => (
        <span
          key={a.nombre}
          className={cn(
            "flex items-center gap-2 border border-border px-2.5 py-1.5",
            shape.item,
          )}
          style={{ fontSize: escala.caption }}
        >
          <Paperclip
            size={12}
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{a.nombre}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {a.tamano}
          </span>
        </span>
      ))}
    </div>
  );
}

/* El correo abierto en el riel.
 *
 * Es el mismo correo que muestra el perfil —la cabecera con quién escribió y
 * cuándo, el cuerpo en párrafos, los adjuntos colgando abajo— y se escribe
 * igual a propósito: un correo leído desde la búsqueda y el mismo correo leído
 * desde la cuenta no son dos cosas. Lo único que cambia es el mueble: allá es
 * media pantalla, acá es la columna del riel, así que el asunto y la fecha
 * suben al header del `LateralPreview` en vez de repetirse adentro.
 *
 * El correo legal no muestra el cuerpo. Sigue apareciendo entero como registro
 * —de quién es, cuándo salió, cuánto pesa lo que trae— porque eso es lo que la
 * consola tiene que poder auditar; lo que no se abre es lo que dice. Y no se
 * muestra vacío ni con un renglón de disculpa: va el mismo `AnimatedEmpty` que
 * usa el resto de la app cuando no hay nada para ver, diciendo por qué. */
function CorreoEnElRiel({
  email,
  usuario,
  onClose,
  onCuenta,
}: {
  email: Email;
  usuario: Usuario;
  onClose: () => void;
  onCuenta: () => void;
}) {
  const escala = useTypeScale();
  const shape = useShape();
  const carpeta = CARPETAS[email.carpeta];
  const propio = loEscribioLaCuenta(email.carpeta);
  /* Quién escribió y quién recibió, derivados de la carpeta y del dueño del
     buzón: el correo guarda una sola dirección —la del contacto— y de qué lado
     salió, y con esas dos alcanza. */
  const remitente = propio ? usuario.name : email.contacto;
  const destinatario = propio ? email.contacto : usuario.name;
  const protegido = email.tipo === "legal";

  return (
    <LateralPreview
      title={email.asunto}
      subtitle={`${carpeta.label} · ${usuario.name}`}
      icon={carpeta.icon}
      onClose={onClose}
      footer={
        <Button
          variant="secondary"
          leadingIcon={Mail}
          className="w-full"
          onClick={onCuenta}
        >
          {/* Dice adónde lleva: no a la cuenta a secas, sino a este mismo
              correo adentro de la cuenta. */}
          Open in account emails
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {/* Quién lo escribió, con la fecha entera y con año: un correo se
            archiva, y "Aug 27" sin año deja de servir en enero. */}
        <div className="flex items-start gap-3">
          <Avatar
            size="sm"
            className={cn("shrink-0", shape.item, "after:rounded-[inherit]")}
          >
            <AvatarFallback
              className="rounded-[inherit]"
              style={{ fontSize: escala.caption }}
            >
              {iniciales(remitente)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className="min-w-0 truncate"
              style={{ fontSize: escala.body }}
            >
              {remitente}
            </span>
            <span
              className="min-w-0 truncate text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              {autorDe(email, usuario)}
            </span>
            <span
              className="min-w-0 truncate text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              to {destinatario} · {fechaLarga(email.cuando)}
            </span>
          </div>
        </div>

        {protegido ? (
          /* El cuerpo protegido. `dashed`: el marco punteado es el que este
             sistema usa para el hueco que espera algo, y acá lo que falta no
             falta por error —falta porque no se muestra—.

             Trae su propia presentación —el plato, el glifo, el título, la
             línea—, que es suya y no de esta pantalla: es el único de acá que
             se anuncia al llegar. */
          <AnimatedEmpty variant="dashed" size="compact">
            <AnimatedEmptyHeader>
              <AnimatedEmptyMedia variant="icon">
                <ShieldCheck />
              </AnimatedEmptyMedia>
              <AnimatedEmptyTitle>Protected email</AnimatedEmptyTitle>
              <AnimatedEmptyDescription>
                This message is legal correspondence. Its contents can&rsquo;t
                be opened from this console.
              </AnimatedEmptyDescription>
            </AnimatedEmptyHeader>
          </AnimatedEmpty>
        ) : (
          <>
            {/* El cuerpo, párrafo por párrafo, con el mismo aire que en el
                perfil: lo que hace legible una columna de texto es el renglón,
                y acá el renglón lo pone el ancho del riel. */}
            <div
              className="flex flex-col gap-3 border-t border-border pt-4 leading-relaxed"
              style={{ fontSize: escala.body }}
            >
              {email.cuerpo.map((parrafo, i) => (
                <p key={i}>{parrafo}</p>
              ))}
            </div>

            {email.adjuntos.length > 0 && (
              <AdjuntosDelCorreo adjuntos={email.adjuntos} />
            )}
          </>
        )}
      </div>
    </LateralPreview>
  );
}

/* ─────────────────────────── Las marcas ─────────────────────────── */

/* Los badges del asunto, en la misma línea y a su derecha. Van los tres en el
   mismo lugar porque los tres dicen algo del correo que el asunto no dice: qué
   trae colgado, de qué es, y si llegó.

   Se pintan sólo cuando dicen algo. Un badge "Standard" en cada fila de una
   tabla de sesenta es ruido con forma de dato: lo normal no lleva insignia, y
   marcar todo es no marcar nada. */

function Adjuntos({ cuantos }: { cuantos: number }) {
  return (
    <MarcaAnimada
      variants={entraMarca}
      color="gray"
      className="shrink-0 tabular-nums"
      aria-label={`${cuantos} ${cuantos === 1 ? "attachment" : "attachments"}`}
    >
      {/* El clip y el número van juntos adentro de una caja propia: el badge
          mete todo lo que le pasan en un solo span de texto, y un `svg` es un
          bloque —lo deja así el preflight de Tailwind—, así que sueltos se
          apilaban uno arriba del otro. */}
      <span className="inline-flex items-center gap-1">
        <Paperclip size={12} strokeWidth={1.5} aria-hidden />
        {cuantos}
      </span>
    </MarcaAnimada>
  );
}

/* ─────────────────────────── El tiempo ─────────────────────────── */

/* La fecha de la columna sale de `tiempo.ts` —mes y día, y el año sólo cuando
   no es el corriente—: es la misma regla que usan las listas del perfil, y una
   fecha escrita de dos maneras en la misma consola se lee como dos hechos
   distintos. La hora va debajo, en el escalón chico: en una bandeja hay varios
   correos del mismo martes, y sin ella la columna no ordena nada de lo que se
   ve. */

const tramoEnvio = (iso: string) => {
  const dias = diasDesde(iso);
  if (dias < 1) return "today";
  if (dias < 7) return "week";
  if (dias < 30) return "month";
  return "older";
};

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: es
   la misma razón que en Accounts —un panel que dice un número y devuelve otro
   miente sobre lo que va a hacer—. */

const opcionesCarpeta = (filas: EmailConDueno[]): FilterOption[] =>
  ORDEN_CARPETAS.map((value) => ({
    value,
    label: CARPETAS[value].label,
    /* La carpeta ya tiene su glifo en el perfil: el mismo acá, y no un punto de
       color inventado para la ocasión. */
    icon: CARPETAS[value].icon,
    hint: String(filas.filter((f) => f.email.carpeta === value).length),
  }));

const opcionesTipo = (filas: EmailConDueno[]): FilterOption[] =>
  ORDEN_TIPOS.map((value) => {
    const tipo = TIPOS_EMAIL[value];
    return {
      value,
      label: tipo.label,
      /* Sólo `legal` tiene tinte: es el único que se pinta, acá y en la fila. */
      icon: "tinte" in tipo ? punto(tipo.tinte) : undefined,
      hint: String(filas.filter((f) => f.email.tipo === value).length),
    };
  });

const opcionesEntrega = (filas: EmailConDueno[]): FilterOption[] =>
  ORDEN_ENTREGAS.map((value) => ({
    value,
    label: ENTREGAS[value].label,
    icon: punto(ENTREGAS[value].tinte),
    hint: String(filas.filter((f) => entregaDe(f.email) === value).length),
  }));

const opcionesAdjuntos = (filas: EmailConDueno[]): FilterOption[] =>
  [
    { value: "with", label: "With attachments" },
    { value: "without", label: "Without attachments" },
  ].map((o) => ({
    ...o,
    hint: String(
      filas.filter((f) =>
        o.value === "with"
          ? f.email.adjuntos.length > 0
          : f.email.adjuntos.length === 0,
      ).length,
    ),
  }));

const OPCIONES_ENVIO: FilterOption[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "older", label: "Older" },
];

const grupos = (filas: EmailConDueno[]): FilterGroup[] => [
  {
    label: "The email",
    attributes: [
      { id: "subject", label: "Subject", icon: Text, type: "text" },
      { id: "author", label: "Author", icon: AtSign, type: "text" },
      {
        id: "folder",
        label: "Folder",
        icon: Folder,
        options: opcionesCarpeta(filas),
      },
      {
        id: "type",
        label: "Email type",
        icon: Scale,
        options: opcionesTipo(filas),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      {
        id: "delivery",
        label: "Delivery",
        icon: ShieldCheck,
        options: opcionesEntrega(filas),
      },
      {
        id: "attachments",
        label: "Attachments",
        icon: Paperclip,
        options: opcionesAdjuntos(filas),
      },
      // `single`, como los tramos de Accounts: "hoy o esta semana" es "esta
      // semana". Elegir uno reemplaza al anterior.
      {
        id: "sent",
        label: "Date sent",
        icon: CalendarClock,
        options: OPCIONES_ENVIO,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada correo para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (f: EmailConDueno) => string[]> = {
  folder: (f) => [f.email.carpeta],
  type: (f) => [f.email.tipo],
  delivery: (f) => [entregaDe(f.email)],
  attachments: (f) => [f.email.adjuntos.length > 0 ? "with" : "without"],
  sent: (f) => [tramoEnvio(f.email.cuando)],
};

/** Los atributos de texto: los del panel que no tienen lista, y también contra
 *  qué busca la barra de arriba. Es la misma pregunta escrita dos veces, así
 *  que se contesta en un solo lugar. */
const TEXTOS: Record<string, (f: EmailConDueno) => string[]> = {
  subject: (f) => [f.email.asunto],
  author: (f) => [autorDe(f.email, f.usuario)],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(
  fila: EmailConDueno,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim().toLowerCase();
  /* La barra de arriba busca en lo que la fila muestra —el autor y el asunto— y
     además en el nombre de la cuenta: la tabla no lo tiene en ninguna columna,
     pero es lo primero que uno pega ahí cuando llegó desde un perfil. */
  if (
    texto &&
    !contiene(
      [
        fila.email.asunto,
        autorDe(fila.email, fila.usuario),
        fila.usuario.name,
        fila.usuario.id,
      ],
      texto,
    )
  ) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    const libre = TEXTOS[id];
    if (libre) return valores.some((v) => contiene(libre(fila), v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(fila);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El asunto se lleva la mitad: es lo único que se lee para decidir, y los
   badges que lo acompañan viven en su misma línea. */
const COLUMNAS = [
  { id: "author", ancho: "30%" },
  { id: "subject", ancho: "52%" },
  { id: "sent", ancho: "18%" },
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

/* Las mismas medidas que Accounts, por lo mismo: la sangría alinea la tabla con
   el header sin meterle un contenedor con padding, y el aire suelta las filas
   sin sacarlas de la densidad compacta. */
const SANGRIA =
  "[&_th:first-child]:pl-6 [&_td:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6";

const AIRE_FILA = "[&_td]:py-2";
const AIRE_TITULOS = "[&_th]:py-2.5";

/* La banda de la cabecera, la misma de Accounts: el violeta lavado del sistema,
   translúcido y con desenfoque detrás, para que se lea como una banda apoyada
   sobre la lista y no como un bloque pintado al lado. */
const BANDA_TITULOS = [
  "bg-[oklch(0.966_0.022_292)]/70",
  "dark:bg-[oklch(0.34_0.03_292)]/70",
  "backdrop-blur-md",
].join(" ");

/** Cuántos correos entran en una página. */
const POR_PAGINA = 40;

export function EmailSearch() {
  return (
    /* Una región densa entera, como la tabla de Accounts: el buscador, el panel
       y la tabla leen el escalón de acá y no lo reciben cada uno por su
       cuenta. */
    <SizeProvider size="compact">
      <Pantalla />
    </SizeProvider>
  );
}

function Pantalla() {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  /* Los correos de todas las cuentas, del más nuevo al más viejo. Salen de la
     lista viva de usuarios: el día que se dé de baja a alguien, sus correos se
     van con él sin que esta pantalla tenga que enterarse. */
  const usuarios = useUsuarios();
  const todos = useMemo(() => todosLosEmails(usuarios), [usuarios]);
  const escala = useTypeScale();
  /* Lo que mide la cabecera, para que el scroller reserve ese alto arriba: la
     cabecera flota encima, así que sin la reserva las primeras filas nacerían
     tapadas. */
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const encontrados = useMemo(
    () => todos.filter((f) => pasa(f, busqueda, filtros)),
    [todos, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todos), [todos]);

  const openTab = useWorkspace((w) => w.openTab);

  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* El riel muestra un correo a la vez, y el que muestra es el de esta pestaña:
     el `PreviewProvider` guarda uno por scope, así que dos copias de esta
     pantalla no se pisan el vistazo. */
  const { show, close } = usePreview();

  const abrirCorreo = useCallback(
    ({ email, usuario }: EmailConDueno) =>
      show(
        <CorreoEnElRiel
          /* Abrir otro correo es cambiar de contenido, no actualizarlo: sin la
             `key` React reusaría el que ya está y el scroll del riel se
             quedaría donde lo dejó el anterior —un correo largo leído hasta el
             final deja al siguiente empezando por la mitad—. Es la misma razón
             por la que el perfil le pone la suya a la vista del correo
             abierto. */
          key={email.id}
          email={email}
          usuario={usuario}
          onClose={close}
          /* Al perfil, a sus correos, y a **este** correo: el vistazo del
             riel se abrió desde uno, así que su pantalla entera es la sección
             Emails de la cuenta con ese mismo correo abierto. Abrir la bandeja
             en otro sería contestar una pregunta que nadie hizo. */
          onCuenta={() => openTab(tabDePerfil(usuario, "emails", email.id))}
        />,
      ),
    [show, close, openTab],
  );

  /* En qué página estamos, con la clave de lo que estaba filtrado cuando se
     eligió: cambiar el filtro vuelve a la primera, la página se acota contra el
     total, y cambiar de página vuelve arriba. Las tres decisiones viven en el
     hook —lo mismo hace Provisioning, que es la otra tabla que se pagina—. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const { pagina, paginas, desde, filas, dir, ancla, irA } = usePaginacion(
    encontrados,
    clave,
    POR_PAGINA,
  );

  return (
    /* La pantalla reparte los turnos y sus piezas los toman: el header, la
       cabecera de la tabla y el cuerpo son sus hijos, y las filas los hijos del
       cuerpo. El estado viaja por el contexto de Framer, así que el `ScrollArea`
       y la `Table` que hay en el medio no lo cortan. */
    <motion.div
      variants={cascadaPantalla}
      initial="oculto"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col"
    >
      {/* El aire lateral es del header, no de la pantalla: así la tabla llega a
          los dos bordes y son sus celdas las que se alinean con él. */}
      <motion.header
        variants={entraBloque}
        className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-6 py-4"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: escala.title }}
          >
            Email Search
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            Search every message that passed through the house, and see what
            each one carried.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search emails"
              labelHidden
              icon={Search}
              placeholder="Search emails"
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
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <MailX />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No emails</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              Nothing matches what you&rsquo;re looking for. Try fewer letters,
              or drop a filter.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      ) : (
        <motion.div variants={entraTabla} className="relative min-h-0 flex-1">
          {/* Los títulos van afuera del scroller y flotando encima: adentro,
              `scroll-fade` los desvanecería cada vez que hay filas por arriba.
              Las dos tablas se alinean porque comparten `Columnas` y van las
              dos en `table-fixed`. */}
          <div ref={medirCabecera} className="absolute inset-x-0 top-0 z-10">
            <Table
              className={cn("table-fixed", BANDA_TITULOS, SANGRIA, AIRE_TITULOS)}
            >
              <Columnas />
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date Sent</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            {/* La reserva para la cabecera que flota encima. Lleva el ancla:
                es lo que la pantalla usa para encontrar la caja que scrollea y
                subirla cuando cambia de página. */}
            <div ref={ancla} style={{ paddingTop: altoCabecera ?? 0 }} />
            <Table className={cn("table-fixed", SANGRIA, AIRE_FILA)}>
              <Columnas />
              <TableBody>
                {filas.map(({ email, usuario }, i) => {
                  const tipo = TIPOS_EMAIL[email.tipo];
                  const entrega = ENTREGAS[entregaDe(email)];

                  return (
                    /* La fila entera abre el correo en el riel: es una sola
                       cosa que se puede tocar, y el cursor de mano lo promete
                       en todo el ancho. La única parte que hace otra cosa es la
                       dirección, que lleva a la cuenta —ver su celda—. */
                    <TableRow
                      key={email.id}
                      index={i}
                      className="cursor-pointer"
                      onClick={() => abrirCorreo({ email, usuario })}
                    >
                      {/* El autor, y nada más que el autor: sin avatar, sin
                          nombre y sin el buzón de la cuenta debajo. Una
                          dirección es lo que se busca y lo que se pega en la
                          barra de arriba; todo lo demás alrededor la haría más
                          difícil de encontrar, no más fácil.

                          Es también el disparador de la tarjeta, y es la misma
                          que abre el nombre en Accounts Search: la cuenta es la
                          misma cosa se la mire desde donde se la mire, así que
                          la ficha que la cuenta también. La tarjeta es la del
                          dueño del buzón —de quién es esta fila—, que en un
                          correo que entró no es el de la dirección que se ve. */}
                      <TableCell className="text-foreground">
                        {/* La caja flex no es decoración: el disparador de la
                            tarjeta es un `span` —inline—, y a un inline el
                            `max-w-full` que lo recortaría no le aplica. Adentro
                            de un flex se convierte en ítem, y ahí sí se corta en
                            vez de meterse en la columna del asunto cuando el
                            panel viene angosto. Es la misma caja que usa la
                            tabla de Accounts alrededor del nombre. */}
                        <motion.span
                          variants={entraCelda}
                          /* Hasta donde llega el texto y no más: el clic de la
                             dirección abre la cuenta y no el correo, y la caja
                             que lo frena no tiene por qué comerse el resto de
                             la celda. */
                          className="flex w-fit max-w-full min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TarjetaUsuario
                            usuario={usuario}
                            onEstado={cambiarEstado}
                            onPerfil={abrirCuenta}
                          >
                            {autorDe(email, usuario)}
                          </TarjetaUsuario>
                        </motion.span>
                      </TableCell>

                      {/* El asunto y sus marcas, en la misma línea. El asunto se
                          come lo que sobra y se corta; los badges no se cortan
                          nunca —un "3" a medias no es un número—. */}
                      <TableCell className="text-foreground">
                        <motion.div
                          variants={entraCelda}
                          className="flex min-w-0 items-center gap-2"
                        >
                          {/* Sin `flex-1`: el asunto ocupa lo suyo y los badges
                              quedan pegados a él. Estirado, las marcas se irían
                              al borde derecho de la columna y dejarían de leerse
                              como parte del asunto. */}
                          <span className="min-w-0 truncate">
                            {email.asunto}
                          </span>
                          {email.adjuntos.length > 0 && (
                            <Adjuntos cuantos={email.adjuntos.length} />
                          )}
                          {"color" in tipo && (
                            <MarcaAnimada
                              variants={entraMarca}
                              color={tipo.color}
                              className="shrink-0"
                            >
                              {tipo.label}
                            </MarcaAnimada>
                          )}
                          {email.rechazado && (
                            <MarcaAnimada
                              variants={entraMarca}
                              color={entrega.color}
                              className="shrink-0"
                            >
                              {entrega.label}
                            </MarcaAnimada>
                          )}
                        </motion.div>
                      </TableCell>

                      {/* Cuándo salió, en relativo y en un solo renglón. Es lo
                          que uno quiere saber de un correo —cuán reciente es—,
                          y la fecha exacta casi nunca: "Apr 9" obliga a restar
                          mentalmente para llegar a lo que "4 mo ago" ya dice.

                          La fecha entera igual no se pierde: va en el `title`,
                          a un hover de distancia, para las dos veces que hace
                          falta el día exacto. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={fechaLarga(email.cuando)}
                        >
                          {haceCuanto(email.cuando)}
                        </motion.span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántos se está viendo cuáles, y por dónde se pasa a los
          que siguen. Va afuera del scroller y pegado abajo —es del mueble, no
          de la lista—, así que el pager no se va con el scroll: se pagina desde
          donde uno esté.

          Sólo cuando hay resultados. Un pager sobre una tabla vacía ofrece
          páginas que no existen, y el estado vacío ya dice todo lo que hay para
          decir. */}
      {filas.length > 0 && (
        <motion.footer
          variants={entraBloque}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3"
        >
          {/* El rango y el total: el pager de al lado dice en qué página está,
              y eso no dice cuántos correos hay. */}
          <Rango
            desde={desde + 1}
            hasta={desde + filas.length}
            total={encontrados.length}
            dir={dir}
          />

          <Pagination total={paginas} value={pagina} onValueChange={irA} />
        </motion.footer>
      )}
    </motion.div>
  );
}
