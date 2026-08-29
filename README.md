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
por nombre **y por id** —si el id está a la vista, alguien lo va a pegar ahí—,
el panel por atributo —entre atributos, Y; entre los valores de un
mismo atributo, O—, y la página se acota al derivar, porque filtrar puede dejar
menos páginas que la que estabas mirando.

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

## Lo que falta

Las pantallas son un andamio. Tres están escritas —`Accounts`, `What's New` con
`ChangelogPage`, y el board de `Analytics`— y el resto usa
`src/pages/Placeholder.tsx`, que dice que la pantalla no está en vez de
inventarla. Escribir una es cambiarle el `render` a su hoja en
`navigation.tsx`; el shell no cambia.
