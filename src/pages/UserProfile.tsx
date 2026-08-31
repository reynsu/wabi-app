import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CircleCheck,
  Contact,
  KeyRound,
  Mail,
  MessagesSquare,
  MoreHorizontal,
  Save,
  Wrench,
} from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { Elevated } from "@/lib/elevated";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import type { IconComponent } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { spring } from "@/lib/springs";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  cambiarEstado,
  iniciales,
  useUsuario,
  type Usuario,
} from "@/pages/usuarios";
import { conversacionesDe } from "@/pages/conversaciones";
import { UserConversations } from "@/pages/UserConversations";
import { emailsDe } from "@/pages/emails";
import { UserEmails } from "@/pages/UserEmails";
import { ticketsDe } from "@/pages/tickets";
import { UserTickets } from "@/pages/UserTickets";

/* El perfil de una cuenta, como pestaña del workspace. Se abre desde el nombre
   de la tabla de Accounts.

   Toma el id y no el usuario entero: la pestaña se arma una vez y su contenido
   queda guardado tal cual en el workspace, así que un usuario pasado por prop
   sería una foto del momento en que se hizo clic. Con el id, el perfil va a
   buscarlo a la tienda en cada pintada y dice siempre lo mismo que la tabla
   —incluso si lo bloquearon desde la tarjeta de la fila después de abrirlo—.

   Sin `SizeProvider`: un perfil no es una región densa. La tabla de Accounts
   se declara compacta porque son cuarenta y ocho filas peleando por el alto;
   acá hay una cuenta sola, y el escalón normal es el que corresponde. */
export function UserProfile({
  id,
  tabId,
  seccion,
  foco,
}: {
  id: string;
  tabId: string;
  /** Con qué sección abre. Es para el que manda al perfil desde afuera —una
   *  fila de Email Search abre la cuenta *en sus correos*, no en el chat—. Sin
   *  esto, o con un valor que no existe, abre con la primera: un enlace viejo
   *  que nombra una sección que se renombró tiene que llevar igual a la cuenta,
   *  no romperse. */
  seccion?: string;
  /** Qué cosa de esa sección venía a ver: el id de un correo, mañana el de un
   *  ticket. Lo interpreta la sección, que es la única que sabe qué es. */
  foco?: string;
}) {
  const usuario = useUsuario(id);

  /* La cuenta ya no está. Hoy no puede pasar —la lista es un fixture y nada la
     borra—, pero la pestaña sobrevive a su contenido: la dejás abierta, y el
     día que los usuarios vengan de una API el de al lado la da de baja. Que
     lo diga es más barato que que reviente. */
  if (!usuario) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <AnimatedEmpty>
          <AnimatedEmptyHeader>
            <AnimatedEmptyMedia variant="icon">
              <Contact />
            </AnimatedEmptyMedia>
            <AnimatedEmptyTitle>Account not found</AnimatedEmptyTitle>
            <AnimatedEmptyDescription>
              {id} isn&rsquo;t in the directory any more. It may have been
              removed while this tab was open.
            </AnimatedEmptyDescription>
          </AnimatedEmptyHeader>
        </AnimatedEmpty>
      </div>
    );
  }

  return (
    <Perfil usuario={usuario} tabId={tabId} seccion={seccion} foco={foco} />
  );
}

/* Lo que se puede mirar de una cuenta, como dato y en un solo lugar: la
   etiqueta que va en la pestaña, el glifo con el que se la reconoce y qué es lo
   que va a haber adentro.

   Los íconos no se eligen acá de cero, se toman prestados del árbol de
   navegación: el sobre es el de la sección Email y la llave inglesa es la de la
   fila Tickets. Un mismo concepto con dos glifos distintos según dónde lo mires
   es la manera más barata de que parezcan dos cosas. */
