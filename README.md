# Wabi App

Una app armada con los componentes y blocks del registry **@wabi**, que vive en
el proyecto de al lado (`../new-wabi-ui`).

```bash
npm run dev     # http://localhost:5174
npm run build
```

## De dónde salen los componentes

Todo lo que hay en `src/components/`, `src/lib/` y `src/hooks/` **no se escribe
acá**: se instala desde dos registries declarados en `components.json`.

| registry | qué trae | de dónde |
|---|---|---|
| `@wabi` | los componentes y blocks propios | `../new-wabi-ui/public/r/{name}.json` |
| `@fluid` | el design system del que salen las piezas base | `https://www.fluidfunctionalism.com/r/{name}.json` |

`@wabi` apunta a un servidor estático local porque el registry todavía no está
publicado. Para instalar o actualizar algo:

```bash
cd ../new-wabi-ui && npm run build:registry && npm run serve:registry
```

y con eso corriendo, desde acá:

```bash
yes n | npx shadcn add @wabi/pagination -y
npm run fix:fluid
```

Dos cosas de ese comando, las dos aprendidas a los golpes:

**Sin `--overwrite`, y contestando que no a cada archivo que ya existe.** Con
`--overwrite` el CLI pisa las dependencias transitivas con su última versión, y
ahí se van por delante las desviaciones locales —`font-weight.ts` vuelve a
perder el `opsz 20`— y, cuando @fluid publica una pieza migrada, componentes que
estaban sobre Base UI vuelven sobre Radix sin que nadie lo pida.

**Y después mirar `src/index.css`.** El item de tokens lo reescribe y le mete
`@keyframes` adentro del `@theme inline` y bloques `:root` duplicados. Si el
`git diff` de ese archivo tiene algo, es eso: `git checkout -- src/index.css`.

Cuando el registry esté publicado, en `components.json` se cambia esa URL por la
del sitio y no hace falta nada más.

### `src/index.css`

Es **el mismo archivo** que el del showcase (`../new-wabi-ui/src/index.css`),
copiado tal cual. El item `@wabi/tokens` trae la escalera de superficies, las
sombras y los tokens de interacción, pero deja afuera —a propósito— lo que es
decisión de la app: la paleta base de shadcn (`--background`, `--foreground`,
`--border`, `--radius`, los `--sidebar-*`…), el fondo del `<html>`, los
scrollbars nativos y el selector `.light` que hace falta para anidar un tema.
Sin esa mitad, `bg-background` y `text-muted-foreground` resuelven a nada: en
claro casi no se nota y en oscuro queda texto negro sobre fondo negro.

Copiarlo entero es lo que garantiza que las dos apps pinten con los mismos
valores. Si el showcase cambia un token, se vuelve a copiar — con una salvedad,
que es la única línea en la que los dos archivos difieren:

```css
--radius: 0.5rem;   /* el showcase trae el 0.625rem de shadcn */
```

A 10px un control de 28px se lee casi como una píldora. Y 8px es, además, el
número que el sistema de figuras ya da por sentado: `shape-context` tiene
`bgRadius: 8` para el fondo que viaja y un anillo de foco de 10 que se describe
a sí mismo como "item + 2". Bajarlo alinea el CSS con lo que el propio sistema
asume. Al volver a copiar el archivo, hay que volver a bajarlo.

### `npm run fix:fluid`

Las dos desviaciones locales sobre lo que publica @fluid, en un script porque
`shadcn add --overwrite` vuelve a bajar el archivo original y se las lleva
puestas. **Hay que correrlo después de cada instalación.**

| archivo | qué |
|---|---|
| `components/ui/card.tsx` | viene compilado para Next e importa `next/link`, que en Vite no resuelve: se cambia por un `<a>` |
| `lib/font-weight.ts` | el semibold viene en `opsz 18`; acá va en **20**, que es el tamaño óptico con el que está ajustada la tipografía |

Es idempotente, y **falla con código 1 si un parche no encaja** — si el archivo
del registry cambió de forma, es mejor enterarse que perder la desviación en
silencio. El mismo script está en el showcase, con los mismos dos parches: las
dos apps tienen que verse igual.

## Cómo está armado

- `src/main.tsx` — los cuatro sistemas del registry cableados una sola vez:
  motion (`reducedMotion="user"`), figuras, tamaños y superficies.
- `src/App.tsx` — el shell: sidebar, `WorkspacePanel` con pestañas y el
  `WidgetRail` del costado. El board y el preview del riel son **de la pestaña
  que los abrió**; qué pantallas vienen con board puesto lo decide `CON_BOARD`.
- `src/navigation.tsx` — el árbol de navegación, como dato. Ver abajo.
- `src/widgets.tsx` — los mosaicos del riel. Van separados de las pantallas
  porque el riel es un lugar del shell y no una pantalla.
- `src/pages/` — una pantalla por pestaña.

## El árbol es un dato, no un JSX

Toda la navegación vive en `src/navigation.tsx`. `App.tsx` no sabe qué
pantallas hay: recorre `NAV` y arma las filas.

El árbol está **aplanado a un nivel**. Lo que conceptualmente es una sección
—Chat, Email, Admin— es un `SidebarGroup` con label, y sus hijas son filas de
primer nivel con ícono propio. No hay sub-menús: el label del grupo es lo que
colapsa (`collapsible` se lo pide) y el chevron aparece con el hover, salvo
cuando el grupo está cerrado, que se queda visible como la manera de volver a
abrirlo.

Tres decisiones que valen la pena:

- **Los ids van calificados** (`chat/search`, `email/search`). El árbol repite
  etiquetas a propósito: hay un Search en Chat y otro en Email, un Reports en
  Email y otro en Admin. El id es la identidad de la pestaña, así que sin
  calificar serían la misma pestaña.
- **Cada fila tiene su ícono.** Antes las hijas no llevaban y lo prestaba la
  sección; ahora que son de primer nivel, cada una tiene el suyo —y es lo que
  separa los dos "Search" en la barra de pestañas.
- **Hay grupos sin nombre.** Announcements, Tickets y Support & feedback no
  cuelgan de ninguna sección en el árbol original, así que van en grupos sin
  label, en el mismo lugar en que estaban. Sin label no hay disparador, así
  que esos grupos no se colapsan: no hay de dónde agarrarlos.

Cada fila lleva **una acción**, revelada con el hover: abre otra copia de la
misma pantalla. El clic en la fila lleva a la pestaña que ya está abierta —
`openTab` deja ganar a la existente para no remontar su contenido—, así que
duplicar es abrir la misma hoja con un id nuevo: `chat/search#2`, el número más
chico que esté libre. Cada copia arma su propio contenido y por eso tiene su
propio estado: su página del paginador, su board, su preview. La fila le
reserva el lugar a la acción sola —`rowGutter` es exacto, no un padding a ojo.

Dos pestañas de lo mismo destaparon un bug en `WorkspacePanel`: el plano
montaba `activeTab.content` sin `key`, así que dos pestañas del mismo tipo de
componente caían en la misma posición del árbol, React las reconciliaba en una
sola instancia y el estado de la que dejabas aparecía en la que abrías.

Ahora el panel **monta todas las pestañas** y esconde las inactivas, cada una
en su propia caja de scroll. Es lo que hace que una pestaña conserve lo suyo
mientras estás en otra: la página del paginador, cuánto habías bajado, un
formulario a medio llenar. Las esconde con `visibility` y no con `display:
none` —un elemento que no se maqueta pierde su scroll y el browser se lo
devuelve en cero, y cuánto habías bajado también es estado— más `inert`, que
hace el resto: fuera del árbol de accesibilidad, fuera del orden de tabulado y
sordo al puntero.

El header es un **dropdown**: la insignia y el nombre en una fila, el chevron
al final, y adentro los tres destinos de producto (What's new, FAQ, Support &
feedback). Son filas del mismo árbol: el menú es un atajo, no un lugar aparte.

## La pantalla de usuarios

`Chat › Accounts` es la primera pantalla escrita de verdad: un header con la
barra de búsqueda y el `FilterMenu`, y debajo la tabla con User Name,
Communication Status, Last Activity y Date Added.

**El header va a la derecha**, con el campo de búsqueda y el `FilterMenu`
juntos contra el borde. Dos ajustes sobre lo que traen los componentes:

- El campo se muestra siempre con la caja puesta. `InputField` la deja
  invisible en reposo —es un campo de toolbar y el marco aparece al tocarlo— y
  acá queremos lo contrario: que se vea que hay dónde escribir sin buscarlo. Se
  pisa con un selector al contenedor que tiene el input adentro
  (`[&>div:has(>input)]`) y no a un `:last-child`, que se rompe el día que el
  campo muestre un error.
- El botón de filtros va en `secondary`. Para eso `FilterMenu` estrenó una prop
  `variant`: tenía el `tertiary` cableado adentro, y pisar por CSS el relleno de
  una variante desde afuera es pelearse con el componente. El default no cambia,
  así que el showcase sigue igual.

**La densidad se declara una vez.** La pantalla entera va adentro de un
`SizeProvider size="compact"` y el buscador, el panel de filtros y la tabla lo
leen de ahí: ninguno recibe `size` por su cuenta. Es lo que pide el sistema de
tamaños —envolver la región densa, no repetir la palabra en cada pieza—, y
pasar la pantalla a la densidad normal es cambiar esa palabra. Lo mismo con el
texto propio: el id debajo del nombre sale de `useTypeScale().caption`, no de
un `text-[11px]`.

**Lo único que scrollea es el cuerpo de la tabla.** La pantalla mide lo que
mide la pestaña y no desborda, así que el panel no scrollea; adentro, una
`ScrollArea` —el scrollbar del sistema, que en un táctil se corre sola y deja
el overflow nativo— se queda con el alto que sobra, con `scroll-fade` en el
viewport: la lista se disuelve contra el borde que todavía tiene contenido y se
queda nítida en el principio y en el final de verdad.

Los títulos de las columnas van **afuera del scroller, en su propia tabla**.
Adentro no pueden: el `scroll-fade` desvanece el borde de arriba en cuanto hay
filas por encima, y una cabecera pegada cae justo ahí — quedaría fantasma cada
vez que scrolleás. Afuera se queda entera. Las dos tablas se alinean porque
comparten el mismo `colgroup` y van las dos en `table-fixed`: con el ancho
saliendo del contenido, separadas, no habría manera.

**La tabla no tiene marco.** Ni radio, ni sombra, ni escalón propio: llega a
los dos bordes del panel. Lo que la alinea con el header es el `pl-6` de su
primera columna y el `pr-6` de la última, no un contenedor con padding — el
aire lateral es del header, no de la pantalla.

