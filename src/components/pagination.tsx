"use client";

/**
 * Pagination — which page you're on, and the two ways out of it.
 *
 * The whole component is one number and two arrows, so what it's worth
 * spending on is the number: it doesn't blink from one value to the next, it
 * **rolls**, digit by digit and in the direction it was sent. That's the piece
 * that says the list moved instead of being replaced, which is the only thing
 * a pager has to say.
 *
 * Six decisions worth not undoing without looking at the rest:
 *
 * 1. **Only what changed moves.** Each digit is a column of its own, and a
 *    column whose digit didn't change doesn't animate: from 19 to 29 the units
 *    stay still and only the tens roll. It's the difference between a counter
 *    and a card that flips: the eye follows the digit that moved because it's
 *    the only thing that moved.
 *
 * 2. **The key of a digit is a counter, not the digit.** The obvious thing is
 *    to key each digit by itself and let `AnimatePresence` do the rest. It
 *    breaks on the way back: going 1 → 2 → 1 faster than the exit takes puts
 *    two `"1"`s inside the same presence, and two children with the same key
 *    is a React error and a digit that flickers. A per-column tick that only
 *    goes up is always a new key, and it goes up exactly when that column's
 *    digit changed — which is also what buys decision 1.
 *
 * 3. **The direction comes from the number, not from the button.** It's read
 *    from the move —`page > previous`— and not stored when the arrow is
 *    pressed, so a jump made from outside (a "last page" button, a link, the
 *    browser's history) rolls the right way too. A controlled pager whose value
 *    lands from anywhere is the normal case, not the exception.
 *
 * 4. **The counter keeps the widest page's room.** The row of digits reserves
 *    as many characters as the total has and fills from the right, so going
 *    from 9 to 10 doesn't shove the label and the buttons sideways. A pager
 *    that moves while you're clicking it is a pager you click twice.
 *
 * 5. **The bar is the tint and the arrows are what's raised on it.** The frame
 *    paints `--accent` —the fill a `secondary` control has— and the two buttons
 *    climb the surface ladder over it, which is the same relationship the
 *    window controls have with the panel's bar: a plane that recedes, and round
 *    pieces that sit on it with their own shadow. They're the registry's
 *    `Button` in its `ghost` variant, so the hover comes from the interaction
 *    tokens over the raised surface and not from a second fill; and they bring
 *    no `whileTap`, because the button already collapses its own geometry when
 *    pressed. Two components animating the same press is one too many.
 *
 * 6. **Out loud it's one sentence, not a column of digits.** The rolling
 *    numerals are `aria-hidden` —read one by one they're "one, five", not
 *    fifteen— and what gets announced is a live region with the whole line.
 *    The two arrows are the keyboard path and they're already reachable, so the
 *    component adds no shortcuts of its own.
 */

import { forwardRef, useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useIcon } from "@/lib/icon-context";
import { useTypeScale, useSizeVariant, type SizeVariant } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { surfaceClasses } from "@/lib/surface-classes";
import { useSurface } from "@/lib/surface-context";
import { cn } from "@/lib/utils";

/* ── The roll ──────────────────────────────────────────────────────────── */

/**
 * How far a digit travels, as a share of its box.
 *
 * It has to be more than half or the digit fades out in the middle of the
 * column instead of being cut off by its edge, and the cut is what makes the
 * thing read as an odometer and not as a crossfade.
 */
const TRAVEL = 0.7;

/** The blur is what turns the swap into speed: a digit that crosses its box in
 *  a quarter of a second and stays sharp reads as two digits, not as one
 *  moving. Small — 2px on a 16px glyph — because past that it's a smudge. */
const BLUR = "blur(2px)";

const rollVariants = (travel: number) => ({
  initial: (dir: number) => ({
    y: dir >= 0 ? travel : -travel,
    opacity: 0,
    scale: 0.6,
    filter: BLUR,
  }),
  animate: { y: 0, opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    y: dir >= 0 ? -travel : travel,
    opacity: 0,
    scale: 0.6,
    filter: BLUR,
  }),
});

/** With reduced motion the digit still changes —it's the content— but it does
 *  it by fading, without travelling or blurring. */
const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * The roll's own beat.
 *
 * `lib/springs` has three tiers and they're for reactions: something the
 * pointer touched that has to answer *now*. The digit is the answer to the
 * click, so it lands on the system's slowest tier and not on a beat of its own:
 * at `moderate` a number crossing its box is a flicker, and the point of this
 * component is that the move can be seen.
 */
