"use client";

/**
 * WidgetCard — the wrapper that turns anything into a piece of the board.
 *
 * `WidgetTile` knows how to draw a widget; this knows how to **place** one. A
 * card is one cell of the grid: it takes the span, it signs up with the board
 * and it carries the drag. What goes inside is none of its business — a
 * widget's tile, a chart, a paragraph, whatever the app has to arrange.
 *
 * The dragging is `@dnd-kit`'s: `useSortable` for the cell, and the context
 * that routes it is `widget-drag`'s — one for a lone board, one for the whole
 * shell when a card has to travel from a tray in the panel to the board in the
 * rail. Sorting a grid has a long tail —collisions between cells of different
 * spans, auto-scroll at the edge of a region, a keyboard path, announcements
 * for a screen reader— and none of that is the house's business to invent.
 * What's ours is where it plugs in:
 *
 * 1. **No callback, no drag.** Same rule as the close buttons: the board
 *    doesn't own the list, so with nobody to report to there's nothing a drag
 *    could accomplish — and an affordance that leads nowhere is worse than no
 *    affordance. It goes all the way down: a grid that neither sorts nor lets
 *    a card leave draws cards that never call `useSortable`, so there's no
 *    node registered, no tab stop and no cursor promising a gesture.
 *
 * 2. **The press is read on the capture phase.** A widget's tile stops
 *    `pointerdown` from bubbling —the surface that opens it does that so the
 *    click doesn't reach its `PeekCard`— so dnd-kit's activator, which comes
 *    as a normal React prop, would never hear the press. It's bound on the
 *    capture phase instead, where it runs before any of that. Whatever must
 *    *not* start a drag says so with `data-no-drag`, which is what the tile's
 *    close button carries.
 *
 * 3. **What travels is the overlay; the cell stays and shows the hole.** The
 *    card hands its children to the drag, and while they're in the air its cell
 *    draws the dashed outline a tile leaves when its view opens as a tab. Two
 *    copies of the same widget mounted at once would be, for Framer, the same
 *    object in two places — the board's oldest rule — so there's only ever one.
 *
 * 4. **A card can carry something for the other end.** `data` is whatever the
 *    board that receives it needs to make it its own: for a widget, its
 *    descriptor. The card doesn't read it and the grid doesn't either; it just
 *    travels.
 *
 * 5. **`copy` decides whether the original stays.** By default a card moves:
 *    it lands on the other board and leaves the one it came from. With `copy`
 *    it's a source instead — the original stays exactly where it was, still
 *    holding whatever state it had, and what lands is one of its own under a
 *    new id. It's what turns a board into a palette, and it changes nothing
 *    about sorting: inside its own board a `copy` card is rearranged like any
 *    other, because there's nothing there to duplicate it into.
 *
 *    What travels is the card's `data` and what it draws, not the React state
 *    inside its children: a copy mounts fresh. Anything the copy has to be
 *    born with goes in `data`, which is the only thing the other board is
 *    handed.
 */

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  WidgetDragScope,
  useWidgetDrag,
  type BoardHandle,
  type CardData,
} from "@/components/widget-drag";
import { cn } from "@/lib/utils";

/** How much of the grid a card takes. */
type WidgetSpan = "1x1" | "2x1" | "2x2";

/** The ladder's classes, written out literally because Tailwind can't compile
 *  a class built from an expression. Spans only kick in at `@md`: below that
 *  the board is a single column and every card is the same size.
 *
 *  They live with the card and not with the board: the card is what occupies
 *  the cell, and the board only says how many columns there are. */
const SPAN: Record<WidgetSpan, string> = {
  "1x1": "@md:col-span-1 @md:row-span-1",
  "2x1": "@md:col-span-2 @md:row-span-1",
  "2x2": "@md:col-span-2 @md:row-span-2",
};

/** What a card needs from the grid around it: who to say it belongs to, and
 *  whether that grid does anything with a drag at all. */
const Board = createContext<{ id: string; draggable: boolean } | null>(null);

/* ─────────────────────────────── The grid ─────────────────────────────── */

/** A cell, as the grid sees it: an id, how much room it asks for, a name for
 *  what gets read out, and the thing itself. */
interface WidgetCell {
  id: string;
  span: WidgetSpan;
  label: string;
  node: ReactNode;
}

