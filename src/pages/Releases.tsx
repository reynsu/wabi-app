import { ChangelogPage, type Release } from "@/components/changelog-page";

/* Las releases de la app. Salen de un array de objetos tipados, así que
   engancharlas a un JSON del repo, a los tags de git o a un CMS es cambiar de
   dónde sale esta constante y nada más. */
const RELEASES: Release[] = [
  {
    version: "0.1.0",
    date: "Aug 27, 2026",
    sections: [
      {
        kind: "feature",
        items: [
          "El shell: sidebar, panel con pestañas y riel de widgets.",
          "Changelog y Customers, armadas con los blocks del registry.",
        ],
      },
      {
        kind: "improvement",
        items: ["Los cuatro sistemas cableados en la raíz, una sola vez."],
      },
    ],
  },
  {
    version: "0.0.1",
    date: "Aug 26, 2026",
    sections: [
      {
        kind: "feature",
        items: ["Proyecto vacío: Vite, React 19, TypeScript y Tailwind v4."],
      },
    ],
  },
];

/** La página entera es el block: no hay marco alrededor porque el block *es*
 *  la pantalla. */
export function Releases() {
  return (
    <ChangelogPage
      eyebrow="Always up to date"
      title="What's new"
      description="Lo que fue entrando, en el orden en que entró."
      releases={RELEASES}
    />
  );
}
