"use client";

/**
 * Widget — a view declared once that knows how to show itself at three sizes.
 *
 * It isn't a fourth kind of card next to `Card`, `PeekCard` and `InsetDialog`.
 * It's an **axis**, like the size ladder or the surface one: what changes from
 * step to step isn't the component but how much detail of the same thing is on
 * screen.
 *
 *   glance  the board's tile — a number, a status, a row
 *   peek    the `PeekCard`, stuck to the tile — the summary with tabs
 *   full    the `WorkspacePanel`'s tab — the whole view
 *
 * The two upper steps were already built. The only new thing is the glance and
 * the descriptor that ties them together.
 *
 * Seven decisions worth not undoing without looking at the rest:
 *
 * 1. **The tile doesn't open the tab: it becomes it.** That's the whole point
 *    of the concept and the only thing that can go wrong, so it comes first. On
 *    opening, the tile's plane and the full view's share a `layoutId`, and
 *    since the panel only mounts the active tab, one unmounts in the very
 *    commit the other mounts: Framer recognizes them as the same object and
 *    carries it from one place to the other. Without that the view appears out
 *    of nowhere and the board doesn't read as the place it came from.
 *
 * 2. **`glance` and `full` are functions, not `ReactNode`.** The board mounts
 *    many widgets at once and needs only the glance from each; with prebuilt
 *    nodes it would assemble all three steps of every widget on every render.
 *    That's the difference from `WorkspaceTab.content`, which is a node because
 *    by then opening that tab is already decided.
 *
 * 3. **Size is a ladder; order is a drag.** `1x1`, `2x1`, `2x2` on a grid that
 *    responds to its container's width — how big a widget is stays a decision
 *    of the region, not something the hand stretches. Where it sits is another
 *    matter: `WidgetCard` lets the board be rearranged by dragging, and it
 *    does it on the motion the app already has, without a grid library and
 *    without a second source of truth about layout — the order is a list of
 *    ids, and the owner of the list is whoever passes it in.
 *
 * 4. **The tile climbs any layer's two steps.** `Elevated` applies them and
 *    publishes that level inwards, so a menu opened inside a widget keeps
 *    rising from where it used to rise. No new surface code.
 *
 * 5. **The widget's id is its tab's id.** `openTab` doesn't duplicate by id:
 *    tapping the same tile twice focuses the tab that's already open instead of
 *    mounting another. That's why the descriptor has one id and not two.
 *
 * 6. **A widget is drawn once per screen.** It's the flip side of decision 1:
 *    the `layoutId` comes from the id, so two tiles of the same widget mounted
 *    at once are, as far as Framer is concerned, the same object in two places
 *    — and it crosses them, leaving one at zero opacity and shifted towards the
 *    other. If two views of the same data are genuinely needed, that's two
 *    descriptors with two ids.
 *
 * 7. **With the view open, the tile leaves a gap.** It follows from decision 6
 *    and it's what lets the board live off to the side, always mounted, without
 *    colliding with the tab it opened: while the widget is the active tab its
 *    cell doesn't draw the plane but the outline of where it was. That way the
 *    plane exists in a single place at a time —the move stays a move— and it
 *    also reads better than a tile sitting still showing the same thing as the
 *    screen next to it: the object left, and the board says so.
 *
 * It hangs off a `WorkspaceProvider` — that's who opens the tab. Without one it
 * throws, same as `WorkspacePanel` without its `SidebarProvider`.
 */

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { X } from "lucide-react";

import { PeekCard, type PeekCardTab } from "@/components/peek-card";
// The span belongs to the cell, and the cell is the card's: a widget only
// declares how much room it asks for.
import type { WidgetSpan } from "@/components/widget-card";
import { useWorkspace } from "@/components/workspace-context";
import type { WorkspaceTab } from "@/components/workspace-panel";
import { Elevated } from "@/lib/elevated";
import type { IconComponent } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { useTypeScale } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

/** Steps the widget's plane climbs over the board's substrate: the two of any
 *  layer that rests on it, like a popup. */
const PLANE_RISE = 2;

