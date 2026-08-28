"use client";

/**
 * WidgetRail — the widget rail, resizable against the panel.
 *
 * The rail and the `WorkspacePanel` split whatever is left after the sidebar,
 * so widening one narrows the other. There's a single rule for that split and
 * it isn't negotiable: **the panel never drops below 55% of the screen**. It's
 * the app's reading column; a rail that eats into it stops being a side.
 *
 * Three things this component does follow from that rule:
 *
 * 1. **The drag stops itself.** Dragging the left edge, the rail grows until
 *    the panel hits its 55% and there it plants itself. There's no maximum
 *    written down: the ceiling is computed against the window, so it changes
 *    with it.
 *
 * 2. **Before stopping, the sidebar gives way.** If the sidebar is still open
 *    when the limit is reached, it folds — and with that the panel gets its
 *    256px back and the drag carries on. That's the right order of priorities:
 *    between navigating and reading, reading first. The hard stop only arrives
 *    once there's nothing left to give.
 *
 * 3. **The rule holds without touching anything too.** On mount, on window
 *    resize and on folding or unfolding the sidebar, the width is trimmed
 *    against the same ceiling. If the ceiling falls below what a widget
 *    measures, the rail leaves: showing a 160px column isn't showing the board.
 *
 * The calculation doesn't model the layout —not the sidebar's width, not the
 * margins—: it measures. What the panel and the rail split is `panel + rail`,
 * which doesn't change when one grows at the other's expense, only when the
 * sidebar folds or the window moves. The ceiling comes out of that in one line:
 *
 *     railCeiling = panelWidth + railWidth − 0.55 × window
 *
 * It hangs off a `SidebarProvider`: it needs to be able to fold it. And it
 * stands to the right of the panel — its previous sibling in the DOM is the
 * element it measures.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useSidebar } from "@/components/ui/sidebar";
import { WidgetBoard } from "@/components/widget-board";
import type { WidgetDefinition } from "@/components/widget";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";

/** The share of the screen the panel never gives up. */
const PANEL_SHARE = 0.55;

/** What one cell measures plus the board's edge on both sides. Below this the
 *  rail isn't showing a widget but a strip, so it leaves. */
const MIN = 220;

/** The rail's own ceiling, so it doesn't eat the screen on a wide monitor where
 *  the panel's 55% still leaves room to spare. */
const MAX = 560;

/**
 * How much the rail widens while it's showing a preview, in px.
 *
 * The board lives on short numbers in cells; a preview lives on lines
 * —messages, rows of data— and in the board's column they wrap every three
 * words. It's a width driven by content and not a preference: that's why it's
 * added to whatever width the person left instead of replacing it, and why on
 * closing the preview the rail goes back on its own to where it was.
 *
 * The ceiling doesn't change: if there's no room for the 140, the rail widens
 * as much as it can. The panel's rule outranks this.
 */
const PREVIEW_EXTRA = 140;

/** How far the rail moves with each arrow key. */
const STEP = 16;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** What the rail exposes outwards so another control can start a drag — the
 *  button in the panel's bar, for one. It takes the same pointer event the
 *  handle would take: the capture stays with whoever pressed it, so releasing
 *  there ends the drag. */
interface WidgetRailControl {
  beginResize: (event: React.PointerEvent<HTMLElement>) => void;
  /** Grows (positive) or shrinks (negative) the rail by one step. It's the
   *  keyboard path: the control that fires the drag has to offer it with the
   *  arrows too, or resizing is left only to those who can drag. */
  nudge: (delta: number) => void;
  /** How far each step moves, in px. The rail publishes it so whoever drives it
   *  doesn't have to guess. */
  step: number;
}

