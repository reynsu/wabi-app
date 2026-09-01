import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarPlus,
  Ellipsis,
  Pencil,
  ScrollText,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPen,
  Users as UsersIcon,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { punto } from "@/components/color-dot";
import {
  FilterMenu,
  type FilterGroup,
  type FilterOption,
  type FilterSelection,
} from "@/components/filter-menu";
import { Pagination } from "@/components/pagination";
import { Rango } from "@/components/pager-range";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { MenuItem } from "@/components/ui/menu-item";
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
import { SizeProvider, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { PolicyTargets } from "@/components/policy-targets";
import { EditorDePolitica, BorrarPolitica } from "@/pages/EditorDePolitica";
import { useAltaDePolitica } from "@/pages/NuevaPolitica";
import {
  ALCANCES,
  CREADORES,
  ORDEN_ALCANCES,
  ORDEN_TIPOS,
  TIPOS_DE_POLITICA,
  aQuienesRige,
  claveDeAlcance,
  usePoliticas,
  type Politica,
} from "@/pages/politicas";
import { tabDePerfil } from "@/pages/perfil-tab";
import { fechaDia, tramoAlta } from "@/pages/tiempo";
import { TarjetaUsuario } from "@/pages/Users";
import { cambiarEstado, useUsuarios, type Usuario } from "@/pages/usuarios";
import { useWorkspace } from "@/stores/workspace";
import {
  AIRE_FILA,
  AIRE_TITULOS,
  BANDA_TITULOS,
  SANGRIA,
} from "@/pages/tabla";

/* La pantalla de Policies: las reglas que la casa le puso al correo.

   Es el mismo mueble que Provisioning y Email Search —header con la búsqueda, el
   panel de filtros y la acción; la tabla debajo con su cabecera flotando sobre el
   scroller; el pie con el rango y el pager— porque son tres maneras de mirar el
   correo de la misma consola, y cambiar de fila del sidebar no debería cambiar de
   mueble.

   Cuatro columnas, y la cuarta no tiene título porque no muestra un dato: es lo
   que se puede hacer con la fila. Una columna de acciones con un rótulo promete
   un dato que no está.

   La diferencia con Provisioning es qué se puede hacer con una fila. Un buzón
   se suspende —un estado, tres valores, y eso se edita en la celda—. Una
   política se reescribe entera o se saca, y eso no entra en una celda: va al
   menú de la fila, y de ahí a un diálogo. */

/* ─────────────────────────── El movimiento ───────────────────────────

   El mismo reparto que las otras dos tablas, y por la misma razón: abrir esto es
   una reacción —alguien tocó una fila del sidebar— y no hay cascada entre filas,
   que contaría un orden de llegada que no existió. */

const cascadaPantalla = {
  oculto: {},
  visible: { transition: { delayChildren: 0.02, staggerChildren: 0.04 } },
} as const;

const entraBloque = {
  oculto: { opacity: 0, scale: 0.99 },
  visible: { opacity: 1, scale: 1, transition: spring.moderate },
} as const;

const entraTabla = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: spring.moderate },
} as const;

const entraCelda = {
  oculto: { opacity: 0, filter: "blur(5px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: spring.slow },
} as const;

const FilaAnimada = motion.create(TableRow);

/* El destello: la fila que acaba de existir —o la que se acaba de corregir—
   llega encendida y se apaga sola. Es lo que cierra el diálogo: se aceptó, el
   diálogo se fue, y sin esto hay que buscar con la vista cuál de las cuarenta
   filas es la que uno tocó. Es el mismo violeta lavado con el que esta consola
   marca lo suyo. */
const DESTELLO = {
  encendida: { backgroundColor: "oklch(0.966 0.022 292)" },
  apagada: {
    backgroundColor: "oklch(0.966 0.022 292 / 0)",
    transition: { duration: 1.1, delay: 0.35 },
  },
} as const;

/* ─────────────────────────── Los filtros ─────────────────────────── */

/* Los conteos salen de la lista que se está mirando y no de una constante: un
   panel que dice un número y devuelve otro miente sobre lo que va a hacer. */

const opcionesTipo = (filas: Politica[]): FilterOption[] =>
  ORDEN_TIPOS.map((value) => ({
    value,
    label: TIPOS_DE_POLITICA[value].label,
    icon: punto(TIPOS_DE_POLITICA[value].tinte),
    hint: String(filas.filter((p) => p.tipo === value).length),
  }));

/* Los alcances van agrupados y no cuenta por cuenta: cuarenta opciones con un
   nombre cada una no son un filtro, son la misma tabla otra vez. Lo que se
   pregunta acá es "¿esto rige sobre todos o sobre uno?". */
const opcionesAlcance = (filas: Politica[]): FilterOption[] =>
  ORDEN_ALCANCES.map((value) => ({
    value,
    label: ALCANCES[value],
    hint: String(filas.filter((p) => claveDeAlcance(p) === value).length),
  }));

const opcionesCreador = (filas: Politica[]): FilterOption[] =>
  CREADORES.map((value) => ({
    value,
    label: value,
    hint: String(filas.filter((p) => p.creador === value).length),
  }));

const OPCIONES_FECHA: FilterOption[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "older", label: "Before this year" },
];