Sobre el escalón compacto, dos ajustes de aire: las filas van a 8px de padding
vertical —el texto se queda en la densidad compacta, lo que cambia es cuánto
respiran— y los títulos a 10px, que los deja en 36px de alto, el escalón normal
de la escalera de tamaños.

La cabecera lleva además una banda de color. No sale de la escalera de
superficies —en el modo claro la escalera es plana en blanco de la tercera para
arriba, así que un escalón no la separaría ni de las filas ni del header de la
pestaña, que están sobre el mismo plano; es la misma razón por la que el plato
del avatar tampoco es un escalón—. Es un violeta muy lavado, en el hue 292 del
violeta de los badges para que sea el púrpura del sistema y no otro traído de
afuera: `oklch(0.966 0.022 292)` en claro y `oklch(0.34 0.03 292)` en oscuro,
que queda por encima del plano, porque una banda más oscura que lo que la rodea
se lee como un hueco y no como una cabecera.

Va al 70% y con `backdrop-blur-md`, y **eso es lo que decide la estructura**: un
desenfoque necesita algo detrás que desenfocar. La cabecera no va antes del
scroller sino flotando encima, y el scroller reserva su alto arriba —medido con
`useMeasuredHeight`, no una constante, porque el alto sale del escalón de
tamaños y cambia con él—. Así las filas le pasan por debajo y la banda se lee
apoyada sobre la lista en vez de pintada al lado. De paso el `scroll-fade` cae
justo ahí: las filas se disuelven mientras entran debajo del vidrio.

Va declarado en la pantalla y no como token en `index.css`: ese archivo es copia
byte a byte del showcase y una variable de más lo desalinea. Si el violeta le
sirve a otra pantalla, el lugar es el registry.

La columna del nombre lleva tres cosas: el avatar, el nombre, y debajo el id de
la cuenta. El avatar es el `Avatar` de shadcn —no hay ninguno en `@wabi` ni en
`@fluid`—, y viene del estilo `base-nova`, que está sobre Base UI: no mete una
segunda librería de primitivas en un proyecto que sacó Radix a mano. Sin foto,
lo que se ve es el `AvatarFallback` con las iniciales.

Va en su escalón normal, 32px, que es lo que mide la celda de dos líneas que
tiene al lado, y el radio sale del sistema de figuras en vez de ser redondo: el
aro del componente y el plato del fallback lo heredan, así que los tres siguen
la misma esquina que el buscador y el botón de filtros.

El nombre abre un **`PeekCard` al pasarle por encima**. En reposo es texto: una
lista de 48 filas subrayadas es una lista de 48 enlaces que no lo son. El
subrayado punteado aparece con el hover y se queda mientras la tarjeta está
abierta —de ahí el `aria-expanded`, que es lo que el disparador de Base UI
marca—; sin eso parpadearía al mover el puntero del nombre a la tarjeta, que
sigue arriba. El disparador es el texto y nada más —`w-fit`—, así que el
`cursor-pointer` es lo que dice dónde está el blanco.

**El clic abre el perfil** en una pestaña nueva del workspace, con el primer
nombre y nada más —"Camila’s Profile"—: en una barra de pestañas compiten por
el ancho, y el apellido no distingue nada que el nombre no distinga ya. El id
lleva el del usuario adentro, así que abrir dos veces el mismo perfil no abre
dos pestañas. Lo que hay adentro está más abajo, en **El perfil**.

Eso obligó a controlar la apertura de la tarjeta desde afuera. Con
`openOn="hover"` el clic **también** abre —es lo único que le queda a un táctil—,
y sin cerrarla la tarjeta se quedaba flotando sobre la pestaña recién abierta: el
popup va portalado al `body`, así que esconder el panel de Accounts no lo esconde
a él. Cerrarla dentro del `onClick` tampoco alcanza, porque el handler de Base UI
corre en el mismo evento y el último que escribe gana; el cierre va en un
`setTimeout(0)`, que corre cuando el evento ya terminó.

En la cabecera de la tarjeta va **el mismo avatar de la fila** y no un glifo
genérico: la tarjeta se abre desde ahí, y repetir la cara es lo que la ata a la
fila que la disparó. Para eso `PeekCard` estrenó una prop `media`, que toma el
lugar del `icon` cuando lo que va ahí no es un ícono —un avatar, una miniatura,
una muestra de color—.

Tres pestañas, y ninguna parte un dato en dos:

- **Details**, la que abre: el tipo de cuenta —Resident o Friends & Family—,
  el id y el estado de comunicación. La **ubicación** aparece sólo para un
  residente: a alguien de afuera no se lo ubica adentro, y una fila que dijera
  "Facility Base" para un familiar sería falsa. Ese valor es un default y no una
  constante escondida — `location` existe en el modelo para el día que haya
  alas, pisos o habitaciones, y hasta entonces todos caen ahí.
- **Analytics**: conversaciones y mensajes de siempre, tasa de respuesta, tiempo
  medio de respuesta, y abajo los últimos 30 días con su variación contra los 30
  anteriores.
- **Timeline**: las fechas enteras que la tabla abrevia —«Aug 28, 2026, 9:10 AM»
  bajo el «2 h ago»—.

Del fixture salen números crudos y nada derivado: la variación se calcula de
`last30` contra `prev30`, y la duración legible de los minutos. Guardar el
porcentaje además de los dos números sería tener dos fuentes para el mismo
hecho, y tarde o temprano dirían cosas distintas — la misma regla que con las
fechas. Los valores están correlacionados con el estado: una cuenta activa se
mueve entre −31% y +38%, una desactivada cae entre −80% y −100%, y una bloqueada
llega a cero.

En el pie, dos acciones: **Reset Password** y **Block / Unblock**. Van al pie y
no al `action` del header porque ahí entra un botón corto y acá son dos. Bloquear
y desbloquear son la misma fila —una cuenta está de un lado o del otro, nunca de
los dos—, así que el botón cambia de etiqueta y de ícono en vez de aparecer al
lado de su contrario.

Bloquear **funciona de verdad**: la lista dejó de ser una constante y pasó a ser
estado vivo, así que el badge de la fila cambia, el de la tarjeta también, el
botón se da vuelta y los conteos del panel de filtros se recalculan —salen de la
lista viva y no del fixture, porque un panel que sigue diciendo los números de
antes miente sobre lo que va a devolver—. **Reset Password no hace nada
todavía**: no hay backend detrás, y cuando lo haya lo que falta es la
confirmación, no el botón.

### El perfil

Una pantalla propia —`src/pages/UserProfile.tsx`—, no una versión grande de la
tarjeta. Por ahora es **el header, sus acciones y el selector de secciones**; lo
que va adentro de cada sección se dice con el vacío que usa el resto de la app,
porque un panel en blanco no se distingue de algo roto.

El header es **quién es la cuenta**: el avatar, el nombre entero y el id debajo.
El nombre entero y no el primero —en la barra de pestañas compite por el ancho,
acá tiene la línea para él—, y el id en el mismo lugar donde lo pone la fila que
abrió esto: debajo del nombre, en el color secundario. El avatar sube al escalón
grande —40px—, que es lo que mide el bloque de dos líneas que tiene al lado,
igual que en la tabla el de 32px medía su celda. El aire lateral y el vertical
son los del header de Accounts, así que las dos pestañas arrancan a la misma
altura y contra el mismo margen. Y no hay `SizeProvider`: un perfil no es una
región densa —la tabla se declara compacta porque son cuarenta y ocho filas
peleando por el alto, y acá hay una cuenta sola—.

El header **no muestra estadísticas**. Llegó a tener tres —mensajes, tasa de
bloqueo y hora pico— en una tira de columnas separadas por un filete, y se
sacaron: son datos de la cuenta entera, y arriba de una pantalla que se recorre
por secciones terminaban compitiendo por la línea con lo único que el header
tiene que decir, que es de quién es. Los números siguen en el modelo
—`blockedMessages` como conteo crudo y `peakHour` como entero de 0 a 23, ambos
correlacionados con el estado igual que el resto del fixture— esperando el lugar
donde sí signifiquen algo: adentro de una sección.

Contra el borde derecho, **un menú y no dos botones sueltos**. Son cosas que se
le hacen a la cuenta y no cosas que la pantalla ofrece: puestas al aire pesarían
más que el nombre que tienen al lado, y son las dos infrecuentes. El disparador
es el glifo de "más", que es como esta app ya dice que hay más de lo que se ve
—el mismo de `WindowControls`—, y el panel cuelga del borde contra el que está
apoyado (`align="end"`).

Adentro, **Save user** arriba y separado: lo que se le hace al registro no es la
misma clase de acción que lo que se le hace a la cuenta, y la línea es más barata
que agrupar por costumbre. Debajo, las mismas dos del pie de la tarjeta y con la
misma regla: **Block / Unblock** es una fila sola que cambia de etiqueta y de
ícono —una cuenta está de un lado o del otro, nunca de los dos—. **Save user** y
**Reset password** todavía no hacen nada: el cuerpo editable del perfil no está
escrito y no hay backend detrás; por ahora las filas dicen que van a existir.

El panel **se ajusta a lo que dice** (`w-auto`) en vez de tomar los 288px que
trae `DropdownContent`. Ese ancho es para un menú de navegación, donde las filas
son de largos distintos y uno parejo las alinea; acá son tres acciones cortas y
dejaba media caja vacía al lado de las etiquetas. El `min-w` del anclaje sigue
puesto, así que no se angosta más que el botón del que cuelga. Va en el call site
y no en `dropdown.tsx`: ese archivo es del registry, y una desviación local se la
lleva puesta la próxima instalación.

#### Las secciones

Qué se está mirando de la cuenta: **Conversations**, **Emails** y **Support
Tickets**. Van en el header, entre el nombre y el menú, y **como columnas**: no
son un control apoyado sobre la pantalla, son una fila de datos con la misma
forma que el sistema ya usa para poner un número al lado de otro —valor arriba,
etiqueta abajo, un filete de un píxel en el medio—. La diferencia con una fila
de datos cualquiera es que estas se clickean, y que el número de cada una es
**cuánto hay adentro**: "Emails 12" dice si vale la pena entrar antes de entrar,
que es más de lo que hace una pestaña.

Se llegó ahí por descarte, y las dos que perdieron dicen por qué:

- **Un control segmentado debajo del header** encierra las opciones en una caja
  rellena y levanta la elegida como una ficha. Sirve para dos o tres variantes
  de un mismo valor —una densidad, un rango de fechas—; acá las secciones son
  lugares, y era una caja más en un header que trabajó para no tener ninguna.
  Además dejaba la pantalla en tres franjas apiladas.
- **Un riel vertical al costado** resolvía eso pero comía doscientos píxeles de
  ancho y repetía la forma del sidebar, que está tres centímetros a la
  izquierda.

Tres decisiones adentro de la que quedó:

