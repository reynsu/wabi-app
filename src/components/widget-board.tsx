"use client";

/**
 * WidgetBoard — the grid of tiles, and where the views come from.
 *
 * It's every widget's `glance` step at once: the screen you look at without
 * opening anything. Five decisions:
 *
 * 1. **It measures its container, not the window.** The board lives inside the
 *    panel, whose width changes with the sidebar: a viewport `md:` would give
 *    it four columns with the sidebar open and those same four squeezed once
 *    it closes. With `@container` the split comes from what the board actually
 *    measures, same as `LoginBlock`.
 *
 * 2. **Rows have a fixed height.** That's what makes the size ladder mean
 *    something: a `2x2` takes exactly two rows and two columns, not however
 *    much its content wants. A board where every tile is as tall as it likes is
 *    a list of cards, not a grid.
 *
 * 3. **The empty state is `AnimatedEmpty`.** A board with no widgets is the
 *    normal state of a freshly opened app, not an error: it comes in
 *    choreographed and with the figure floating, which is exactly the case
 *    `float` exists for.
 *
 * 4. **The list scrolls without a bar.** Not the region around it either: the
 *    header stays put —there's a way out of the board in it— and what moves is
 *    the grid. What says there's more is `scroll-fade`, the cells dissolving
 *    towards the edge that still has some; the bar itself is hidden, because a
 *    track pinned to the edge of a column this narrow either rides over a tile
 *    or eats the air that keeps the grid centred in the rail. It's the same
 *    treatment as the panel's tab row and the `PeekCard`'s rail.
 *
 * 5. **It's a plane, not a transparent region.** The cells are the objects and
 *    the board only arranges them, which is an argument for painting nothing —
 *    and on screen it means the region has no edge: dropped on the shell it's
 *    the shell's own colour. So it climbs the two steps of any layer resting on
 *    its substrate and carries its shadow — two, and not one, because in the
 *    light key the ladder is three values wide and one step reads as dull
 *    rather than raised next to the panel's white plane.
 *
 * 6. **It arranges, it doesn't own.** Every cell is a `WidgetCard`, and cards
 *    can be dragged from one place to another — but only where there's an
 *    `onReorder` to report to, same rule as the close buttons. The board keeps
 *    the arrangement while the hand is moving and hands back the list of ids
 *    when the card lands; whoever passes `widgets` is still the one who owns
 *    the list. Anything else can be dropped in as a `WidgetCard` child: the
 *    board arranges cells, and what's inside a cell is not its business.
 */

