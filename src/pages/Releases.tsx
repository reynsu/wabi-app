import { ChangelogPage, type Release } from "@/components/changelog-page";
import { ScrollArea } from "@/components/ui/scroll-area";

/* Las releases de la app. Salen de un array de objetos tipados, así que
   engancharlas a un JSON del repo, a los tags de git o a un CMS es cambiar de
   dónde sale esta constante y nada más.

   El contenido va en inglés: es lo que la pantalla muestra, y la pantalla habla
   el idioma del producto. Los comentarios —esto— siguen en castellano, que es
   el idioma del código. */
const RELEASES: Release[] = [
  {
    version: "0.5.0",
    date: "Sep 2, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "A sign-in screen: the console asks who you are before it opens.",
          "Admin › DOC Accounts: the table, and an account created straight from it.",
          "Admin › Reports: what the console was asked for, and who asked for it — with a report requested from the rail.",
          "Announcements, with the compose form on the rail.",
          "Email › Reports.",
        ],
      },
      {
        kind: "improvement",
        items: [
          "Correcting a DOC account uses the very form that creates one.",
          "Correcting a policy does too: it opens the rail form filled in, instead of a dialog that asked for other things.",
          "Policies and Provisioning create with the same button as the rest of the console.",
          "The policy form handed over the pieces it was going to share.",
          "The three profile sections behave the same: Conversations and Emails got the filter panel Tickets already had, and all three lists start at one width.",
          "The card behind an account name shows what the account is, and stops asking for a click to say more.",
        ],
      },
      {
        kind: "fix",
        items: [
          "The row that was just created — or just corrected — lights up again. It never did: four tables were waiting for a signal that arrives one render too late.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "Sep 1, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "Email › Policies: a policy is written on the rail, against the promise it makes.",
          "An account opens up: its analytics on the board, its activity on the rail, its map of connections.",
          "A board tile can be written in, and a transcript gets its own card.",
        ],
      },
      {
        kind: "improvement",
        items: [
          "App state moved to Zustand.",
          "The activity list is fenced in and scrolls on its own, with its count and its filters.",
          "The five tables share one row height.",
          "The site is published on GitHub Pages.",
        ],
      },
      {
        kind: "fix",
        items: [
          "New policy opens the form again after it was closed.",
          "The creation form dropped the empty-state signs it had no business showing.",
        ],
      },
    ],
  },
  {
    version: "0.3.0",
    date: "Aug 31, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "Email › Search, with a message opening on the rail.",
          "Email › Provisioning: the mailbox table, its state changed in the cell.",
          "Mailboxes created from inside the table, showing what happens while they are created.",
          "Chat › Search: the Messages Search screen.",
        ],
      },
      {
        kind: "improvement",
        items: [
          "Pagination and the result range moved out to shared pieces.",
          "Toasts moved to the top centre.",
        ],
      },
      {
        kind: "fix",
        items: [
          "The accounts dropdown is no longer clipped by the box around it.",
          "The colour dot lines up with the label beside it.",
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "Aug 29, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "Chat › Accounts: the users table, and the profile behind a row.",
        ],
      },
      {
        kind: "improvement",
        items: ["The theme radius came down: at 10px it read as a pill."],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "Aug 27, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "The shell: sidebar, tabbed panel and widget rail.",
          "Copies of one screen open as separate tabs, each holding its own board.",
        ],
      },
      {
        kind: "improvement",
        items: ["The four systems wired at the root, once."],
      },
    ],
  },
  {
    version: "0.0.1",
    date: "Aug 26, 2026",
    sections: [
      {
        kind: "feature",
        items: ["Empty project: Vite, React 19, TypeScript and Tailwind v4."],
      },
    ],
  },
];

/** La página entera es el block: no hay marco alrededor porque el block *es*
 *  la pantalla.
 *
 *  Lo único que le agrega la página es el scroll. El block no lo toma —"a page
 *  block scrolls with the document it landed in"—, y el documento acá es la
 *  pestaña, que scrollea con `overflow-auto`: el del navegador. El `ScrollArea`
 *  lo cambia por el del sistema, que es el que usan las otras pantallas, con el
 *  mismo `scroll-fade` en el viewport. Toma `h-full` porque el panel es
 *  `absolute inset-0`: midiéndose contra él, el scroll del navegador se queda
 *  sin nada que scrollear y no quedan dos barras, una adentro de la otra. */
export function Releases() {
  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade">
      <ChangelogPage
        eyebrow="Always up to date"
        title="What's new"
        description="Everything that landed, in the order it landed."
        releases={RELEASES}
      />
    </ScrollArea>
  );
}