- **Las tres miden lo mismo** (`grid-cols-3`) y no lo que mide su texto: con
  anchos distintos, "Support Tickets" contra "Emails" deja una tira que se lee
  como tres cosas de distinto peso. Con tres fracciones iguales la más ancha
  manda y las otras dos la acompañan, y la tira sigue midiendo lo que necesita
  porque el contenedor se encoge al contenido.
- **Lo elegido se marca con una barrita abajo**, que se desliza de una columna a
  otra con un `layoutId` —una sola marca en toda la fila— en vez de apagarse acá
  y encenderse allá. Sin fondo: el fondo en esta app es lo que se mueve con el
  puntero, y una selección que lo use se confunde con un hover que se quedó
  pegado.
- **El fondo es el hover por proximidad** del sistema —`useProximityHover` en el
  eje `x`, igual que `TabsList`—. No es un `:hover` por columna: hay un solo
  fondo para la fila entera que viaja hasta la más cercana al cursor, así que
  pasar de Emails a Tickets es el fondo desplazándose y no uno apagándose
  mientras otro prende. Y como resuelve por cercanía y no por contacto, la fila
  responde desde antes de que el puntero pise una columna. Crece cuatro píxeles
  para arriba y para abajo —las columnas no tienen aire propio, y un fondo
  pegado a las letras se lee como un resaltador—, y abajo termina justo donde
  empieza la barrita de la elegida. El color del texto sube a `foreground` con
  el hover y no sólo con la selección, igual que en `TabItem`: lo que está
  debajo del puntero se lee entero aunque no sea lo elegido, y lo que las sigue
  separando es la barrita.
- **El fondo llega hasta el filete, y es cuadrado.** Las dos cosas salen de lo
  mismo: una columna acá no es un objeto apoyado sobre la pantalla —una fila, un
  chip, un panel— sino un tramo de una tira que va de filete a filete. Por eso
  las columnas **no llevan `gap`**: el aire entre una y otra es padding de cada
  una y no un hueco entre ellas. Se ve igual —veinte píxeles del texto al
  filete y veinte del filete al texto siguiente— pero cambia de quién es: con
  el hueco, la caja terminaba veinte píxeles antes de la línea y el fondo se
  cortaba ahí, dejando una zanja sin pintar. Y por eso tampoco lleva el radio
  del sistema de figuras: una esquina redondeada le dibujaría un borde propio a
  algo que no lo tiene. El `-mr-5` de la tira devuelve el padding de la última
  columna, que es del fondo y no de la maqueta: sin él, el menú se iba veinte
  píxeles más a la derecha.
- **Cada sección sabe cuál de los números del modelo es el suyo** (`cuantos`),
  así que el header no lleva una tabla aparte que después haya que acordarse de
  ampliar. `emails` y `tickets` se agregaron al fixture como conteos crudos, al
  lado de `conversations`.

Ninguna está escrita todavía, y **cada una lo dice con su nombre y su glifo** —no
con un cartel genérico—: quien abre Emails y encuentra "esta pantalla no está" no
sabe si se equivocó de pestaña o si de verdad no hay nada. Los íconos no se
eligen de cero: el sobre es el de la sección Email del árbol y la llave inglesa
es la de la fila Tickets.

Tres cosas que no se ven y sin ellas la fila es tres botones sueltos:

- **Un solo punto de entrada de tabulado.** La columna elegida lleva `tabIndex 0`
  y las otras `-1`; adentro se mueve con las flechas, Home y End.
- **El foco viaja con la selección.** Si se quedara donde estaba, la próxima
  flecha se movería desde el lugar equivocado.
- **Los ids salen de `useId`.** Dos perfiles abiertos son dos copias de esto en
  la misma página, y un `conversations-panel` repetido deja el `aria-controls` de
  una apuntando al panel de la otra.

Los tres paneles se quedan **montados** y el que no se mira se esconde, que es lo
mismo que hace `WorkspacePanel` con sus pestañas y por el mismo motivo: una
sección conserva lo suyo mientras estás en otra. Hoy además arregla algo que se
ve — el vacío entra con una cascada de un segundo, pensada para una pantalla que
aterriza vacía y no para algo que se cambia tres veces seguidas. Montado una sola
vez, la cascada corre una vez y volver a la sección es instantáneo. Se esconde
cambiando la clase y no poniendo `hidden` al lado de `flex`: son las dos
`display`, y cuál gana lo decide el orden en que salieron impresas y no lo que
uno quiso decir.

El panel es **una superficie propia**, no la continuación del header: sube un
escalón de la escalera —`Elevated offset={1}`, que además se lo pasa a todo lo
que monte adentro— y arranca con las esquinas de arriba redondeadas. El borde
superior no es un `border`: es el aro que trae la escalera —`0 0 0 1px` de negro
al 6%, la primera línea de `--shadow-5`—. Con un `border-t` encima quedaban dos
filetes pegados donde el sistema dibuja uno, y el aro además sigue el radio y se
curva en las esquinas, que es lo que un borde de una sola cara no hace. En el
modo claro la escalera es plana en blanco de la tercera para arriba, así que ahí
lo que separa es el aro; en el oscuro el escalón se ve y el panel queda un tono
por encima del header. `overflow-hidden` es lo que hace que el radio se cumpla.

#### La columna de la izquierda

Las tres secciones usan el mismo mueble —una lista a la izquierda y lo elegido a
la derecha—, y el ancho de esa columna lo decide `ListPane` y no cada una: es lo
que hace que cambiar de sección no cambie de mueble. **Se puede ajustar**, entre
260 y 560 píxeles, porque lo que entra ahí no es lo mismo en las tres —un asunto
de correo es largo, una hora no— y lo que a una le sobra a otra le falta. Abajo,
lo que necesita una fila de tres renglones para no cortar el asunto en la primera
palabra; arriba, la mitad de una pantalla angosta, porque más que eso deja de ser
una lista al costado y pasa a ser la pantalla con lo elegido de invitado.

**El ancho es uno por sección**, guardado en el módulo. Que sea del módulo y no
de la pantalla es lo importante: no es estado de una vista, es cómo alguien
decidió que quiere ver esta clase de vista, y tenerlo por pantalla obligaría a
acomodarlo de nuevo en cada perfil que se abra — dos perfiles abiertos comparten
el ancho de su sección.

Y es por sección, y no uno solo para las tres, porque las tres terminaron
llevando cosas distintas: una conversación es un nombre y un renglón, un ticket
son tres renglones con badges y el último mensaje del cliente. Lo que a una le
sobra a otra le falta, y quien sabe cuánto lugar necesitan sus filas es la
sección. Conversations y Emails arrancan en 340px; **Tickets arranca un cuarto
más ancha, en 425**, que es la que más se agradece el lugar.

El tirador sigue el camino del riel de widgets: `setPointerCapture` y los
handlers enganchados adentro del `pointerdown` y no desde un efecto —pasando por
estado, un arrastre corto alcanza a moverse y soltarse antes de que React vuelva
a pintar, y los listeners llegan a una fiesta que ya terminó—. El arrastre es
**relativo**: agarrar el filete tres píxeles corrido no tiene por qué hacer que
la columna pegue ese salto al empezar. Mientras dura, el cursor manda en toda la
página y el texto no se selecciona, o cruzar la lista con el botón apretado pinta
media pantalla de azul. Y **las flechas también lo mueven**, de a 16: un tirador
que sólo responde al mouse es un control que la mitad de la gente no tiene.

En reposo no se dibuja —el filete solo ya dice dónde termina la columna— y con el
puntero encima se oscurece, que es como esta app dice "de acá se agarra".

#### Conversations

La primera sección escrita: **la lista a la izquierda, el hilo abierto a la
derecha**. Es la forma que tiene un cliente de chat porque es lo que hay que
leer: una conversación no se entiende por partes, y una lista de hilos sin el
hilo al lado obliga a ir y volver perdiendo el lugar cada vez. Los dos paneles
scrollean por separado y los separa el mismo filete de un píxel que separa todo
lo demás.

La lista es la de cualquier cliente de chat: avatar, con quién, cuándo fue el
último mensaje, y debajo el vistazo de ese mensaje con `You:` adelante cuando lo
dijo la cuenta —sin eso, "Yes please, that would be lovely" parece dicho por el
otro—. El badge de sin leer sólo aparece en el hilo más reciente y sólo si la
cuenta está activa: una bloqueada no está recibiendo nada, y un badge sobre una
cuenta apagada dice que algo la está esperando cuando no es cierto. El buscador
de arriba busca por con quién **y por lo que se dijo**: los nombres se olvidan
antes que la frase por la que uno vuelve a buscar la conversación.

Las filas usan el mismo **hover por proximidad** que las columnas del header,
esta vez en el eje `y`, y con dos capas: el fondo de lo elegido debajo y el del
hover encima, que es como lo hacen el sidebar y el dropdown.

En el hilo, la burbuja de la cuenta va en el violeta del sistema —el mismo tono
292 de la banda de títulos de la tabla y de los badges— y la del contacto en el
gris. No es un verde traído de otro chat: el violeta es el único acento que esta
app tiene, y lo que hace falta decir es "estas son suyas", no una marca. La
esquina del lado del que habla se achica, que es lo que apunta la burbuja sin
dibujar una colita. Los días van en una cápsula centrada, que es lo único de esa
columna que no es de ninguno de los dos lados.

Es de **sólo lectura**, y lo dice: esta es una consola de administración, quien
la abre está moderando y no participando, y una caja de texto abajo diría que
puede contestar en nombre de otro. La barra del pie ocupa un renglón y evita que
alguien busque medio minuto dónde se escribe.

**Cuántas conversaciones tiene una cuenta es cuántas hay en la lista.** El número
que muestra la columna del header sale de ahí, y por eso `conversations` se fue
del modelo: guardarlo además habría sido tener dos fuentes para el mismo hecho, y
la primera vez que se agregue un hilo al fixture el header diría un número y la
lista de abajo otro. La métrica del `PeekCard` de la tabla lee la misma fuente.

Los hilos —`conversaciones.ts`— están **escritos a mano** y no generados: un
texto armado con piezas sueltas se nota enseguida, todas las frases tienen el
mismo largo y ninguna contesta a la anterior, y lo que esta pantalla tiene que
probar es justamente cómo se lee una conversación de verdad. Lo que sí se reparte
es cuáles le tocan a cada cuenta, por el número del id, entre dos y cinco. El
apellido del contacto lo pone la cuenta cuando es de la familia —la hija de
Camila Ferreyra se apellida Ferreyra—, y el hilo más reciente termina cuando se
vio a la cuenta por última vez, que es el mismo hecho que la columna "Last
Activity" de la tabla.

