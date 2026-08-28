"use client";

/**
 * ChangelogPage — what shipped, release by release.
 *
 * A block and not a component: it doesn't solve one piece but a whole screen —
 * the page a product points at when somebody asks what changed. Its anatomy is
 * a document's: a header that says what this page is, and under it a column of
 * releases, each one a version, a date, and the changes grouped by what kind of
 * change they are.
 *
 * Six decisions worth not undoing without looking at the rest:
 *
 * 1. **Colour means a kind of change, and nothing else.** Four of them, in the
 *    hues the reference uses and in the same positions: violet for what's new,
 *    blue for what got better, rose for what got fixed, emerald for what got
 *    closed. They live in one map — `CHANGE_KINDS` — with their label, their
 *    glyph and their ink, so a palette that doesn't fit a brand is one edit and
 *    a fifth kind is one more entry. Nothing else on the page is coloured: the
 *    version, the date, the rail and the bullets are all ink and border, which
 *    is what leaves the four hues meaning something.
 *
 * 2. **The chip carries the tint, the heading carries the ink.** The row of
 *    `Badge`s under a version is the release's table of contents —what kinds of
 *    thing are in here— and it lands on the system's badge convention: the hue
 *    is the fill, the label stays foreground. The section headings below carry
 *    the hue in the text instead, because that's the mark the eye jumps between
 *    when it scans a release for the one line it came for. Same four colours,
 *    two jobs.
 *
 * 3. **Each release draws its own piece of rail.** The reference runs one
 *    absolute line down the whole list. That breaks the moment the list changes
 *    —a release that arrives has to grow a line that belongs to the container,
 *    and a line that belongs to the container can only jump— so this takes
 *    `Timeline`'s decision instead: the segment goes from a node to the next one
 *    and belongs to the release above it. `group-last` retires the one that
 *    stopped being last, with no index arithmetic.
 *
 * 4. **The date sits in its own gutter, and the gutter is a container query.**
 *    Opposite the rail, so the version headings stack into one scannable column
 *    with the dates reading down the other side. Below `@xl` the gutter has
 *    nowhere to go and the date moves above the version — measured on the
 *    block's container and not on the window, so the same code is right inside
 *    a 360px frame and on a full screen. The date doesn't move in the DOM: the
 *    three parts are placed by grid, so what changes is the placement and never
 *    the reading order.
 *
 * 5. **A release lands when it's read, not when the page mounts.** A changelog
 *    is long — a cascade fired on mount is spent on eleven releases nobody has
 *    scrolled to yet. Each one comes in on `whileInView`, once, and its rail is
 *    drawn from the top afterwards, which is the order the eye reads them in.
 *
 * 6. **It's an `<ol>`.** The order is the content — newest first is the whole
 *    argument of the page. Anything driving by keyboard or by voice gets "list,
 *    11 items" for free, and the headings stay a real h1 → h2 → h3 ladder so
 *    the page can be jumped through by structure.
 *
 * Unlike `LoginBlock` this one does **not** paint itself in its own theme: a
 * changelog lives inside a product's docs, on the plane the docs are on. That's
 * why the four hues can use the `dark:` variant here and can't there.
 */

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bug, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { Badge, type BadgeColor } from "@/components/ui/badge";
import type { IconComponent } from "@/lib/icon-context";
import { useSizeVariant, useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

/* ── The four kinds ────────────────────────────────────────────────────── */

interface ChangeKindStyle {
  /** The heading over the list, and the chip's label. */
  label: string;
  /** The glyph next to the heading. */
  icon: IconComponent;
  /** The chip's hue — one of `Badge`'s colours, which is where the system's
   *  colour lives. */
  badge: BadgeColor;
  /** The heading's ink. Two values because a hue that reads on white is too
   *  dark on near-black: the same step down the reference uses. */
  ink: string;
}

/**
 * The whole palette of the page, in one place — see decision 1. The hues are
 * the reference's and so is what each one means; swapping a brand in is this
 * map and nothing else.
 */
const CHANGE_KINDS = {
  feature: {
    label: "New Features",
    icon: Sparkles,
    badge: "violet",
    ink: "text-violet-600 dark:text-violet-400",
  },
  improvement: {
    label: "Improvements",
    icon: Zap,
    badge: "blue",
    ink: "text-blue-600 dark:text-blue-400",
  },
  fix: {
    label: "Bug Fixes",
    icon: Bug,
    badge: "rose",
    ink: "text-rose-600 dark:text-rose-400",
  },
  security: {
    label: "Security",
    icon: ShieldCheck,
    badge: "emerald",
    ink: "text-emerald-600 dark:text-emerald-400",
  },
} as const satisfies Record<string, ChangeKindStyle>;

type ChangeKind = keyof typeof CHANGE_KINDS;

/* ── The steps ─────────────────────────────────────────────────────────── */

/** The rail's own beat. `lib/springs` has three and they're for reactions —
 *  something the pointer touched that has to answer now. A line being drawn is
 *  the other thing, and it starts after the text it follows. Same value as
 *  `Timeline`'s: the two rails are the same object. */
const draw = { type: "spring" as const, duration: 0.42, bounce: 0, delay: 0.06 };

const releaseVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: spring.moderate },
} as const;

