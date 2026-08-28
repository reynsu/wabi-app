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

El registry de @fluid publica sus componentes compilados para Next.js: `card.tsx`
importa `next/link`, que acá no resuelve. El script lo cambia por un `<a>`.
**Hay que correrlo después de cada `shadcn add --overwrite`**, porque el CLI
vuelve a bajar el archivo original.

## Cómo está armado

- `src/main.tsx` — los cuatro sistemas del registry cableados una sola vez:
  motion (`reducedMotion="user"`), figuras, tamaños y superficies.
- `src/App.tsx` — el shell: sidebar, `WorkspacePanel` con pestañas y el
  `WidgetRail` del costado. El board y el preview del riel son **de la pestaña
  que los abrió**; qué pantallas vienen con board puesto lo decide `CON_BOARD`.
- `src/widgets.tsx` — los mosaicos del riel. Van separados de las pantallas
  porque el riel es un lugar del shell y no una pantalla.
- `src/pages/` — una pantalla por pestaña.

## Lo que falta

Las tres pantallas son un andamio: dicen qué hay puesto y ejercitan las piezas.
Cuando sepamos qué es la app de verdad, se reemplaza el contenido de `src/pages/`
y los widgets; el shell no cambia.