interface WidgetRailProps {
  widgets: WidgetDefinition[];
  /** What the rail shows **instead of** the board. The rail is the place and
   *  the board is its default content; a `LateralPreview` put here replaces it
   *  for as long as it lasts.
   *
   *  It replaces rather than stacks because they're the same question at two
   *  moments: the board says how everything is going, the preview says what
   *  this is. Having both at once would force a choice of which one to look at,
   *  which is exactly what the rail exists not to ask. */
  preview?: ReactNode;
  /** Which board this is. The rail is one place and what it shows can change
   *  underneath it —another tab's board, with its own widgets—: with a key,
   *  that change crosses over like the switch to a preview does, instead of the
   *  cells of one board morphing into the other's. Without it there's a single
   *  board and nothing to tell apart. */
  contentKey?: string;
  /** Removes a widget. Passed straight through to the board — the rail doesn't
   *  own the list either. */
  onWidgetClose?: (id: string) => void;
  /** Rearranges the widgets. Passed straight through as well: the board does
   *  the dragging, the rail is only where it happens. Without it the cards
   *  don't drag. */
  onWidgetReorder?: (ids: string[]) => void;
  /** Takes a card dragged in from somewhere else — a tray in the panel, say.
   *  Passed straight through to the board, and it needs a shared
   *  `WidgetDragProvider` above the panel and the rail. Without it the rail is
   *  not a destination. */
  onWidgetAdd?: (id: string, index: number, data: unknown) => boolean | void;
  /** One of its widgets was taken by another board. Without it they can be
   *  rearranged but they can't leave. */
  onWidgetRemove?: (id: string) => void;
  /** Closes the board. Passed straight through: the rail is the place and
   *  doesn't decide what's shown in it. Whoever mounts it usually answers by
   *  no longer mounting it. */
  onBoardClose?: () => void;
  /** Filled with the rail's handle on mount. It's the only way to resize it:
   *  the rail brings no handle of its own. */
  controlRef?: React.RefObject<WidgetRailControl | null>;
  /** Reports while a drag is going on. Whoever fires it usually wants to mark
   *  the panel meanwhile —raise its elevation, darken its edge— and that's
   *  decided outside, together with the hover of the control that fires it. */
  onResizingChange?: (resizing: boolean) => void;
  /** Starting width, before it's trimmed against the ceiling. @default 360 */
  defaultWidth?: number;
  className?: string;
}