const railVariants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: draw },
} as const;

/** How much of a release has to be on screen before it lands. Low, because the
 *  tall ones would otherwise wait until they're nearly past. */
const IN_VIEW = { once: true, amount: 0.1 } as const;

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ChangeSection {
  kind: ChangeKind;
  /** One line each. Nodes and not strings, so a line can carry a link to the
   *  pull request or a `<code>` with the flag that changed. */
  items: ReactNode[];
}

interface Release {
  /** The number alone — "4.3.0". The word "Version" is the page's, not the
   *  data's. */
  version: string;
  /** Already formatted, in the product's locale. A changelog renders dates
   *  somebody chose; guessing at a format here would fight that. */
  date: string;
  sections: ChangeSection[];
}

interface ChangelogPageProps {
  /** The chip over the title — a status, not a heading. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Newest first: the order is the content, see decision 6. The first one is
   *  drawn as the live release. */
  releases: Release[];
  /** Under the header — a subscribe button, an RSS link, whatever the product
   *  wants offered at the top of the page. */
  action?: ReactNode;
  className?: string;
}

/* ── The page ──────────────────────────────────────────────────────────── */

function ChangelogPage({
  eyebrow,
  title,
  description,
  releases,
  action,
  className,
}: ChangelogPageProps) {
  const type = useTypeScale();

  return (
    <div
      className={cn(
        // The container the gutter is measured against — decision 4. It doesn't
        // own the scroll: a page block scrolls with the document it landed in.
        "@container min-h-full bg-surface-1 text-foreground",
        className
      )}
    >
      {/* The header is separated by a hairline and by air, and not by a plane
          of its own: the surface ladder in this system goes *up*, and a band
          that has to recede would have to invent a step below the page. */}
      <header className="border-b border-border px-6 py-14 text-center @xl:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          {eyebrow && <Badge variant="dot">{eyebrow}</Badge>}
          <h1
            className="font-medium tracking-tight text-balance"
            style={{ fontSize: type.display }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-balance text-muted-foreground"
              style={{ fontSize: type.subtitle }}
            >
              {description}
            </p>
          )}
          {action && <div className="mt-2">{action}</div>}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 @xl:px-8 @xl:py-16">
        <ol className="flex flex-col">
          {releases.map((release, i) => (
            <ReleaseEntry
              key={release.version}
              release={release}
              latest={i === 0}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * One release: the date in the gutter, the node on the rail, and the version
 * with its changes in the column that reads.
 */
function ReleaseEntry({
  release,
  latest,
}: {
  release: Release;
  latest: boolean;
}) {
  const compact = useSizeVariant() === "compact";
  const type = useTypeScale();

  /* The node's box is also the rail's column, so every release lines up
     whatever size the dot is. */
  const node = compact ? 10 : 12;
  /* The air under a release, which is also how much rail there is between one
     node and the next. */
  const gap = compact ? 36 : 48;
  /* The dot's nudge onto the optical centre of the row it marks — and that row
     isn't the same one in both placements: with the gutter open the dot lands
     against the version heading, and without it against the date that moved
     over the version. Hence the two values, and hence a variable: the second
     one has to be spent by a container query. */
  const nodeTop = compact ? 5 : 6;

  return (
    <motion.li
      variants={releaseVariants}
      initial="hidden"
      whileInView="visible"
      viewport={IN_VIEW}
      className={cn(
        "group/release grid gap-x-5",
        // Two placements of the same three parts — decision 4. The gutter only
        // exists above `@xl`; below it the date moves over the version and the
        // rail takes the left edge.
        "[grid-template-columns:var(--cl-node)_minmax(0,1fr)]",
        "@xl:[grid-template-columns:7rem_var(--cl-node)_minmax(0,1fr)]"
      )}
      style={{
        ["--cl-node" as string]: `${node}px`,
        ["--cl-node-top" as string]: `${nodeTop}px`,
        // A variable and not a padding on the row: the air has to live *inside*
        // the grid or the node's column can't stretch over it, and then the
        // rail stops short of the next node.
        ["--cl-gap" as string]: `${gap}px`,
      }}
    >
      <time
        className={cn(
          "tabular-nums text-muted-foreground",
          "col-start-2 row-start-1 pb-2",
          "@xl:col-start-1 @xl:row-start-1 @xl:pt-1 @xl:pb-0"
        )}
        style={{ fontSize: type.caption }}
      >
        {release.date}
      </time>

      {/* The node's column. It stretches over the whole entry —air included—
          which is what lets the rail reach the node underneath. */}
      <div
        className={cn(
          "relative flex justify-center",
          "col-start-1 row-start-1 row-span-2",
          "@xl:col-start-2"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-[2px] shrink-0 rounded-full @xl:mt-[var(--cl-node-top)]",
            /* The live release is filled, with a halo of the interaction
               tokens; the ones behind it are rings. Same three weights
               `Timeline` gives a state, and for the same reason: colour on this
               page already means a kind of change. */
            latest
              ? "bg-foreground shadow-[0_0_0_4px_var(--hover),0_0_0_5px_var(--active)]"
              : "border-[1.5px] border-foreground"
          )}
          style={{ width: node, height: node }}
        />

        {/* The segment down to the next node. It belongs to this release —
            decision 3— so the last one simply doesn't draw it. */}
        <motion.span
          aria-hidden
          variants={railVariants}
          className="absolute w-px origin-top bg-border group-last/release:hidden"
          style={{
            top: nodeTop + node + 6,
            bottom: 2,
            left: "50%",
            translateX: "-50%",
          }}
        />
      </div>

      {/* The column that reads, and the air under it — the padding that was on
          the entry and had to come inside. */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-5 pb-[var(--cl-gap)] group-last/release:pb-0",
          "col-start-2 row-start-2",
          "@xl:col-start-3 @xl:row-start-1 @xl:row-span-2"
        )}
      >
        <div className="flex flex-col gap-2.5">
          <h2
            className="font-medium tracking-tight"
            style={{ fontSize: type.title }}
          >
            Version <span className="font-mono">{release.version}</span>
          </h2>

          {/* The release's table of contents: what kinds of thing are in here,
              before reading a line of them. No glyph inside the chip — the
              tint already says which kind, and a second mark in the same 20px
              is a mark too many. */}
          <div className="flex flex-wrap gap-1.5">
            {release.sections.map(({ kind }) => (
              <Badge key={kind} color={CHANGE_KINDS[kind].badge} size="compact">
                {CHANGE_KINDS[kind].label}
              </Badge>
            ))}
          </div>
        </div>

        {release.sections.map((section) => (
          <ChangeGroup key={section.kind} section={section} />
        ))}

        {/* The line that closes a release. The last one doesn't close: a page
            that ends in a rule ends twice. */}
        <div
          aria-hidden
          className="mt-1 h-px bg-border group-last/release:hidden"
        />
      </div>
    </motion.li>
  );
}

/** One kind of change inside a release: the coloured heading and its lines. */
function ChangeGroup({ section }: { section: ChangeSection }) {
  const compact = useSizeVariant() === "compact";
  const type = useTypeScale();
  const { label, icon: Icon, ink } = CHANGE_KINDS[section.kind];

  return (
    <section className="flex flex-col gap-2">
      <h3
        className={cn("flex items-center gap-2 font-semibold", ink)}
        style={{ fontSize: type.body }}
      >
        <Icon size={compact ? 13 : 14} className="shrink-0" />
        {label}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {section.items.map((item, i) => (
          <li
            key={i}
            className="flex gap-2 text-muted-foreground"
            style={{ fontSize: type.body }}
          >
            {/* A dot and not a `list-disc`: the marker has to line up with the
                first line's optical centre and take the muted weight, and a
                native marker takes neither. */}
            <span
              aria-hidden
              className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/40"
            />
            <span className="min-w-0 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { ChangelogPage, CHANGE_KINDS };
export type {
  ChangelogPageProps,
  Release,
  ChangeSection,
  ChangeKind,
  ChangeKindStyle,
};
