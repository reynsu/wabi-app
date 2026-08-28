import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";

const GENTE = [
  ["Camila Ferreyra", "Atlasflow", "Customer"],
  ["Bruno Salas", "Atlasflow", "In conversation"],
  ["Lucía Otero", "Nubex", "Customer"],
  ["Martín Quiroga", "Corriente", "Proposal sent"],
  ["Sofía Bermúdez", "Corriente", "Customer"],
  ["Iván Palacios", "Marmota", "Lost"],
  ["Renata Bianchi", "Atlasflow", "Customer"],
  ["Diego Miralles", "Nubex", "Proposal sent"],
  ["Paula Genovese", "Peral", "In conversation"],
  ["Andrés Lupo", "Atlasflow", "New"],
  ["Valentina Roldán", "Marmota", "Customer"],
  ["Tomás Iriarte", "Peral", "New"],
];

const POR_PAGINA = 5;

/** Una lista paginada de verdad: el pager no es una demo suelta, es el que
 *  mueve estas filas. */
export function Customers() {
  const [pagina, setPagina] = useState(1);
  const total = Math.ceil(GENTE.length / POR_PAGINA);
  const visibles = GENTE.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-medium tracking-tight">Customers</h1>
        <p className="text-[13px] text-muted-foreground">
          {GENTE.length} personas, de a {POR_PAGINA} por página.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {visibles.map(([nombre, empresa, estado]) => (
          <li
            key={nombre}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 shadow-surface-1"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium">{nombre}</span>
              <span className="truncate text-[12px] text-muted-foreground">
                {empresa}
              </span>
            </span>
            <Badge size="compact">{estado}</Badge>
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <Pagination total={total} value={pagina} onValueChange={setPagina} />
      </div>
    </div>
  );
}
