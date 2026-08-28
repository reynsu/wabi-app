"use client";

/**
 * WidgetDragProvider — one drag for the whole shell.
 *
 * A board that only sorts its own cells can own its `DndContext` and nobody
 * needs to know. The moment a card has to leave one board and land in another
 * —a tray in the panel, the board in the rail— the two ends have to be inside
 * the same context, and that context can only live above both of them: in the
 * app's shell, next to the providers that already carry the tabs and the
 * preview.
 *
 * Four decisions worth not undoing without looking at the rest:
 *
 * 1. **The provider routes; the boards decide.** Nothing here knows what a
 *    widget is or where a list lives. Each board signs up with what it's
 *    willing to do —`reorder` its own cells, `accept` a foreign one, `release`
 *    one that left— and a drop is just the provider calling the right pair. A
 *    board that doesn't take `onAdd` refuses the card, and refusing means the
 *    card goes back: nothing is removed from anywhere until the other end has
 *    said yes.
 *
 * 2. **What travels is a `DragOverlay`.** The card that moves between regions
 *    is a copy in a portal, not the cell itself: the panel scrolls its content
 *    —`overflow: auto`— and a cell that left its box would be cut off at the
 *    edge exactly when it starts crossing towards the rail. The cell it left
 *    behind draws the same dashed outline a tile leaves when its view opens as
 *    a tab, because it says the same thing: the object is elsewhere.
 *
 * 3. **A board that's alone still works.** `WidgetDragScope` mounts a context
 *    only when there isn't one above, so a `WidgetBoard` dropped on any page
 *    sorts itself with no ceremony, and the same board inside the shell joins
 *    the shared one without changing a line.
 *
 * 4. **The names travel with the card.** dnd-kit announces ids, and "widget-
 *    aportes was moved over widget-equipo" is not a sentence anybody should
 *    have to hear. Every board publishes its labels and the announcements are
 *    written from those, including the one that says which board the card
 *    landed in.
 *
 * 5. **A copy gets an id of its own.** A card that copies leaves its original
 *    where it was, so what lands on the other side can't be called the same
 *    thing: two cells with one id would be a collision for the sort —dnd-kit
 *    keys its list by id— and, when the cell holds a widget, the same object in
 *    two places for Framer, which is the board's oldest rule. So the provider
 *    mints the id: the original name plus `-copy`, and a number after that if
 *    there's one already. The board that receives is handed that id and adds
 *    the card under it; a move hands over the id it always had.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { LayoutGroup } from "framer-motion";

/** Travel, in px, before a press becomes a drag. Below this a press is still a
 *  click, which is what opens the widget underneath. */
const DISTANCE = 4;

/** How long a finger has to rest on a card before it picks it up, in ms, and
 *  how far it may stray meanwhile. Under that, the gesture is the board's
 *  scroll. */
const HOLD = 350;
const HOLD_TOLERANCE = 5;

/* The sensors' options, out here and not written inline where they're used.
   `useSensor` memoizes on the options object, so a literal rebuilt on every
   render hands `DndContext` a new set of sensors — and a context that gets new
   sensors mid-drag cancels the drag it was carrying. This provider re-renders
   on every move (it publishes where the card would land), so the difference is
   between a drag that works and one that gives up after two frames. */
const POINTER_OPTIONS = { activationConstraint: { distance: DISTANCE } };
const TOUCH_OPTIONS = {
  activationConstraint: { delay: HOLD, tolerance: HOLD_TOLERANCE },
};
const KEYBOARD_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

/** What a card puts in its drag data, so the provider can route it without
 *  knowing what a widget is. */
interface CardData {
  card: true;
  board: string;
  label: string;
  /** What the board on the other end receives if it accepts the card. */
  payload: unknown;
  /** What the overlay draws while the card travels. */
  node: ReactNode;
  /** The card leaves a copy behind instead of moving: the original stays where
   *  it was and the other board gets one of its own, under a new id. */
  copy: boolean;
}