interface Seccion {
  value: string;
  label: string;
  icon: IconComponent;
  /** Cuántas cosas hay adentro. Cada sección sabe cuál de los números del
   *  modelo es el suyo, así que el header no necesita una tabla aparte que
   *  después haya que acordarse de ampliar. */
  cuantos: (usuario: Usuario) => number;
  /** Lo que se ve adentro. Recibe también el id de la pestaña, para las
   *  secciones que además ponen algo en el board —ver `UserTickets`—, y qué
   *  cosa de adentro pedía el que abrió el perfil, para las que son una lista
   *  con algo abierto al lado —ver `UserEmails`—. Sin esto, la sección todavía
   *  no está escrita y lo que se ve es `Vacio` diciendo qué va a haber. */
  contenido?: (usuario: Usuario, tabId: string, foco?: string) => ReactNode;
  /** Qué va a mostrar cuando esté escrita. Es lo que dice el vacío. */
  promesa: string;
}

const SECCIONES: Seccion[] = [
  {
    value: "conversations",
    label: "Conversations",
    icon: MessagesSquare,
    cuantos: (u) => conversacionesDe(u).length,
    contenido: (u) => <UserConversations usuario={u} />,
    promesa: "every thread this account has taken part in",
  },
  {
    value: "emails",
    label: "Emails",
    icon: Mail,
    cuantos: (u) => emailsDe(u).length,
    contenido: (u, _tabId, foco) => <UserEmails usuario={u} foco={foco} />,
    promesa: "what this account has sent and received by email",
  },
  {
    value: "tickets",
    label: "Support Tickets",
    icon: Wrench,
    cuantos: (u) => ticketsDe(u).length,
    contenido: (u, tabId) => <UserTickets usuario={u} tabId={tabId} />,
    promesa: "the tickets this account has opened, and where each one stands",
  },
];

/* El vacío de una sección. Nombra lo que va a ir ahí y no "esta pantalla":
   quien abre Emails y encuentra un cartel genérico no sabe si se equivocó de
   pestaña o si todavía no hay nada. */
function Vacio({ seccion }: { seccion: Seccion }) {
  const Icono = seccion.icon;

  return (
    <AnimatedEmpty>
      <AnimatedEmptyHeader>
        <AnimatedEmptyMedia variant="figure" float>
          <Icono />
        </AnimatedEmptyMedia>
        <AnimatedEmptyTitle>{seccion.label}</AnimatedEmptyTitle>
        <AnimatedEmptyDescription>
          This is where {seccion.promesa} will go. It isn&rsquo;t written yet.
        </AnimatedEmptyDescription>
      </AnimatedEmptyHeader>
    </AnimatedEmpty>
  );
}

/* Las secciones, en el header y como columnas.

   No es un control aparte apoyado sobre la pantalla: es una fila de datos, con
   la misma forma que el sistema ya usa para poner un número al lado de otro
   —valor arriba, etiqueta abajo, un filete de un píxel en el medio—. La
   diferencia con una fila de datos cualquiera es que estas se clickean, y que
   el número que cada una muestra es cuánto hay adentro. "Emails 6" dice si
   vale la pena entrar antes de entrar, que es más de lo que hace una pestaña.

   Las tres miden lo mismo (`grid-cols-3`) y no lo que mide su texto: con anchos
   distintos, "Support Tickets" contra "Emails" deja una tira que se lee como
   tres cosas de distinto peso. Con tres fracciones iguales la más ancha manda y
   las otras dos la acompañan, y la tira sigue midiendo lo que necesita porque
   el contenedor se encoge al contenido.

   Lo elegido se marca con una barrita abajo que se desliza —`layoutId`, una
   sola en toda la fila— y con el color, que sube a `foreground`. Sin fondo: el
   fondo en esta app es **lo que se mueve con el puntero**, así que una
   selección que lo usara se confundiría con un hover que se quedó pegado.

   Y el que se mueve con el puntero es el mismo de todo el resto: el hover por
   proximidad —`useProximityHover` en el eje `x`, igual que `TabsList`—. No es
   un `:hover` por columna: hay un solo fondo para la fila entera que viaja
   hasta la más cercana al cursor, así que pasar de Emails a Tickets es el
   fondo desplazándose y no uno apagándose mientras otro prende. Y como
   resuelve por cercanía y no por contacto, la fila responde desde antes de que
   el puntero pise una columna. */