interface WidgetDefinition {
  /** Unique and stable. It's also the id of the tab it opens, so tapping the
   *  tile twice focuses instead of duplicating. */
  id: string;
  label: string;
  icon: IconComponent;
  /** @default "1x1" */
  span?: WidgetSpan;
  /** The glance: what you see on the board without opening anything. A number,
   *  a status, a short row. */
  glance: () => ReactNode;
  /** The middle step, in a `PeekCard` anchored to the tile. Omitted, the tile
   *  goes straight from the glance to the full view. */
  peek?: PeekCardTab[];
  /** The full view, the one that opens as a tab of the panel. */
  full: () => ReactNode;
}

/** The button that takes the widget off the board. It lives in the header, and
 *  also in the gap the tile leaves while its view is open: you have to be able
 *  to drop a widget from the board without closing the tab it opened first.
 *
 *  It sits above the surface that opens the widget —hence the `z-10`— and is
 *  always in the layout even when it can't be seen: if it only appeared on
 *  hover, the name would shift under your hand. It's the same thing the close
 *  button on the panel's tabs does. */
function WidgetClose({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      // The card reads presses on the capture phase, so stopping the bubble
      // isn't enough to keep a drag from starting on the ×.
      data-no-drag
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className={cn(
        "relative z-10 -mr-1 inline-flex shrink-0 items-center justify-center",
        "cursor-pointer rounded-md outline-none",
        "opacity-0 transition-opacity duration-80",
        "group-hover/widget:opacity-100 focus-visible:opacity-100",
        "hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        "size-5 [&_svg]:size-3",
      )}
    >
      <X />
    </button>
  );
}

/** The `layoutId` the tile and the full view share. It's what makes one become
 *  the other instead of replacing it. */
const planeId = (id: string) => `widget-plane-${id}`;

/* `Elevated` already knows how to stand on the substrate and publish its step
   inwards; the only thing it's missing for the move is being a motion node.
   Wrapping it in a separate `motion.div` would split the plane into two boxes
   —the one that travels and the one that paints— and the shadow would travel a
   frame behind the background. */
const MotionElevated = motion.create(Elevated);

/**
 * The widget's plane: the surface that travels from the board to the tab.
 *
 * Both steps use it with the same `layoutId`, so its shape has to come from the
 * same decision on both sides — the radius above all: if the tile and the full
 * view don't share a corner, the move looks like a change of figure and not
 * like the same object growing.
 */
function WidgetPlane({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const shape = useShape();
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <MotionElevated
      layoutId={planeId(id)}
      /* The plane is the same object at both steps, and the attribute says so:
         it's there to hook onto from the outside —a test measuring the move, a
         style in the app— without depending on what's inside, which is exactly
         what changes on opening. */
      data-widget-plane={id}
      offset={PLANE_RISE}
      /* `spring.slow` and not the popups' one: this is a change of context —the
         whole screen becomes something else— and it's the step the system
         reserves for dialogs. With reduced motion the object doesn't travel,
         but `layoutId` still hands over without animating. */
      transition={reduceMotion ? { duration: 0 } : spring.slow}
      className={cn("overflow-hidden", shape.container, className)}
    >
      {children}
    </MotionElevated>
  );
}

/**
 * What's inside the plane fades in and doesn't travel.
 *
 * The plane changes size during the move, so whatever it carries stretches with
 * it. A short fade over the end of the trip covers that distortion and also
 * settles the fact that the two steps show different things: what comes in
 * isn't what was there.
 */
function WidgetContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.12, delay: spring.slow.duration * 0.5 }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * The tile: the widget at its smallest step.
 *
 * It's a `<button>` and not a div with `onClick`: it opens a view, which is
 * what a button does, and that way it works from the keyboard without having to
 * give it a `tabIndex` or listen for Enter by hand.
 */