**El movimiento** sale de los escalones de `lib/springs` y no de duraciones
inventadas: abrir una conversación es una **reacción** —algo que la persona tocó
y tiene que contestar enseguida—, que es para lo que ese archivo está. No es el
caso de `AnimatedEmpty`, que es una presentación y por eso tuvo que traerse pasos
propios más lentos. Lo único que se agrega acá es el reparto de turnos:

- **El hilo entra en cascada**, 35ms por pieza. Con seis burbujas es menos de un
  cuarto de segundo: se ve que se arma de arriba abajo y no se espera. Los días
  van en fragmentos y no en un `div` por grupo, así la pastilla y las burbujas
  son todas hijas del mismo contenedor y la cascada es una sola — con un `div` en
  el medio habría que repartir turnos en dos niveles y el orden se cruza.
- **Cada burbuja entra desde su propio lado**, las de la cuenta desde la derecha
  y las del contacto desde la izquierda. Es lo que hace que la cascada diga algo
  además de "esto es nuevo": el hilo se arma alternando y se lee de quién es cada
  una antes de leerla.
- **La cabecera del hilo no espera turno.** Es lo que contesta al clic —"abriste
  esta"— y llegar tarde a su propia respuesta la haría ver lenta: entra sola, en
  el escalón rápido, y la cascada empieza después.
- **Las filas de la lista** entran desde la izquierda, que es de donde vienen, y
  con el turno un poco más largo: son cuatro o cinco y no diez, así que se puede
  sin que se note la espera. Es sólo al montar; cambiar de conversación no
  vuelve a animarlas, porque la lista no cambió.

Todo se apaga solo con `prefers-reduced-motion`: `main.tsx` monta `MotionConfig
reducedMotion="user"`, que a estas variantes les saca lo que se mueve y les deja
lo que se enciende.

Una cosa que no se ve y sin la que la lista se rompe: `ScrollArea` mete adentro
del viewport un envoltorio con `min-width: fit-content` para que Base UI pueda
medir el ancho intrínseco de lo que scrollea. En una lista vertical eso no hace
falta y hace daño — la fila deja de achicarse, crece hasta lo que mide su texto
entero y se lleva la hora y el badge fuera del panel—. Se neutraliza desde el
`viewportClassName` con `[&>div]:min-w-0!`; el `!` es porque el estilo lo pone el
primitivo y no una clase.

#### Emails

Los mismos dos paneles que Conversations —el mismo ancho, el mismo filete, el
mismo buscador arriba— porque son dos maneras de mirar lo mismo y cambiar de
sección no debería cambiar de mueble. **Lo que cambia es lo que va adentro**, y
se lo dejó cambiar: un correo no es un mensaje de chat. Tiene asunto, viene de
una dirección, se lee entero de una vez y a veces trae algo colgado. Forzarlo a
la forma del hilo habría hecho que las dos secciones se vieran iguales cuando no
lo son.

- **La lista va agrupada por carpeta**: Inbox, Sent, Draft y Spam, en ese orden —
  primero lo que llegó, después lo que salió, después lo que no salió, y último
  lo que no debería haber llegado—. Sólo se dibujan las carpetas que tienen algo:
  un encabezado sobre una carpeta vacía ocupa un renglón para decir que no hay
  nada, y eso ya lo dice el no estar. El encabezado **se queda arriba** mientras
  la carpeta pasa por debajo: en una lista larga, saber en cuál se está mirando
  no puede depender de acordarse de lo que se leyó al pasar.

  **Los grupos se pliegan**, y el encabezado es el que lo hace. El chevron
  aparece con el hover y se queda puesto cuando la carpeta está plegada: es la
  manera de volver a abrirla, y escondido sería un grupo que se cerró y no dice
  cómo — el mismo trato que reciben los grupos del sidebar. La cuenta se queda a
  la vista plegada, que es medio motivo para plegarla. Se guardan **las plegadas
  y no las abiertas**: lo normal es que estén todas abiertas, así el estado
  inicial es "ninguna" en vez de una lista que hay que mantener al día cuando
  aparezca una carpeta nueva.

  **Cada carpeta lleva su glifo**: una bandeja, una flecha que sale, un lápiz,
  un escudo. Un sobre que llega y uno que sale se distinguen de reojo mucho
  antes que las palabras "Inbox" y "Sent", que empiezan las dos con una letra
  alta y miden casi lo mismo.

  **El correo entra un escalón respecto del encabezado** — ocho píxeles, apenas
  para que la carpeta se lea como el techo de lo que tiene debajo y no como un
  renglón más de la misma columna. Alinearlos del todo los ponía al mismo nivel,
  que es justo lo que no son. El punto de sin abrir vive **adentro de ese
  escalón** y no en una sangría propia: la columna de asuntos sigue alineada
  esté o no el punto, porque el punto nunca estuvo en el flujo.

  La carpeta es **el dato que se guarda**, y de qué lado salió el correo se
  deduce de ahí —lo escribió la cuenta si está en Sent o en Draft—. Antes se
  guardaban las dos cosas; son el mismo hecho, y con las dos guardadas el primer
  correo que cambie de carpeta las deja contradiciéndose.

  **Quien reparte los turnos de entrada es cada grupo, no la lista.** Estaba en
  la lista, y con los grupos plegables eso se volvió un bug con cara de otra
  cosa: al desplegar, el hueco quedaba del alto correcto y **las filas
  invisibles adentro**. La causa es que una fila que se vuelve a montar entra a
  un contenedor que ya está en `visible`, así que hereda el `initial` —`oculto`,
  opacidad cero— y el `animate` del padre no vuelve a correr porque no cambió.
  Con el reparto en el grupo, montarse es siempre arrancar en `oculto` e ir a
  `visible`, venga de un primer pintado o de haber estado plegado.

  Y el cuerpo del grupo **se monta y se desmonta, sin `AnimatePresence`**. Lo
  tuvo, animando la altura de `auto` a cero, y traía lo suyo: `AnimatePresence`
  deja montado al que se va hasta que termine su salida, y volver a abrir el
  grupo mientras eso pasa le pide a framer resucitar un hijo con la misma clave
  que se está encogiendo. Con cuatro grupos plegados y abiertos seguidos, los
  cuatro quedaban con la altura mal y las filas todavía montadas. Ahora sólo se
  anima la entrada: plegar es instantáneo —lo que se pliega deja de estar, que
  es lo que uno pidió— y sin salida no hay a quién resucitar.

  Un detalle que no se ve y que costó otro bug: el índice de cada fila para el
  hover por proximidad es **su lugar en la lista sin agrupar**, no el orden en
  que termina dibujada. Numerar por orden de dibujo parece lo natural —el hook
  mide una columna— y rompe al plegar: la fila que estaba abajo hereda un índice
  que otra acaba de dejar, y como la que se va sigue montada mientras dura su
  animación de salida, su limpieza corre *después* y borra el registro recién
  hecho; el fondo desaparece hasta la próxima remedición. Con el índice atado a
  la fila, plegar sólo deja huecos en la lista de medidas —que el hook ya sabe
  saltear— y ningún registro pisa a otro.
- **La fila lleva tres renglones** —con quién y cuándo, el asunto, el vistazo del
  cuerpo— en vez de los dos del chat. El punto de sin abrir va en el margen y no
  adentro del texto: es un estado de la fila entera, y el lugar se le guarda
  siempre, así que la columna de asuntos queda alineada esté o no el punto. El
  clip aparece sólo cuando hay algo colgado.
- **`To:` adelante cuando el correo salió de la cuenta.** Sin eso la fila diría
  que se lo mandaron.
- **El correo abierto entra en un bloque y no en cascada.** Un correo es una cosa
  sola —un asunto, un cuerpo, una firma—, no una serie de piezas que llegaron una
  detrás de otra; escalonarlo diría algo falso sobre lo que es. Lo único que se
  separa es la cabecera del cuerpo, medio suspiro.
- **La fecha del correo abierto lleva año**, la de la lista no: un correo se
  archiva, y "Aug 27" sin año deja de servir en enero.
- **El cuerpo se corta en `68ch`.** Lo que hace legible una columna de texto es
  cuántos signos entran en un renglón, no cuánto mide en pantalla.
- **Los adjuntos no son botones.** No hay de dónde bajarlos: decir que hay algo
  colgado y cuánto pesa es todo lo que esta pantalla puede prometer hoy, y un
  botón que no descarga es peor que ninguno.
- **Abrir un correo no lo marca como leído.** En un cliente de verdad sí; acá
  quien lee está moderando, y marcarlo cambiaría el buzón de otro por haberlo
  mirado. Es la misma regla que el pie: esta consola no toca nada.

La dirección que va debajo del nombre es la **del que escribió**. El modelo
guarda una sola —la del contacto— y de qué lado salió el correo, y con esas dos
se sabe cuál va arriba y cuál abajo; la de la cuenta se deriva del nombre, porque
en esta residencia el buzón de un residente **es** su nombre y guardarlo aparte
sería tener dos lugares donde arreglar un apellido mal escrito.

Como con las conversaciones, **cuántos correos tiene una cuenta es cuántos hay en
la lista**, así que `emails` también se fue del modelo. `tickets` sigue ahí: es un
total suelto hasta que esa sección se escriba.

Los formateadores de "cuándo fue" viven en `tiempo.ts` y no adentro de una de las
dos secciones: las dos tienen que decirlo igual, y dos formatos distintos para el
mismo instante, uno al lado del otro, se leen como dos hechos distintos.

#### Support Tickets

Mismo mueble que las otras dos, y otra vez un adentro distinto — pero esta vez
el adentro se parte en dos lugares.

**El cuerpo del ticket es un chat**, porque eso es: una conversación entre el
residente y el que lo atiende. Las burbujas son las mismas que en Conversations
y a propósito: adentro de este perfil, el lado derecho es siempre esta cuenta.
Que del otro lado esté recepción y no la hija no cambia de qué lado está quien
abrió el ticket. Lo único que se agrega es **el nombre encima de la burbuja
ajena**: en un chat de dos no haría falta, pero acá del otro lado puede haber
recepción, mantenimiento o el equipo de cuidados según la novedad.

**El ticket no es de sólo lectura**: desde el chat se contesta, se cierra y se
reabre. Lo que se puede hacer está en una **barra flotante** sobre la
conversación —`components/floating-actions.tsx`—, no en un pie fijo:

- **Flota en vez de ocupar una franja.** Lo que hay detrás es lo que importa, y
  una barra en el flujo le come alto al contenido para siempre; esto sólo tapa
  un rato y cuando hace falta.
