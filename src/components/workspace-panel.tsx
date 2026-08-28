"use client";

/**
 * WorkspacePanel — the content frame that sits next to the sidebar.
 *
 * A bar of tabs where the active one isn't a loose pill but merges into the
 * content area: they share a background and a pair of concave corners joins
 * them, like a browser's tabs. That's what says the thing below is the content
 * *of that* tab and not a separate panel.
 *
 * To the left of the first tab sits the button that shows and hides the
 * sidebar, so the component has to live inside a SidebarProvider.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSize, type SizeVariant } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { SurfaceProvider, useSurface } from "@/lib/surface-context";
import { SURFACE_BG, surfaceClasses } from "@/lib/surface-classes";
import type { IconComponent } from "@/lib/icon-context";
import { useProximityHover } from "@/hooks/use-proximity-hover";

/** Radius of the tab and of the concave corners that join it to the content.
 *  A single number: if they differ, the curve reads as broken at the joint. */
const TAB_RADIUS = 12;

/** Steps the plane (active tab + content) climbs over the bar. Two, like any
 *  layer resting on its substrate. */
const PLANE_OFFSET = 2;

/**
 * The plane's shadow weight, fixed.
 *
 * The plane's background follows the substrate, but its shadow doesn't: all you
 * see of it is the 1px ring along the top edge — the rest is clipped by the
 * panel's `overflow-hidden` — and that ring is the line separating the bar from
 * the content. Fixed so it's always a hairline, even if the panel lives inside
 * a dialog. Same device as the `tabs` indicator with its `shadowLevel`.
 */
const PLANE_SHADOW = 3;

/** How far the active tab rides onto the plane to cover its shadow's ring
 *  exactly where the two merge. */
const TAB_OVERLAP = 1;

/**
 * The bar's air: between tabs and also between the row and the content.
 *
 * A single number for both, because it's the same air — on hover, a tab's fill
 * has to sit as far off its neighbour as it does off the content below.
 *
 * Don't raise it to 24 (`TAB_RADIUS * 2`) to "fix" the overlap of two
 * neighbouring tabs' concave corners: that overlap is on purpose.
 */
const BAR_GAP = 4;

/**
 * The outline's edge colour.
 *
 * It's the same one the ladder draws all its rings with in light
 * (`--shadow-color`), so the tab's edge and the line running along the bar are
 * literally the same line. In dark the ladder separates by colour and this edge
 * drops to a whisper, which is exactly right.
 */
const EDGE = "var(--shadow-color)";

/**
 * How far down the edge's sides run, measured from the tab's foot.
 *
 * It isn't a loose number: it's exactly where the concave corner's arc starts,
 * which begins `TAB_RADIUS` above the plane's line while the tab ends
 * `BAR_GAP` above it. That's where the edge has to stop — not a pixel earlier,
 * which opens a gap, and not one later, which treads on it.
 */
const EDGE_STOP = TAB_RADIUS - BAR_GAP;

interface WorkspaceTab {
  id: string;
  label: string;
  icon?: IconComponent;
  content: ReactNode;
}

interface WorkspacePanelProps {
  tabs: WorkspaceTab[];
  /** Active tab (controlled). */
  value?: string;
  /** Initial active tab (uncontrolled). The first one by default. */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Closes a tab. The component doesn't own the array, so it only reports:
   *  whoever uses it drops the tab from `tabs`. Without this callback there's no
   *  close button — it would have nothing to do. */
  onTabClose?: (id: string) => void;
  /** Marks the panel while something is holding it from outside — the handle
   *  that resizes it, today the widget rail's.
   *
   *  It does two things, both in the vocabulary the system already has:
   *
   *  - **raises the shadow two steps**, which is how you say "elevation" here;
   *  - **darkens the edge**, the same device the sidebar's rail uses to mark its
   *    border when it can be grabbed. The ladder's ring is 6% black —enough to
   *    separate two resting surfaces, not to say "this object is being held"—,
   *    so for as long as it lasts it's swapped for 25% of the text colour.
   *
   *  What **isn't** touched is the fill or the level the panel publishes
   *  inwards: that way everything mounted on top —the tabs, the popups— doesn't
   *  get recomputed every time the pointer brushes the edge. */
  lifted?: boolean;
  /** What goes at the far right of the bar, after the tabs: the panel's
   *  controls — theme, notifications, whatever the app has to offer about the
   *  window and not about the content.
   *
   *  It sits outside the scrolling row, for the same reason as the sidebar
   *  button at the other end: they belong to the panel and not to the tabs, and
   *  with many tabs open they'd scroll out of sight exactly when they're needed
   *  most. */
  controls?: ReactNode;
  /** Pins the panel to a step of the size ladder. */
  size?: SizeVariant;
  /** The root element. A panel that takes the place of the app's content is its
   *  `<main>`, and it's worth it actually being one and not a div with the air
   *  of one. The default is `div` because a single page can show several panels
   *  —the showcase's shows three— and a document has only one main. */
  as?: "div" | "main";
  className?: string;
}

