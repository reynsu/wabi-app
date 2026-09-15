/**
 * La desviación local sobre lo que publica el registry @wabi.
 *
 * `shadcn add --overwrite` vuelve a bajar el archivo original, así que esto se
 * corre después (`npm run fix:wabi`) y es lo único que hace que la desviación
 * sobreviva a una actualización. Es el gemelo de `patch-fluid.mjs`, con la
 * misma regla: si el parche no encaja, falla.
 *
 *   `filter-menu.tsx` enfoca su campo de buscar solo — al abrirse, al entrar a
 *   un atributo, al volver y al limpiar—. Es lo correcto en escritorio: el
 *   panel entero se maneja desde ese campo, que retiene el foco mientras un
 *   realce recorre las filas. En un táctil, foco es **teclado**: medio panel
 *   desaparece detrás de él antes de haber leído una fila, y nadie pidió
 *   escribir. En el teléfono no se enfoca nada; el que quiera buscar toca el
 *   campo.
 *
 * Esto no se puede hacer desde el call site —`initialFocus` es del popup y el
 * `className` del `FilterMenu` cae en su botón—, y por eso es un parche y no
 * una clase en las nueve pantallas que lo usan.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** Devuelve `true` si escribió, `false` si no hacía falta; tira si no encaja. */
function parche(file, { yaEsta, aplicar }) {
  const source = readFileSync(file, "utf8");
  if (yaEsta(source)) {
    console.log(`${file}: ya estaba, nada que hacer.`);
    return false;
  }
  const patched = aplicar(source);
  if (!patched || patched === source) {
    throw new Error(`${file}: el parche no aplicó — el archivo del registry cambió de forma.`);
  }
  writeFileSync(file, patched);
  return true;
}

const IMPORT = `// Local deviation, kept by \`npm run fix:wabi\`: see \`enfocarCampo\` below.
import { useEsMovil } from "@/hooks/use-es-movil";`;

const HELPER = `/** Local deviation, kept by \`npm run fix:wabi\`: \`initialFocus\` returning false
 *  is how Base UI is told to leave focus where it is. */
const SIN_FOCO = () => false;

`;

const GANCHO = `
  /* Local deviation, kept by \`npm run fix:wabi\`.

     On a phone the search box never takes focus on its own. Everything in here
     is driven from that field on a desktop —it holds focus while a highlight
     travels the rows— so opening the panel, stepping into an attribute or
     coming back all put focus there. On a touch screen, focus means the
     keyboard: half the panel disappears behind it before you've read a single
     row, and you didn't ask to type. Whoever wants to search taps the field. */
  const esMovil = useEsMovil();
  const enfocarCampo = useCallback(() => {
    if (esMovil) return;
    inputRef.current?.focus();
  }, [esMovil]);`;

try {
  const menu = "src/components/filter-menu.tsx";
  if (
    parche(menu, {
      yaEsta: (s) => s.includes("enfocarCampo"),
      aplicar: (s) => {
        /* Primero los cuatro focos que corren solos —`replaceAll`: los cuatro
           dicen lo mismo y los cuatro tienen que dejar de decirlo—, y recién
           después se inserta el gancho. Al revés, el `inputRef.current?.focus()`
           que vive *adentro* del gancho también se reemplazaría y la función
           se llamaría a sí misma. */
        let out = s.replaceAll("inputRef.current?.focus();", "enfocarCampo();");

        /* Y las dos dependencias que eso agrega. */
        out = out
          .replace("      enfocarCampo();\n    },\n    [search],\n  );", "      enfocarCampo();\n    },\n    [search, enfocarCampo],\n  );")
          .replace("    enfocarCampo();\n  }, [search]);", "    enfocarCampo();\n  }, [search, enfocarCampo]);");

        out = out
          .replace('import { cn } from "@/lib/utils";', `import { cn } from "@/lib/utils";\n${IMPORT}`)
          .replace("function FilterMenu({", `${HELPER}function FilterMenu({`)
          .replace(
            "  const inputRef = useRef<HTMLInputElement>(null);",
            `  const inputRef = useRef<HTMLInputElement>(null);\n${GANCHO}`,
          )
          .replace(
            "                // only place everything else is driven from.\n                initialFocus={inputRef}",
            "                // only place everything else is driven from. On a phone\n                // nothing is focused — see `enfocarCampo`.\n                initialFocus={esMovil ? SIN_FOCO : inputRef}",
          );

        return out.includes("enfocarCampo") && out.includes("SIN_FOCO") ? out : null;
      },
    })
  ) {
    console.log(`${menu}: el campo ya no se enfoca solo en el teléfono.`);
  }
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