- **Se arrastra**, y **se desvanece cuando nadie la usa** — las dos por lo
  mismo: flota sobre algo que se está leyendo. Por bien puesta que esté va a
  tapar algo que alguien quiera ver, y poder correrla es más barato que adivinar
  dónde molesta menos; en reposo baja a 0.45 de opacidad y con el puntero encima
  —o con el foco, que quien llega con el teclado también la está usando— vuelve
  entera. Abierta como campo o como lista no se desvanece: eso ya no es reposo.

  La cancha del arrastre es lo que la barra cubre, y es **la misma caja que la
  posiciona**: el lugar de reposo y el límite de hasta dónde se puede correr son
  uno solo y no dos que hay que mantener de acuerdo. Sin inercia —esto no es una
  tarjeta que uno tira, es un mueble que se corre— y con un poco de elástico
  contra el borde para que se note dónde termina. No arranca desde el campo ni
  desde el cuerpo de la lista: ahí adentro arrastrar es seleccionar texto o
  scrollear, así que el evento se corta ahí en vez de apagar el arrastre para
  toda la caja. El panel se sigue agarrando de su encabezado, que es de donde se
  agarra un panel.
- **Cuatro acciones en dos por dos, con filetes en el medio.** Cuatro botones
  seguidos son cuatro cosas de la misma importancia peleando por el ancho; en
  grilla cada una tiene su celda y el bloque se lee como un solo objeto. Los
  filetes los dibuja un `gap` con el fondo del borde detrás, no un `border` por
  celda: eso deja líneas dobles en el medio y sueltas en los extremos.
- **Reply no hace algo: convierte la barra en un campo**, y al mandar vuelve a
  ser la barra. Es lo que evita un cuadro de texto ocupando lugar todo el tiempo
  para algo que se usa de a ratos, y hace que escribir se sienta como una
  continuación de la barra y no como otro mueble que apareció. El campo abierto
  y vacío después de enviar es un cursor esperando algo que ya se dijo, y encima
  tapa la respuesta recién agregada — que es justamente lo que uno quiere ver.
- **La transformación se anima en los dos sentidos.** El `layout` va en la caja
  que de verdad cambia de tamaño y no en el contenedor de posición, que ocupa
  todo el ancho y no tiene nada que animar; lo que se ve es la caja bajando de
  dos filas a una. El ancho es el mismo en los dos estados a propósito:
  cambiarlo además la movería para los costados mientras se pliega, y dos
  movimientos a la vez se leen como un salto.

  El intercambio va con `mode="wait"` y no con `popLayout`. Con `popLayout` el
  saliente pasa a `absolute` mientras la caja ya se plegó, y adentro de un
  `overflow-hidden` eso son dos bloques encimados y recortados durante toda la
  salida. El hueco que deja `wait` lo tapa el `layout`: mientras uno sale y
  entra el otro, la altura está interpolando, así que lo que se ve es el bloque
  plegándose. Por eso las transiciones de adentro son cortas — lo que dura la
  transformación es la de la caja.
- **Un ticket cerrado no recibe respuestas**, así que Reply queda apagado:
  contestarle sería dejar un mensaje en algo que ya nadie mira. No hace falta
  explicar por qué está apagado — al lado está *Reopen ticket*, que es lo que
  hay que hacer primero. Y si el ticket se cierra desde otro lado mientras el
  campo está abierto, se pliega: un cursor parpadeando sobre algo que ya no
  acepta texto promete algo que no va a pasar. El ajuste se hace **al derivar**,
  en el mismo render, y no en un efecto que pintaría una vez el campo que no
  corresponde para sacarlo después — el mismo patrón que la ventana de la tabla
  de Accounts cuando cambia lo filtrado.
- **Enter manda, Escape pliega**, y el campo se pliega solo si pierde el foco
  estando vacío. Con algo escrito se queda: perder un borrador por mirar para
  otro lado es la peor manera de perderlo.
- **Close / Reopen es una fila sola** que cambia según el estado, la misma regla
  que Block / Unblock en el menú del header. El cambio entra **como una novedad
  más** y no como un campo que se pisa por afuera: así el ticket cuenta lo que
  le pasó, que es lo que la historia del board está para mostrar.
- **Show activity convierte la barra en una lista**, del mismo modo que Reply
  la convierte en un campo — pero **contra el borde derecho**. Eso es lo que la
  separa de las otras dos formas: no es la barra con otra cara, es algo que se
  corrió a un costado para dejar ver la conversación que hay detrás. Ahí sí
  cambia de ancho *y* de lado, y los dos movimientos son el mismo gesto en vez
  de dos que compiten. Lleva un botón para cerrarla y volver a la barra: es lo
  único de los tres estados que no se cierra solo —el campo se pliega al mandar
  y al perder el foco vacío—, porque mirar una lista termina cuando el que mira
  lo dice. Tope de alto y scroll adentro: un ticket con veinte novedades no
  puede empujar la caja hasta arriba de todo y tapar la conversación que vino a
  acompañar.

  Es **la misma historia que va al board**, no una segunda: el board la tiene
  siempre al costado mientras se lee, y esto es el vistazo para el que no tiene
  el riel abierto. Acá va la versión completa —también las novedades que no
  movieron el estado— porque acá se la pidió; en el board es un resumen que
  acompaña, y esto es haber preguntado.
- **Save ticket todavía no guarda nada.** No hay backend y no hay nada editable
  en la ficha; está por lo mismo que `Save user` en el menú del header.

Las respuestas salen a nombre de **Support** y no de quien está asignado: hasta
que haya una sesión con nombre, firmar con el de otro sería ponerle palabras en
la boca. Y como ahora hay tres lugares que tienen que decir lo mismo —el chat,
la fila de la izquierda y los widgets del board—, y dos de ellos ni siquiera
están en el mismo árbol de React, los tickets pasaron a una **tienda de módulo**,
igual que los usuarios.

**La ficha y la historia de estados se fueron al board.** No son la
conversación: son lo que hay que tener a la vista *mientras* se la lee, que es
exactamente el trabajo del riel —"cómo va esto", al costado de "qué estoy
mirando"—. Puestas arriba del chat lo empujaban media pantalla para abajo.

- **Ficha** (`2x1`): estado, prioridad, categoría, quién lo tiene, cuándo se
  abrió. *Unassigned* se dice con todas las letras: un renglón en blanco parece
  roto, y esconderlo hace creer que alguien lo tiene.
- **Activity** (`2x2`): quién lo tocó, cuándo, y a qué estado lo movió — **sin
  el texto de los mensajes**, que está en el chat. Repetirlo haría del board una
  segunda copia de la conversación en vez de su resumen. El punto relleno marca
  dónde cambió el estado y el hueco dónde sólo se dijo algo, así la columna se
  recorre con el ojo buscando los cambios. La vista entera del widget —la que se
  abre como pestaña— sí lleva las novedades que no movieron nada: ahí hay lugar.

**Los cuatro estados** son New, Open, Pending y Closed, en ese orden, que es el
del ciclo de vida: *New* se lo gana solo, por no haber pasado nada todavía;
*Open* es que hay ida y vuelta; *Pending* es esperando algo que no depende de
soporte —una respuesta del residente, un repuesto, una semana para ver si vuelve
a pasar—; *Closed* es terminado, y el único terminal.

**Al lado del buscador hay un filtro**, el mismo `FilterMenu` de la tabla de
Accounts, con tres atributos:

- **Status**, con los cuatro y su conteo. Los conteos salen de las filas vivas y
  no de una constante: un panel que sigue diciendo los números de antes miente
  sobre lo que va a devolver.
- **Created**, el tramo en que se abrió el ticket — los mismos cortes que "Date
  added" en Accounts, porque lo que uno pregunta de una fecha es casi siempre
  "¿esta semana? ¿este mes?" y no un rango exacto. Con `single`: un tramo de
  tiempo no se acumula con otro, "esta semana o este mes" es "este mes".
- **Sort**, Newest u Oldest. Es un atributo del panel y no un control aparte
  porque se usa igual que los otros dos —se abre el mismo menú, se elige un
  valor, la lista se rehace—; un selector suelto al lado sería un segundo lugar
  donde buscar lo mismo. También `single`: dos órdenes elegidos a la vez no son
  un orden.

Ordena por **lo que se movió último**, que es lo que muestra el renglón de la
derecha de cada fila: ordenar por otra cosa dejaría esa columna de horas
desordenada. *Oldest* da vuelta el mismo criterio, no lo cambia.

El buscador y el filtro van en la misma fila —el campo se lleva lo que sobra y
el botón mide lo suyo—: los dos recortan la misma lista, y ponerlos en dos
renglones haría creer que son dos cosas.

De la lista: arriba el nombre —o el asunto, según la pantalla— con cuándo se
movió, y **debajo lo último que dijo el cliente**. No la última novedad: entre lo
que dice soporte y lo que dice quien abrió el ticket, lo que hace falta para
decidir a quién atender primero es lo segundo. La **referencia no está en la
fila**: es un número que nadie lee al recorrer una lista, y sigue en la cabecera
del chat, que es donde uno la busca cuando se la dictan por teléfono —el buscador
igual la sigue comparando primero—. **Los que siguen vivos pesan más**, porque en
una lista de seis lo que importa es cuáles todavía piden algo; y **la prioridad
sólo se dibuja cuando es alta**, porque un badge que dice "Normal" en cinco filas
de seis no informa, ocupa.

**Una de cada cuatro cuentas no abrió ninguno**, y está bien: la mayoría de la
gente no abre tickets, y una sección que nunca se ve vacía esconde el único
estado que casi siempre es el verdadero. El vacío lo dice así — *That's the
usual case*.

Con esto `tickets` también se fue del modelo, y las tres columnas del header
cuentan sobre la lista que abren. `Usuario` quedó con lo que de verdad es de la
cuenta y no de una de sus secciones.

##### Cómo una pantalla llega al board

El board vive en el shell y no en las pantallas, y está bien que así sea: es un
lugar de la ventana, no de lo que se está mirando. Pero la ficha del ticket
abierto sólo la conoce la pantalla, y pertenece al board y no al cuerpo. Sin una
puerta, eso obliga a elegir entre meterla al medio del contenido o no tenerla.

La puerta es `BoardProvider` —`components/board-context.tsx`—, una sola función:

```tsx
board?.mostrarWidgets(tabId, widgets);
```

Tres decisiones adentro:

- **Va con el id de la pestaña adentro, no con "la activa".** Todas las pestañas
  siguen montadas cuando no se las mira —así conservan lo suyo—, y una pantalla
  escondida que escribiera sobre la activa le pisaría el board a la que sí se
  está mirando. Por eso el id se arma una vez en `tabDePerfil` y viaja también
  adentro del contenido.
- **Reemplaza y no agrega.** Lo que la pantalla aporta corresponde a lo que se
  está mirando, y cuando eso cambia lo de antes ya no corresponde.
- **Compara por identidad del array, no por los ids de adentro.** Cuando el
  ticket cambia de estado los widgets son otros —otro `glance`, otros datos— pero
  se siguen llamando igual, así que comparar ids se comía justamente la
  actualización que había que hacer. La pantalla los memoriza, así que la misma
  lista llega como el mismo array y no se escribe nada.