/* ────────────────── The active tab's concave corners ────────────────── */

/**
 * Each corner is a square with a quarter circle bitten out of it, centred on its
 * outer top corner. Placed beside the tab, that bite is the curve that drops
 * towards the bar.
 *
 * It's SVG and not a mask over a background because the curve isn't only
 * filled: it's also stroked. The arc is the stretch of outline that joins the
 * tab's side edge with the line running along the bar, and with the circle's
 * centre at the outer corner it meets both tangentially — no kinks at either
 * joint.
 */
function ConcaveCorner({
  side,
  level,
}: {
  side: "left" | "right";
  level: number;
}) {
  const R = TAB_RADIUS;
  const outline = `${R} ${R} 0 0 0`;
  const borde =
    side === "left"
      ? `M0,${R} A${outline} ${R},0`
      : `M0,0 A${outline} ${R},${R}`;
  // Closing against the inner bottom corner leaves the fill on the content's
  // side, which is what the corner is part of.
  const fill = side === "left" ? `${borde} L${R},${R} Z` : `${borde} L0,${R} Z`;

  // The stroke doesn't run along the fill's border but half a pixel inside the
  // circle, which in a bite is the bar's side. With a 1px stroke that leaves it
  // on the same band as the tab's edge above and the plane's line below: the
  // three lines continue into each other without overlapping.
  const r = R - 0.5;
  const arco =
    side === "left"
      ? `M0,${r} A${r},${r} 0 0 0 ${r},0`
      : `M${R - r},0 A${r},${r} 0 0 0 ${R},${r}`;

  return (
    <svg
      aria-hidden
      width={R}
      height={R}
      viewBox={`0 0 ${R} ${R}`}
      className="pointer-events-none absolute"
      style={{
        // Aligned with the plane and not with the tab: the tab drops one extra
        // pixel to cover the ring, and that pixel is filled by the content,
        // which is the same colour.
        bottom: TAB_OVERLAP,
        [side === "left" ? "left" : "right"]: -R,
        // The stroke runs half a pixel out of the square at both ends; that's
        // exactly where it has to meet its neighbours.
        overflow: "visible",
      }}
    >
      <path d={fill} style={{ fill: `var(--surface-${level})` }} />
      <path d={arco} fill="none" strokeWidth={1} style={{ stroke: EDGE }} />
    </svg>
  );
}

/* ─────────────────────── The active tab's edge ─────────────────────── */

/**
 * The tab's top and sides, on a layer of their own.
 *
 * It's a full ring —that way both top corners come out round in one go, with no
 * splicing of three lines— with a mask eating its bottom half. That takes away,
 * together, the floor edge, which doesn't exist because the tab carries on into
 * the content, and the lower half of the sides.
 *
 * A separate layer and not a shadow on the tab itself because the mask clips
 * everything the element paints, and the tab also paints its background.
 */