/** What a board's own droppable box puts in its data, so a drop on the air
 *  between cells still lands somewhere. */
interface BoardData {
  container: true;
  board: string;
}

/** Everything a board is willing to do about a drag. What it doesn't fill in,
 *  it doesn't do: a board with no `accept` refuses foreign cards, and one with
 *  no `release` keeps its own. */
interface BoardHandle {
  id: string;
  getOrder: () => string[];
  getLabels: () => Record<string, string>;
  reorder: (ids: string[]) => void;
  accept?: (id: string, index: number, payload: unknown) => boolean | void;
  release?: (id: string) => void;
}

interface DragValue {
  register: (handle: BoardHandle) => () => void;
  /** The card in the air, or `null`. */
  active: { id: string; board: string; label: string; copy: boolean } | null;
  /** Where it would land if it were dropped now. */
  over: { board: string; index: number } | null;
}

/** The name a copy lands under: the original plus `-copy`, and a number after
 *  that if the shell already holds one. It's checked against every board and
 *  not only the destination — the ids of a drag context share one namespace,
 *  and a card can be copied back to where a sibling of it already lives. */
function copyId(base: string, taken: Set<string>) {
  const first = `${base}-copy`;
  if (!taken.has(first)) return first;
  let n = 2;
  while (taken.has(`${first}-${n}`)) n += 1;
  return `${first}-${n}`;
}

const DragContext = createContext<DragValue | null>(null);

function useWidgetDrag() {
  return useContext(DragContext);
}

/* ───────────────────────────── The provider ───────────────────────────── */