- **No toca `open`.** Poner algo y decidir si se ve son dos cosas distintas, y
  mezclarlas haría que actualizar la ficha del ticket le vuelva a abrir el riel
  en la cara a quien lo había cerrado.

Es el mismo movimiento que hizo `WorkspaceProvider` con las pestañas: levantar
al shell lo que el shell ya tenía, y dejar que cualquiera lo pida sin encadenar
props hasta ahí.

### La pantalla de Tickets

La fila `Tickets` del sidebar abre **los tickets de toda la residencia**, no los
de una cuenta. Es **el mismo panel** que la sección del perfil —`PanelDeTickets`:
la lista a la izquierda, el chat a la derecha, la ficha y la historia en el
board— y lo único que cambia es qué tickets se le pasan y qué dice el renglón
grande de cada fila.

En el perfil ese renglón es **el asunto**, porque de quién es el ticket ya lo
dice la pantalla entera. Acá los tickets son de todos, así que es **el nombre de
quien lo abrió**: lo primero que hay que saber en una cola de soporte es a quién
se está por atender. El asunto no se pierde — sigue en la cabecera del chat, que
es donde uno mira después de haber elegido.

Que sea un componente y no dos pantallas parecidas es lo que evita que arreglar
algo acá haya que arreglarlo dos veces. Y como detrás hay **una sola tienda**,
contestar o cerrar desde esta pantalla cambia el mismo ticket que muestra el
perfil de esa cuenta.

Van ordenados por **lo que se movió último** y no por el id: una cola de soporte
se lee por lo que pasó recién, no por quién entró primero al padrón.

Y con el panel compartido viene todo lo suyo: la **barra flotante** con Save /
Close-Reopen / Show activity / Reply, la ficha y la historia en el board, y las
respuestas cayendo en la misma tienda — contestar desde la cola aparece en el
perfil de esa cuenta y al revés.

Montarlo directo como pestaña destapó un bug de layout que adentro del perfil no
se veía: la raíz del panel era `flex min-h-0 flex-1`, y `flex-1` necesita un
padre flex contra el cual medir. En el perfil lo tenía —la sección cuelga de una
columna flex—; como pestaña su padre es el panel del workspace, un bloque con
`overflow: auto`. Sin altura definida la raíz creció hasta lo que medía la lista
entera —seis mil trescientos píxeles con setenta y tres filas—, los `ScrollArea`
de adentro nunca entraron a jugar y **la barra flotante quedó cinco mil píxeles
debajo del pliegue**. Con `h-full` además de `flex-1` el panel mide lo que mide
su hueco, venga de un flex o de un bloque.

Dos cosas que hubo que tocar del shell:

- **`render` de una hoja del árbol recibe el id de su pestaña.** Una pantalla que
  pone algo en el board tiene que poder decir en cuál, y no alcanza con el id de
  la hoja: una copia —`tickets#2`— es otra pestaña con otro board. `toTab` lo
  pasa, y duplicar pasa el nuevo.
- **El archivo se llama `SupportTickets.tsx` y no `Tickets.tsx`**, por una razón
  boba y real: en macOS el sistema de archivos no distingue mayúsculas, y
  `Tickets.tsx` y `tickets.ts` —el fixture— serían el mismo archivo para el
  compilador.

#### Por qué los usuarios se mudaron a un módulo

La lista vivía en un `useState` adentro de `Users`. Con el perfil eso deja de
alcanzar: la tabla y el perfil son **pestañas hermanas**, no una adentro de la
otra, así que no hay un árbol de React que las dos compartan y por donde bajar
un estado. Cada una tendría su copia, y bloquear desde el perfil dejaría a la
tabla diciendo "Active" sobre una cuenta bloqueada.

Así que el dominio —qué es un usuario, qué estados hay, el fixture— se fue a
`src/pages/usuarios.ts`, y con él una tienda mínima: una variable, un `Set` de
oyentes y `useSyncExternalStore`. Que cada pestaña sostenga lo suyo vale para lo
que es **de la vista** —el filtro, el scroll, qué se está mirando—; el estado de
una cuenta no es de la vista, es el mismo hecho para todo el que lo mire.

Es una tienda de veinte líneas a propósito: lo que hay para compartir es una
lista de mentira hasta que haya API, y traer una librería de estado para eso es
cargar un camión para mudar una silla. La otra cara de lo mismo es que el perfil
toma el **id** y no el usuario: la pestaña se guarda tal cual en el workspace y
no se vuelve a armar, así que un usuario pasado por prop sería una foto del
momento del clic. Con el id va a buscarlo a la tienda en cada pintada, y dice
siempre lo mismo que la tabla.

La tabla no se pagina: **se sigue**. Un centinela al final de la lista y un
`IntersectionObserver` que pide el próximo tramo cuando se acerca. Tres cosas
que no son obvias y que sin ellas no anda:

- **La raíz del observer es la caja que scrollea, no el viewport.** Contra el
  viewport el `rootMargin` no sirve de nada: un ancestro que recorta deja al
  centinela fuera de la intersección aunque caiga dentro del margen, y el tramo
  llega recién al tocar fondo. La caja se busca subiendo desde el centinela, no
  nombrando al panel: la pantalla no tiene por qué saber quién la contiene.
- **El observer se rearma después de cada tramo.** Un `IntersectionObserver`
  avisa cuando la intersección *cambia*, y al agregar filas el centinela sigue
  visible, así que no vuelve a avisar nunca: la lista se planta a la mitad.
- **Una pestaña que no estás mirando sigue montada**, escondida con
  `visibility`, y un observer no mira la visibilidad. Sin el chequeo, una copia
  de esta pantalla en segundo plano se trae la tabla entera sin que nadie
  scrollee.

Y cambiar lo filtrado vuelve arriba y reinicia la ventana, las dos cosas: si no,
filtrar desde el fondo deja la vista a la altura de la fila 40 de un resultado
que recién empieza, y el centinela pide tramo tras tramo hasta alcanzarla.

Los tres filtran lo mismo y la tabla se recalcula con lo que quede: la búsqueda
por nombre **y por id** —si el id está a la vista, alguien lo va a pegar ahí—, y
el panel por atributo —entre atributos, Y; entre los valores de un mismo
atributo, O—.

Las fechas se guardan una sola vez y en ISO. La etiqueta que se ve —"3 h ago",
"Yesterday", "Aug 12"— y el tramo con el que filtra el panel salen las dos de
ahí, así que no pueden contradecirse: no hay manera de que una fila diga
"yesterday" y el filtro de "Last 7 days" la deje afuera. `HOY` es un valor fijo
y no `new Date()`: con un hoy que se mueve solo, la fila de "hace dos horas"
pasaría a decir "hace tres meses" sin que nadie toque nada. Cuando los usuarios
salgan de una API, eso se va con ellos.

Y los estados de comunicación viven en una sola constante: la etiqueta que se
lee en la tabla, el color del punto en el panel de filtros y el color del badge
son tres vistas del mismo dato, no tres listas que se contradicen.

## La pantalla de Email Search

`Email › Search` son **los correos de toda la casa**, no los de una cuenta. Es
el mismo mueble que Accounts Search —header con la búsqueda y el `FilterMenu`,
la tabla debajo, la densidad declarada una vez con un `SizeProvider compact`,
la cabecera flotando sobre el scroller con su banda de vidrio— porque son dos
maneras de buscar en la misma consola, y cambiar de fila del sidebar no debería
cambiar de mueble. Lo que cambia es lo que hay adentro, que es lo único que
tiene por qué cambiar.

**Tres columnas y no seis.** El autor, el asunto, y cuándo salió.

- **Autor**: la dirección y nada más. Sin avatar, sin nombre y sin el buzón de
  la cuenta debajo. Una dirección es lo que se busca y lo que se pega en la
  barra de arriba; todo lo demás alrededor la haría más difícil de encontrar, no
  más fácil. De quién es la dirección se deriva de la carpeta: si el correo
  salió de la cuenta, el autor es la cuenta.
- **Asunto**: se lleva la mitad del ancho, porque es lo único que se lee para
  decidir. Las marcas van en su misma línea y pegadas a él —el clip con el
  número de adjuntos, `Legal`, `Rejected`—, no estiradas contra el borde
  derecho: ahí dejarían de leerse como parte del asunto. Y se pintan sólo
  cuando dicen algo: un badge `Standard` en cada fila de una tabla de sesenta es
  ruido con forma de dato.
- **Date Sent**: hace cuánto, en relativo, en un solo renglón. Es lo que uno
  quiere saber de un correo —cuán reciente es— y la fecha exacta casi nunca:
  "Apr 9" obliga a restar mentalmente para llegar a lo que "4 mo ago" ya dice.
  La fecha entera no se pierde, va en el `title`. La escalera se aprieta a
  medida que se aleja —horas, días, semanas, meses, años— porque a nadie le
  sirve "hace 47 días", y los meses se cuentan por calendario y no dividiendo
  días: un mes no mide 30.

### Dos hechos nuevos en el modelo

Un correo ganó **de qué es** —`standard` o `legal`— y **si la moderación lo
frenó**. Van separados a propósito: un legal puede rebotar y uno cualquiera
también, así que meterlos en un campo sería inventar que son excluyentes. El
tipo viaja con su etiqueta y su color en `TIPOS_EMAIL`, por lo mismo que los
estados de una cuenta viven en `ESTADOS`: la etiqueta que se lee, el color del
badge y el punto del panel de filtros son tres vistas del mismo dato.

`ENTREGAS` es la lectura del booleano —dos palabras para `rechazado`— y vive
al lado, para que la tabla y el panel digan lo mismo. Y la dirección de quien
escribió no se guarda: `autorDe` la deriva de la carpeta y del dueño del buzón.
Guardarla además sería el mismo hecho dos veces, y el primer correo que cambie
de carpeta los deja peleados.

`todosLosEmails` junta los de todas las cuentas ordenados por fecha, **sin
tienda** —a diferencia de los tickets—: un correo no cambia desde la consola,
así que `emailsDe` devuelve siempre la misma lista y alcanza con memorizar
contra los usuarios.

### La tarjeta del autor es la de Accounts

Pasarle por encima a la dirección abre **el mismo `PeekCard` que abre el nombre
en Accounts Search**: Details, Analytics, Timeline, y el pie con Reset Password
y Block. La cuenta es la misma cosa se la mire desde donde se la mire, así que
la ficha que la cuenta también; dos copias serían dos fichas del mismo hecho
que un día dicen cosas distintas. Para eso `TarjetaUsuario` se exporta y recibe
su disparador como `children` —allá el nombre, acá la dirección—, y las
acciones escriben en la misma tienda: bloquear desde acá se ve en Accounts.

