import type { ReactNode } from "react";
import {
  ChartColumn,
  CircleQuestionMark,
  FileChartColumn,
  FileText,
  IdCard,
  LifeBuoy,
  MailPlus,
  MailSearch,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Users as UsersIcon,
  Wrench,
} from "lucide-react";

import type { IconComponent } from "@/lib/icon-context";
import { EmailSearch } from "@/pages/EmailSearch";
import { SupportTickets } from "@/pages/SupportTickets";
import { Users } from "@/pages/Users";
import { Placeholder } from "@/pages/Placeholder";
import { Provisioning } from "@/pages/Provisioning";
import { Releases } from "@/pages/Releases";

/* La navegación, como dato y en un solo lugar.
 *
 * El árbol es el de siempre —Chat, Email, Announcements, Tickets, Admin,
 * Support & feedback y sus hojas— pero aplanado a un nivel: lo que antes era
 * una sección con hijas ahora es un grupo con label, y las hijas son filas de
 * primer nivel. Nada se perdió; cambió quién es el contenedor.
 *
 * Los ids siguen calificados (`chat/search`, `email/search`) porque el árbol
 * repite etiquetas a propósito: el id es la identidad de la pestaña, así que
 * sin calificar serían la misma. */

/** Una fila: la que abre una pestaña. Ahora todas son de primer nivel, así que
 *  todas llevan su ícono —y como la sección ya no lo presta, cada una tiene el
 *  suyo. Es lo que separa los dos "Search" en la barra de pestañas. */
export interface NavLeaf {
  id: string;
  label: string;
  icon: IconComponent;
  /** Recibe el id de la pestaña que la está montando. La mayoría de las
   *  pantallas lo ignoran; lo necesitan las que ponen algo en el board, que se
   *  pone en el board *de esa* pestaña. No es el id de la hoja: una copia
   *  —`tickets#2`— es otra pestaña con otro board. */
  render: (tabId: string) => ReactNode;
}

/** Un grupo de filas. Con label es una sección colapsable —el label es el
 *  disparador—; sin label es un grupo suelto: el árbol tiene tres filas que no
 *  cuelgan de ninguna sección y no les invento un nombre para poder
 *  agruparlas. */
export interface NavGroup {
  id: string;
  label?: string;
  items: NavLeaf[];
}

/* Sin `render`, la fila se lleva la pantalla que dice que todavía no está: las
   que faltan no se inventan. Escribir una es pasarle su `render` acá. */
const hoja = (
  id: string,
  label: string,
  icon: IconComponent,
  section?: string,
  render?: (tabId: string) => ReactNode,
): NavLeaf => ({
  id,
  label,
  icon,
  render:
    render ?? (() => <Placeholder icon={icon} label={label} section={section} />),
});

export const NAV: NavGroup[] = [
  {
    id: "chat",
    label: "Chat",
    items: [
      hoja("chat/accounts", "Accounts", UsersIcon, "Chat", () => <Users />),
      hoja("chat/search", "Search", Search, "Chat"),
      hoja("chat/analytics", "Analytics", ChartColumn, "Chat"),
    ],
  },
  {
    id: "email",
    label: "Email",
    items: [
      hoja("email/provisioning", "Provisioning", MailPlus, "Email", () => (
        <Provisioning />
      )),
      hoja("email/search", "Search", MailSearch, "Email", () => (
        <EmailSearch />
      )),
      hoja("email/policies", "Policies", ShieldCheck, "Email"),
      hoja("email/reports", "Reports", FileChartColumn, "Email"),
    ],
  },
  {
    id: "sueltas",
    items: [
      hoja("announcements", "Announcements", Megaphone),
      hoja("tickets", "Tickets", Wrench, undefined, (tabId) => (
        <SupportTickets tabId={tabId} />
      )),
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      hoja("admin/doc-accounts", "DOC Accounts", IdCard, "Admin"),
      hoja("admin/reports", "Reports", FileText, "Admin"),
      hoja("admin/whats-new", "What's New", Sparkles, "Admin", () => <Releases />),
      hoja("admin/faq", "FAQ", CircleQuestionMark, "Admin"),
    ],
  },
  {
    id: "ayuda",
    items: [hoja("support", "Support & feedback", LifeBuoy)],
  },
];

/** Con qué abre la app: la fila que el diseño muestra encendida. */
export const INICIO = "chat/accounts";

/** Las hojas aplanadas — lo que el shell necesita para abrir una pestaña sin
 *  volver a recorrer los grupos. */
export const HOJAS: NavLeaf[] = NAV.flatMap((grupo) => grupo.items);

export const buscarHoja = (id: string): NavLeaf | undefined =>
  HOJAS.find((h) => h.id === id);