const roll = spring.slow;

/* ── Types ─────────────────────────────────────────────────────────────── */

/** What this render draws with. It's kept whole and not as four states because
 *  the four are read together and change together, on the render where the page
 *  moved. */
interface Memoria {
  page: number;
  digits: string[];
  /** One per column, right-aligned. Goes up when that column's digit changed —
   *  see decision 2. */
  ticks: number[];
  /** 1 forward, -1 back, 0 while nothing has moved yet. */
  dir: number;
  /** Which columns didn't exist before this page — the tens, going from 9 to
   *  10. One per column, right-aligned like the ticks. */
  nuevas: boolean[];
}

interface PaginationProps {
  /** How many pages there are. Also how much room the counter reserves. */
  total: number;
  /** Controlled page, 1-based. Without it the component keeps its own. */
  value?: number;
  /** @default 1 */
  defaultValue?: number;
  /** Fires only when the page actually changes: asking for the page you're
   *  already on isn't a change. */
  onValueChange?: (page: number) => void;
  /** Pins the control to one step of the size ladder. Omitted, it follows the
   *  surrounding SizeProvider. */
  size?: SizeVariant;
  /** Accessible name of the whole thing. @default "Pagination" */
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  /** The word between the page and the total, visible and out loud.
   *  @default "of" */
  ofLabel?: string;
  className?: string;
}

/* ── The component ─────────────────────────────────────────────────────── */

