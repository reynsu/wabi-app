/**
 * The @fluid registry ships its components built for Next.js: `card.tsx`
 * imports `next/link`, which doesn't resolve in this Vite app. Swap it for a
 * plain anchor with the same props.
 *
 * `shadcn add --overwrite` re-fetches the pristine registry file, so re-run
 * this (`npm run fix:fluid`) after installing or updating @fluid components.
 * If you add a router later, point the shim at its Link instead.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/components/ui/card.tsx";

const SHIM = `
// Vite build: the registry ships this component for Next.js, where \`Link\` is
// an anchor that takes \`href\`. Swapped for a real anchor so it resolves here.
// Point this at your router's Link if you add one.
function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href} {...props} />;
}
`;

const source = readFileSync(FILE, "utf8");

if (!source.includes('from "next/link"')) {
  console.log(`${FILE}: already patched, nothing to do.`);
  process.exit(0);
}

const patched = source
  .replace('import Link from "next/link";\n', "")
  .replace("  type HTMLAttributes,\n", "  type AnchorHTMLAttributes,\n  type HTMLAttributes,\n")
  .replace(
    'import { useProximityHover } from "@/hooks/use-proximity-hover";\n',
    'import { useProximityHover } from "@/hooks/use-proximity-hover";\n' + SHIM
  );

if (patched === source || patched.includes('from "next/link"')) {
  console.error(`${FILE}: patch did not apply — the registry file changed shape.`);
  process.exit(1);
}

writeFileSync(FILE, patched);
console.log(`${FILE}: replaced next/link with a local anchor shim.`);