function WidgetDragProvider({ children }: { children: ReactNode }) {
  const boards = useRef(new Map<string, BoardHandle>());
  const [active, setActive] = useState<(CardData & { id: string }) | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [over, setOver] = useState<{ board: string; index: number } | null>(null);

  const register = useCallback((handle: BoardHandle) => {
    boards.current.set(handle.id, handle);
    return () => {
      boards.current.delete(handle.id);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_OPTIONS),
    useSensor(TouchSensor, TOUCH_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_OPTIONS),
  );

  /** Where a drop would land: over a card, its place; over a board's own box,
   *  the end of it; over anything else, nowhere. */
  const resolve = useCallback((target: Over | null) => {
    if (!target) return null;
    const data = target.data.current as Partial<CardData & BoardData> | undefined;
    const boardId = data?.board;
    if (!boardId) return null;
    const handle = boards.current.get(boardId);
    if (!handle) return null;

    if (data?.card) {
      const index = handle.getOrder().indexOf(String(target.id));
      return { board: boardId, index: index === -1 ? handle.getOrder().length : index };
    }
    if (data?.container) return { board: boardId, index: handle.getOrder().length };
    return null;
  }, []);

  const cardOf = (item: Active) => {
    const data = item.data.current as CardData | undefined;
    return data?.card ? { ...data, id: String(item.id) } : null;
  };

  const onDragStart = useCallback((event: DragStartEvent) => {
    const card = cardOf(event.active);
    if (!card) return;
    setActive(card);
    const rect = event.active.rect.current.initial;
    setSize(rect ? { width: rect.width, height: rect.height } : null);
  }, []);

  const onDragOver = useCallback(
    (event: DragOverEvent) => setOver(resolve(event.over)),
    [resolve],
  );

  const clear = useCallback(() => {
    setActive(null);
    setSize(null);
    setOver(null);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const card = cardOf(event.active);
      const destination = resolve(event.over);
      clear();
      if (!card || !destination) return;

      const source = boards.current.get(card.board);
      if (!source) return;

      // Same board: the sort it already knew how to do.
      if (destination.board === card.board) {
        const order = source.getOrder();
        const from = order.indexOf(card.id);
        if (from === -1 || from === destination.index) return;
        source.reorder(arrayMove(order, from, destination.index));
        return;
      }

      /* Another board: it's asked first and only then does the card leave.
         A board with no `accept` —or one that answers `false`, because the
         payload isn't something it can hold— refuses, and refusing means
         nothing moves: the card goes back where it was. */
      const target = boards.current.get(destination.board);
      if (!target?.accept) return;

      // A copy travels under a new name; a move keeps the one it had.
      const taken = new Set<string>();
      for (const board of boards.current.values()) {
        for (const id of board.getOrder()) taken.add(id);
      }
      const landing = card.copy ? copyId(card.id, taken) : card.id;

      const accepted = target.accept(landing, destination.index, card.payload);
      if (accepted === false) return;
      // The original only leaves when it wasn't the one that stayed.
      if (!card.copy) source.release?.(card.id);
    },
    [clear, resolve],
  );

  const accessibility = useMemo(() => {
    const name = (id: string) => {
      for (const handle of boards.current.values()) {
        const label = handle.getLabels()[id];
        if (label) return label;
      }
      return id;
    };
    const place = (spot: { board: string; index: number } | null) => {
      if (!spot) return "nowhere";
      const handle = boards.current.get(spot.board);
      const total = handle?.getOrder().length ?? 0;
      return `position ${spot.index + 1} of ${total}`;
    };

    return {
      screenReaderInstructions: {
        draggable:
          "Press space to pick the card up. Move it with the arrow keys, drop it with space, and press escape to put it back where it was.",
      },
      announcements: {
        onDragStart: ({ active: item }: { active: Active }) =>
          `Picked up ${name(String(item.id))}.`,
        onDragOver: ({ over: target }: { over: Over | null }) => {
          const spot = resolve(target);
          return spot ? `Over ${place(spot)}.` : undefined;
        },
        onDragEnd: ({ active: item, over: target }: { active: Active; over: Over | null }) => {
          const spot = resolve(target);
          return spot
            ? `${name(String(item.id))} dropped in ${place(spot)}.`
            : `${name(String(item.id))} dropped where it was.`;
        },
        onDragCancel: ({ active: item }: { active: Active }) =>
          `Cancelled: ${name(String(item.id))} went back to its place.`,
      },
    };
  }, [resolve]);

  const value = useMemo<DragValue>(
    () => ({
      register,
      active: active && {
        id: active.id,
        board: active.board,
        label: active.label,
        copy: active.copy,
      },
      over,
    }),
    [register, active, over],
  );

  return (
    <DragContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={accessibility}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={clear}
      >
        {children}

        {/* The card that travels. It carries the cell's measurements so what
            crosses the screen is the same size as what was picked up, and it
            lives in a portal of its own — which is what keeps the panel's
            scroll from cutting it off at the edge. */}
        <DragOverlay>
          {active && (
            /* Its own layout group: a card that copies keeps drawing itself
               where it was, so what the overlay carries is a second mount of
               the same thing — and two mounts of a widget's plane share a
               `layoutId`, which Framer would read as one object in two places.
               A group with an id namespaces them apart. */
            <LayoutGroup id="widget-drag-overlay">
              <div
                className={active.copy ? "cursor-copy" : "cursor-grabbing"}
                style={size ? { width: size.width, height: size.height } : undefined}
              >
                {active.node}
              </div>
            </LayoutGroup>
          )}
        </DragOverlay>
      </DndContext>
    </DragContext.Provider>
  );
}

/**
 * Mounts a context only when there isn't one above. It's what lets the same
 * board be a self-contained thing on any page and a piece of the shell inside
 * the app, without a prop saying which.
 */
function WidgetDragScope({ children }: { children: ReactNode }) {
  const outer = useWidgetDrag();
  if (outer) return <>{children}</>;
  return <WidgetDragProvider>{children}</WidgetDragProvider>;
}

// `useWidgetDrag` lives with its provider on purpose: splitting it out to
// please fast refresh would break the module in two for nothing.
// oxlint-disable-next-line react/only-export-components
export { WidgetDragProvider, WidgetDragScope, useWidgetDrag };
export type { BoardHandle, CardData, BoardData };