interface WidgetGridProps {
  cells: WidgetCell[];
  /** Rearranges. The grid keeps the arrangement while the hand is moving and
   *  hands back the ids when the card lands. */
  onReorder?: (ids: string[]) => void;
  /** Takes a card that came from another board. It gets the id, where it
   *  landed and whatever the card was carrying; returning `false` refuses it,
   *  and a refused card goes back where it was. Without this the grid isn't a
   *  destination. */
  onAdd?: (id: string, index: number, data: unknown) => boolean | void;
  /** One of its cards was taken by another board. Without this its cards can't
   *  leave. */
  onRemove?: (id: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The grid the cards sort themselves in. It owns the arrangement —dnd-kit
 * shifts the cells with transforms while the hand is moving and only settles
 * the list when the card lands— and signs up with the drag context so a card
 * can also arrive from, or leave for, another board.
 */
function WidgetGrid(props: WidgetGridProps) {
  return (
    <WidgetDragScope>
      <Grid {...props} />
    </WidgetDragScope>
  );
}

function Grid({
  cells,
  onReorder,
  onAdd,
  onRemove,
  className,
  style,
}: WidgetGridProps) {
  const drag = useWidgetDrag();
  const boardId = useId();

  const ids = useMemo(() => cells.map((c) => c.id), [cells]);
  const [order, setOrder] = useState(ids);

  /* Reconciled during render and not in an effect: a widget that arrives or
     leaves has to be in the order the same commit it's in the list, or the
     grid draws a frame with a cell it can't place. The arrangement survives —
     what's still there keeps its position and what's new goes to the end. */
  const signature = ids.join(" ");
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      return [...kept, ...ids.filter((id) => !kept.includes(id))];
    });
  }

  const byId = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);
  const draggable = onReorder != null || onRemove != null;

  /* What the provider calls when a drag lands, kept in a ref and refreshed
     after every render: it's read long after the drag was set up, and it has
     to answer with the order and the callbacks of *now*. Synced in an effect
     and not during render — writing a ref while rendering is what React asks
     you not to do, and effects run before anyone gets to press anything. */
  const latest = useRef<BoardHandle | null>(null);
  useEffect(() => {
    latest.current = {
      id: boardId,
      getOrder: () => order,
      getLabels: () => Object.fromEntries(cells.map((c) => [c.id, c.label])),
      reorder: (next) => {
        setOrder(next);
        onReorder?.(next);
      },
      accept: onAdd,
      release: onRemove,
    };
  });

  const register = drag?.register;
  useEffect(() => {
    if (!register) return;
    return register({
      id: boardId,
      getOrder: () => latest.current?.getOrder() ?? [],
      getLabels: () => latest.current?.getLabels() ?? {},
      reorder: (next) => latest.current?.reorder(next),
      // The two are wired only if the grid does them at all: the provider asks
      // for `accept` before letting a card leave its board, and a board with
      // none refuses.
      accept: onAdd
        ? (id, index, data) => {
            const answer = latest.current?.accept?.(id, index, data);
            if (answer === false) return false;
            /* The card is put in the order *here* and not left to the
               reconciliation: that one appends what's new to the end —which is
               right for a widget that simply arrived— and this card didn't
               arrive, it landed somewhere on purpose. */
            setOrder((prev) =>
              prev.includes(id)
                ? prev
                : [...prev.slice(0, index), id, ...prev.slice(index)],
            );
            return answer;
          }
        : undefined,
      release: onRemove ? (id) => latest.current?.release?.(id) : undefined,
    });
  }, [register, boardId, onAdd, onRemove]);

  /* The grid's own box as a drop target, so a card let go over the air between
     cells still lands at the end instead of nowhere. */
  const { setNodeRef } = useDroppable({
    id: boardId,
    disabled: onAdd == null,
    data: { container: true, board: boardId },
  });

  const incoming =
    drag?.active && drag.active.board !== boardId && drag.over?.board === boardId
      ? drag.over.index
      : null;

  const context = useMemo(
    () => ({ id: boardId, draggable }),
    [boardId, draggable],
  );

  const drawn = order.map((id) => byId.get(id)).filter((c) => c !== undefined);

  return (
    <Board.Provider value={context}>
      <SortableContext id={boardId} items={order} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          data-widget-grid={boardId}
          data-incoming={incoming !== null || undefined}
          className={className}
          style={style}
        >
          {drawn.map((cell, index) => (
            <Fragment key={cell.id}>
              {/* Where the card in the air would land. It's the only preview a
                  foreign card gets: it isn't in this grid's sortable list, so
                  the cells around it have no reason to have moved yet. */}
              {incoming === index && <Landing key="landing" />}
              {cell.node}
            </Fragment>
          ))}
          {incoming !== null && incoming >= drawn.length && <Landing />}
        </div>
      </SortableContext>
    </Board.Provider>
  );
}