import {
  Children,
  isValidElement,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { LayoutPanelTop, Plus } from "lucide-react";

import {
  AnimatedEmpty,
  AnimatedEmptyContent,
  AnimatedEmptyDescription,
  AnimatedEmptyHeader,
  AnimatedEmptyMedia,
  AnimatedEmptyTitle,
} from "@/components/animated-empty";
import { WidgetTile, type WidgetDefinition } from "@/components/widget";
import {
  WidgetCard,
  WidgetGrid,
  type WidgetCardProps,
  type WidgetCell,
  type WidgetSpan,
} from "@/components/widget-card";
import { Elevated } from "@/lib/elevated";
import { useShape } from "@/lib/shape-context";
import { useSurface } from "@/lib/surface-context";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";

/**
 * A row's height. A `2x2` is two of these plus the gap in between.
 *
 * It isn't a number picked by eye: it's what has to fit in the base cell
 * without the plane's `overflow-hidden` eating anything. The densest glance the
 * system invites you to write —a label and five lines— asks for 186px in a
 * narrow rail, where the right-hand column wraps "2 days ago" onto two lines.
 * At 168 the last line came out clipped.
 */
const ROW = 192;

/** The air between cells, and the air the board leaves against its container.
 *  The same number for both: if the inner gap differed from the outer edge, the
 *  grid would read as off-centre inside the rail. */
const GAP = 16;

/** Air the scrolling box gives back to the cards, and takes off its own margin
 *  so nothing moves.
 *
 *  A plane's first shadow layer is a 1px ring painted *outside* its box, and
 *  this box clips: `overflow-y: auto` makes the horizontal axis clip too, so a
 *  grid flush with its scroller loses the top edge of the first row and the
 *  side edges of every card — the bottom survives because there's content
 *  under it, which is exactly the "no top, no sides" a card ends up drawing.
 *  Bleeding the scroller out by this much and padding it back in leaves the
 *  grid in the same place with room for the ring; it stays inside the board
 *  because it's smaller than `GAP`. */
const RING_ROOM = 4;

/**
 * Steps the board's plane climbs over its substrate, and how far over the plane
 * its shadow goes.
 *
 * Without a plane the board is transparent, which reads fine on paper —the
 * cells are the objects and the board only arranges them— and on screen means
 * the region has no edge: dropped straight on the shell it's the shell's own
 * colour, and all that's left of the boundary is whatever shadow each card
 * casts. The same thing that happens to a panel sitting flush with its
 * substrate.
 *
 * **Two steps and not one**, which are the ones of any layer resting on its
 * substrate and the same ones `LateralPreview` takes, so the rail doesn't change
 * depth depending on which of the two it's holding.
 *
 * The light key is what settles it. Up there the ladder has three values —
 * `#FAFAFA`, `#FCFCFC` and white from the third rung on— so one step leaves the
 * board two units off the shell and its own cells three units off it: a region
 * that doesn't read as raised but as *dull*, right next to a panel whose reading
 * plane is white. Two steps put its face on that same white, which is the only
 * tone the ladder has left up there, and the two regions read as what they are —
 * the same rank, side by side. What the cells lose in tone they already carry in
 * their own shadow, which is how anything sits on a white plane in this system.
 *
 * Which is why the shadow goes two rungs over the plane **while the plane is
 * near the floor of the ladder**: down there the light key is flat —`#FAFAFA`
 * against `#FCFCFC` is 2%— and the region's silhouette has to be the shadow,
 * the same pairing the `WorkspacePanel` makes with its bar. Higher up the
 * colour already does the work and the shadow goes back to the plane's own
 * rung, which is what keeps a board dropped inside a page from casting the
 * halo of a dialog.
 */
const PLANE_RISE = 2;
const PLANE_SHADOW_RISE = 2;
/** Where the boost stops: past this rung the ladder moves on its own. */
const PLANE_SHADOW_CAP = 4;


interface WidgetBoardProps {
  /** The widgets, in the order they're drawn. Optional: a board can be made
   *  only of `WidgetCard` children. */
  widgets?: WidgetDefinition[];
  /** Cells that aren't widgets — `WidgetCard`s with anything inside. They're
   *  drawn after the widgets and rearrange along with them: to the board a
   *  cell is a cell. A child without an `id` is ignored, because an id is what
   *  the order is made of. */
  children?: ReactNode;
  /** Reorders. The board doesn't own the list —it takes it through props— so
   *  it hands back the ids in their new order and whoever uses it sorts
   *  `widgets`. Without this callback nothing drags: no grab cursor, no tab
   *  stop, no listeners. */
  onReorder?: (ids: string[]) => void;
  /** Takes a card dropped from another board. It gets the id, the place it
   *  landed in and whatever the card was carrying —for a widget, its
   *  descriptor— and returning `false` refuses it, which sends the card back
   *  where it came from. Without this the board isn't a destination: a card
   *  from elsewhere can hover over it and nothing will happen.
   *
   *  It needs a shared `WidgetDragProvider` above both boards; two boards each
   *  with their own context can only sort their own cells. */
  onAdd?: (id: string, index: number, data: unknown) => boolean | void;
  /** One of its cards was taken by another board. Without this its cards can
   *  be rearranged but they can't leave. */
  onRemove?: (id: string) => void;
  /** The cards it builds for `widgets` are sources: dropping one on another
   *  board leaves the original here and lands a copy of it there, under an id
   *  of its own. It's what turns a board into a palette — and with it,
   *  `onRemove` never fires, because nothing ever leaves. Cards passed as
   *  children carry their own `copy`. @default false */
  copy?: boolean;
  /** Removes a widget from the board. The board doesn't own the array —it takes
   *  it through props—, so it only reports: whoever uses it drops the widget
   *  from `widgets`. Without this callback the tiles have no close button, same
   *  as the panel's tabs. */
  onWidgetClose?: (id: string) => void;
  /** What goes at the top right of the empty state or of the board — the button
   *  that adds a widget, usually. */
  action?: ReactNode;
  /** Closes the whole board. The board doesn't own its place —whoever mounts it
   *  does—, so it only reports. Without this callback there's no close button.
   *
   *  It's there whether the board is full or empty: a board with no widgets
   *  still takes up a column, and not being able to remove it exactly when it
   *  shows nothing would be the worst moment for it. */
  onClose?: () => void;
  className?: string;
}

function WidgetBoard({
  widgets = [],
  children,
  onReorder,
  onAdd,
  onRemove,
  copy = false,
  onWidgetClose,
  onClose,
  action,
  className,
}: WidgetBoardProps) {
  const shape = useShape();
  const typeScale = useTypeScale();

  /* Where the board's plane lands and how heavy its shadow is — see
     `PLANE_RISE`. The boost only reaches the rungs where the ladder is flat;
     above them the shadow is the plane's own, which is what `Elevated` would
     have given it. */
  const plano = Math.min(useSurface() + PLANE_RISE, 8);
  const sombra = Math.max(
    plano,
    Math.min(plano + PLANE_SHADOW_RISE, PLANE_SHADOW_CAP),
  );

  /* The cells, in the order they arrive: first the widgets —each wrapped in
     the card that places it— and then whatever came in as a child. From here
     on the board only knows ids and spans; what a cell draws is the cell's
     business. */
  const cells = useMemo<WidgetCell[]>(() => {
    const fromWidgets = widgets.map((w) => ({
      id: w.id,
      label: w.label,
      span: w.span ?? ("1x1" as WidgetSpan),
      node: (
        /* The descriptor travels with the card: it's what the board on the
           other end needs to make the widget its own. */
        <WidgetCard id={w.id} span={w.span} label={w.label} data={w} copy={copy}>
          <WidgetTile
            widget={w}
            onClose={onWidgetClose && (() => onWidgetClose(w.id))}
          />
        </WidgetCard>
      ),
    }));

    const fromChildren = Children.toArray(children)
      .filter(
        (child): child is ReactElement<WidgetCardProps> =>
          isValidElement<WidgetCardProps>(child) &&
          typeof child.props.id === "string",
      )
      .map((child) => ({
        id: child.props.id,
        label: child.props.label ?? child.props.id,
        span: child.props.span ?? ("1x1" as WidgetSpan),
        node: child,
      }));

    return [...fromWidgets, ...fromChildren];
  }, [widgets, children, onWidgetClose, copy]);


  return (
    /* The board is a plane and not a transparent region — see `PLANE_RISE`. It
       publishes its level inwards, which is what keeps the cells climbing from
       the board and not from whatever the board was dropped on: a tile is two
       steps over *its* plane, wherever that plane ended up.

       No `overflow-hidden` on it: the cells bleed their ring past their slot
       and the scrolling box pads it back (see `RING_ROOM`), and a plane that
       clips would cut exactly that ring. Nothing reaches the corners anyway —
       there's `GAP` of air all around. */
    <Elevated
      offset={PLANE_RISE}
      shadowLevel={sombra}
      className={cn(
        "@container flex h-full min-h-0 flex-col",
        shape.container,
        className,
      )}
      style={{ padding: GAP }}
    >
      {/* The board's header: for now just the close button, against the right
          edge. It sits outside the `AnimatePresence` so it doesn't cross paths
          with the content when the board empties out — what changes is what's
          below, and the button stays where it was.

          Always visible, unlike the tiles': those are four, and one per card
          would be noise; this one is a single button and the only way to get
          the column back. */}
      {onClose && (
        <header
          className="flex shrink-0 justify-end"
          style={{ paddingBottom: GAP / 2 }}
        >
          {/* The word and not an ×. A lone glyph above a grid of cards —which
              already carry an × of their own— reads as one more card missing
              its body; the word says what's being talked about without having
              to deduce it from size or position.

              No `aria-label`: the accessible name is the visible text, which is
              what's right when there is one. A label different from the visible
              one leaves anyone driving by voice asking for something that isn't
              written anywhere. */}
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: typeScale.caption }}
            className={cn(
              "-mt-1 -mr-1 inline-flex shrink-0 items-center justify-center",
              "cursor-pointer rounded-md px-1.5 py-0.5 outline-none",
              "text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
            )}
          >
            Close
          </button>
        </header>
      )}

      {/* The board's own list: the header above it doesn't move —there's a way
          out of the board in it— and what scrolls is the grid.

          It scrolls with no bar at all. `scroll-fade` is the whole cue: the
          cells dissolve towards whichever edge still has more, which is the
          same thing a bar would say and the only thing worth saying in a
          column this narrow — a track pinned to the edge of a 328px cell is
          either riding over a tile or eating the air that keeps the grid
          centred in the rail. It's the treatment the panel's tab row and the
          `PeekCard`'s rail already use: `scrollbar-hide` keeps the scroll and
          drops the furniture.

          It bleeds `RING_ROOM` past its slot and pads the same amount back in:
          a scrolling box clips, and a grid flush with it loses the ring its
          cards paint outside themselves. See the constant. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto scrollbar-hide scroll-fade"
        style={{ margin: -RING_ROOM, padding: RING_ROOM }}
      >
      <AnimatePresence mode="wait" initial={false}>
        {cells.length === 0 && !onAdd ? (
          <AnimatedEmpty key="empty" variant="dashed" className="h-full">
            <AnimatedEmptyHeader>
              <AnimatedEmptyMedia variant="figure" badge={<Plus />} float>
                <LayoutPanelTop />
              </AnimatedEmptyMedia>
              <AnimatedEmptyTitle>The board is empty</AnimatedEmptyTitle>
              <AnimatedEmptyDescription>
                Add a widget and it shows up here, with its glance. Tapping it
                opens the whole thing.
              </AnimatedEmptyDescription>
            </AnimatedEmptyHeader>
            {/* Wrapped and not bare: `AnimatedEmptyContent` is what gives it its
                turn in the cascade. As a plain child the button carries no
                variants, so it appears whole from the first frame while
                everything else is still coming in. */}
            {action && <AnimatedEmptyContent>{action}</AnimatedEmptyContent>}
          </AnimatedEmpty>
        ) : (
          <WidgetGrid
            key="grid"
            cells={cells}
            onReorder={onReorder}
            onAdd={onAdd}
            onRemove={onRemove}
            className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4"
            style={{
              gridAutoRows: `${ROW}px`,
              gap: GAP,
              /* An empty board that takes cards still has to be somewhere to
                 drop them: with no cells the grid measures zero and there'd be
                 nothing to aim at. */
              minHeight: cells.length === 0 ? ROW : undefined,
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </Elevated>
  );
}

export { WidgetBoard };
export type { WidgetBoardProps };