function Secciones({
  activa,
  onCambio,
  idBase,
  usuario,
}: {
  activa: string;
  onCambio: (value: string) => void;
  idBase: string;
  usuario: Usuario;
}) {
  const escala = useTypeScale();
  const fila = useRef<HTMLDivElement>(null);

  const {
    activeIndex,
    itemRects,
    isMeasured,
    sessionRef,
    handlers,
    registerItem,
  } = useProximityHover(fila, { axis: "x" });

  /* Las funciones que registran cada columna, hechas una sola vez. Un
     `ref={(n) => registerItem(i, n)}` escrito en la lista cambia de identidad
     en cada render, y React lo lee como que la columna se fue y volvió: cada
     render pediría una remedición. Con las tres memorizadas —`registerItem` es
     estable— se llaman al montar y al desmontar, que es cuando corresponde. */
  const registrar = useMemo(
    () =>
      SECCIONES.map(
        (_, i) => (node: HTMLElement | null) => registerItem(i, node),
      ),
    [registerItem],
  );

  const resaltada = activeIndex !== null ? itemRects[activeIndex] : null;

  /* En un `tablist` la fila no se recorre con Tab —hay un solo punto de entrada
     y adentro se mueve con las flechas—, así que las teclas van a mano. Es
     horizontal, de ahí izquierda y derecha; Home y End porque con tres es
     barato y con diez deja de serlo. */
  const teclas = (e: React.KeyboardEvent) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const i = SECCIONES.findIndex((s) => s.value === activa);
    let proxima: number | undefined;

    if (paso !== undefined) {
      proxima = (i + paso + SECCIONES.length) % SECCIONES.length;
    } else if (e.key === "Home") {
      proxima = 0;
    } else if (e.key === "End") {
      proxima = SECCIONES.length - 1;
    }
    if (proxima === undefined) return;

    e.preventDefault();
    onCambio(SECCIONES[proxima].value);
    /* El foco viaja con la selección: si se quedara donde estaba, la próxima
       flecha se movería desde el lugar equivocado. */
    fila.current?.querySelectorAll<HTMLElement>('[role="tab"]')[proxima]?.focus();
  };

  return (
    <div
      ref={fila}
      role="tablist"
      aria-label="Profile sections"
      onKeyDown={teclas}
      onMouseEnter={handlers.onMouseEnter}
      onMouseMove={handlers.onMouseMove}
      onMouseLeave={handlers.onMouseLeave}
      /* Sin `gap`: el aire entre columnas es padding de cada una y no un hueco
         entre ellas. Se ve igual —veinte píxeles del texto al filete y veinte
         del filete al texto siguiente— pero cambia de quién es: con el hueco,
         la caja de una columna terminaba veinte píxeles antes del filete y el
         fondo del hover se cortaba ahí, dejando una zanja sin pintar contra la
         línea. Ahora las cajas son contiguas, el filete cae justo en la
         costura, y el fondo llega hasta él. */
      /* El `-mr-5` devuelve el padding de la última columna: ese aire es del
         fondo del hover —para que termine parejo con los otros dos— y no de la
         maqueta, así que no tiene por qué empujar al menú veinte píxeles más
         lejos. Con esto el botón queda donde estaba. */
      className="relative -mr-5 grid grid-cols-3 items-stretch"
    >
      {/* El fondo que viaja. `key` es la sesión de hover, así que entra
          apareciendo cada vez que el puntido entra a la fila y se desliza
          mientras está adentro. Espera a `isMeasured`: montarlo contra medidas
          que una pasada posterior corrige se ve como si llegara deslizándose
          desde otra columna.

          Crece cuatro píxeles para arriba y para abajo porque las columnas no
          tienen aire propio —son dos líneas de texto y nada más—, y un fondo
          pegado a las letras se lee como un resaltador. Abajo termina justo
          donde empieza la barrita de la elegida: se tocan, no se pisan. */}
      <AnimatePresence>
        {resaltada && isMeasured && (
          <motion.span
            /* Leer el ref en el render es justamente lo que se quiere: la
               sesión no tiene que provocar un pintado —lo provoca el
               `activeIndex` del primer movimiento, que siempre viene después
               del `mouseEnter` que la incrementó—, sólo tiene que ser distinta
               entre una entrada y la siguiente. Es lo mismo que hacen
               `dropdown`, `tabs` y `table` en el registry. */
            // oxlint-disable-next-line react/refs
            key={sessionRef.current}
            aria-hidden
            /* Cuadrado, sin el radio del sistema de figuras. Estas columnas
               no son objetos apoyados sobre la pantalla —una fila, un chip, un
               panel—: son un tramo de una tira que va de filete a filete, y una
               esquina redondeada le dibujaría un borde propio a algo que no lo
               tiene. Cuadrado, el fondo termina donde termina la columna y la
               línea sigue siendo la que separa. */
            className="pointer-events-none absolute bg-hover"
            initial={{
              opacity: 0,
              left: resaltada.left,
              top: resaltada.top - 4,
              width: resaltada.width,
              height: resaltada.height + 8,
            }}
            animate={{
              opacity: 1,
              left: resaltada.left,
              top: resaltada.top - 4,
              width: resaltada.width,
              height: resaltada.height + 8,
            }}
            exit={{ opacity: 0, transition: spring.fast.exit }}
            transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
          />
        )}
      </AnimatePresence>

      {SECCIONES.map((seccion, i) => {
        const elegida = seccion.value === activa;
        /* El color sube a `foreground` con el hover y no sólo con la
           selección, igual que en `TabItem`: lo que está debajo del puntero se
           lee entero aunque no sea lo elegido. Lo que las sigue separando es
           la barrita. */
        const encendida = elegida || activeIndex === i;

        return (
          <button
            key={seccion.value}
            ref={registrar[i]}
            type="button"
            role="tab"
            id={`${idBase}-tab-${seccion.value}`}
            aria-selected={elegida}
            aria-controls={`${idBase}-panel-${seccion.value}`}
            /* Un solo punto de entrada de tabulado: la elegida. Es lo que
               separa un `tablist` de tres botones sueltos. */
            tabIndex={elegida ? 0 : -1}
            onClick={() => onCambio(seccion.value)}
            className={cn(
              "relative flex min-w-0 cursor-pointer flex-col gap-0.5 px-5 text-left outline-none",
              "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
              /* El filete arranca en la segunda: a la izquierda de la primera
                 no hay nada de qué separarla. El `px-5` va en las tres, así la
                 sangría es la misma y la marca de abajo también. */
              i > 0 && "border-l border-border",
            )}
          >
            <span
              className={cn(
                "truncate font-medium tabular-nums transition-colors duration-80",
                encendida ? "text-foreground" : "text-muted-foreground",
              )}
              style={{ fontSize: escala.subtitle }}
            >
              {seccion.cuantos(usuario).toLocaleString("en-US")}
            </span>
            <span
              className={cn(
                "truncate transition-colors duration-80",
                encendida ? "text-foreground" : "text-muted-foreground",
              )}
              style={{ fontSize: escala.caption }}
            >
              {seccion.label}
            </span>
            {elegida && (
              <motion.span
                layoutId="seccion-activa"
                aria-hidden
                className="absolute inset-x-5 -bottom-1.5 h-0.5 bg-foreground"
                transition={spring.moderate}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Perfil({
  usuario,
  tabId,
  seccion,
  foco,
}: {
  usuario: Usuario;
  tabId: string;
  seccion?: string;
  foco?: string;
}) {
  const escala = useTypeScale();
  const shape = useShape();
  const bloqueado = usuario.status === "blocked";
  /* Con cuál abre. Sólo el estado inicial: a partir de ahí la sección es de
     quien está mirando, y una prop que la siguiera mandando le sacaría la
     pestaña de las manos cada vez que el de afuera vuelva a pedir el perfil. */
  const [activa, setActiva] = useState(
    SECCIONES.some((s) => s.value === seccion)
      ? (seccion as string)
      : SECCIONES[0].value,
  );
  /* Los ids atan cada fila del riel con su panel. Salen de `useId` y no del
     valor de la sección: dos perfiles abiertos son dos copias de esto en la
     misma página, y `conversations-panel` repetido deja al `aria-controls` de
     una apuntando al panel de la otra. */
  const idBase = useId();

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* El header dice de quién es la pantalla y nada más: la cara, el nombre
          y el id. Mismo aire lateral que el header de Accounts —`px-6 py-4`—,
          para que las dos pestañas empiecen a la misma altura y contra el
          mismo margen. */}
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* El escalón grande del avatar —40px—: es lo que mide el bloque de
              dos líneas que tiene al lado, igual que en la fila de la tabla el
              de 32px medía su celda. El radio sale del sistema de figuras en
              vez de ser redondo, y el aro y el plato lo heredan. */}
          <Avatar
            size="lg"
            className={cn("shrink-0", shape.item, "after:rounded-[inherit]")}
          >
            <AvatarFallback
              className="rounded-[inherit]"
              style={{ fontSize: escala.body }}
            >
              {iniciales(usuario.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col gap-0.5">
            {/* El nombre entero y no el primero: en la pestaña compite por el
                ancho con las otras, acá tiene la línea para él. */}
            <h1
              className="truncate font-medium tracking-tight"
              style={{ fontSize: escala.title }}
            >
              {usuario.name}
            </h1>
            {/* El id, en el mismo lugar que en la fila que abrió esto: debajo
                del nombre y en el color secundario. `tabular-nums` porque es
                un número con forma de código y se lee de a dígitos. */}
            <p
              className="truncate tabular-nums text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              {usuario.id}
            </p>
          </div>
        </div>

        {/* Lo que se está mirando y lo que se le puede hacer, juntos contra el
            borde derecho. El `gap` es más grande que el que separa entre sí a
            las piezas del selector, así que el botón se lee como algo aparte y
            no como una sección más. */}
        <div className="flex shrink-0 items-center gap-6">
          <Secciones
            activa={activa}
            onCambio={setActiva}
            idBase={idBase}
            usuario={usuario}
          />

          {/* Las acciones de la cuenta, en un menú y no en dos botones
              sueltos. Son cosas que se le hacen a la cuenta y no cosas que la
              pantalla ofrece: puestas al aire pesarían más que el nombre que
              tienen al lado, y son las dos infrecuentes. El disparador es un
              solo botón con el glifo de "más", que es como esta app ya dice
              "acá hay más de lo que se ve" —ver `window-controls`—.

              `align="end"`: el menú cuelga del borde derecho del botón, que es
              el borde contra el que está apoyado. */}
          <DropdownMenu>
            <DropdownTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Account actions"
                />
              }
            >
              <MoreHorizontal />
            </DropdownTrigger>

            {/* El panel se ajusta a lo que dice y no al ancho fijo del
                componente. Los 288px que trae `DropdownContent` son para un
                menú de navegación, donde las filas son de largos distintos y
                un ancho parejo las alinea; acá son tres acciones cortas, y ese
                ancho deja media caja vacía al lado de las etiquetas. `w-auto`
                sobre un `flex-col` es el contenido más ancho, y el `min-w` del
                anclaje —que sigue puesto— evita que se angoste más que el
                botón del que cuelga. */}
            <DropdownContent side="bottom" align="end" className="w-auto">
              {/* Lo que se le hace al registro, arriba y separado de lo que
                  se le hace a la cuenta: no son la misma clase de acción, y la
                  línea es más barata que agrupar por costumbre.

                  Todavía no guarda nada: el cuerpo del perfil —lo editable— no
                  está escrito, así que por ahora la fila dice que va a existir
                  y nada más. Cuando haya qué editar, lo que falta es lo de
                  abajo, no esta fila. */}
              <MenuItem index={0} icon={Save} label="Save user" />

              <DropdownSeparator />

              {/* Bloquear y desbloquear son la misma fila —una cuenta está de
                  un lado o del otro, nunca de los dos—, así que la fila cambia
                  de etiqueta y de ícono en vez de aparecer al lado de su
                  contrario. Es la misma regla que el pie del `PeekCard` de la
                  tabla, y funciona de verdad: la tienda es una sola, así que el
                  badge de la fila y los conteos del panel de filtros cambian
                  con esto. */}
              <MenuItem
                index={1}
                icon={bloqueado ? CircleCheck : Ban}
                label={bloqueado ? "Unblock account" : "Block account"}
                onSelect={() =>
                  cambiarEstado(usuario.id, bloqueado ? "active" : "blocked")
                }
              />
              {/* Reset password todavía no hace nada: no hay backend detrás,
                  y cuando lo haya lo que falta es la confirmación, no la
                  fila. */}
              <MenuItem index={2} icon={KeyRound} label="Reset password" />
            </DropdownContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Ninguna sección está escrita todavía, y cada una lo dice con su
            nombre y su glifo.

            Las tres se quedan montadas y la que no se mira se esconde, que es
            lo mismo que hace `WorkspacePanel` con sus pestañas y por el mismo
            motivo: una sección conserva lo suyo mientras estás en otra —cuánto
            habías bajado, qué habías filtrado—. Hoy además arregla algo que se
            ve: el vacío entra con una cascada de un segundo, pensada para una
            pantalla que aterriza vacía y no para algo que se cambia tres veces
            seguidas. Montado una sola vez, la cascada corre una vez y volver a
            la sección es instantáneo.
 */}
        {SECCIONES.map((seccion) => (
          /* El panel es una superficie propia y no la continuación del header:
             sube un escalón de la escalera —`Elevated offset={1}`, que además
             se lo pasa a todo lo que monte adentro— y se apoya con un filete
             arriba y las esquinas de arriba redondeadas, como algo que empieza
             ahí. Es lo que separa "de quién es esta pantalla", que vive en el
             header, de "qué estoy mirando de esa cuenta", que vive acá.

             El borde de arriba no es un `border`: es el aro que trae la
             escalera —`0 0 0 1px` de negro al 6%, la primera línea de
             `--shadow-5`—. Poniendo además un `border-t` quedaban dos filetes
             pegados, uno arriba del otro, y una línea de dos píxeles donde el
             sistema dibuja una. Este además sigue el radio y se curva en las
             esquinas, que es lo que un borde de una sola cara no hace.

             En el modo claro la escalera es plana en blanco de la tercera para
             arriba, así que ahí lo que separa es el aro y no el relleno; en el
             oscuro el escalón se ve, y el panel queda un tono por encima del
             header. Es el mismo comportamiento que documenta la banda de
             títulos de la tabla de Accounts.

             `overflow-hidden` es lo que hace que el radio se cumpla: sin él,
             el filete que divide la lista del hilo y los fondos del hover
             salen por las esquinas.

             Se esconde cambiando la clase y no poniendo `hidden` al lado de
             `flex`: son las dos `display`, y cuál gana lo decide el orden en
             que salieron impresas y no lo que uno quiso decir. */
          <Elevated
            key={seccion.value}
            offset={1}
            role="tabpanel"
            id={`${idBase}-panel-${seccion.value}`}
            aria-labelledby={`${idBase}-tab-${seccion.value}`}
            hidden={seccion.value !== activa}
            className={
              seccion.value === activa
                ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl"
                : "hidden"
            }
          >
            {seccion.contenido?.(usuario, tabId, foco) ?? <Vacio seccion={seccion} />}
          </Elevated>
        ))}
      </div>
    </div>
  );
}