function WidgetRail({
  widgets,
  preview,
  contentKey,
  onWidgetClose,
  onWidgetReorder,
  onWidgetAdd,
  onWidgetRemove,
  onBoardClose,
  controlRef,
  onResizingChange,
  defaultWidth = 360,
  className,
}: WidgetRailProps) {
  const { open, setOpen } = useSidebar();
  const reduceMotion = useReducedMotion() ?? false;
  const railRef = useRef<HTMLElement>(null);

  /** The width the user asked for. What gets drawn is this one trimmed against
   *  the ceiling: that way, when room is freed up —the window is widened, the
   *  sidebar folds—, the rail goes back on its own to the width it was asked
   *  for instead of staying at the trim. */
  const [pedido, setPedido] = useState(defaultWidth);
  const [tope, setTope] = useState<number | null>(null);
  /** The ceiling that rules while a drag lasts: the one that came out of the
   *  split frozen at press time. See the drag's comment. */
  const [topeTiron, setTopeTiron] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  /* The trim is applied here and never on `pedido`, which keeps the raw intent.
     If the drag stored the already-trimmed width, the intent would be lost:
     when room frees up —the sidebar folds, the window grows— the rail would
     stay at the old trim instead of going back to the width it was asked for.
     While dragging, the drag's frozen ceiling rules, not the measured one: the
     measured one runs behind the sidebar's transition and would stop the rail
     halfway to release it a moment later, which is an elastic feel a handle
     can't have. At rest, the measured one rules. */
  /* The preview's extra is added here, at draw time, and never to `pedido`:
     what the person dragged is the board's width, and adding it to the state
     would leave the rail widened once the preview closes. */
  const pide = pedido + (preview ? PREVIEW_EXTRA : 0);
  const rige = arrastrando ? topeTiron : tope;
  /* Rounded: the ceiling comes from multiplying the window by a fraction, and
     that decimal would end up in the `width` and —worse— in `aria-valuenow`,
     which a screen reader reads out in full. */
  const ancho = Math.round(
    rige === null
      ? clamp(pide, MIN, MAX)
      : clamp(pide, MIN, Math.max(Math.min(rige, MAX), MIN)),
  );
  const cabe = tope === null || tope >= MIN;

  /**
   * Measures the ceiling against the layout's current state.
   *
   * `panel + rail` is what the two of them split, and it doesn't change when
   * one grows at the other's expense — which is why it works as a stable base
   * even mid-drag. What does move it is folding the sidebar or changing the
   * window, which is exactly when this gets called again.
   */
  const medir = useCallback(() => {
    const riel = railRef.current;
    const panel = riel?.previousElementSibling;
    if (!riel || !panel) return;
    const reparto =
      panel.getBoundingClientRect().width + riel.getBoundingClientRect().width;
    setTope(Math.min(reparto - PANEL_SHARE * window.innerWidth, MAX));
  }, []);

  // The first measurement happens before paint: in a regular effect the rail
  // would show for one frame at the width it asked for and only then trimmed.
  useLayoutEffect(medir, [medir, open]);

  /* The measurement that counts is the one taken with the layout already at
     rest, and what reports that is the panel itself once it finishes changing
     width — the sidebar's transition included, which is slower than any effect.
     That it also fires halfway does no harm: it only moves `tope`, and the
     requested width stays untouched waiting for the good measurement. */
  useEffect(() => {
    const panel = railRef.current?.previousElementSibling;
    if (!panel) return;
    const observador = new ResizeObserver(medir);
    observador.observe(panel);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir]);

  /* The sidebar's state in a ref, so the drag always reads it fresh: the
     handler is built once at press time and inside it has to be able to find
     out that the sidebar already folded on an earlier move. It's synced in an
     effect and not during render —reading or writing a ref while rendering is
     exactly what React asks you not to do—; for what it's used for that's
     enough, because effects run before anyone gets to press anything. */
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    onResizingChange?.(arrastrando);
  }, [arrastrando, onResizingChange]);

  /**
   * The preview asks for more width, and if there's nowhere to take it from the
   * sidebar gives way.
   *
   * It's the same manoeuvre the drag makes when it hits the limit, and for the
   * same reason: between navigating and reading, reading first. Without this,
   * on a screen where the panel is already at its 55% the preview opens exactly
   * as wide as the board and the widening is never seen.
   *
   * There's no automatic return: the sidebar comes back when the person opens
   * it. Giving it back on its own when the preview closes would move their
   * navigation twice for something they asked for once.
   */
  useEffect(() => {
    if (!preview || !open || tope === null) return;
    if (pedido + PREVIEW_EXTRA > tope) setOpen(false);
  }, [preview, open, tope, pedido, setOpen]);

  /**
   * The drag.
   *
   * What the panel and the rail split is measured **once, on press**, and not
   * on every move. Measuring it on every move looks more correct and is exactly
   * what breaks it: folding the sidebar doesn't hand back its 256px at once but
   * over a transition, so halfway through the measurement says there's less
   * room than there's going to be, and the rail sticks at a ceiling that no
   * longer exists. Frozen, the drag doesn't depend on what the layout is doing
   * meanwhile.
   *
   * The handlers are attached in here and not from an effect on state: going
   * through state, a quick drag can move and release before React re-renders,
   * and the listeners turn up to a party that's already over. With
   * `setPointerCapture` every event goes to this element until release, so
   * listening to it is enough and `window` stays clean.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const riel = railRef.current;
    const panel = riel?.previousElementSibling;
    if (!riel || !panel) return;

    e.preventDefault();
    const tirador = e.currentTarget;
    tirador.setPointerCapture(e.pointerId);
    setArrastrando(true);

    const caja = riel.getBoundingClientRect();
    /* The drag is **relative**: where the pointer started and how wide the rail
       was are stored, and from there the width is however far the hand moved.
       The absolute reckoning —the width is the distance from the pointer to the
       right edge— looks simpler and brings two problems: grabbing the edge 4px
       off centre makes it jump those 4px, and starting the drag from a button
       far from the edge sends it straight to the ceiling. Relative, the rail
       moves however far the hand moved, wherever it starts. */
    const xInicial = e.clientX;
    const anchoInicial = caja.width;
    let reparto = panel.getBoundingClientRect().width + caja.width;
    /* What the panel gets back if the sidebar gives way. It's read now, while
       it's still unfolded and its width is the real one. */
    const cede =
      riel.parentElement?.firstElementChild?.getBoundingClientRect().width ?? 0;

    // While it lasts, the cursor rules the whole page and text doesn't get
    // selected: without this, crossing the panel with the button held down
    // paints half the screen blue.
    const previo = document.body.style.cssText;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const mover = (ev: PointerEvent) => {
      const pide = anchoInicial + (xInicial - ev.clientX);
      /* The two ceilings are kept apart on purpose. `porElPanel` is the rule
         —how far the rail can grow without eating the panel's share— and it's
         the only one the sidebar can loosen by giving up its place. `MAX` is
         the rail's own ceiling, which no folding moves: reaching it isn't
         running out of room, it's having got as far as the rail goes. With both
         mixed into a single number, hitting the ceiling on a wide screen folded
         the sidebar for nothing. */
      const porElPanel = reparto - PANEL_SHARE * window.innerWidth;

      /* The comparison is against the width the rail will actually take and not
         against what the hand asked for: asking for 760 on a rail that ends at
         560 isn't running short of room, it's having carried on past the end.
         Without this trim, dragging on after hitting the ceiling folded the
         sidebar to give the rail room it can't occupy. */
      const efectivo = Math.min(pide, MAX);

      if (efectivo > porElPanel && openRef.current) {
        // Going past the rule with the sidebar open isn't an error: it's the
        // sign that there's something to give. It folds, the split grows by
        // what it freed up and the drag carries on in the same movement,
        // without waiting for the transition.
        openRef.current = false;
        setOpen(false);
        reparto += cede;
      }

      const limite = Math.min(
        reparto - PANEL_SHARE * window.innerWidth,
        MAX,
      );
      setTopeTiron(limite);
      setPedido(clamp(pide, MIN, MAX));
    };

    const soltar = () => {
      setArrastrando(false);
      setTopeTiron(null);
      document.body.style.cssText = previo;
      /* On release the measurement rules again, and there's a difference to
         settle: what the panel gets back when the sidebar folds is its width
         minus the margin that appears on that side, so the drag's frozen
         ceiling ends up a few px generous. Here the rail settles into what's
         really there — with the width transition on, so you see it settle. */
      medir();
      tirador.removeEventListener("pointermove", mover);
      tirador.removeEventListener("pointerup", soltar);
      tirador.removeEventListener("pointercancel", soltar);
    };

    tirador.addEventListener("pointermove", mover);
    tirador.addEventListener("pointerup", soltar);
    tirador.addEventListener("pointercancel", soltar);
  };

  /** A nudge from the keyboard, in steps. Called by whoever holds the control —
   *  today the button in the panel's bar, which is the only thing that
   *  resizes. */
  const nudge = useCallback(
    (delta: number) => {
      const pide = pedido + delta;
      if (tope !== null && pide > tope && openRef.current) {
        openRef.current = false;
        setOpen(false);
      }
      setPedido(clamp(pide, MIN, MAX));
    },
    [pedido, tope, setOpen],
  );

  /* The handle: everything the rail lets you do from outside. The rail brings
     no handle of its own —the only thing that resizes is the button in the
     panel's bar—, so this isn't a shortcut but the door. */
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { beginResize: onPointerDown, nudge, step: STEP };
    return () => {
      controlRef.current = null;
    };
  });

  return (
    /* The rail comes and goes by opening and closing its own width, not by
       appearing on top of what's there: it's a region of the shell and regions
       make room for themselves. Animating the width is what makes the panel get
       its own back in the same movement instead of snapping when the rail
       unmounts — the panel is `flex-1` and simply follows the gap that's left.

       The width is joined by a short outward shift: without it the column
       squeezes against the edge and reads as a layout bug, with it it reads as
       something that went that way. */
    <motion.aside
      ref={railRef}
      aria-label="Widgets"
      initial={{ width: 0, marginRight: 0, opacity: 0, x: 24 }}
      animate={{
        width: cabe ? ancho : 0,
        marginRight: cabe ? 8 : 0,
        opacity: cabe ? 1 : 0,
        x: 0,
      }}
      exit={{ width: 0, marginRight: 0, opacity: 0, x: 24 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              /* The width doesn't animate during the drag —it would follow the
                 pointer a frame behind and feel elastic—, but it does when the
                 ceiling trims it on its own, or when the rail comes and goes:
                 there it's worth seeing it settle.

                 And it waits as long as the outgoing content takes to leave.
                 Without that wait the rail widens while the board is still in
                 place, and the board gets as far as rearranging its cells into
                 two columns only to disappear a frame later: a layout flicker
                 for something that was already leaving. Room is made for what's
                 arriving. */
              width: arrastrando
                ? { duration: 0 }
                : { ...spring.moderate, delay: spring.moderate.exit.duration },
              default: spring.moderate,
            }
      }
      className={cn(
        // `overflow-hidden` and not `auto`: what scrolls is the board's own
        // list, with the system's scrollbar. Here it only keeps the width
        // animation from spilling.
        "m-2 ml-0 hidden shrink-0 flex-col overflow-hidden xl:flex",
        !cabe && "pointer-events-none",
        className,
      )}
    >

      {/* The switch of what's in the rail —board to preview, or one scope's
          board to another's— crosses over instead of snapping: it's a change of
          content in a region that stays, so the step is `moderate` —the popups'
          and the tabs'— and not the dialogs'.
          `mode="wait"` so the one leaving finishes before the other comes in:
          in a narrow column, two overlapping bodies are unreadable. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${contentKey ?? ""}:${preview ? "preview" : "board"}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0 } : spring.moderate}
          /* The preview carries no edge on its sides: it rests against the
             rail's borders, so it stays as close as possible to the panel on
             one side and to the edge of the screen on the other. It's the
             opposite of the board, which keeps its cells off the border because
             there are several of them and they need a common frame; the preview
             is one thing and it is the frame. Above and below it does breathe,
             which is where it competes with nothing. */
          className={cn("flex min-h-0 flex-1 flex-col", preview && "py-2")}
        >
          {preview ?? (
            <WidgetBoard
              widgets={widgets}
              onWidgetClose={onWidgetClose}
              onReorder={onWidgetReorder}
              onAdd={onWidgetAdd}
              onRemove={onWidgetRemove}
              onClose={onBoardClose}
              className="h-full"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}

export { WidgetRail };
export type { WidgetRailProps, WidgetRailControl };
