"use client";

import { Fragment, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MailX, Paperclip, Search, Send } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListPane } from "@/components/list-pane";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import {
  CARPETAS,
  ORDEN_CARPETAS,
  direccionDe,
  emailsDe,
  loEscribioLaCuenta,
  type Adjunto,
  type Carpeta,
  type Email,
} from "@/pages/emails";
import { cuandoCorto, fechaLarga } from "@/pages/tiempo";
import { iniciales, type Usuario } from "@/pages/usuarios";

/* La sección Emails del perfil: la lista a la izquierda, el correo abierto a
   la derecha.

   Los dos paneles son los mismos que los de Conversations —el mismo ancho, el
   mismo filete, el mismo buscador arriba— porque son dos maneras de mirar lo
   mismo y cambiar de pestaña no debería cambiar de mueble. Lo que sí cambia es
   lo que va adentro, porque un correo no es un mensaje de chat: tiene asunto,
   viene de una dirección, se lee entero de una vez y a veces trae algo
   colgado. Forzarlo a la forma del hilo habría hecho que las dos secciones se
   vieran iguales cuando no lo son.

   De sólo lectura, por lo mismo que la otra: esta es una consola de
   administración y quien la abre está moderando, no escribiendo. */

/* Los mismos escalones y el mismo reparto de turnos que en Conversations. Se
   repiten a propósito y no se comparten: el día que una de las dos secciones
   quiera moverse distinto, la otra no tiene por qué enterarse. */

const cascadaLista = {
  oculto: {},
  visible: { transition: { delayChildren: 0.03, staggerChildren: 0.045 } },
} as const;

const entraFila = {
  oculto: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: spring.moderate },
} as const;

/* El correo abierto entra en un solo bloque y no en cascada: un correo es una
   cosa sola —un asunto, un cuerpo, una firma—, no una serie de piezas que
   llegaron una detrás de la otra. Escalonarlo diría algo falso sobre lo que
   es. Lo único que se separa es la cabecera del cuerpo, medio suspiro. */
const cascadaCorreo = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.05 } },
} as const;

const entraBloque = {
  oculto: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: spring.moderate },
} as const;

/* ─────────────────────────── La lista ─────────────────────────── */

function Fila({
  email,
  elegido,
  registrar,
  onElegir,
}: {
  email: Email;
  elegido: boolean;
  registrar: (node: HTMLElement | null) => void;
  onElegir: () => void;
}) {
  const escala = useTypeScale();
  const sinAbrir = !email.leido;

  return (
    <motion.button
      ref={registrar}
      variants={entraFila}
      type="button"
      role="option"
      aria-selected={elegido}
      onClick={onElegir}
      className={cn(
        "relative flex w-full cursor-pointer flex-col gap-1 py-2.5 pl-5 pr-3 text-left outline-none",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
      )}
    >
      {/* El correo entra un escalón respecto del encabezado: ocho píxeles,
          apenas para que la carpeta se lea como el techo de lo que tiene
          debajo y no como un renglón más de la misma columna. Alinearlos del
          todo los ponía al mismo nivel, que es justo lo que no son.

          El punto de sin abrir vive **adentro de ese escalón** y no en una
          sangría propia: la columna de asuntos sigue alineada esté o no el
          punto, porque el punto nunca estuvo en el flujo. */}
      {sinAbrir && (
        <span
          aria-label="Unread"
          className="absolute left-2 top-[18px] h-[5px] w-[5px] rounded-full bg-foreground"
        />
      )}

      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            sinAbrir ? "font-medium text-foreground" : "text-foreground/90",
          )}
          style={{ fontSize: escala.body }}
        >
          {/* Quién es el otro. Cuando lo escribió la cuenta, el otro es el
              destinatario: sin el "To:" la fila diría que se lo mandaron. */}
          {loEscribioLaCuenta(email.carpeta) && (
            <span className="text-muted-foreground">To: </span>
          )}
          {email.contacto}
        </span>
        <span
          className="shrink-0 tabular-nums text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          {cuandoCorto(email.cuando)}
        </span>
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            sinAbrir ? "font-medium text-foreground" : "text-foreground/80",
          )}
          style={{ fontSize: escala.caption }}
        >
          {email.asunto}
        </span>
        {email.adjuntos.length > 0 && (
          <Paperclip
            size={12}
            strokeWidth={1.5}
            aria-label="Has attachments"
            className="shrink-0 text-muted-foreground"
          />
        )}
      </span>

      {/* El vistazo del cuerpo. Un renglón y no dos: lo que decide si se abre
          es el asunto, y el cuerpo sólo confirma. */}
      <span
        className="min-w-0 truncate text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        {email.cuerpo.join(" ")}
      </span>
    </motion.button>
  );
}

