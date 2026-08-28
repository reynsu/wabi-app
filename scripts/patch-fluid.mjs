/**
 * Los dos arreglos locales sobre lo que publica el registry @fluid.
 *
 * `shadcn add --overwrite` vuelve a bajar el archivo original, así que esto se
 * corre después (`npm run fix:fluid`) y es lo único que hace que las
 * desviaciones sobrevivan a una actualización.
 *
 *   1. `card.tsx` viene compilado para Next: importa `next/link`, que en una app
 *      de Vite no resuelve. Se cambia por un `<a>` con las mismas props.
 *   2. `font-weight.ts` trae el semibold en `opsz 18`. Acá va en **20**: es el
 *      tamaño óptico con el que está ajustada la tipografía de esta app, y
 *      bajarlo adelgaza cada etiqueta semibold de la pantalla.
 *
 * Cada parche avisa si ya estaba puesto, y falla —con código 1— si el archivo
 * del registry cambió de forma y el reemplazo no encaja. Eso es a propósito: un
 * parche que no aplica en silencio es una desviación que se perdió sin que
 * nadie se entere.
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

const SHIM = `
// Vite build: the registry ships this component for Next.js, where \`Link\` is
// an anchor that takes \`href\`. Swapped for a real anchor so it resolves here.
// Point this at your router's Link if you add one.
function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href} {...props} />;
}
`;

try {
  const card = "src/components/ui/card.tsx";
  if (
    parche(card, {
      yaEsta: (s) => !s.includes('from "next/link"'),
      aplicar: (s) => {
        const out = s
          .replace('import Link from "next/link";\n', "")
          .replace(
            "  type HTMLAttributes,\n",
            "  type AnchorHTMLAttributes,\n  type HTMLAttributes,\n",
          )
          .replace(
            'import { useProximityHover } from "@/hooks/use-proximity-hover";\n',
            'import { useProximityHover } from "@/hooks/use-proximity-hover";\n' + SHIM,
          );
        return out.includes('from "next/link"') ? null : out;
      },
    })
  ) {
    console.log(`${card}: next/link reemplazado por un anchor local.`);
  }

  const pesos = "src/lib/font-weight.ts";
  if (
    parche(pesos, {
      yaEsta: (s) => s.includes(`semibold: "'wght' 550, 'opsz' 20"`),
      aplicar: (s) =>
        s.replace(
          `semibold: "'wght' 550, 'opsz' 18",`,
          `semibold: "'wght' 550, 'opsz' 20",`,
        ),
    })
  ) {
    console.log(`${pesos}: semibold fijado en opsz 20.`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