const grupos = (filas: Politica[]): FilterGroup[] => [
  {
    label: "The policy",
    attributes: [
      { id: "name", label: "Name", icon: ScrollText, type: "text" },
      {
        id: "type",
        label: "Type",
        icon: ShieldCheck,
        options: opcionesTipo(filas),
      },
      {
        id: "scope",
        label: "Applies to",
        icon: UsersIcon,
        options: opcionesAlcance(filas),
      },
    ],
  },
  {
    label: "The record",
    attributes: [
      {
        id: "creator",
        label: "Creator",
        icon: UserPen,
        options: opcionesCreador(filas),
      },
      /* `single`, como los tramos de Accounts y de Provisioning: "este mes o
         este año" es "este año". Elegir uno reemplaza al anterior. */
      {
        id: "created",
        label: "Created on",
        icon: CalendarPlus,
        options: OPCIONES_FECHA,
        single: true,
      },
    ],
  },
];

/** De qué valores dispone cada política para cada atributo del panel. Entre
 *  atributos, Y; entre los valores de un mismo atributo, O. */
const CAMPOS: Record<string, (p: Politica) => string[]> = {
  type: (p) => [p.tipo],
  scope: (p) => [claveDeAlcance(p)],
  creator: (p) => [p.creador],
  created: (p) => [tramoAlta(p.creadaEl)],
};

const contiene = (donde: string[], que: string) =>
  donde.some((d) => d.toLowerCase().includes(que.toLowerCase()));

function pasa(
  politica: Politica,
  alcance: string,
  busqueda: string,
  filtros: FilterSelection,
) {
  const texto = busqueda.trim().toLowerCase();
  /* La barra de arriba busca en las tres columnas que se leen: lo que la regla
     dice, sobre quién rige y quién la escribió. "Todo lo que escribió Irene" es
     algo que uno escribe antes de acordarse de que hay un panel. */
  if (texto && !contiene([politica.nombre, alcance, politica.creador], texto)) {
    return false;
  }

  return Object.entries(filtros).every(([id, valores]) => {
    /* El único atributo de texto del panel es el nombre, y busca contra el
       nombre: es la misma pregunta que la barra pero acotada a una columna. */
    if (id === "name") return valores.some((v) => contiene([politica.nombre], v));
    const campo = CAMPOS[id];
    if (!campo) return true;
    const tiene = campo(politica);
    return valores.some((v) => tiene.includes(v));
  });
}

/* ─────────────────────────── La tabla ─────────────────────────── */

/* Las columnas, declaradas una vez y usadas por las dos tablas —la de los
   títulos y la del cuerpo—. Con `table-fixed` el ancho sale de acá y no del
   contenido, que es lo único que las mantiene alineadas estando separadas.

   El nombre se lleva la porción más grande: es una oración entera —"Review every
   message sent to Camila Ferreyra"— y es lo que se lee y lo que se busca.

   La de acciones va en píxeles y no en porcentaje: es lo único de la tabla que
   no muestra un dato sino un botón, y un botón mide lo que mide en cualquier
   ancho de ventana. En porcentaje, la columna crecía con la pantalla y dejaba al
   botón nadando en un hueco que le sacaba lugar a lo que sí se lee. Son los 28
   píxeles del botón más la sangría del borde. */
