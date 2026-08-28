"use client";

/**
 * TravelTooltip — a single tooltip shared by a group of triggers.
 *
 * The difference from a regular tooltip: when the pointer moves from one
 * trigger to its neighbour, the pill doesn't unmount and reappear. It travels,
 * fits its width to the new text and crossfades the label. The caret arrives
 * ahead of the body, and that difference is what makes the movement read as a
 * single piece chasing the cursor and not as two separate tooltips.
 *
 * Standalone: it doesn't wrap the registry's Tooltip, so `shadcn add` never
 * touches it. A group with a single item behaves like a plain tooltip.
 */

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/springs";
import { useShape } from "@/lib/shape-context";
import { useSize, type SizeVariant } from "@/lib/size-context";
import { useTouchPrimary } from "@/hooks/use-touch-primary";

type Side = "top" | "bottom";

/** Minimum air between the pill and the viewport's edge, in px. */
const VIEWPORT_MARGIN = 8;
/** Half the base of the triangular caret, in px. */
const CARET = 4;

interface Registered {
  node: HTMLElement | null;
  label: string;
}

interface Geometry {
  /** Viewport coordinates: the pill lives in a portal with position fixed. */
  left: number;
  top: number;
  width: number;
  /** The trigger's centre. Independent of the body: when the viewport trims
   *  the pill, the caret keeps pointing at the real button. */
  caretX: number;
}

interface TravelTooltipContextValue {
  register: (index: number, entry: Registered | null) => void;
  activate: (index: number, immediate: boolean) => void;
  deactivate: (index: number) => void;
  activeIndex: number | null;
  open: boolean;
  tooltipId: string;
  enabled: boolean;
}

const TravelTooltipContext = createContext<TravelTooltipContextValue | null>(
  null
);

function useTravelTooltip() {
  const ctx = useContext(TravelTooltipContext);
  if (!ctx) {
    throw new Error("TravelTooltipItem must be used inside a TravelTooltip");
  }
  return ctx;
}

/* ─────────────────────────── Root ─────────────────────────── */

interface TravelTooltipProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Which side of the trigger it opens on. @default "bottom" */
  side?: Side;
  /** Distance in px between the trigger and the pill. @default 8 */
  sideOffset?: number;
  /** Wait before the first opening, in ms. Moving to a neighbouring trigger
   *  with the tooltip already open waits for nothing — that's the whole effect.
   *  @default 200 */
  delayDuration?: number;
  /** Grace period on leaving the group, in ms. It avoids the flicker when
   *  crossing the 1-2px gap between two adjacent buttons. @default 90 */
  closeDelay?: number;
  /** Pins the group to a step of the size ladder. Omitted, it follows the
   *  surrounding SizeProvider. */
  size?: SizeVariant;
  /** Classes for the pill. */
  tooltipClassName?: string;
}

