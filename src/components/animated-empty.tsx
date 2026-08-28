"use client";

/**
 * AnimatedEmpty — the empty state, choreographed.
 *
 * Same anatomy as shadcn's registry `Empty` —a centred block with media, title,
 * description and an actions area— and the same loose pieces, so anyone who
 * already wrote it once doesn't have to learn something else. What changes is
 * that here the block **enters**: it shows up when something emptied out or a
 * search found nothing, which are the two moments when the user is waiting to
 * see something else. A screen that fills up all at once with a notice reads as
 * an error; the same screen assembling itself from the top down reads as an
 * answer.
 *
 * Four decisions worth not undoing without looking at the rest:
 *
 * 1. **The entry order comes from the composition, not from each piece.** No
 *    part declares its own delay: the block staggers them with
 *    `staggerChildren` and the header staggers its own again. Reordering the
 *    JSX reorders the animation, and adding a piece doesn't force recomputing
 *    the others' timings. That's why every part is a motion component even
 *    though some animate nothing of their own: if one were a plain `<div>` it
 *    would break the chain of variants and what's inside would come in without
 *    a turn.
 *
 * 2. **The figure scales, the text travels.** The media lands with a bounce —
 *    it's what you look at first and it can afford to touch down. The text
 *    comes in rising 8px and without bounce: scaling a paragraph puts it on
 *    half a pixel and it reads blurry during the trip, and text that bounces
 *    reads as a line break.
 *
 * 3. **The exit runs backwards and much faster.** Wrapped in
 *    `AnimatePresence`, the block leaves from the bottom up
 *    (`staggerDirection: -1`) in a fraction of what it took to come in. That's
 *    the house rule —the exit is always faster— and it also avoids the ugly
 *    crossover when one empty state replaces another: the one leaving finishes
 *    before the one arriving scales.
 *
 * 4. **With `reducedMotion="user"` there's still choreography.** Framer drops
 *    the changes of position and scale and keeps the opacities, so the block
 *    doesn't appear all at once: it lights up in a cascade, in the same order.
 *    The only thing switched off entirely is the media's `float`, which is a
 *    loop and exactly what a user with that preference doesn't want to see.
 */

import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import {
  SizeProvider,
  useSize,
  useSizeVariant,
  type SizeVariant,
} from "@/lib/size-context";
import { surfaceClasses } from "@/lib/surface-classes";
import { useSurface } from "@/lib/surface-context";

/* ─────────────────────────── The variants ─────────────────────────── */

/**
 * The block and the header animate nothing of their own: they exist to hand out
 * turns. `delayChildren` is the breath before the first piece starts —without
 * it, the first one comes in on the same frame the block mounts and it doesn't
 * read as a cascade but as a flicker— and `staggerChildren` is the distance
 * from one piece to the next.
 *
 * The block's step is three times the header's, and that isn't a number picked
 * by eye: the block's children are groups, not lines. With the same step at
 * both levels, the footer —which is a child of the block— starts while the
 * header is still bringing out its description, and the cascade reads crossed.
 * The outer step has to cover how long the inner round lasts.
 */
/**
 * The presentation's own steps.
 *
 * `lib/springs` has three and they're for **reactions**: something the user
 * touched that has to answer right away. This is another thing —a
 * presentation, and of a large object— and at a reaction's speed you don't get
 * to see it: the figure's three beats read as a single flicker. A 128px object
 * crossing in 240ms is a flash; the same object over half a second is something
 * settling into place.
 *
 * They live here and not in `lib/springs` because that file belongs to the
 * registry, and the next `shadcn add --overwrite` takes it with it.
 */
const step = {
  /** The plate: the biggest and the first, with the most contained bounce. */
  plate: { type: "spring" as const, duration: 0.55, bounce: 0.2 },
  /** The glyph: smaller, it can bounce a bit more. */
  glyph: { type: "spring" as const, duration: 0.45, bounce: 0.25 },
  /** The stamp: 20px, and it comes from zero — here the bounce is the whole
   *  gesture. */
  stamp: { type: "spring" as const, duration: 0.5, bounce: 0.35 },
  /** The text: no bounce and shorter than the figure. A paragraph doesn't land. */
  text: { type: "spring" as const, duration: 0.32, bounce: 0 },
  /** The exit, for everyone. It's still much faster than the entry —the house
   *  rule— but not as fast as the `fast` step: against a one-second entry, 80ms
   *  reads as the block having vanished, not as it having left. */
  exit: { type: "spring" as const, duration: 0.18, bounce: 0 },
} as const;

/**
 * The turns. Each level hands out its own, and the numbers are set so that
 * **nothing starts on top of what came before**: the plate at 80ms, the glyph
 * at 280, the title at 380, the stamp at 460, the description at 680 and the
 * footer at 800 — which with its own trip closes past the one-second mark.
 *
 * The outer step is more than double the header's because its children are
 * groups and not lines: it has to cover how long the inner round lasts, or the
 * footer starts while the header is still bringing out its description.
 */