function Lista({
  emails,
  elegido,
  onElegir,
}: {
  emails: Email[];
  elegido: string;
  onElegir: (id: string) => void;
}) {
  const escala = useTypeScale();
  const [busqueda, setBusqueda] = useState("");
  /* Qué carpetas están plegadas. Guardadas las plegadas y no las abiertas: lo
     normal es que estén todas abiertas, y así el estado inicial es "ninguna"
     en vez de una lista que hay que mantener al día cuando aparezca una
     carpeta nueva. */
  const [plegadas, setPlegadas] = useState<Set<Carpeta>>(new Set());
  const caja = useRef<HTMLDivElement>(null);
  /* Los ids que atan cada encabezado con su carpeta. De `useId` porque dos
     perfiles abiertos son dos listas en la misma página. */
  const idLista = useId();

  const plegar = (carpeta: Carpeta) =>
    setPlegadas((previas) => {
      const proximas = new Set(previas);
      if (proximas.has(carpeta)) proximas.delete(carpeta);
      else proximas.add(carpeta);
      return proximas;
    });

  const { activeIndex, itemRects, isMeasured, sessionRef, handlers, registerItem } =
    useProximityHover(caja, { axis: "y" });

  /* Busca por con quién, por asunto y por lo que dice el cuerpo. Lo último es
     lo que hace que buscar sirva de verdad: uno se acuerda de "riser" y no de
     quién firmaba el aviso. */
  const encontrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter(
      (e) =>
        e.contacto.toLowerCase().includes(q) ||
        e.asunto.toLowerCase().includes(q) ||
        e.cuerpo.some((p) => p.toLowerCase().includes(q)),
    );
  }, [emails, busqueda]);

  /* Agrupados por carpeta y en el orden de siempre: primero lo que llegó,
     después lo que salió, después lo que no salió, y último lo que no debería
     haber llegado. Sólo se dibujan las carpetas que tienen algo — un
     encabezado sobre una carpeta vacía ocupa un renglón para decir que no hay
     nada, y eso ya lo dice el no estar.

     El índice de cada fila para el hover por proximidad es **su lugar en la
     lista sin agrupar**, y no el orden en que termina dibujada. Numerar por
     orden de dibujo parece lo natural —el hook mide una columna— y trae un
     bug feo: al plegar una carpeta, la fila que estaba abajo hereda un índice
     que otra acaba de dejar, y como la que se va sigue montada mientras dura
     su animación de salida, su limpieza corre *después* y borra el registro
     recién hecho. El fondo desaparece hasta la próxima remedición.

     Con el índice atado a la fila, plegar sólo deja huecos en la lista de
     medidas —que el hook ya sabe saltear— y ningún registro pisa a otro. */
  const grupos = useMemo(
    () =>
      ORDEN_CARPETAS.map((carpeta) => {
        const dentro = encontrados
          .map((email, indice) => ({ email, indice }))
          .filter(({ email }) => email.carpeta === carpeta);
        return { carpeta, dentro };
      }).filter((g) => g.dentro.length > 0),
    [encontrados],
  );

  /* Memorizadas por el mismo motivo que en Conversations: una arrow escrita en
     el `map` cambia de identidad en cada render y el hook lo lee como que la
     fila se fue y volvió. */
  const registrar = useMemo(
    () =>
      encontrados.map(
        (_, i) => (node: HTMLElement | null) => registerItem(i, node),
      ),
    [encontrados, registerItem],
  );

  const hoverRect = activeIndex !== null ? itemRects[activeIndex] : null;
  const elegidoIdx = encontrados.findIndex((e) => e.id === elegido);
  const elegidoRect = elegidoIdx >= 0 ? itemRects[elegidoIdx] : null;

  return (
    <ListPane id="emails">
      {/* El campo se lleva el ancho del panel. `InputGroup` trae un `w-72`
          fijo —el ancho de un formulario suelto— y este panel es
          redimensionable: con el ancho fijo, arrastrarlo para ver los nombres
          enteros deja el buscador parado donde estaba y un hueco a su derecha.
          Es lo mismo que ya hacía Tickets con su `flex-1`. */}
      <div className="shrink-0 p-3">
        <InputGroup className="w-full">
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
      </div>

      {/* `[&>div]:min-w-0!` por lo mismo que en Conversations: el envoltorio
          que Base UI mete adentro del viewport trae `min-width: fit-content` y
          sin desactivarlo la fila deja de achicarse. */}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        {/* El que reparte los turnos de entrada **no es esta caja sino cada
            grupo** —ver abajo—. Estaba acá, y con los grupos plegables eso se
            volvió un bug: una fila que se vuelve a montar entra a un
            contenedor que ya está en `visible`, así que hereda el `initial`
            —`oculto`, opacidad cero— y el `animate` del padre no vuelve a
            correr porque no cambió. Resultado: al desplegar, el hueco quedaba
            del alto correcto y las filas invisibles adentro. */}
        <div
          ref={caja}
          role="listbox"
          aria-label="Emails"
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          className="relative flex flex-col pb-2"
        >
          {elegidoRect && isMeasured && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bg-active"
              initial={false}
              animate={{ top: elegidoRect.top, height: elegidoRect.height }}
              transition={spring.moderate}
            />
          )}

          <AnimatePresence>
            {hoverRect && isMeasured && (
              <motion.span
                // Ver `UserProfile`: la sesión no tiene que provocar un
                // pintado, sólo ser distinta entre una entrada y la siguiente.
                // oxlint-disable-next-line react/refs
                key={sessionRef.current}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-hover"
                initial={{
                  opacity: 0,
                  top: elegidoRect?.top ?? hoverRect.top,
                  height: elegidoRect?.height ?? hoverRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: hoverRect.top,
                  height: hoverRect.height,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>

          {grupos.map((grupo) => {
            const plegada = plegadas.has(grupo.carpeta);
            const idCuerpo = `${idLista}-${grupo.carpeta}`;
            const { label, icon: Icono } = CARPETAS[grupo.carpeta];

            return (
              <Fragment key={grupo.carpeta}>
                {/* El encabezado se queda arriba mientras la carpeta pasa por
                    debajo: en una lista larga, saber en cuál se está mirando
                    no puede depender de acordarse de lo que se leyó al pasar.
                    Lleva fondo propio porque los fondos del hover y de lo
                    elegido van detrás y le pasarían por encima.

                    Es un botón que pliega la carpeta. El `px-3` es el mismo de
                    las filas, así que el nombre del grupo y el texto de sus
                    correos arrancan en la misma columna. */}
                <button
                  type="button"
                  onClick={() => plegar(grupo.carpeta)}
                  aria-expanded={!plegada}
                  aria-controls={idCuerpo}
                  className={cn(
                    "group/carpeta sticky top-0 z-10 flex cursor-pointer items-baseline gap-2",
                    "bg-surface-5 px-3 pb-1 pt-3 text-left text-muted-foreground outline-none",
                    "hover:text-foreground focus-visible:text-foreground",
                  )}
                  style={{ fontSize: escala.caption }}
                >
                  {/* El glifo de la carpeta. Un sobre abierto y uno que sale
                      se distinguen de reojo mucho antes que las palabras
                      "Inbox" y "Sent", que empiezan las dos con una letra alta
                      y miden casi lo mismo. */}
                  <Icono
                    size={13}
                    strokeWidth={1.5}
                    aria-hidden
                    className="shrink-0 self-center"
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    {grupo.dentro.length}
                  </span>
                  {/* El chevron aparece con el hover y se queda puesto cuando
                      la carpeta está plegada: es la manera de volver a abrirla,
                      y escondida sería un grupo que se cerró y no dice cómo.
                      Es el mismo trato que reciben los grupos del sidebar. */}
                  <ChevronDown
                    size={12}
                    strokeWidth={1.5}
                    aria-hidden
                    className={cn(
                      "shrink-0 self-center transition-[transform,opacity] duration-80",
                      plegada
                        ? "-rotate-90 opacity-100"
                        : "opacity-0 group-hover/carpeta:opacity-100 group-focus-visible/carpeta:opacity-100",
                    )}
                  />
                </button>

                {/* El cuerpo se monta y se desmonta, sin `AnimatePresence`.
                    Lo tuvo, animando la altura de `auto` a cero, y traía un
                    bug: `AnimatePresence` deja montado al que se va hasta que
                    termine su salida, y volver a abrir el grupo mientras eso
                    pasa le pide a framer resucitar un hijo con la misma clave
                    que se está encogiendo. La medida del `height: "auto"` sale
                    de ahí, y el grupo aterriza en cero con las filas adentro:
                    espacio reservado, contenido invisible. Con cuatro grupos
                    plegados y abiertos seguidos, los cuatro quedaban así.

                    Ahora sólo se anima la entrada. Plegar es instantáneo —lo
                    que se pliega deja de estar, que es lo que uno pidió— y
                    abrir trae el bloque con un desplazamiento corto. Sin
                    salida no hay a quién resucitar.

                    El `y` no descoloca los fondos del hover: el hook mide con
                    `offset*` justamente para no verse afectado por
                    transformaciones. */}
                {!plegada && (
                  <motion.div
                    id={idCuerpo}
                    /* Cada grupo reparte los turnos de sus propias filas. Al
                       montarse —la primera vez, y cada vez que se lo
                       despliega— arranca en `oculto` y va a `visible`, así que
                       sus filas entran siempre, vengan de un primer pintado o
                       de haber estado plegadas. */
                    variants={cascadaLista}
                    initial="oculto"
                    animate="visible"
                  >
                      {grupo.dentro.map(({ email, indice }) => (
                        <Fila
                          key={email.id}
                          email={email}
                          elegido={email.id === elegido}
                          registrar={registrar[indice]}
                          onElegir={() => onElegir(email.id)}
                        />
                      ))}
                  </motion.div>
                )}
              </Fragment>
            );
          })}

          {encontrados.length === 0 && (
            <p
              className="px-3 py-6 text-center text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              Nothing matches &ldquo;{busqueda}&rdquo;.
            </p>
          )}
        </div>
      </ScrollArea>
    </ListPane>
  );
}

/* ─────────────────────────── El correo ─────────────────────────── */

function Adjuntos({ adjuntos }: { adjuntos: Adjunto[] }) {
  const escala = useTypeScale();
  const shape = useShape();

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {adjuntos.map((a) => (
        /* No son botones: no hay de dónde bajarlos. Decir que hay algo colgado
           y cuánto pesa es todo lo que esta pantalla puede prometer hoy, y un
           botón que no descarga es peor que ninguno. */
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

function Vista({ email, usuario }: { email: Email; usuario: Usuario }) {
  const escala = useTypeScale();
  const shape = useShape();
  const propio = loEscribioLaCuenta(email.carpeta);
  /* Quién escribió y quién recibió. El correo guarda con quién es y de qué
     lado salió; los dos nombres se derivan de eso y no se guardan dos veces. */
  const remitente = propio ? usuario.name : email.contacto;
  const destinatario = propio ? email.contacto : usuario.name;
  /* La dirección que va debajo del nombre es la **del que escribió**, no la
     del otro: el correo guarda una sola —la del contacto— y de qué lado salió,
     y con esas dos se sabe cuál va arriba y cuál abajo. La de la cuenta se
     deriva de su nombre. */
  const direccionRemitente = propio ? direccionDe(usuario) : email.direccion;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade [&>div]:min-w-0!"
      >
        <motion.article
          variants={cascadaCorreo}
          initial="oculto"
          animate="visible"
          className="flex flex-col gap-4 px-6 py-5"
        >
          <motion.header variants={entraBloque} className="flex flex-col gap-3">
            {/* El asunto es el título de la pantalla mientras este correo esté
                abierto, así que va en el escalón de título y no en el del
                cuerpo. */}
            <h2
              className="font-medium tracking-tight"
              style={{ fontSize: escala.title }}
            >
              {email.asunto}
            </h2>

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
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontSize: escala.body }}
                  >
                    {remitente}
                  </span>
                  {/* La fecha entera y con año: un correo se archiva, y
                      "Aug 27" sin año deja de servir en enero. */}
                  <span
                    className="shrink-0 tabular-nums text-muted-foreground"
                    style={{ fontSize: escala.caption }}
                  >
                    {fechaLarga(email.cuando)}
                  </span>
                </span>
                <span
                  className="truncate text-muted-foreground"
                  style={{ fontSize: escala.caption }}
                >
                  {direccionRemitente} · to {destinatario}
                </span>
              </div>
            </div>
          </motion.header>

          {/* El cuerpo, párrafo por párrafo. `max-w` en caracteres y no en
              píxeles: lo que hace legible una columna de texto es cuántos
              signos entran en un renglón, no cuánto mide en pantalla. */}
          <motion.div
            variants={entraBloque}
            className="flex max-w-[68ch] flex-col gap-3 border-t border-border pt-4 leading-relaxed"
            style={{ fontSize: escala.body }}
          >
            {email.cuerpo.map((parrafo, i) => (
              <p key={i}>{parrafo}</p>
            ))}
          </motion.div>

          {email.adjuntos.length > 0 && (
            <motion.div variants={entraBloque}>
              <Adjuntos adjuntos={email.adjuntos} />
            </motion.div>
          )}
        </motion.article>
      </ScrollArea>

      <footer
        className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-muted-foreground"
        style={{ fontSize: escala.caption }}
      >
        <Send size={12} strokeWidth={1.5} />
        Read-only — this console doesn&rsquo;t send email
      </footer>
    </div>
  );
}

/* ─────────────────────────── La sección ─────────────────────────── */

export function UserEmails({
  usuario,
  foco,
}: {
  usuario: Usuario;
  /** Con qué correo abre. Es para el que llega desde afuera —una fila de Email
   *  Search abre la cuenta en *ese* correo y no en el más nuevo—. Sólo el
   *  estado inicial: a partir de ahí elige el que está mirando.
   *
   *  Un id que no existe cae en el primero, que es lo que hace `abierto` unas
   *  líneas más abajo: un enlace a un correo que ya no está tiene que abrir la
   *  bandeja igual, no romperse. */
  foco?: string;
}) {
  const escala = useTypeScale();
  const emails = emailsDe(usuario);
  const [elegido, setElegido] = useState(foco ?? emails[0]?.id ?? "");
  const abierto = emails.find((e) => e.id === elegido) ?? emails[0];

  if (!abierto) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <MailX size={24} strokeWidth={1.5} className="text-muted-foreground" />
        <p style={{ fontSize: escala.body }}>No emails</p>
        <p
          className="max-w-sm text-muted-foreground"
          style={{ fontSize: escala.caption }}
        >
          This account hasn&rsquo;t sent or received any email yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Lista emails={emails} elegido={abierto.id} onElegir={setElegido} />
      {/* `key`: abrir otro correo es cambiar de contenido, no actualizarlo —
          sin esto el scroll del anterior se queda puesto en el nuevo, y la
          entrada no se vuelve a reproducir. */}
      <Vista key={abierto.id} email={abierto} usuario={usuario} />
    </div>
  );
}