/** The outline of the cell a card would land in. Dashed, like the gap a tile
 *  leaves when its view is open: both say the same thing about a place that
 *  belongs to something that isn't there yet. */
function Landing() {
  return (
    <div
      aria-hidden
      className="rounded-xl border border-dashed border-muted-foreground/40 bg-hover/40"
    />
  );
}

/* ───────────────────────────── The card ───────────────────────────── */

interface WidgetCardProps {
  /** Unique and stable: it's the currency of the order, and what the board
   *  hands back through `onReorder`. */
  id: string;
  /** How much of the grid it takes. @default "1x1" */
  span?: WidgetSpan;
  /** The name the drag answers to — it's what gets read out when the card is
   *  picked up and when it lands. Without it the id is announced, which is a
   *  poor thing to hear. */
  label?: string;
  /** What the card carries for the board that receives it: a widget's
   *  descriptor, a record, an id of your own. It only matters when the card
   *  can land somewhere else. */
  data?: unknown;
  /** The card is a source, not a piece: dropping it on another board leaves
   *  the original where it is and lands a copy of it there, under an id of its
   *  own. It's what a palette is made of. Sorting inside its own board is
   *  unchanged — there's nothing there to copy into. @default false */
  copy?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The card in a grid that does something with a drag: this is the one that
 * calls the hook.
 */
function SortableCard({
  id,
  span = "1x1",
  label,
  data,
  copy = false,
  className,
  children,
  board,
}: WidgetCardProps & { board: string }) {
  const cardData: CardData = {
    card: true,
    board,
    label: label ?? id,
    payload: data,
    node: children,
    copy,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({
    id,
    data: cardData,
    // dnd-kit marks a draggable as `role="button"`, and a widget's tile already
    // has one covering it — a button inside a button is what a screen reader
    // would have to untangle. A group with its role description says what this
    // is without claiming an activation it doesn't have.
    attributes: { role: "group", roleDescription: "sortable card" },
  });

  /* dnd-kit hands the activator over as a normal React prop, which is the
     bubble phase — and the surface that opens a widget stops `pointerdown`
     there. Bound on the capture phase it runs first; `data-no-drag` is how a
     control inside says the press is its own. */
  const onPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
      listeners?.onPointerDown?.(event);
    },
    [listeners],
  );

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      // Only while sorting: outside a drag the cards are laid out by the grid
      // and a lingering transition would animate the layout twice.
      transition: isSorting ? transition : undefined,
    }),
    [transform, transition, isSorting],
  );

  return (
    <div
      ref={setNodeRef}
      data-widget-card={id}
      data-dragging={isDragging || undefined}
      style={style}
      {...attributes}
      aria-label={label ?? id}
      onPointerDownCapture={onPointerDownCapture}
      // The keyboard sensor's activator — space picks the card up, the arrows
      // move it, space drops it and escape puts it back. dnd-kit types its
      // listeners loosely, hence the cast.
      onKeyDown={
        listeners?.onKeyDown as React.KeyboardEventHandler<HTMLDivElement> | undefined
      }
      className={cn(
        SPAN[span],
        "min-w-0 outline-none",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        isDragging ? (copy ? "cursor-copy" : "cursor-grabbing") : "cursor-grab",
        className,
      )}
    >
      {/* A card that moves is in the air —see decision 3— and what's left is
          the outline of where it belongs. One that copies never left: it stays
          drawn, dimmed while the copy of it is travelling, so it reads as the
          source it is and not as something that's about to disappear. */}
      {isDragging && !copy ? (
        <div className="h-full w-full rounded-xl border border-dashed border-border" />
      ) : (
        <div className={cn("h-full", isDragging && copy && "opacity-60")}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The card. In a grid that sorts —or that lets its cards leave— it's the
 * sortable one; anywhere else it's a cell and nothing more: it never calls the
 * hook, so there's no node registered, no tab stop and no cursor promising a
 * gesture.
 */
function WidgetCard(props: WidgetCardProps) {
  const board = useContext(Board);
  if (board?.draggable) return <SortableCard {...props} board={board.id} />;

  const { id, span = "1x1", className, children } = props;
  return (
    <div className={cn(SPAN[span], "min-w-0", className)} data-widget-card={id}>
      {children}
    </div>
  );
}

WidgetCard.displayName = "WidgetCard";

export { WidgetCard, WidgetGrid, SPAN };
export type { WidgetCardProps, WidgetCell, WidgetGridProps, WidgetSpan };
