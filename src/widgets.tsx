/**
 * Los widgets de esta app.
 *
 * Separados de las pantallas a propósito: los mosaicos viven en el riel de la
 * derecha, que es un lugar del shell y no una pantalla, así que quien los
 * declara tampoco puede serlo. Cada uno trae su `glance` —lo que se ve en el
 * board— y su `full`, que es la pestaña que abre al tocarlo.
 */

import type { ReactNode } from "react";
import { Activity, Rocket, Users } from "lucide-react";

import type { WidgetDefinition } from "@/components/widget";

/** El número grande de un mosaico, con su renglón de contexto debajo. */
export function Cifra({ valor, nota }: { valor: string; nota: string }) {
  return (
    <span className="flex h-full flex-col justify-end gap-0.5">
      <span className="text-[24px] leading-none font-medium tracking-tight">
        {valor}
      </span>
      <span className="text-[12px] text-muted-foreground">{nota}</span>
    </span>
  );
}

export function Vista({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-10">
      <h2 className="text-[16px] font-medium tracking-tight">{title}</h2>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

/* La lista vive al lado de las piezas con las que se dibuja: separarla en otro
   archivo para contentar al fast refresh partiría en dos algo que se lee de una
   sola vez. Es la misma decisión que toman los contextos del registry. */
// oxlint-disable-next-line react/only-export-components
export const WIDGETS: WidgetDefinition[] = [
  {
    id: "revenue",
    label: "Revenue",
    icon: Activity,
    span: "2x1",
    glance: () => <Cifra valor="$38,000" nota="+12% vs. last month" />,
    full: () => (
      <Vista title="Revenue">
        La vista entera del widget. Es una pestaña del panel como cualquier otra
        — el mosaico no la abre al costado: se convierte en ella.
      </Vista>
    ),
  },
  {
    id: "users",
    label: "Active users",
    icon: Users,
    glance: () => <Cifra valor="1,204" nota="7-day average" />,
    full: () => (
      <Vista title="Active users">
        Reemplazá esto con la pantalla de verdad cuando sepamos qué es la app.
      </Vista>
    ),
  },
  {
    id: "deploys",
    label: "Deploys",
    icon: Rocket,
    glance: () => <Cifra valor="9" nota="this week" />,
    full: () => (
      <Vista title="Deploys">
        El board es de la pestaña que lo abrió: cerrarlo acá no toca el de las
        otras.
      </Vista>
    ),
  },
];