const COLUMNAS = [
  { id: "name", ancho: "46%" },
  { id: "scope", ancho: "28%" },
  { id: "created", ancho: "26%" },
  { id: "acciones", ancho: "60px" },
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

/** Cuántas políticas entran en una página. Las mismas que buzones y correos: es
 *  la misma tabla mirada con otros ojos, y dos largos de página distintos harían
 *  que el pager cambie de significado al cambiar de sección. */
const POR_PAGINA = 40;

/* ─────────────────────────── El menú de la fila ─────────────────────────── */

/* Las dos cosas que se le pueden hacer a una política. Van en un menú y no como
   dos botones sueltos en la fila: son acciones sobre la fila entera —no sobre un
   dato de una celda, como el estado de un buzón—, y dos íconos por fila en
   cuarenta filas es una columna de ruido.

   El disparador aparece con el hover de la fila y se queda mientras el menú está
   abierto, igual que el chevron del estado en Provisioning. Con el foco de
   teclado también: si no, tabular hasta acá sería tabular hacia algo invisible. */
function AccionesDePolitica({
  onEditar,
  onBorrar,
}: {
  onEditar: () => void;
  onBorrar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button
            variant="ghost"
            size="icon-compact"
            aria-label="Policy actions"
            className={cn(
              "opacity-0 transition-opacity duration-80",
              "group-[.is-active]/row:opacity-100",
              "aria-expanded:opacity-100 focus-visible:opacity-100",
            )}
          />
        }
      >
        <Ellipsis />
      </DropdownTrigger>

      {/* Ancho propio: los 288px que trae el panel son para un menú de
          navegación, pero dejarlo en `w-auto` a secas lo encoge hasta las dos
          palabras que tiene adentro, y sale un menú más angosto que el nombre de
          la acción que ofrece —se lee como un recorte, no como un panel—. Un
          piso de 144px le da el ancho de un menú y sigue sin ser el de una
          barra lateral.

          `align="end"`, porque el botón vive contra el borde derecho de la tabla
          y un menú alineado a la izquierda se saldría. */}
      <DropdownContent
        side="bottom"
        align="end"
        className="w-auto min-w-36"
      >
        <MenuItem index={0} icon={Pencil} label="Edit" onSelect={onEditar} />
        {/* Lo que borra se pinta: es la única fila del menú que no se puede
            deshacer, y el color es lo que hace que no se la elija de paso. */}
        <MenuItem
          index={1}
          icon={Trash2}
          label="Delete"
          onSelect={onBorrar}
          className="text-[oklch(0.58_0.2_18)] dark:text-[oklch(0.72_0.17_18)]"
        />
      </DropdownContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────── La pantalla ─────────────────────────── */

/** `tabId` es el de la pestaña que la monta: la ficha de alta se pone en **su**
 *  board, no en el de la que esté puesta. Las pestañas que no se miran siguen
 *  montadas, y escribir contra "la activa" le pondría la ficha en la cara a
 *  otra. */
export function Policies({ tabId }: { tabId?: string }) {
  return (
    /* Una región densa entera, como las otras tablas: el buscador, el panel y la
       tabla leen el escalón de acá y no lo reciben cada uno por su cuenta. */
    <SizeProvider size="compact">
      <Pantalla tabId={tabId} />
    </SizeProvider>
  );
}

function Pantalla({ tabId }: { tabId?: string }) {
  /* El alta vive en el riel y no en un diálogo: escribir una regla es
     justamente cuando hace falta poder mirar las que ya existen. Ver
     `NuevaPolitica`. */
  const alta = useAltaDePolitica(tabId);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FilterSelection>({});
  const escala = useTypeScale();
  const [medirCabecera, altoCabecera] = useMeasuredHeight<HTMLDivElement>();

  const todas = usePoliticas();
  const usuarios = useUsuarios();

  /* Qué está abierto: el editor —escribiendo una nueva o corrigiendo una— y la
     confirmación de borrado. Es estado de la vista, así que vive acá: dos
     pestañas de esta pantalla tienen que poder estar mirando cosas distintas. */
  const [editando, setEditando] = useState<Politica | null>(null);
  const [borrando, setBorrando] = useState<Politica | null>(null);
  /* La fila que se acaba de tocar, para el destello. Se guarda el id y no la
     fila: la fila se vuelve a armar y la de antes ya no es la misma.

     Son dos fuentes porque son dos caminos: corregir una es del diálogo, y
     escribir una nueva es de la ficha del riel, que la señala cuando su alta
     termina. */
  const [corregida, setCorregida] = useState<string | null>(null);
  const recien = corregida ?? alta.recienCreada;

  /* El alcance escrito se calcula una vez por fila y se usa tres veces —la
     columna, la búsqueda y el `title`—: resolverlo adentro de cada uso sería
     recorrer el padrón tres veces por fila. */
  const conAlcance = useMemo(
    () =>
      todas.map((politica) => ({
        politica,
        alcance: aQuienesRige(politica, usuarios),
      })),
    [todas, usuarios],
  );

  const encontradas = useMemo(
    () =>
      conAlcance.filter(({ politica, alcance }) =>
        pasa(politica, alcance, busqueda, filtros),
      ),
    [conAlcance, busqueda, filtros],
  );

  const GRUPOS = useMemo(() => grupos(todas), [todas]);

  const openTab = useWorkspace((w) => w.openTab);
  const abrirCuenta = useCallback(
    (usuario: Usuario) => openTab(tabDePerfil(usuario)),
    [openTab],
  );

  /* La página, con la clave de lo que estaba filtrado cuando se la eligió:
     cambiar el filtro vuelve a la primera, y la página se acota contra el total.
     Es el mismo hook que usan Email Search y Provisioning. */
  const clave = `${busqueda}|${JSON.stringify(filtros)}`;
  const { pagina, paginas, desde, filas, dir, ancla, irA } = usePaginacion(
    encontradas,
    clave,
    POR_PAGINA,
  );

  return (
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
            Email Policies
          </h1>
          <p
            className="text-muted-foreground"
            style={{ fontSize: escala.caption }}
          >
            The rules the house puts on its mail &mdash; and who each one covers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="w-56">
            <InputField
              index={0}
              label="Search policies"
              labelHidden
              icon={Search}
              placeholder="Search policies"
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

          {/* La acción de la pantalla, y la única que crea algo: el resto de la
              barra busca y filtra, que es mirar. Va `primary` y última, contra
              el borde, que es donde este sistema deja la acción. El glifo es el
              mismo con el que la fila del sidebar nombra la sección. */}
          <Button
            variant="primary"
            leadingIcon={ShieldCheck}
            onClick={alta.abrir}
            disabled={!alta.disponible}
          >
            New policy
          </Button>
        </div>
      </motion.header>

      {filas.length === 0 ? (
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <ShieldOff />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>No policies</AnimatedEmptyTitle>
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
              Las dos tablas se alinean porque comparten `Columnas` y van las dos
              en `table-fixed`. */}
          <div ref={medirCabecera} className="absolute inset-x-0 top-0 z-10">
            <Table
              className={cn("table-fixed", BANDA_TITULOS, SANGRIA, AIRE_TITULOS)}
            >
              <Columnas />
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Created on</TableHead>
                  {/* Sin rótulo a la vista, pero con nombre para quien la lee
                      de a una celda: una columna anónima en un lector de
                      pantalla es una celda que no se sabe qué contesta. */}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            {/* La reserva para la cabecera que flota encima. Lleva el ancla: es
                lo que el hook de la paginación usa para encontrar la caja que
                scrollea y subirla cuando cambia de página. */}
            <div ref={ancla} style={{ paddingTop: altoCabecera ?? 0 }} />

            <Table className={cn("table-fixed", SANGRIA, AIRE_FILA)}>
              <Columnas />
              <TableBody>
                {filas.map(({ politica, alcance }, i) => {
                  const tocada = politica.id === recien;
                  /* El alcance en una variable propia: la unión se acota sobre
                     ella y no sobre `politica.alcance`, que el compilador vuelve
                     a ensanchar al leerla dos veces. */
                  const suyo = politica.alcance;
                  const cuenta =
                    suyo.clase === "cuenta"
                      ? usuarios.find((u) => u.id === suyo.cuenta)
                      : undefined;

                  return (
                    <FilaAnimada
                      key={politica.id}
                      index={i}
                      /* Sin destello, `initial`/`animate` en el mismo valor: la
                         fila no anima nada y el envoltorio no cuesta nada. */
                      initial={tocada ? "encendida" : false}
                      animate={tocada ? "apagada" : undefined}
                      variants={DESTELLO}
                    >
                      {/* Qué dice la regla, y nada más. El tipo no se pinta en
                          la fila: es una palabra de cinco valores que sirve para
                          agrupar —y para eso está el panel de filtros y el
                          diálogo—, no para recorrer con la vista. Puesto debajo
                          del nombre, lo único que hacía era duplicar el alto de
                          las cuarenta filas para repetir cinco palabras. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="block truncate"
                          title={politica.nombre}
                        >
                          {politica.nombre}
                        </motion.span>
                      </TableCell>

                      {/* Sobre quién rige. Cuando es una cuenta, es también el
                          disparador de su ficha —la misma que abre el nombre en
                          Accounts—: la cuenta es la misma cosa se la mire desde
                          donde se la mire. Los grupos no tienen ficha que abrir,
                          así que ahí es texto: no se inventa una cuenta detrás
                          de "All accounts" para que las filas se vean todas
                          iguales. */}
                      <TableCell className="text-foreground">
                        <motion.span
                          variants={entraCelda}
                          className="flex w-fit max-w-full min-w-0"
                        >
                          {cuenta ? (
                            <TarjetaUsuario
                              usuario={cuenta}
                              onEstado={cambiarEstado}
                              onPerfil={abrirCuenta}
                            >
                              {cuenta.name}
                            </TarjetaUsuario>
                          ) : politica.objetivos.length > 1 ? (
                            /* Con varios, la celda escribe el primero y cuántos
                               más, y el resto se asoma: leer dos nombres no
                               puede costar abrir la regla. Con uno solo no hay
                               nada que asomar —la celda ya lo dice entero—. */
                            <PolicyTargets politica={politica} resumen={alcance} />
                          ) : (
                            <span className="min-w-0 truncate" title={alcance}>
                              {alcance}
                            </span>
                          )}
                        </motion.span>
                      </TableCell>

                      {/* Cuándo se la escribió, con el día entero y no en
                          relativo: lo que se pregunta de una regla no es cuán
                          reciente es sino de cuándo data. Es la misma fecha,
                          escrita igual, que la columna Date Added de Accounts y
                          la Created At de Provisioning. */}
                      <TableCell>
                        <motion.span
                          variants={entraCelda}
                          className="block truncate tabular-nums"
                          title={`${fechaDia(politica.creadaEl)} · ${politica.creador}`}
                        >
                          {fechaDia(politica.creadaEl)}
                        </motion.span>
                      </TableCell>

                      {/* Qué se puede hacer con ella. La celda va a la derecha
                          del todo porque es donde termina la fila: se la lee
                          entera y recién entonces se decide. */}
                      {/* Sin el relleno vertical de las otras celdas —de ahí
                          el `!`, que le gana al `[&_td]:py-2` compartido—: el
                          botón mide 28 y el alto de la fila lo pone la tabla, no
                          esta celda. Con el relleno, la única columna que no
                          muestra texto era la que decidía cuánto mide una fila,
                          y esta tabla terminaba medio píxel más alta que las
                          otras cuatro. */}
                      <TableCell className="py-0!">
                        {/* `flex` y no `inline-flex`: un inline abre una caja de
                            línea, y su descendente vuelve a empujar el alto. */}
                        <motion.span
                          variants={entraCelda}
                          className="flex justify-end"
                        >
                          <AccionesDePolitica
                            onEditar={() => setEditando(politica)}
                            onBorrar={() => setBorrando(politica)}
                          />
                        </motion.span>
                      </TableCell>
                    </FilaAnimada>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>
      )}

      {/* El pie: de cuántas se está viendo cuáles, y por dónde se pasa a las que
          siguen. Va afuera del scroller y pegado abajo —es del mueble, no de la
          lista—, así que el pager no se va con el scroll. */}
      {filas.length > 0 && (
        <motion.footer
          variants={entraBloque}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3"
        >
          <Rango
            desde={desde + 1}
            hasta={desde + filas.length}
            total={encontradas.length}
            dir={dir}
          />

          <Pagination total={paginas} value={pagina} onValueChange={irA} />
        </motion.footer>
      )}

      {/* Los dos diálogos, montados sólo cuando hay algo que decidir: uno
          corrige y el otro pregunta antes de sacar. Escribir una nueva no está
          acá: eso es la ficha del riel. */}
      {editando && (
        <EditorDePolitica
          politica={editando}
          onListo={(id) => {
            setEditando(null);
            setCorregida(id);
          }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {borrando && (
        <BorrarPolitica
          politica={borrando}
          alcance={aQuienesRige(borrando, usuarios)}
          onListo={() => setBorrando(null)}
          onCancelar={() => setBorrando(null)}
        />
      )}
    </motion.div>
  );
}