function TabEdge({ skirt }: { skirt: number }) {
  const mask = `linear-gradient(to bottom, #000 calc(100% - ${EDGE_STOP}px), transparent calc(100% - ${EDGE_STOP}px))`;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        // The layer runs 1px outwards on all three sides and the ring is inset,
        // so the edge ends up occupying that outer band. That's where it has to
        // be: the plane's ring also runs over the content and not inside it, and
        // both lines have to fall on the same side of the fill or they don't
        // meet.
        top: -1,
        left: -1,
        right: -1,
        // At the bottom, on the other hand, it stops before the skirt: the
        // skirt is already content and carries no edge.
        bottom: skirt,
        // One more than the tab's, to stay concentric with it.
        borderTopLeftRadius: TAB_RADIUS + 1,
        borderTopRightRadius: TAB_RADIUS + 1,
        boxShadow: `inset 0 0 0 1px ${EDGE}`,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

/* ──────────────────────────── The selector ──────────────────────────── */

/**
 * Everything that sets the active tab apart —the plane, the two concave corners
 * and the edge— lives here, on a single layer that slides from one tab to
 * another instead of appearing and disappearing.
 *
 * It's what turns a change of tab into a movement: the shape is always the same
 * and only travels, which is exactly what the registry's `tabs` indicator does.
 * `left` and `width` are animated and not a `transform` because a scale would
 * distort the corners' radii and the arcs.
 *
 * The tabs underneath stay clean: they only supply their label and their hover.
 */
function TabSelector({
  rect,
  skirt,
  level,
}: {
  rect: { left: number; width: number; top: number; height: number };
  skirt: number;
  level: number;
}) {
  return (
    <motion.div
      aria-hidden
      // No events: the arcs slip underneath the neighbouring tabs and have no
      // business stealing their clicks.
      className={cn("pointer-events-none absolute z-10", SURFACE_BG[level])}
      // No entry animation: the first time it has to appear already sitting on
      // its tab, not travelling in from the edge.
      initial={false}
      animate={{ left: rect.left, width: rect.width }}
      transition={spring.moderate}
      style={{
        top: rect.top,
        // The skirt is part of the height: the selector reaches the plane and
        // rides the pixel that covers its ring.
        height: rect.height + skirt,
        borderTopLeftRadius: TAB_RADIUS,
        borderTopRightRadius: TAB_RADIUS,
      }}
    >
      <ConcaveCorner side="left" level={level} />
      <ConcaveCorner side="right" level={level} />
      <TabEdge skirt={skirt} />
    </motion.div>
  );
}

/* ───────────────────────── The sidebar button ───────────────────────── */

function SidebarToggle({
  compact,
  level,
}: {
  compact: boolean;
  level: number;
}) {
  const { open, toggleSidebar, side, isMobile, openMobile } = useSidebar();
  const visible = isMobile ? openMobile : open;

  const Icon =
    side === "right"
      ? visible
        ? PanelRightClose
        : PanelRightOpen
      : visible
        ? PanelLeftClose
        : PanelLeftOpen;

  return (
    <button
      type="button"
      aria-label={visible ? "Hide side panel" : "Show side panel"}
      aria-pressed={visible}
      onClick={toggleSidebar}
      style={{ borderRadius: TAB_RADIUS }}
      className={cn(
        "group relative inline-flex shrink-0 items-center justify-center",
        "cursor-pointer outline-none transition-colors duration-80",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        // The hover fill is a rounded rectangle wider than the resting circle —
        // it's what the reference shows.
        "hover:bg-active",
        compact ? "h-7 w-9" : "h-8 w-11"
      )}
    >
      <span
        // The chip rests on the same step as the plane, at 60% so that over the
        // bar it reads as a support and not as one more button. Inline because
        // the opacity of a dynamic token can't come out of Tailwind's classes.
        style={{
          backgroundColor: `color-mix(in srgb, var(--surface-${level}) 60%, transparent)`,
        }}
        className={cn(
          // It's a surface, so it comes with its shadow: in dark colour lifts
          // it, but in light the ladder is flattened to white and without
          // --shadow-1's ring you can't see there's a chip at all.
          "flex items-center justify-center rounded-full shadow-surface-1",
          "[&_svg]:stroke-[1.5] group-hover:[&_svg]:stroke-2 [&_svg]:transition-[stroke-width] [&_svg]:duration-80",
          compact ? "h-5 w-5 [&_svg]:h-3 [&_svg]:w-3" : "h-6 w-6 [&_svg]:h-3.5 [&_svg]:w-3.5"
        )}
      >
        <Icon />
      </span>
    </button>
  );
}

/* ───────────────────────── WorkspacePanel ───────────────────────── */

function WorkspacePanel({
  tabs,
  value,
  defaultValue,
  onValueChange,
  onTabClose,
  lifted = false,
  controls,
  size,
  as: Root = "div",
  className,
}: WorkspacePanelProps) {
  const sizeClasses = useSize(size);
  const compact = sizeClasses.variant === "compact";

  /* The panel is a card, so it climbs: the bar takes one step over whatever the
     panel was put on, and the plane —active tab and content, which are the same
     surface— two more over the bar.

     The step under the bar is the one that was missing. Sitting the bar *on*
     the substrate reads fine on paper —the card is the ground and the plane is
     what's on it— and on screen it means the panel's own edge disappears: at
     the same rung as the shell it's the same colour as the shell, and what's
     left of the boundary is the hairline of a shadow at 6% black. In the dark
     key that step is the whole fix, because there the ladder actually moves
     (#171717 to #1E1E1E); in the light key it's worth 2% and the shadow below
     does the work. */
  const substrate = useSurface();
  const barLevel = Math.min(substrate + 1, 8);
  const planeLevel = Math.min(barLevel + PLANE_OFFSET, 8);
  /** Two steps and not one: a single step, against a shadow that's already
   *  there, is indistinguishable from a change of light. */
  const lift = lifted ? 2 : 0;

  // How much further down the active tab goes than its neighbours: it crosses
  // the bar's air and on top of that rides the pixel covering the plane's ring.
  const skirt = BAR_GAP + TAB_OVERLAP;

  // The selector needs to know where to travel to, so the tabs get measured.
  // It's the same hook the `tabs` indicator is measured with: it publishes the
  // rects in layout coordinates —`offsetLeft`, immune to transforms— and takes
  // them again on its own as soon as a tab changes size.
  const listRef = useRef<HTMLDivElement>(null);
  const { itemRects, registerItem } = useProximityHover<HTMLDivElement>(
    listRef,
    { axis: "x" }
  );
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInternal(id);
      onValueChange?.(id);
    },
    [value, onValueChange]
  );

  // Resolved and not the raw id: on closing the active tab, `active` is left
  // pointing at an id that's no longer in `tabs`. Compared against this, the
  // replacement ends up marked instead of showing tabs[0]'s content with no tab
  // selected at all.
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  // Registering here and not in each tab's `ref`: an inline ref is re-attached
  // on every render and would cause needless remeasuring. This way registration
  // only happens when the array changes.
  useLayoutEffect(() => {
    tabs.forEach((_, i) => registerItem(i, itemsRef.current[i] ?? null));
    // On closing a tab there are leftover indices registered from last time.
    for (let i = tabs.length; i < itemsRef.current.length; i++) {
      registerItem(i, null);
    }
    itemsRef.current.length = tabs.length;
  }, [tabs, registerItem]);

  const activeIndex = tabs.findIndex((t) => t.id === activeTab?.id);
  const activeRect = activeIndex >= 0 ? itemRects[activeIndex] : undefined;

  // With the bar scrolled, the active tab can end up out of view — above all
  // when it isn't the bar that picks it but something outside, an `openTab` from
  // the sidebar. It's brought back the bare minimum: it only moves if it doesn't
  // fit, and with the concave corner's arc included in the margin, because
  // otherwise the tab ends up flush and its curve cut off.
  //
  // By assigning `scrollLeft` and not with `scrollTo({ behavior: "smooth" })`:
  // changing tab remounts the plane's content, and that smooth scroll cancels
  // itself halfway more often than it arrives. A jump is also what editors do
  // when revealing a tab, and here what has to read as movement is the selector,
  // which already travels on its own.
  //
  // By hand and not with `scrollIntoView`: that one also corrects the ancestors,
  // and here the ancestor is the whole page.
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = itemsRef.current[activeIndex];
    if (!list || !item) return;

    const inicio = item.offsetLeft - TAB_RADIUS;
    const fin = item.offsetLeft + item.offsetWidth + TAB_RADIUS;

    if (inicio < list.scrollLeft) list.scrollLeft = inicio;
    else if (fin > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = fin - list.clientWidth;
    }
  }, [activeIndex, tabs.length]);

  // Closing only makes sense if there's something left behind.
  const closable = onTabClose != null && tabs.length > 1;

  const closeTab = useCallback(
    (id: string) => {
      // On closing the active tab the baton has to pass to a neighbour: the one
      // on the right, and if it was the last one the one on the left — the
      // convention in browsers and editors. It's chosen before telling the
      // parent because afterwards the tab is no longer in `tabs` to tell who
      // came after it.
      if (id === activeTab?.id) {
        const i = tabs.findIndex((t) => t.id === id);
        const vecina = tabs[i + 1] ?? tabs[i - 1];
        if (vecina) select(vecina.id);
      }
      onTabClose?.(id);
    },
    [activeTab?.id, tabs, select, onTabClose]
  );

  return (
    <Root
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl",
        // The background you see here is the bar's, because the content covers
        // it. The shadow goes two rungs over the bar and not one: in the light
        // key the ladder is flat —#FAFAFA against #FCFCFC is 2%— so the panel's
        // silhouette *is* its shadow, and one rung is a bare hairline. With
        // `lifted` it climbs two more and the background stays: see the prop.
        "transition-[box-shadow] duration-80",
        surfaceClasses(barLevel, Math.min(barLevel + 2 + lift, 8)),
        // The ring goes as a `ring` and not by overriding `--shadow-color`: all
        // four layers of the shadow read that variable, so darkening it there
        // would turn the whole halo into a smudge. As a separate ring, what gets
        // darkened is the edge and nothing else.
        lifted &&
          "ring-1 ring-[color-mix(in_oklab,var(--foreground)_25%,transparent)]",
        className
      )}
    >
      {/* items-end aligns the whole row to the bottom, and the bar's air lifts
          it off the content as much as the tabs are lifted off each other. The
          only one that crosses that air is the active tab, with its skirt.

          The sidebar button stays outside the scrolling row: it belongs to the
          panel and not to the tabs, and with many tabs open it would scroll out
          of sight exactly when it's needed most. */}
      <div
        className={cn(
          "flex shrink-0 items-end pl-2",
          compact ? "pt-1.5" : "pt-2"
        )}
        style={{ paddingBottom: BAR_GAP }}
      >
        <SidebarToggle compact={compact} level={planeLevel} />

        {/* With many tabs the row runs past the end: it scrolls instead of
            clipping them against the edge. With no visible bar —it's a 32px row
            and a native scrollbar would eat a third of it— and no vertical
            scroll, which has nowhere to go here. */}
        <div
          role="tablist"
          ref={listRef}
          className="relative flex min-w-0 flex-1 items-end overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{
            gap: BAR_GAP,
            // The sides leave room for the concave corners' arcs, which run
            // `TAB_RADIUS` out of the active tab. Without that air the scroll's
            // clipping eats them at the ends — and on the left it's also what
            // separates the first tab from the sidebar button.
            paddingLeft: TAB_RADIUS,
            paddingRight: TAB_RADIUS,
            // The foot carries the extra skirt and gives it back to the layout
            // with a negative margin. The active tab's skirt drops `skirt` below
            // the tabs' foot to ride onto the plane, and the scrolling box clips
            // whatever runs out: without this air the clipping eats exactly the
            // pixel that covers the plane's ring and the seam reappears.
            paddingBottom: skirt,
            marginBottom: -skirt,
          }}
        >
          {activeRect && (
            <TabSelector rect={activeRect} skirt={skirt} level={planeLevel} />
          )}

          {tabs.map((tab, i) => {
            const isActive = tab.id === activeTab?.id;
            const Icon = tab.icon;
            return (
              // A container and not a <button>: the close button is another
              // button, and nesting them is invalid HTML. As siblings, each
              // keeps its native semantics and the wrapper supplies the hover.
              <div
                key={tab.id}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                className={cn(
                  "group relative inline-flex shrink-0 items-center",
                  "transition-colors duration-80",
                  compact ? "h-7 text-[12px]" : "h-8 text-[13px]",
                  isActive
                    ? // Neither background nor shape: the selector supplies
                      // those, travelling underneath. All that's left here is
                      // the label, and it goes above it.
                      "z-20 text-foreground font-medium"
                    : // --active (10% white) and not --hover (6%): over the
                      // bar, the 6% lands on #232323, two points off the active
                      // tab's #252525, and the fill doesn't lift off the
                      // background.
                      "text-muted-foreground hover:bg-active hover:text-foreground"
                )}
                // Same radius as the selector: two different roundings in the
                // same row show.
                style={{ borderRadius: TAB_RADIUS }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => select(tab.id)}
                  className={cn(
                    "relative inline-flex h-full items-center bg-transparent",
                    "cursor-pointer outline-none",
                    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    compact ? "gap-1.5 pl-2.5" : "gap-2 pl-3",
                    // With no close button, the right padding is supplied by the
                    // tab itself.
                    closable ? "pr-1" : compact ? "pr-2.5" : "pr-3"
                  )}
                  style={{ borderRadius: TAB_RADIUS }}
                >
                  {Icon && (
                    <span
                      className={cn(
                        "relative flex items-center justify-center",
                        "[&_svg]:stroke-[1.5] group-hover:[&_svg]:stroke-2 [&_svg]:transition-[stroke-width] [&_svg]:duration-80",
                        compact ? "[&_svg]:h-3.5 [&_svg]:w-3.5" : "[&_svg]:h-4 [&_svg]:w-4"
                      )}
                    >
                      <Icon />
                    </span>
                  )}
                  <span className="relative whitespace-nowrap">{tab.label}</span>
                </button>

                {closable && (
                  // Always in the layout, invisible until hover: if it only
                  // appeared then, the tab would change width and the whole row
                  // would jump under the cursor.
                  <button
                    type="button"
                    aria-label={`Close ${tab.label}`}
                    onClick={() => closeTab(tab.id)}
                    className={cn(
                      "relative mr-1 inline-flex items-center justify-center",
                      "cursor-pointer rounded-md outline-none",
                      "opacity-0 transition-opacity duration-80 pointer-events-none",
                      // Focus reveals it too: otherwise the keyboard reaches a
                      // button you can't see.
                      "group-hover:pointer-events-auto group-hover:opacity-100",
                      "focus-visible:pointer-events-auto focus-visible:opacity-100",
                      "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                      "text-muted-foreground hover:bg-active hover:text-foreground",
                      compact
                        ? "h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5"
                        : "h-5 w-5 [&_svg]:h-3 [&_svg]:w-3"
                    )}
                  >
                    <X />
                  </button>
                )}
              </div>
              );
          })}
        </div>

        {/* The controls close the bar at the other end. `items-center` and not
            the row's `items-end`: the tabs rest on the bottom edge because
            that's where their skirt comes from, and the controls have no skirt —
            flush with the bottom they'd sit lower than the tabs' text. */}
        {controls && (
          <div className="flex shrink-0 items-center self-stretch pr-2 pl-1">
            {controls}
          </div>
        )}
      </div>

      {/* The plane carries background *and* shadow. In dark colour lifts it,
          but in light the surface ladder is flattened to white from step 3 up,
          so the separation from the bar is given entirely by the shadow's ring.
          Without it, #FAFAFA against #FFFFFF is indistinguishable. */}
      <div
        role="tabpanel"
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          surfaceClasses(planeLevel, PLANE_SHADOW)
        )}
      >
        {/* Whatever is mounted inside starts from the plane's level and not
            from the panel's substrate: a popover in a tab keeps rising. */}
        <SurfaceProvider value={planeLevel}>{activeTab?.content}</SurfaceProvider>
      </div>
    </Root>
  );
}

WorkspacePanel.displayName = "WorkspacePanel";

export { WorkspacePanel };
export type { WorkspacePanelProps, WorkspaceTab };