const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    total,
    value,
    defaultValue = 1,
    onValueChange,
    size,
    label = "Pagination",
    previousLabel = "Previous page",
    nextLabel = "Next page",
    ofLabel = "of",
    className,
  },
  ref,
) {
  /* The two glyphs are fixed —they're not props: a pager that points somewhere
     else isn't a pager— so they come from the icon system, which is what lets an
     app swap the whole set. They travel in an object because a capitalised local
     read as JSX is, to the linter, a component declared inside a render; through
     a member expression it's the same component and the same swap. */
  const flecha = {
    atras: useIcon("arrow-left"),
    adelante: useIcon("arrow-right"),
  };
  const compact = useSizeVariant(size) === "compact";
  const type = useTypeScale(size);
  const reduceMotion = useReducedMotion() ?? false;

  /* Where the buttons stand on the surface ladder. Two steps over whatever the
     pager landed on, like anything raised in this system — but never under the
     fifth, because the tint the bar paints (`--accent`) reads as the third rung
     in the dark key, and a button below it doesn't look raised, it looks sunk.
     In the light key the ladder is already white from the third rung up, so the
     floor costs nothing there. */
  const escalon = Math.min(Math.max(useSurface() + 2, 5), 8);

  const [interna, setInterna] = useState(defaultValue);
  const page = Math.min(Math.max(value ?? interna, 1), Math.max(total, 1));

  const digits = String(page).split("");

  /* The memory of the previous page, and the tick of each column. It's state
     and not a ref because it's read while rendering: a ref written during a
     render that React then throws away —a pass that doesn't commit, StrictMode's
     double render— would advance the ticks for a page that was never drawn. */
  const [prev, setPrev] = useState<Memoria>(() => ({
    page,
    digits,
    ticks: digits.map(() => 0),
    dir: 0,
    /* Nothing is new on the first render: a pager that rolls on load is
       announcing a move that didn't happen. */
    nuevas: digits.map(() => false),
  }));

  /* The memory this render draws with: the stored one while the page hasn't
     moved, and the one the move produces on the render where it does. Adjusting
     it here and not in an effect is what keeps the digit's key and its
     direction in the same commit as the number: from an effect the digit would
     be drawn once with the old key and roll one frame later. */
  const memoria: Memoria =
    prev.page === page
      ? prev
      : {
          page,
          digits,
          /* Columns line up from the right —units against units— so a page that
             gains a digit doesn't shift every tick by one and set the whole
             number rolling. */
          ticks: digits.map((digit, i) => {
            const j = i - (digits.length - prev.digits.length);
            const antes = j >= 0 ? prev.digits[j] : undefined;
            const tick = j >= 0 ? prev.ticks[j] : 0;
            return digit === antes ? tick : tick + 1;
          }),
          dir: page > prev.page ? 1 : -1,
          nuevas: digits.map(
            (_, i) => i - (digits.length - prev.digits.length) < 0,
          ),
        };

  if (memoria !== prev) setPrev(memoria);

  const ir = useCallback(
    (delta: number) => {
      const next = Math.min(total, Math.max(1, page + delta));
      if (next === page) return;
      if (value === undefined) setInterna(next);
      onValueChange?.(next);
    },
    [page, total, value, onValueChange],
  );

  /* The counter's own box. The digit's column is taller than the glyph —that's
     where the roll happens and where it gets cut off— and the whole row sits on
     the control's line, so the three pieces of the bar share one baseline. */
  const fuente = compact ? type.subtitle : type.title;
  const alto = Math.round(fuente * 1.6);
  const variants = reduceMotion ? fadeVariants : rollVariants(Math.round(alto * TRAVEL));

  return (
    <nav ref={ref} aria-label={label} className={cn("inline-flex w-fit", className)}>
      {/* One frame holding the three pieces, so they read as one object and not
          as two buttons that happen to be near a number. It's a tint and not a
          step of the ladder: what's raised here are the arrows, and a plane that
          climbs under them would leave them with nothing to climb over.

          Round, and not `shape.container`: the circle is part of a window
          control's identity and the bar is the pill that holds two of them —
          the same exception `WindowControls` already makes to the shape
          system, and for the same reason. */}
      <div
        className={cn(
          "flex items-center rounded-full bg-accent",
          compact ? "gap-1 p-1" : "gap-1.5 p-1.5",
        )}
      >
        <Button
          /* `ghost` and not `secondary`: the raised surface is painted here,
             from the ladder, and ghost's layer stays transparent over it — so
             the hover is the interaction token darkening the piece instead of a
             second fill replacing it. */
          variant="ghost"
          size={compact ? "icon-compact" : "icon"}
          className={cn(
            "rounded-full text-muted-foreground hover:text-foreground",
            surfaceClasses(escalon),
          )}
          aria-label={previousLabel}
          disabled={page <= 1}
          onClick={() => ir(-1)}
        >
          <flecha.atras />
        </Button>

        <div
          aria-hidden
          className="flex select-none items-center tabular-nums"
          style={{ fontSize: fuente, height: alto }}
        >
          {/* The row keeps the widest page's room and fills from the right —
              decision 4 — so nothing beside it moves when a digit is gained. */}
          <div
            className="flex justify-end"
            style={{ minWidth: `${String(total).length}ch` }}
          >
            {digits.map((digit, i) => (
              <div
                /* Keyed by its distance from the right and not by its index:
                   that way the units column is the same column before and after
                   the number gains a digit, and it's the new one on the left
                   that mounts. */
                key={digits.length - 1 - i}
                className="relative w-[1ch] overflow-hidden"
                style={{ height: alto }}
              >
                {/* A column that appears later rolls in like any other digit
                    —`initial` is only read on the presence's first render, and
                    a column's presence is born with the column. It travels
                    inside the memory so it survives the adjust: the render that
                    commits is the second one, and by then the page is no longer
                    "new". */}
                <AnimatePresence
                  initial={memoria.nuevas[i] ?? false}
                  custom={memoria.dir}
                >
                  <motion.span
                    key={memoria.ticks[i]}
                    custom={memoria.dir}
                    variants={variants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={reduceMotion ? { duration: 0 } : roll}
                    className="absolute inset-0 flex items-center justify-center font-medium text-foreground"
                  >
                    {digit}
                  </motion.span>
                </AnimatePresence>
              </div>
            ))}
          </div>

          <span className="ml-[0.5ch] whitespace-nowrap text-muted-foreground">
            {ofLabel} {total}
          </span>
        </div>

        <Button
          variant="ghost"
          size={compact ? "icon-compact" : "icon"}
          className={cn(
            "rounded-full text-muted-foreground hover:text-foreground",
            surfaceClasses(escalon),
          )}
          aria-label={nextLabel}
          disabled={page >= total}
          onClick={() => ir(1)}
        >
          <flecha.adelante />
        </Button>
      </div>

      {/* What's actually read out: one sentence, and only when it changes.
          `polite` because moving pages is something the person just did — it
          doesn't interrupt what's being read, it lands after. */}
      <span aria-live="polite" className="sr-only">
        {page} {ofLabel} {total}
      </span>
    </nav>
  );
});

export { Pagination };
export type { PaginationProps };