const block = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.72 } },
  exit: { transition: { staggerChildren: 0.06, staggerDirection: -1 } },
} as const;

const group = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.3 } },
  exit: { transition: { staggerChildren: 0.06, staggerDirection: -1 } },
} as const;

/** Text: it rises and lights up. It never scales — see the header's decision 2. */
const text = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: step.text },
  exit: { opacity: 0, y: 4, transition: step.exit },
} as const;

/**
 * The figure comes in over three beats and not one: the plate settles, then the
 * glyph appears and last of all the stamp.
 *
 * That's what separates an image that lights up from one that assembles itself.
 * The plate arrives tilted by 4 degrees and straightens as it lands —the
 * gesture of laying a card on the table, not of switching a lamp on— and the
 * glyph waits until there's something to rest on: having both appear together
 * leaves the glyph's scale fighting the plate's and the drawing reads as
 * trembling.
 */
const plate = {
  hidden: { opacity: 0, scale: 0.9, rotate: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    // The orchestration keys sit next to the value ones: the plate animates its
    // own thing and also hands out turns to what it carries inside. The
    // `delayChildren` lets the tilt finish straightening before what goes on
    // top of it appears.
    transition: { ...step.plate, delayChildren: 0.2, staggerChildren: 0.18 },
  },
  exit: { opacity: 0, scale: 0.96, transition: step.exit },
} as const;

/** The glyph grows from really small: it climbs further than the plate because
 *  it has to read as having appeared inside, and not as the plate having
 *  brought it along. */
const glyph = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: step.glyph },
  exit: { opacity: 0, transition: step.exit },
} as const;

/** The stamp is the last and the smallest, so it can afford to come from zero:
 *  at 20px a bounce is a detail, at 128 it would be a jump. */
const stamp = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: step.stamp },
  exit: { opacity: 0, scale: 0.6, transition: step.exit },
} as const;

/* ─────────────────────────── The block ─────────────────────────── */

type DivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>;

interface AnimatedEmptyProps extends DivProps {
  /** `dashed` draws the dotted frame that encloses the gap. It's useful when
   *  the emptiness has a shape —a card, a cell, a panel that will be filled
   *  later— and not when it takes up the whole screen, where the frame only
   *  adds a rectangle. */
  variant?: "plain" | "dashed";
  /** Pins the block to a step of the size ladder. Density travels inwards
   *  through context, so the footer's button comes in at the same size as the
   *  rest of the block instead of staying at the default. */
  size?: SizeVariant;
  children?: ReactNode;
}

function AnimatedEmpty({
  variant = "plain",
  size,
  className,
  children,
  ...props
}: AnimatedEmptyProps) {
  const sizeClasses = useSize(size);
  const compact = sizeClasses.variant === "compact";
  const shape = useShape();

  const blockDom = (
    <motion.div
      data-slot="animated-empty"
      data-variant={variant}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center text-center",
        compact ? "gap-4 p-6" : "gap-6 p-8",
        // The frame takes the container radius from the shape ladder, the same
        // one the cards use: a gap with another thing's corners reads as a
        // piece glued on from a different system.
        variant === "dashed" && cn("border border-dashed border-border", shape.container),
        className
      )}
      variants={block}
      initial="hidden"
      animate="visible"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  );

  return size ? <SizeProvider size={size}>{blockDom}</SizeProvider> : blockDom;
}

/** Groups media, title and description: what's read in one go. The max width is
 *  what makes the description break into two or three short lines instead of
 *  one long line across the panel. */
function AnimatedEmptyHeader({ className, children, ...props }: DivProps) {
  const compact = useSizeVariant() === "compact";

  return (
    <motion.div
      data-slot="animated-empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center text-center",
        compact ? "gap-1.5" : "gap-2",
        className
      )}
      variants={group}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedEmptyMediaProps extends DivProps {
  /** How much the figure weighs on screen:
   *
   *  `icon` — the small plate from shadcn's `EmptyMedia`, the size of a
   *  control. For emptiness that shares the screen with other things: a cell, a
   *  card, a side panel.
   *
   *  `figure` — the big plate. When the emptiness takes up the screen, a 20px
   *  glyph floating above a 15px title isn't a drawing of anything: the figure
   *  has to be the first thing you see and the text only after it.
   *
   *  `default` — no background, for a custom illustration. It gives the SVG a
   *  base size and steps aside if the caller brings their own. */
  variant?: "default" | "icon" | "figure";
  /** A small glyph resting in the corner of the figure — the `+` of "there
   *  aren't any yet", the clock of "it's on its way". It comes in last and from
   *  zero, and it's what turns the plate into a drawing with an idea inside.
   *  Meant for `figure`: on `icon`'s plate there's no room. */
  badge?: ReactNode;
  /** The figure floats, very slowly and very little. Off by default: an endless
   *  loop on a screen that already says "there's nothing here" is tiring. It's
   *  useful when the emptiness is the screen's normal state —an inbox at zero,
   *  a panel waiting— and not when it's the result of a search. */
  float?: boolean;
  children?: ReactNode;
}