function WidgetTile({
  widget,
  onClose,
  className,
}: {
  widget: WidgetDefinition;
  /** Without this there's no close button: it would have nothing to do. The
   *  tile doesn't own the board's list, so it only reports. */
  onClose?: () => void;
  className?: string;
}) {
  const { openTab, activeId } = useWorkspace();
  const typeScale = useTypeScale();
  const Icon = widget.icon;

  /* The plane went off to the tab: what's left here is the cell. The comparison
     is against the **active** tab and not the open ones, because the panel only
     mounts the active one — which is exactly when the other plane exists. */
  const abierto = activeId === widget.id;

  if (abierto) {
    return (
      <div
        className={cn(
          "group/widget flex h-full flex-col gap-2 rounded-xl border border-dashed border-border p-4",
          className,
        )}
      >
        <header className="flex min-w-0 items-center gap-2 bg-transparent text-muted-foreground/60">
          <Icon size={typeScale.caption} strokeWidth={1.75} className="shrink-0" />
          <span
            className="min-w-0 flex-1 truncate font-medium"
            style={{ fontSize: typeScale.caption }}
          >
            {widget.label}
          </span>
          {onClose && <WidgetClose label={widget.label} onClose={onClose} />}
        </header>
        <span
          className="flex flex-1 items-end text-muted-foreground/60"
          style={{ fontSize: typeScale.caption }}
        >
          Open alongside
        </span>
      </div>
    );
  }

  const tile = (
    <div className="relative h-full">
      <div className="flex h-full flex-col gap-2 p-4">
        {/* The header carries no fill of its own: it's the tile's own plane, and
            what separates it from the glance is air. A fill here would split
            the card into two surfaces to gain nothing — the name is already at
            the top and in grey, which is all a heading this size has to do. */}
        <header className="flex min-w-0 items-center gap-2 bg-transparent text-muted-foreground">
          <Icon size={typeScale.caption} strokeWidth={1.75} className="shrink-0" />
          <span
            className="min-w-0 flex-1 truncate font-medium"
            style={{ fontSize: typeScale.caption }}
          >
            {widget.label}
          </span>

          {onClose && <WidgetClose label={widget.label} onClose={onClose} />}
        </header>

        <div className="min-h-0 flex-1">{widget.glance()}</div>
      </div>

      {/* What opens the widget is a surface covering the whole card and not the
          `<div>` above: a button can't hold another button inside, and the
          close one has to live in the header. It comes later in the DOM so it
          sits above everything except what's raised with `z-10`. */}
      <button
        type="button"
        /* The click deliberately doesn't reach the plane. With `peek` set the
           plane is the `PeekCard`'s trigger, and Base UI opens it on click too
           —it does that so on a touch screen, where there's no pointer, there's
           still some way to see it—. Here the click is already taken by the
           full view, so it's stopped before it bubbles: hover is left for the
           middle step and click for the top one. On touch that means a finger
           opens the full view directly, which is what you expect from a tile. */
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openTab(toWidgetTab(widget));
        }}
        aria-label={`Open ${widget.label}`}
        className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );

  const plane = (
    <WidgetPlane id={widget.id} className={cn("group/widget h-full", className)}>
      <WidgetContent className="h-full">{tile}</WidgetContent>
    </WidgetPlane>
  );

  /* The middle step opens on hover and not on click: the click is already taken
     by the full view. It's the same reason `PeekCard` takes the gesture as a
     prop and not as a separate component. */
  if (!widget.peek) return plane;

  return (
    <PeekCard
      title={widget.label}
      icon={widget.icon}
      tabs={widget.peek}
      openOn="hover"
      side="bottom"
      align="start"
      nativeButton={false}
    >
      {plane}
    </PeekCard>
  );
}

/**
 * The descriptor, wrapped as a `WorkspacePanel` tab.
 *
 * The full view goes inside the same plane as the tile —same `layoutId`, same
 * corner—, which is what turns opening into a move. The padding is set here and
 * not by the panel: the plane belongs to the widget.
 */
function toWidgetTab(widget: WidgetDefinition): WorkspaceTab {
  return {
    id: widget.id,
    label: widget.label,
    icon: widget.icon,
    content: (
      <div className="h-full p-2">
        <WidgetPlane id={widget.id} className="h-full">
          <WidgetContent className="h-full overflow-y-auto p-6">
            {widget.full()}
          </WidgetContent>
        </WidgetPlane>
      </div>
    ),
  };
}

// `toWidgetTab` travels with the descriptor: it's what turns a widget into the
// tab it opens, and it's useful for opening one from somewhere with no tile —a
// command palette, a link—. Moving it to another file just to please fast
// refresh would separate it from the type it translates.
// oxlint-disable-next-line react/only-export-components
export { WidgetTile, WidgetPlane, WidgetContent, toWidgetTab };
export type { WidgetDefinition, WidgetSpan };
