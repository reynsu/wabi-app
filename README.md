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
npx shadcn@latest add @wabi/pagination --yes --overwrite
npm run fix:fluid
```

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
valores. Si el showcase cambia un token, se vuelve a copiar.

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

Cada fila lleva **una acción**, revelada con el hover: abre la pestaña sin
traerla al frente (`openTab(tab, { focus: false })`, que el workspace ya sabía
hacer y nadie usaba). La fila le reserva el lugar sola —`rowGutter` es exacto,
no un padding a ojo.

El header es un **dropdown**: la insignia y el nombre en una fila, el chevron
al final, y adentro los tres destinos de producto (What's new, FAQ, Support &
feedback). Son filas del mismo árbol: el menú es un atajo, no un lugar aparte.

## Lo que falta

Las pantallas son un andamio. Tres están escritas —`Accounts` con `Pagination`,
`What's New` con `ChangelogPage`, y el board de `Analytics`— y el resto usa
`src/pages/Placeholder.tsx`, que dice que la pantalla no está en vez de
inventarla. Escribir una es cambiarle el `render` a su hoja en
`navigation.tsx`; el shell no cambia.