function AnimatedEmptyMedia({
  variant = "default",
  badge,
  float = false,
  className,
  children,
  ...props
}: AnimatedEmptyMediaProps) {
  const sizeClasses = useSize();
  const compact = sizeClasses.variant === "compact";
  const shape = useShape();
  const substrate = useSurface();
  const reduceMotion = useReducedMotion();

  const floats = float && !reduceMotion;

  // The sway goes inside the variant and not in a separate `animate`: an
  // `animate` object at this layer would break the chain of variants and the
  // plate, the glyph and the stamp would be left without a turn. This layer
  // animates nothing else, so its `y` is free — and what floats ends up being
  // the whole drawing and not the glyph on its own inside its box.
  const root = useMemo(
    () =>
      floats
        ? {
            hidden: {},
            visible: {
              y: [0, -5, 0],
              // With `delay`: the plate's entry touches `y` too, and the two at
              // once step on each other halfway. The sway starts once the
              // drawing is already in place.
              transition: {
                y: {
                  duration: 4.5,
                  repeat: Infinity,
                  ease: "easeInOut" as const,
                  delay: 0.6,
                },
              },
            },
            exit: {},
          }
        : { hidden: {}, visible: {}, exit: {} },
    [floats]
  );

  // The background is shadcn's `bg-muted` translated into the system: one step
  // above the substrate, with the ladder's ring. The same plate looks right on
  // the page and inside a dialog, because it follows wherever the block is
  // placed.
  const surface = surfaceClasses(Math.min(substrate + 1, 8), 1);

  const box =
    variant === "figure"
      ? cn(
          surface,
          // Container radius and not item radius: at this scale a button's
          // radius is lost and the plate reads as a square.
          shape.container,
          compact
            ? "h-24 w-24 [&_svg]:h-9 [&_svg]:w-9"
            : "h-32 w-32 [&_svg]:h-12 [&_svg]:w-12"
        )
      : variant === "icon"
        ? cn(
            surface,
            shape.item,
            compact
              ? "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"
              : "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5"
          )
        : // No plate: the base size comes with a guard so an illustration that
          // already brings its own doesn't lose it.
          compact
          ? "[&_svg:not([class*='h-'])]:h-12 [&_svg:not([class*='w-'])]:w-12"
          : "[&_svg:not([class*='h-'])]:h-16 [&_svg:not([class*='w-'])]:w-16";

  return (
    <motion.div
      data-slot="animated-empty-media"
      data-variant={variant}
      className={cn(
        "flex shrink-0 items-center justify-center",
        variant === "figure" ? (compact ? "mb-2" : "mb-3") : compact ? "mb-0.5" : "mb-1"
      )}
      variants={root}
      {...props}
    >
      <motion.div
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
          box,
          className
        )}
        variants={plate}
      >
        <motion.span className="flex items-center justify-center" variants={glyph}>
          {children}
        </motion.span>

        {badge && (
          <motion.span
            aria-hidden
            className={cn(
              "absolute flex items-center justify-center text-muted-foreground",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
              variant === "figure"
                ? compact
                  ? "bottom-2 right-2 [&_svg]:h-4 [&_svg]:w-4"
                  : "bottom-3 right-3 [&_svg]:h-5 [&_svg]:w-5"
                : "-bottom-1 -right-1 [&_svg]:h-3.5 [&_svg]:w-3.5"
            )}
            variants={stamp}
          >
            {badge}
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );
}

function AnimatedEmptyTitle({ className, children, ...props }: DivProps) {
  const compact = useSizeVariant() === "compact";

  return (
    <motion.div
      data-slot="animated-empty-title"
      className={cn(
        "font-medium tracking-tight",
        compact ? "text-[13px]" : "text-[15px]",
        className
      )}
      variants={text}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function AnimatedEmptyDescription({ className, children, ...props }: DivProps) {
  const sizeClasses = useSize();

  return (
    <motion.p
      data-slot="animated-empty-description"
      className={cn(
        "text-muted-foreground leading-relaxed text-balance",
        sizeClasses.text,
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground",
        className
      )}
      variants={text}
      {...props}
    >
      {children}
    </motion.p>
  );
}

/** The footer: what can be done with the emptiness. It comes in last on
 *  purpose — the button is the way out, and it's offered after having said what
 *  happened. */
function AnimatedEmptyContent({ className, children, ...props }: DivProps) {
  const sizeClasses = useSize();
  const compact = sizeClasses.variant === "compact";

  return (
    <motion.div
      data-slot="animated-empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center text-balance",
        sizeClasses.text,
        compact ? "gap-2" : "gap-3",
        className
      )}
      variants={text}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export {
  AnimatedEmpty,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
  AnimatedEmptyDescription,
  AnimatedEmptyContent,
};
export type { AnimatedEmptyProps, AnimatedEmptyMediaProps };