Una cosa que conviene saber: la tarjeta es **la del dueño del buzón**, que en un
correo que entró no es el de la dirección que se ve. La fila es de una cuenta,
y los remitentes de afuera no están en el padrón.

### El correo se abre en el riel

La fila entera abre el correo en un `LateralPreview`, que es el lugar del riel
para mirar **una** cosa: el board dice cómo va todo, el preview dice qué es
esto. El asunto y la carpeta suben a su header en vez de repetirse adentro,
porque acá el correo tiene una columna y no media pantalla.

El cuerpo es el mismo que muestra la sección Emails del perfil —avatar con las
iniciales del remitente, su dirección, a quién fue, la fecha entera con año, los
párrafos, y los adjuntos como chips con nombre y peso—. Un correo leído desde la
búsqueda y el mismo correo leído desde la cuenta no son dos cosas. Los chips no
son botones: no hay de dónde bajarlos, y un botón que no descarga es peor que
ninguno.

**Los legales no muestran su contenido.** Aparecen enteros como registro —de
quién, para quién, cuándo, en qué carpeta— porque eso es lo que hay que poder
auditar; lo que no se abre es lo que dicen. En lugar del cuerpo va un
`AnimatedEmpty` con marco punteado —el que este sistema usa para el hueco que
espera algo— diciendo por qué. Los adjuntos tampoco se listan: un adjunto
también es contenido.

El preview es **de la pestaña que lo abrió**: el `PreviewProvider` guarda uno por
scope, así que dos copias de esta pantalla no se pisan el vistazo.

El pie lleva a **este mismo correo adentro de la cuenta**. `tabDePerfil` toma la
sección y el id del correo, el perfil los pasa a la sección y `UserEmails` abre
en ese. Las dos cosas son sólo estado inicial: a partir de ahí lo que se mira es
de quien está mirando. Nada de eso va en el id de la pestaña —el id es la
identidad, y `profile/USR-1042#emails` al lado de `profile/USR-1042` serían dos
pestañas para la misma cuenta—, y la contracara es que pedir un perfil que ya
está abierto lo trae donde estaba.

La dirección del autor sigue llevando a la cuenta y le corta la propagación al
clic, así que no dispara además el riel. La caja que lo frena llega hasta donde
llega el texto: el resto de esa celda abre el correo como cualquier otra parte
de la fila.

### Se pagina, no se sigue

De a 40, con el `Pagination` del registry. El pie va afuera del scroller y
pegado abajo —es del mueble, no de la lista—, así que se pagina desde donde
estés. A la izquierda el rango y el total, que el pager no dice.

Ese rango **rueda con la página**, en el mismo idioma que el número del pager
que tiene al lado: el que se va sale hacia donde va la página, el que llega
entra desde el otro lado, y los dos cruzan desenfocados. La dirección viene del
número y no del botón —la misma decisión que toma `Pagination` por dentro—, así
que volver a la primera al filtrar rueda para el lado correcto. Dos textos que
cambian por lo mismo y se mueven distinto se leen como dos cosas que no tienen
que ver.

Cambiar de filtro vuelve a la primera página, al derivar y no en un efecto, y la
página se acota contra el total: si estabas en la 7 y el filtro deja 4, caés en
la última que existe en vez de mirar una tabla vacía sobre un pager que dice
"7 of 4". Cambiar de página vuelve arriba: una página que empieza a la altura de
la fila veinte parece cortada.

### El movimiento

**No hay cascada.** Una cascada cuenta un orden —"esto llegó primero, después
esto"— y en una tabla de búsqueda ese orden es mentira: los resultados no
llegaron en fila india, estaban todos ahí. Lo que entra es **el texto de cada
celda**, desenfocado y enfocándose, todas al mismo tiempo. Es el gesto de algo
que termina de resolverse.

Va en el texto y no en la fila: la fila es también su borde de un píxel y el
fondo del hover, y desenfocar un borde de un píxel lo hace desaparecer. Las
marcas del asunto llegan con un zoom más marcado —son insignias, y algo que
aparece creciendo se lee como algo que se le puso encima a la fila—.

El correo del riel sí entra por bloques, con medio suspiro entre uno y otro: es
el mismo reparto que usa el correo abierto del perfil, porque un correo es una
cosa sola y escalonarlo renglón por renglón diría algo falso sobre lo que es. Y
lleva el id del correo como `key`: abrir otro es cambiar de contenido, no
actualizarlo, y sin eso ni la entrada ni el scroll del riel se enterarían.

Todo sale de `lib/springs` —esto es una reacción, alguien tocó algo— y se apaga
solo con `prefers-reduced-motion`, salvo donde hay desenfoque: `reducedMotion`
saca el `transform`, no el filtro, así que el rango del pie elige sus variantes
a mano, igual que el pager.

### Dos cosas que sólo se ven probando

- **A un `span` inline no le aplica el `max-w-full` que lo recortaría.** El
  disparador de la tarjeta es un span, y suelto en la celda no se cortaba: con
  el panel angosto la dirección se metía en la columna del asunto. Adentro de
  una caja flex se convierte en ítem y ahí sí se recorta — es la misma caja que
  usa Accounts alrededor del nombre.
- **Un `svg` es un bloque**, se lo deja así el preflight de Tailwind, y el badge
  mete todo lo que le pasan en un solo span de texto: el clip y el número
  quedaban apilados uno arriba del otro. Van juntos adentro de su propia caja.

## La pantalla de Provisioning

`Email › Provisioning` son **los buzones que la casa dio de alta**. Es el mismo
mueble que Email Search —header con la búsqueda y el `FilterMenu`, la tabla
debajo, la densidad declarada una vez con un `SizeProvider compact`, la cabecera
flotando sobre el scroller con su banda de vidrio, y el pie con el rango y el
pager— porque son dos maneras de mirar el correo de la misma consola. Lo que
cambia es qué hay adentro, que es lo único que tiene por qué cambiar.

**Cinco columnas**, y ninguna es el asunto de nada: acá no hay mensajes. Un buzón
es una dirección, de quién es, quién se la dio, cuándo, y si anda.

- **Name**: el nombre de la persona, o el del área. Cuando el buzón es de
  alguien, el nombre es también el disparador de **la misma ficha que abre el
  nombre en Accounts y la dirección en Email Search**: la cuenta es la misma cosa
  se la mire desde donde se la mire. Los buzones de la casa no son de nadie, así
  que ahí el nombre es texto y no hay ficha que abrir. No se inventa un residente
  detrás de `reception@` para que las filas se vean todas iguales: se ven
  distintas porque no son lo mismo.
- **Email**: la dirección entera, sin adornos. Es lo que se busca y lo que se
  pega en la barra de arriba.
- **Creator**: quién lo dio de alta. Un nombre y no un id —el que lee esta tabla
  conoce a las cuatro personas que provisionan buzones acá— y en el gris de la
  fila: es del registro, no del buzón, y compite con el nombre de la izquierda si
  se lo pinta igual.
- **Created At**: el día entero, no en relativo. Un alta no se lee como un
  correo: lo que se pregunta no es cuán reciente es —casi ninguno lo es— sino de
  cuándo data, y "hace 11 meses" no ubica a nadie en un calendario. Es la misma
  fecha, escrita igual, que la columna Date Added de Accounts, y por eso el
  formato se mudó a `tiempo.ts`: dos maneras de escribir el mismo día, en dos
  pantallas hermanas, se leen como dos hechos distintos.
- **Status**: `Active`, `Suspended` o `Inactive`, en badge con punto —y se
  **edita ahí mismo**, ver abajo—. Es la columna que uno barre buscando el que no
  dice "Active", y el color es lo que la hace barrible. Acá sí se pinta el estado
  normal, a diferencia del tipo de un correo: son tres estados y ninguno es el
  silencio.

### El estado se cambia en la celda

Suspender un buzón es lo que se viene a hacer a esta pantalla —dar de alta es lo
otro—, así que la celda de estado no lo muestra: lo edita. Mandar a alguien a
abrir una ficha para cambiar una palabra que ya está en la fila es hacerle dar
una vuelta alrededor de la mesa.

**El disparador es el badge mismo**, sin caja ni control alrededor: en reposo la
columna se sigue leyendo como una columna. Lo que dice que se puede tocar es un
chevron que aparece con el hover de la fila y se queda mientras el menú está
abierto —el mismo trato que la fila del sidebar le da a su `+`—. Pintado en las
cincuenta filas sería ruido; sin él, un secreto. El menú ofrece **los tres
estados con el actual marcado** (`menuitemradio`, no acciones sueltas): es un
estado de tres valores y no un interruptor, así que no hay una acción que lo dé
vuelta, hay adónde llevarlo. Los puntos de color son los mismos del badge y los
del panel de filtros, porque son el mismo dato.

Elegir uno le da un beat al cambio: el estado va como `key` del badge, así que
volver a montarlo lo hace entrar con el mismo zoom con el que llegó la primera
vez.

Los puntos del menú están alineados con su etiqueta, y hubo que ir a buscarlo a
`color-dot.tsx`: `punto` se dibujaba como caja **inline**, así que se alineaba
por la línea de base del renglón y no por el medio de la fila —dos píxeles abajo
del texto en el panel de filtros, cinco arriba adentro de un `MenuItem`, que lo
mete en una celda de grilla—. Un ícono de este sistema es un bloque —así deja el
preflight de Tailwind a un `svg`, y por eso los de lucide sí caían centrados—,
así que el punto pasó a `flex`. Estaba torcido desde antes en los cuatro paneles
de filtros; se enderezaron todos con eso. Y como todo sale de la misma lista, el badge, los conteos del panel de
filtros y el rango del pie cambian juntos —si estabas filtrando por `Suspended`,
la fila que dejaste en `Active` se va de la tabla, que es lo que el filtro
promete—.

Eso obliga a una tienda, y es la diferencia con los correos, que no la tienen: un
correo no cambia desde la consola y un buzón sí. Suspender un buzón no es una
decisión de la vista, así que no puede vivir en un `useState` de la pantalla —dos
copias de la pestaña dirían cosas distintas del mismo buzón—. Es la tienda mínima
de `usuarios.ts` —una variable, un `Set` de oyentes, `useSyncExternalStore`— con
una diferencia: guarda **sólo lo que se cambió**, contra la dirección, y no la
lista entera. La lista se arma de los usuarios vivos, y una copia acá se
despegaría de ellos el día que se dé de baja a alguien. `cambiarEstadoBuzon` toma
la fila y no la dirección sola porque también necesita el estado que tiene ahora:
pedir el que ya tiene no es un cambio.

### El alta pasa adentro de la tabla

