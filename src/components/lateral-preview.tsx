"use client";

/**
 * LateralPreview — the glance at **one** thing, in the right-hand rail.
 *
 * It takes the same place as `WidgetBoard` and is its counterpart. The board
 * answers "how's everything going?": many things, each reduced to a number.
 * This answers "what is this?": a single thing, opened far enough to decide
 * without changing screens — a conversation, a profile, a board of numbers.
 *
 * That they share the place isn't a layout coincidence: it's the same question
 * at two moments. You watch the board until something catches your eye, and
 * then the rail switches to showing that. Closing it gives the board back.
 *
 * Four decisions worth not undoing without looking at the rest:
 *
 * 1. **It's a single plane, not a list of cards.** The board is a grid because
 *    it shows things that don't touch each other; here everything on screen
 *    belongs to the same object, and splitting it into cards would suggest
 *    otherwise. What separates the zones inside is air, as in the `PeekCard`.
 *
 * 2. **The header doesn't scroll.** The name of what you're looking at and the
 *    close button have to be there at all times, especially in a long body like
 *    a conversation. Same for the footer, which is where "open the whole thing"
 *    lives.
 *
 * 3. **It climbs any layer's two steps** and publishes that level inwards, so a
 *    menu opened in here keeps rising from where it used to rise. It's the same
 *    deal as the board's tile — they share a substrate because they share a
 *    place.
 *
 * 4. **It doesn't know what it's showing.** There's one frame and whoever uses
 *    it supplies the body, with the pieces below or with anything else. One
 *    component per kind of thing —conversation, profile, statistics— would be
 *    three identical frames with three different bodies, and the frame is
 *    precisely the only part that doesn't change.
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Elevated } from "@/lib/elevated";
import type { IconComponent } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";

/** Steps the plane climbs over the rail's substrate: the two of any layer that
 *  rests on it. The same ones as the tile. */
const PLANE_RISE = 2;

interface LateralPreviewProps {
  title: string;
  /** The line under the title: what kind of thing this is and its shortest
   *  fact — "Conversation · 12 messages", "Design · since March". */
  subtitle?: string;
  icon?: IconComponent;
  /** Without this there's no close button. The preview doesn't own what's being
   *  shown: it only reports. */
  onClose?: () => void;
  /** The footer, pinned below the body. Usually a wide button that leads to the
   *  full view of whatever the preview summarizes. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

function LateralPreview({
  title,
  subtitle,
  icon: Icon,
  onClose,
  footer,
  children,
  className,
}: LateralPreviewProps) {
  const shape = useShape();
  const typeScale = useTypeScale();

  return (
    <Elevated
      offset={PLANE_RISE}
      className={cn(
        // It fills whatever it's given: in the rail that's the whole height, in
        // a bounded container it's that height. A preview that shrank to its
        // content would leave half a column empty below it, and the rail isn't
        // a list of cards but a place you occupy entirely.
        "flex h-full min-h-0 flex-col overflow-hidden",
        shape.container,
        className,
      )}
    >
      {/* The header. `shrink-0` and outside the scrolling part: see decision 2. */}
      <header className="flex shrink-0 items-start gap-2 p-4 pb-3">
        {Icon && (
          <Icon
            size={typeScale.subtitle}
            strokeWidth={1.75}
            className="mt-px shrink-0 text-muted-foreground"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="min-w-0 truncate font-medium"
            style={{ fontSize: typeScale.subtitle }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className="min-w-0 truncate text-muted-foreground"
              style={{ fontSize: typeScale.caption }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Always visible, unlike the one on the board's tiles: over there four
            cards with a button each would be noise, here there's a single thing
            and closing it is the likeliest action after looking at it. */}
        {onClose && (
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className={cn(
              "-mt-1 -mr-1 inline-flex shrink-0 items-center justify-center",
              "cursor-pointer rounded-md outline-none",
              "text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
              "size-6 [&_svg]:size-3.5",
            )}
          >
            <X />
          </button>
        )}
      </header>

      {/* The body is the only part that gives: `min-h-0` is what lets it clip
          instead of pushing the header and the footer out of the plane. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scroll-fade">
        {children}
      </div>

      {footer && (
        <div className="shrink-0 px-4 pt-1 pb-4">{footer}</div>
      )}
    </Elevated>
  );
}

/* ── The body's pieces ──────────────────────────────────────────────────── */

/**
 * A group with its label. It's what separates the body's zones without drawing
 * cards inside the card — see decision 1.
 */
function PreviewGroup({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const typeScale = useTypeScale();
  return (
    <section className={cn("flex flex-col gap-2 py-2", className)}>
      {label && (
        <span
          className="font-medium text-muted-foreground"
          style={{ fontSize: typeScale.caption }}
        >
          {label}
        </span>
      )}
      {children}
    </section>
  );
}

/** A line of data: the label on the left, the value on the right. */
function PreviewRow({ label, value }: { label: string; value: ReactNode }) {
  const typeScale = useTypeScale();
  return (
    <div
      className="flex items-baseline justify-between gap-3"
      style={{ fontSize: typeScale.body }}
    >
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

/** A big number with its label underneath. For the statistics preview. */
function PreviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  const typeScale = useTypeScale();
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-muted-foreground"
        style={{ fontSize: typeScale.caption }}
      >
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[22px] leading-none font-medium tracking-tight">
          {value}
        </span>
        {hint}
      </span>
    </div>
  );
}

/**
 * A message from the conversation.
 *
 * It deliberately doesn't reuse the registry's `ChatMessage`: that one is built
 * for a chat's reading width, with its row of hover actions and its
 * attachments. Here it's a glance in a narrow column — what's needed is who
 * said what, and that your own messages read differently from theirs.
 */
function PreviewMessage({
  from,
  time,
  own = false,
  children,
}: {
  from: string;
  time?: string;
  /** The message belongs to whoever is looking. It aligns right and sits on a
   *  fill, as in any chat. */
  own?: boolean;
  children: ReactNode;
}) {
  const typeScale = useTypeScale();
  const shape = useShape();

  return (
    <div className={cn("flex flex-col gap-1", own && "items-end")}>
      <span
        className="flex items-baseline gap-1.5 text-muted-foreground"
        style={{ fontSize: typeScale.caption }}
      >
        <span className="font-medium">{from}</span>
        {time && <span>{time}</span>}
      </span>
      <span
        className={cn(
          "max-w-[85%] px-3 py-1.5",
          shape.bg,
          own ? "bg-hover" : "bg-surface-1",
        )}
        style={{ fontSize: typeScale.body }}
      >
        {children}
      </span>
    </div>
  );
}

export {
  LateralPreview,
  PreviewGroup,
  PreviewRow,
  PreviewStat,
  PreviewMessage,
};
export type { LateralPreviewProps };