const TravelTooltip = forwardRef<HTMLDivElement, TravelTooltipProps>(
  (
    {
      children,
      side = "bottom",
      sideOffset = 8,
      delayDuration = 200,
      closeDelay = 90,
      size,
      className,
      tooltipClassName,
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const measurerRef = useRef<HTMLSpanElement | null>(null);
    // The nodes go in a ref: they take no part in the render, and keeping them
    // in state would cause a render per mount.
    const nodes = useRef(new Map<number, HTMLElement | null>());
    // The labels do go in state: they get painted. In a ref, changing an item's
    // label didn't re-render the parent and the pill kept the previous text
    // until the next render for some other reason.
    const [labels, setLabels] = useState<Record<number, string>>({});

    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [open, setOpen] = useState(false);
    const [geometry, setGeometry] = useState<Geometry>({
      left: 0,
      top: 0,
      width: 0,
      caretX: 0,
    });
    const tooltipId = useId();
    const shape = useShape();
    const sizeClasses = useSize(size);
    const compact = sizeClasses.variant === "compact";
    const isTouch = useTouchPrimary();
    const reduceMotion = useReducedMotion() ?? false;
    // On touch there's no hover: the tooltip never opens and the group is left
    // as a plain container. The platform already solves that with long-press.
    const enabled = !isTouch;

    const pillHeight = compact ? 20 : 24;

    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearTimers = useCallback(() => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      openTimer.current = null;
      closeTimer.current = null;
    }, []);
    useEffect(() => clearTimers, [clearTimers]);

    const register = useCallback((index: number, entry: Registered | null) => {
      if (entry) {
        nodes.current.set(index, entry.node);
        setLabels((prev) =>
          prev[index] === entry.label ? prev : { ...prev, [index]: entry.label }
        );
      } else {
        nodes.current.delete(index);
        setLabels((prev) => {
          if (!(index in prev)) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    }, []);

    // A mirror of the active index, to read it inside a timer without
    // recreating it.
    const activeIndexRef = useRef<number | null>(null);
    useEffect(() => {
      activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    const activate = useCallback(
      (index: number, immediate: boolean) => {
        if (!enabled) return;
        clearTimers();
        // Already open: the jump to the neighbour is immediate, without waiting
        // out the delay again. It's the component's whole reason for being.
        if (open || immediate || delayDuration <= 0) {
          setActiveIndex(index);
          setOpen(true);
          return;
        }
        openTimer.current = setTimeout(() => {
          setActiveIndex(index);
          setOpen(true);
        }, delayDuration);
      },
      [clearTimers, delayDuration, enabled, open]
    );

    const deactivate = useCallback(
      (index: number) => {
        if (openTimer.current) {
          clearTimeout(openTimer.current);
          openTimer.current = null;
        }
        closeTimer.current = setTimeout(() => {
          // It only closes if nobody took over while the grace period ran.
          if (activeIndexRef.current !== index) return;
          setActiveIndex(null);
          setOpen(false);
        }, closeDelay);
      },
      [closeDelay]
    );

    const activeLabel = activeIndex !== null ? labels[activeIndex] ?? "" : "";

    const measure = useCallback(() => {
      if (activeIndex === null) return;
      const node = nodes.current.get(activeIndex);
      const measurer = measurerRef.current;
      if (!node || !measurer) return;

      const triggerBox = node.getBoundingClientRect();
      const width = measurer.offsetWidth;
      const caretX = triggerBox.left + triggerBox.width / 2;

      // Centred on the trigger, trimmed against the viewport. The trim is
      // against the viewport and not the group: a long label in a bar of four
      // icons is wider than the whole group, and clamping there would push it
      // off its own trigger.
      const maxLeft = Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - width - VIEWPORT_MARGIN
      );
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(caretX - width / 2, maxLeft)
      );

      const top =
        side === "bottom"
          ? triggerBox.bottom + sideOffset
          : triggerBox.top - sideOffset - pillHeight;

      setGeometry({ left, top, width, caretX });
    }, [activeIndex, side, sideOffset, pillHeight]);

    // It's measured in layout, before paint, so the pill doesn't show up for a
    // frame at the previous position.
    useLayoutEffect(measure, [measure, activeLabel, compact]);

    // With position:fixed the pill doesn't follow the trigger on its own: it
    // has to be repositioned if anything scrolls or the viewport resizes.
    useEffect(() => {
      if (!open) return;
      const onChange = () => measure();
      window.addEventListener("scroll", onChange, true);
      window.addEventListener("resize", onChange);
      return () => {
        window.removeEventListener("scroll", onChange, true);
        window.removeEventListener("resize", onChange);
      };
    }, [open, measure]);

    const travel = reduceMotion ? { duration: 0 } : spring.moderate;
    // The caret uses a faster tier than the body: it arrives first, and that
    // difference is what makes the whole thing read as chasing the cursor.
    const caretTravel = reduceMotion ? { duration: 0 } : spring.fast;
    const fade = reduceMotion ? { duration: 0 } : spring.fast;

    const contextValue = useMemo<TravelTooltipContextValue>(
      () => ({
        register,
        activate,
        deactivate,
        activeIndex,
        open,
        tooltipId,
        enabled,
      }),
      [register, activate, deactivate, activeIndex, open, tooltipId, enabled]
    );

    // Our own counter instead of the index Children.map hands out: a
    // conditional child that resolves to null would leave a hole in the
    // numbering, and the labels and the geometry are indexed by these numbers.
    let slot = 0;
    const indexedChildren = Children.map(children, (child) =>
      // Same as TabsList: injecting _index into a <div> triggers React's
      // unknown-prop warning, so only components get touched.
      isValidElement(child) && typeof child.type !== "string"
        ? cloneElement(child, { _index: slot++ } as Record<string, unknown>)
        : child
    );

    const overlay = (
      <AnimatePresence>
        {enabled && open && activeIndex !== null && (
          // A fixed, zero-sized layer at the viewport's origin: the children
          // are placed with transform from there. It goes in a portal because
          // any ancestor with overflow would clip the pill — which is exactly
          // what happened when this lived inside the group.
          <motion.div
            className="pointer-events-none fixed left-0 top-0 z-50 h-0 w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : spring.fast.exit }}
            transition={fade}
          >
            <motion.span
              aria-hidden
              className="absolute left-0 top-0 h-0 w-0 border-x-4 border-x-transparent"
              style={
                side === "bottom"
                  ? { borderBottom: `${CARET}px solid var(--foreground)` }
                  : { borderTop: `${CARET}px solid var(--foreground)` }
              }
              animate={{
                x: geometry.caretX - CARET,
                y:
                  side === "bottom"
                    ? geometry.top - CARET
                    : geometry.top + pillHeight,
              }}
              transition={caretTravel}
            />

            <motion.div
              role="tooltip"
              id={tooltipId}
              className={cn(
                "absolute left-0 top-0 flex items-center justify-center overflow-hidden",
                "bg-foreground text-background font-medium",
                compact ? "text-[11px] h-5" : "text-[12px] h-6",
                shape.bg,
                tooltipClassName
              )}
              initial={{
                scale: 0.92,
                x: geometry.left,
                y: geometry.top,
                width: geometry.width,
              }}
              animate={{
                scale: 1,
                x: geometry.left,
                y: geometry.top,
                width: geometry.width,
              }}
              exit={{ scale: 0.96 }}
              transition={{ ...travel, scale: fade }}
            >
              {/* The old label and the new one overlap during the change: the
                  outgoing one goes absolute, so the width is set by the pill and
                  not by the longer of the two. */}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={activeIndex}
                  className="whitespace-nowrap px-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, position: "absolute" }}
                  transition={fade}
                >
                  {activeLabel}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <TravelTooltipContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            containerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref)
              (ref as React.MutableRefObject<HTMLDivElement | null>).current =
                node;
          }}
          className={cn("relative flex items-center", sizeClasses.gap, className)}
          {...props}
        >
          {indexedChildren}

          {/* Measurer: off screen, it gives the target width before animating.
              Animating to "auto" doesn't work — framer resolves it by measuring
              the visual size, which overshoots under a scaled ancestor. */}
          <span
            ref={measurerRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute -left-[9999px] top-0 whitespace-nowrap px-2 font-medium",
              compact ? "text-[11px]" : "text-[12px]"
            )}
          >
            {activeLabel}
          </span>
        </div>

        {/* Vite doesn't do SSR: document exists on the very first render, so
            the portal doesn't need the classic mount guard. */}
        {typeof document !== "undefined"
          ? createPortal(overlay, document.body)
          : null}
      </TravelTooltipContext.Provider>
    );
  }
);

TravelTooltip.displayName = "TravelTooltip";

/* ─────────────────────────── Item ─────────────────────────── */

interface TravelTooltipItemProps {
  /** The pill's text. */
  label: string;
  /** The trigger. A single element — it takes the handlers and
   *  aria-describedby. */
  children: ReactElement;
  /** Silences this item: it doesn't open on hover or on focus, and closes if it
   *  was open. For triggers that unfold something below them —a menu— where the
   *  pill would overlap the popup. */
  suppressed?: boolean;
  /** @internal Assigned by TravelTooltip. */
  _index?: number;
}

function TravelTooltipItem({
  label,
  children,
  suppressed = false,
  _index = 0,
}: TravelTooltipItemProps) {
  const { register, activate, deactivate, activeIndex, open, tooltipId, enabled } =
    useTravelTooltip();
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    register(_index, { node: nodeRef.current, label });
    return () => register(_index, null);
  }, [register, _index, label]);

  // On being silenced, whatever was already open has to close: the menu
  // unfolds under the cursor, so no mouseleave is ever going to arrive.
  useEffect(() => {
    if (suppressed) deactivate(_index);
  }, [suppressed, deactivate, _index]);

  const isActive = open && !suppressed && activeIndex === _index;

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  // In React 19 `ref` is just another prop. Reading it from `child.ref` is
  // deprecated and warns in the console, so it's taken from props.
  const childRef = childProps.ref as React.Ref<HTMLElement> | undefined;

  // The linter sees a ref being handled during render; it's the usual ref
  // composition, which only runs when React mounts the node.
  // oxlint-disable-next-line react/refs
  return cloneElement(child, {
    // It composes with whatever ref the consumer had already put on their
    // trigger, instead of overwriting it.
    ref: (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (typeof childRef === "function") childRef(node);
      else if (childRef && typeof childRef === "object") {
        // Writing the other ref's `.current` is precisely forwarding it, not
        // mutating a prop.
        // oxlint-disable-next-line react/immutability
        (childRef as { current: HTMLElement | null }).current = node;
      }
    },
    // The handlers compose, they don't replace: a consumer's onMouseEnter has
    // to keep running.
    onMouseEnter: (e: React.MouseEvent) => {
      if (!suppressed) activate(_index, false);
      (childProps.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      deactivate(_index);
      (childProps.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
    // Focus opens without waiting: someone navigating by keyboard has already
    // declared their intent.
    onFocus: (e: React.FocusEvent) => {
      if (!suppressed) activate(_index, true);
      (childProps.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      deactivate(_index);
      (childProps.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
    "aria-describedby": enabled && isActive ? tooltipId : undefined,
  } as Record<string, unknown>);
}

TravelTooltipItem.displayName = "TravelTooltipItem";

export { TravelTooltip, TravelTooltipItem };
export type { TravelTooltipProps, TravelTooltipItemProps };