Tocar **New mailbox** no abre nada: la tabla crece. Arriba aparece un renglón
para escribir —con las cuentas colgando mientras se escribe— y cada una que se
elige cae como una **fila borrador**, con la forma exacta que va a tener cuando
exista: su dirección derivada, quién la crea, la fecha de hoy, y el estado con el
que nace. Eso es lo que decidió esta forma y no un panel al costado: lo que se
está creando y lo que ya existe se leen en la misma grilla, una arriba de la
otra, sin cambiar de lugar en la ventana. Lo que hay que sostener a cambio es que
la tabla deja de ser sólo la lista de lo que hay —de ahí el punteado, el tinte y
el badge `Draft`: lo que todavía no es tiene que decirse a simple vista—.

Va en **dos piezas porque van en dos lugares**. El renglón para escribir se queda
quieto arriba de la tabla, afuera del scroller: se lo usa todo el tiempo y con el
scroll se iría. Las filas van adentro del scroller, debajo de los títulos y
arriba de la primera fila real, que es donde van a estar cuando existan. Las dos
leen el mismo estado, que lo tiene la pantalla —no la tienda de buzones—: qué se
está por dar de alta es de la vista, como el filtro y la página, y dos copias de
Provisioning tienen que poder estar escribiendo cosas distintas.

Las filas borrador no son de la `Table` del registry sino una grilla con los
mismos anchos. Una fila de tabla no se puede abrir de alto —las celdas no
colapsan con ella— y lo que esta pieza tiene que hacer es justamente crecer.

**Y el desplegable de cuentas cuelga por afuera de la caja que crece.** La caja
que anima el alto recorta —eso es lo que hace que se lea como un hueco que se
abre y no como contenido que asoma entero—, y un panel que cae por debajo del
campo cae fuera de ella: recortado, lo que se veía debajo del campo era la tabla.
Así que la banda son dos cajas, una adentro de la otra: la de adentro crece y
recorta, la de afuera no recorta nada y mide lo que mide la de adentro, y de ella
cuelga el panel. Se lo saca del recorte en vez de sacarle el recorte a la banda,
porque el recorte **es** la animación. El precio es que el panel tiene que saber
dónde cae —`left-6` es el `px-6` del renglón, `w-72` el ancho del campo—, y es
barato al lado de no verse.

El panel se apoya en el **sistema de superficies**: `Elevated` con dos escalones
sobre el sustrato, que es lo que sube cualquier cosa que flota. Escrito con un
`bg-card` a mano sería el mismo blanco adentro de un panel que adentro de un
diálogo, y ahí dejaría de leerse; el sistema es el que sabe desde qué escalón
está subiendo.

**Entrar y salir es lo mismo acá: la tabla se abre y se cierra.** La banda y las
filas crecen desde cero hasta lo que miden y se van encogiéndose; nada entra
desde un costado ni se acerca desde el fondo, porque nada viene de otro lado —
aparece lugar donde no había. `moderate` para la banda, que es el escalón que
este sistema usa para lo que tiene que asentarse exacto (una banda que rebota
deja la tabla temblando debajo), y `slow` para las filas, que son lo que uno está
mirando cuando las agrega. Las sugerencias no: cuelgan de un campo, así que se
comportan como cualquier popup —se encienden y se acercan—.

Las filas **no entran en cascada**: se agregan de a una, con un clic cada una, así
que cada una es su propio evento. Cuando se van, en cambio, se van todas juntas
—se creó el lote, o se descartó— y son una cosa sola. Un escalonado ahí contaría
un orden que no existe. Con `prefers-reduced-motion` no crecen: aparecen. Va
explícito, porque el `MotionConfig` de `main.tsx` le saca el `transform` a una
animación y no el alto, y un alto que se anima es movimiento igual.

**A quién se le puede dar uno.** Los candidatos son las cuentas **sin** buzón, y
eso obligó a cambiar el fixture: antes `buzones.ts` le armaba uno a cada cuenta,
así que la sección no habría tenido a quién darle nada. Ahora una de cada cuatro
no lo tiene —el resto de dividir su número por cuatro—, y son ésas las que
aparecen al escribir. La lista se achica sola en el mismo render en que el alta
termina, porque sale de los buzones que hay y no de la regla: nadie tiene que
acordarse de sacar a los que acaba de crear.

**`crearBuzon` es una promesa.** No porque haya servidor —no lo hay— sino porque
va a haberlo: quien la llama tiene que poder esperarla, mostrar que está en curso
y enterarse si falla, y eso es lo que decide cómo se ve la pantalla. Tiene una
demora de 900ms puesta a mano, y no es decoración: sin ella el alta sería
instantánea, y una pantalla diseñada contra un alta instantánea no tiene dónde
poner lo que pasa mientras —que es la mitad de lo que hay que mostrar—. Cuando
haya API, se va la demora y queda el `await`.

Falla **entera y no a medias**: si una de las direcciones ya existe, no se crea
ninguna. Un alta de a diez que crea seis y se cae deja al que la pidió sin saber
cuáles, y sin poder repetirla porque repetirla duplicaría esas seis. La
comparación va contra la lista de después de la espera, no la de antes: ahí es
donde estaría el que se coló mientras tanto. La dirección es la identidad de un
buzón, así que dos con la misma no son dos buzones, son un bug con dos filas.

**Lo que pasa mientras se crea** lo cuenta un toast de [Sileo](https://sileo.aaryan.design),
colgado de la promesa: `sileo.promise` encadena los tres momentos —se está
creando, se creó, no se pudo— en un solo aviso, y devuelve la misma promesa así
que lo que sigue se encadena igual. El relato va ahí y no adentro de la banda
porque la banda está ocupada mostrando el borrador: un cartel más ahí competiría
con las filas que justamente hay que mirar. El `Toaster` se monta una sola vez en
el shell —son de la ventana, como el riel y las pestañas—, arriba y al centro:
ahí el aviso cruza por encima de la barra de pestañas sin taparle nada a la
pantalla —el trabajo pasa abajo, en la tabla— y se lo encuentra sin buscarlo. El
tema va atado al toggle de la cabecera, porque el modo `"system"` de Sileo sigue
al sistema operativo y acá el tema lo decide la clase `.dark`.

Un detalle de la copia: Sileo **capitaliza el título** palabra por palabra, así
que lo que se escriba ahí tiene que leerse bien en mayúsculas de título —"Creating
the mailbox…" sale "Creating The Mailbox…"—. De ahí que los títulos no lleven
artículos.

La pantalla igual muestra lo suyo, que es otra cosa: el botón se pone en curso
—el `loading` del registry deja la etiqueta de fondo invisible, así que no cambia
de ancho y no se lo toca dos veces—, el campo deja de ofrecer cuentas —el lote ya
está decidido— y las filas borrador se apagan a la mitad: dejaron de ser algo que
se puede editar y todavía no son filas de la tabla. `Discard` también se apaga: lo
que descartaría ya está del otro lado. Y si falla, lo elegido **se queda**:
volver a elegir a diez personas porque el servidor dijo que no es el peor final
posible para esta pantalla.

Sileo trae `motion` v12 como dependencia, un segundo motor de animación al lado
del `framer-motion` v13 del registry. Conviven sin chocar y el bundle sube ~50 kB
gzip; si algún día eso pesa más que los toasts, sacarlo es `npm rm sileo` y
devolverle el relato a la banda.

**Lo que llega, destella.** El renglón se cerró, la lista se reacomodó y lo
recién creado cayó arriba de todo —es de hoy—: sin una marca hay que ir a buscar
con la vista cuál de las cuarenta filas es la que uno pidió. Llega encendida en
el violeta lavado del sistema y se apaga sola en poco más de un segundo. Es color
y no movimiento a propósito: la fila ya está en su lugar, y moverla otra vez
diría que todavía está llegando.

Las otras cinco maneras que se probaron —un panel en el riel, mosaicos en el
board, una pestaña propia, una barra de comandos, y la tabla dada vuelta en
selector de cuentas— viven en la rama `prototipo-alta`, con lo que cada una
enseñó.

### Un buzón no es una cuenta

`buzones.ts` es un modelo aparte y no dos campos colgados del usuario. La cuenta
es con quién se habla —la que se bloquea desde Accounts—; el buzón es una
dirección que la casa dio de alta, y **hay buzones que no son de nadie**: el de
facturación, el de la recepción, el de mantenimiento. Son los mismos desde los
que la casa escribe en `emails.ts`, así que la consola muestra el buzón del que
después se ve salir un correo; por eso `DOMINIO_CASA` se exporta y la dirección
de un residente sale de `direccionDe` en vez de volver a armarse acá.

**El estado del buzón no se deriva del estado de la cuenta.** Bloquear el chat de
alguien no le apaga el correo: son dos actos distintos, hechos desde dos lugares
distintos de la consola, y derivar uno del otro sería inventar que son el mismo
—además de que los buzones de la casa no tienen cuenta detrás de la que
derivarlo—. Lo que sí se deriva es la fecha: el buzón se da de alta con la
cuenta, así que `creadoEl` es su `addedAt` y no una segunda fecha que va a
discrepar la primera vez que alguien corrija una.

Lo demás es lo de siempre: `useBuzones` sale de la lista viva de usuarios
—dar de baja a alguien se lleva su buzón, y la ficha que abre su nombre muestra
el estado de comunicación de ahora—, la identidad de una fila es su dirección
—no hay dos iguales, y un id al lado sería un segundo nombre para lo mismo—, y
los estados viven en `ESTADOS_BUZON` con su etiqueta, su color de badge y su
punto del panel, que son tres vistas del mismo dato.

### Lo que la paginación dejó de repetir

Esta es la segunda tabla que se pagina, así que las tres decisiones que tiene
alrededor se mudaron a `hooks/use-paginacion.ts`: cambiar el filtro vuelve a la
primera página —al derivar, no en un efecto—, la página se acota contra el total
—si estabas en la 7 y el filtro deja 4, caés en la última que existe—, y cambiar
de página vuelve arriba. Copiadas, alcanza con que una de las dos se olvide de
una para que esa tabla mienta.

El rango del pie —"1–40 of 55", rodando en el mismo idioma que el número del
pager— se fue con él a `components/pager-range.tsx`, por lo mismo que `Datos` y
`punto` viven en `components/`: lo usan dos pantallas y va a usarlo la próxima
que se pagine. Email Search quedó igual de afuera; lo que cambió es de dónde
saca las dos cosas.

## Lo que falta

Las pantallas son un andamio. Seis están escritas —`Accounts`,
`Email › Provisioning`, `Email › Search`, `Tickets`, `What's New` con
`ChangelogPage`, y el board de `Analytics`— y el resto
usa `src/pages/Placeholder.tsx`, que dice que la pantalla no está en vez de
inventarla. Escribir una es cambiarle el `render` a su hoja en `navigation.tsx`;
el shell no cambia.
