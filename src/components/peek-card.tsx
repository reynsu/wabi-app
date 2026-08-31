"use client";

/**
 * PeekCard — a card with tabs anchored to whatever opens it.
 *
 * It's the missing step between the tooltip and the dialog: more than fits in a
 * one-line pill, less than justifies covering the screen. A name, an icon, a
 * `Tabs` rail and the body of the chosen tab, all stuck to the element that
 * fired it so it reads as an expansion of that element and not as a new window.
 *
 * Five decisions worth not undoing without looking at the rest:
 *
 * 1. **One component for both gestures.** `openOn="click"` and
 *    `openOn="hover"` are the same card with the same anatomy; the only thing
 *    that changes is what opens it. They're two separate components in almost
 *    every library —popover and hover-card— and that split forces you to
 *    maintain the same anatomy twice only to end up choosing by the gesture,
 *    which is the outermost thing. Here the gesture is a prop.
 *
 * 2. **Hover doesn't take focus.** A card that appears because the pointer
 *    passed over it didn't ask for focus: moving it there takes the keyboard
 *    away from where it was and makes the scroll jump. With `openOn="hover"`
 *    focus only goes in when the keyboard opened it. With `openOn="click"` it
 *    does: there was an explicit intent there.
 *
 * 3. **It's a plain `Card`, not `InsetDialog`'s inset.** A single plane, and
 *    what separates the title from the body and the body from the footer is
 *    air. The registry's card is transparent and frameless on purpose —it
 *    inherits the substrate from whatever contains it—, so here it supplies the
 *    spacing and the padding, and the popup supplies the surface. The only
 *    thing that steps off the plane is the tab rail, which needs to read the
 *    step below so its active segment doesn't get lost in dark (see the comment
 *    on the rail).
 *
 * 4. **It climbs any popup's two steps.** `Elevated` applies them and publishes
 *    that level inwards, so a menu opened in here keeps rising from where it
 *    used to rise. The shadow stays fixed at a popup's: a card weighs the same
 *    open over the page as it does inside a dialog.
 *
 * 5. **It isn't modal.** The page keeps scrolling and Base UI's positioner
 *    follows the anchor, so the card travels with its trigger instead of
 *    floating where it was. That's what separates an expansion from a dialog:
 *    if the page behind has to be blocked, what was needed was a `Dialog`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { Elevated } from "@/lib/elevated";
import type { IconComponent } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import {
  SizeProvider,
  useSizeVariant,
  useTypeScale,
  type SizeVariant,
} from "@/lib/size-context";
import { spring, exitFallbackMs } from "@/lib/springs";
import { SurfaceProvider, useSurface } from "@/lib/surface-context";
import { cn } from "@/lib/utils";

type PositionerProps = ComponentProps<typeof Popover.Positioner>;

/** Steps the popup climbs over its substrate: the two of any popup in the
 *  system. It's also the level it publishes inwards. */
const POPUP_RISE = 2;

/** The popup's shadow, fixed. It doesn't follow its step for the same reason
 *  `Dropdown`'s doesn't: a card weighs the same open over the page as it does
 *  inside a dialog, even though its background follows the substrate. */
const POPUP_SHADOW = 3;

/** The width, one step narrower in compact regions — the width, not the
 *  padding, like the dialog's widths. */
const WIDTH = { default: 360, compact: 320 } as const;

interface PeekCardTab {
  /** The tab's text. It's also its key, so it isn't repeated. */
  label: string;
  icon?: IconComponent;
  /** The body, inside the inset card. It can be as tall as it likes: the
   *  height follows it. */
  content: ReactNode;
}

interface PeekCardProps {
  /** The trigger. A single element — it takes the handlers and the open state.
   *  A `Button`, an avatar, an underlined name. */
  children: ReactElement;
  title: string;
  icon?: IconComponent;
  /** A leading element that takes the icon's place: an avatar, a thumbnail, a
   *  colour swatch. `icon` is the shorthand for the usual case — a glyph at the
   *  title's size; this is the way out when what goes there isn't one. Given
   *  both, this wins. */
  media?: ReactNode;
  /** The header's action, at the top right. A short button: what the card
   *  invites you to do with what it's showing. */
  action?: ReactNode;
  tabs: PeekCardTab[];
  /** The footer, on the tray and below the card. Usually a wide button that
   *  leads to the full view of whatever the card summarizes. */
  footer?: ReactNode;
  /** What opens the card. With `"hover"` a click still opens it: it's the only
   *  thing left on a touch device, where there's no pointer to pass over it.
   *  @default "click" */
  openOn?: "click" | "hover";
  /** Wait before opening on hover, in ms. Only with `openOn="hover"`.
   *  @default 300 */
  delay?: number;
  /** Grace period before closing on leave, in ms. Only with
   *  `openOn="hover"`: it gives time to cross the gap between the trigger and
   *  the card. @default 120 */
  closeDelay?: number;
  /** Which side of the trigger it opens on. Base UI flips it on its own if it
   *  doesn't fit. @default "bottom" */
  side?: PositionerProps["side"];
  /** How it lines up against that side. It starts at `"start"` —the card's
   *  edge against the trigger's edge— and not centred: the card is much wider
   *  than almost any trigger, and centred it spills out on both sides.
   *  @default "start" */
  align?: PositionerProps["align"];
  /** Distance in px between the trigger and the card. @default 8 */
  sideOffset?: number;
  /** The tray's width in px. Omitted, the ladder sets it: 360, and 320 in a
   *  compact region. */
  width?: number;
  /** Tab open on mount, uncontrolled. @default 0 */
  defaultTab?: number;
  /** Open tab, controlled from outside. */
  tab?: number;
  onTabChange?: (index: number) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Set `false` when the trigger isn't a native `<button>`. Omitted, it's
   *  deduced from the element: any HTML tag other than `button` switches it off
   *  on its own, and a component is assumed to be a button. */
  nativeButton?: boolean;
  /** Pins the card to a step of the size ladder (default 36px, compact 28px —
   *  see /docs/sizes). Omitted, it follows the surrounding SizeProvider. */
  size?: SizeVariant;
  /** Classes for the tray. */
  className?: string;
}

/** How far the body shifts when the tab changes, in px: it comes in from the
 *  side it's arriving from and leaves towards the opposite one. Without that,
 *  going back to the previous tab looks the same as moving on and the movement
 *  says nothing. It's the same 12 as `MobileActionConfirmation`'s step
 *  crossover. */
const PANEL_TRAVEL = 12;

function PeekCard({
  children,
  title,
  icon: Icon,
  media,
  action,
  tabs,
  footer,
  openOn = "click",
  delay = 300,
  closeDelay = 120,
  side = "bottom",
  align = "start",
  sideOffset = 8,
  width,
  defaultTab = 0,
  tab: tabProp,
  onTabChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  nativeButton,
  size,
  className,
}: PeekCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : internalOpen;
  const actionsRef = useRef<Popover.Root.Actions | null>(null);

  // The index lives out here and not inside the popup: the popup unmounts on
  // close, so the card reopens where it was left and not always on the first
  // tab.
  const [internalTab, setInternalTab] = useState(defaultTab);
  // It's clamped against the list once, here: the rail, the body and the
  // panel's ids all come from this number. Unclamped, an out-of-range index —a
  // list that shrinks with the card open, a `tab` past the end— leaves the rail
  // with nothing marked while the body shows the first tab, and the ids
  // pointing at one that's no longer there.
  const selected = Math.min(
    Math.max(tabProp !== undefined ? tabProp : internalTab, 0),
    Math.max(tabs.length - 1, 0)
  );

  // The crossover's direction is derived from the change of index and not
  // written in the rail's handler: driven from outside, the tab changes without
  // going through it, and the direction would keep the previous change's —going
  // back would look the same as moving on. Adjusting state during render leaves
  // the direction ready in the same commit that changes the panel; in an effect
  // it would arrive late, once the exit had already started.
  const [previous, setPrevious] = useState(selected);
  const [direction, setDirection] = useState(1);
  if (previous !== selected) {
    setPrevious(selected);
    setDirection(selected > previous ? 1 : -1);
  }

  const idPrefix = useId();
  const shape = useShape();
  const variant = useSizeVariant(size);
  const typeScale = useTypeScale(size);
  const reduceMotion = useReducedMotion() ?? false;

  // The substrate out here. `Elevated` climbs the popup's two steps from it;
  // the only thing that needs the raw number is the tab rail — see below, where
  // it gets published again.
  const substrate = useSurface();

  const [measureRef, contentHeight] = useMeasuredHeight<HTMLDivElement>();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleTabChange = useCallback(
    (next: number) => {
      if (tabProp === undefined) setInternalTab(next);
      onTabChange?.(next);
    },
    [tabProp, onTabChange],
  );

  // Base UI defers the unmount while `actionsRef` is set; it's released once
  // the exit animation has finished. `onAnimationComplete` is the main signal
  // and this timer the backup for a background tab, where rAF callbacks are
  // throttled.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(
      () => actionsRef.current?.unmount(),
      exitFallbackMs(spring.moderate),
    );
    return () => clearTimeout(id);
  }, [open]);

  // A single step for everything —the opening, the card's height and the body
  // coming in—: `moderate`, the popups' and the tabs', critically damped. That
  // way the box and what it carries leave and arrive together, as one movement;
  // with the fast step on the body, the text sat still halfway waiting for the
  // box to catch up.
  const travel = reduceMotion ? { duration: 0 } : spring.moderate;

  // Opacity is the only thing that doesn't follow the spring: it goes with the
  // system's short durations —and the outgoing one shorter still, as every exit
  // is— so the two bodies don't read as overlapping during the crossover.
  const panelVariants = useMemo(() => {
    const enter = reduceMotion
      ? { duration: 0 }
      : { ...spring.moderate, opacity: { duration: 0.08 } };
    const exit = reduceMotion
      ? { duration: 0 }
      : { ...spring.moderate.exit, opacity: { duration: 0.06 } };
    // Without motion, the body appears and disappears in place: the height
    // doesn't travel either, so a sideways shift would have nothing to go with.
    const offset = reduceMotion ? 0 : PANEL_TRAVEL;
    return {
      enter: (direction: number) => ({ opacity: 0, x: direction * offset }),
      center: { opacity: 1, x: 0, transition: enter },
      exit: (direction: number) => ({
        opacity: 0,
        x: direction * -offset,
        transition: exit,
      }),
    };
  }, [reduceMotion]);

  const current = tabs[selected] ?? tabs[0];

  /** Whether the rail is needed at all — see where it's painted. */
  const hasRail = tabs.length > 1;

  // An HTML element that isn't a `button` can't take the native button props;
  // a component might well end up rendering one, so it's assumed to do so
  // unless told otherwise.
  const isNativeButton =
    nativeButton ??
    (typeof children.type !== "string" || children.type === "button");

  const popup = (
    <Popover.Portal>
      <Popover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-50 outline-none"
      >
        <motion.div
          // A card that opens upwards grows from its bottom edge —the one
          // stuck to the trigger—, so the origin and the initial offset flip
          // with `side`.
          initial={{ opacity: 0, scale: 0.97, y: side === "top" ? 4 : -4 }}
          animate={
            open
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.97, y: side === "top" ? 4 : -4 }
          }
          transition={open ? travel : spring.moderate.exit}
          style={{
            transformOrigin: side === "top" ? "bottom center" : "top center",
          }}
          onAnimationComplete={() => {
            if (!open) actionsRef.current?.unmount();
          }}
        >
          <Popover.Popup
            // On hover, focus only goes in if the keyboard opened it: the
            // pointer asked for nothing. On click Base UI's behaviour rules,
            // which takes focus to the first tabbable inside.
            initialFocus={
              openOn === "hover" ? (opened) => opened === "keyboard" : undefined
            }
            finalFocus={
              openOn === "hover" ? (closed) => closed === "keyboard" : undefined
            }
            // The popup is the surface: it climbs any system popup's two
            // steps, with the shadow fixed at a popup's —it weighs the same
            // open over the page as inside a dialog— and publishes that level
            // inwards, so a menu opened in here keeps rising from where it used
            // to rise.
            render={<Elevated offset={POPUP_RISE} shadowLevel={POPUP_SHADOW} />}
            style={{
              width: width ?? WIDTH[variant],
              maxWidth: "calc(100vw - 16px)",
            }}
            className={cn(
              // The padding is set by the `Card` inside, zone by zone.
              "flex flex-col overflow-hidden p-0 outline-none",
              // The ceiling comes from the side it opened on:
              // `--available-height` is what Base UI measured between the
              // anchor and the edge. Without this, a body taller than the
              // screen runs off the viewport with no way to reach it — the
              // popup is `fixed`, so the page doesn't scroll to it, and
              // `overflow-hidden` clips whatever is left over. With the ceiling
              // in place, what gives is the body: the title, the rail and the
              // footer don't move.
              "max-h-[var(--available-height)]",
              shape.container,
              className,
            )}
          >
            {/* A plain `Card` and not `InsetDialog`'s inset: a single plane,
                and what separates the zones is air. The registry's card is
                transparent and frameless on purpose —it inherits the substrate
                from whatever contains it—, so here it supplies the spacing and
                the padding, and the popup supplies the surface. */}
            <Card className="min-h-0 flex-1">
              {/* The `Tabs` wraps the whole body and not just the rail: the
                  rail and what the tabs select are the two ends of the same
                  thing, so the context has to cover both. It's driven by index
                  —`selectedIndex` / `onSelect`—, which is the same currency as
                  the `tab` prop outside. */}
              <Tabs
                selectedIndex={selected}
                onSelect={handleTabChange}
                className="flex min-h-0 flex-1 flex-col"
              >
                <CardHeader>
                  {/* The icon goes outside the `CardTitle`: the title
                      duplicates its children into an invisible ghost to reserve
                      the active weight's width, and in there the glyph would be
                      drawn twice. `Popover.Title` lends its id to the popup, so
                      the screen reader announces it by name and not as an
                      unlabelled box. */}
                  <div className="flex min-w-0 items-center gap-2">
                    {media ??
                      (Icon && (
                        <Icon
                          size={typeScale.subtitle}
                          strokeWidth={1.75}
                          className="shrink-0 text-foreground"
                        />
                      ))}
                    <Popover.Title
                      render={<CardTitle className="min-w-0 truncate" />}
                    >
                      {title}
                    </Popover.Title>
                  </div>
                  {action && <CardAction>{action}</CardAction>}
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  {/* One tab, no rail. A segmented control with a single
                      segment can't segment anything: it reads as a label the
                      card already has in its title, and it eats a row of the
                      body to say it twice. So a one-tab card is just a card,
                      and the tab is only what holds its content.

                      It isn't a prop because it isn't a choice: two or more
                      tabs need somewhere to switch, one never does. */}
                  {hasRail && (
                  <>
                  {/* The rail paints itself against the substrate it reads: its
                      active segment lands three steps higher. Read from inside
                      the popup —which already climbed two— it lands, in dark, on
                      the same value as the rail and the chosen tab disappears,
                      so here the step the popup rests on gets published again.
                      It's the only thing that needs the number below: whatever
                      opens on top —a menu, another popover— keeps reading the
                      popup's.

                      The tabs share out the width, which the card holds fixed: a
                      rail shorter than its line reads as something left half
                      finished. The `flex-1` goes without `min-w-0` on purpose:
                      it shares out the surplus when the labels fit, but no tab
                      drops below what its text measures —which is neither
                      truncated nor wrapped—, so with long labels the rail
                      overflows and scrolls instead of the tabs treading on each
                      other. */}
                  <SurfaceProvider value={substrate}>
                    <TabsList
                      aria-label={title}
                      className="w-full overflow-x-auto scrollbar-hide"
                    >
                      {tabs.map((item, index) => (
                        <TabItem
                          key={item.label}
                          value={item.label}
                          label={item.label}
                          icon={item.icon}
                          // We set the ids ourselves because the panel is ours
                          // too (see below): with no Base UI `Tabs.Panel`
                          // registered, the tab has nothing to point at.
                          id={`${idPrefix}-tab-${index}`}
                          // Only the chosen one: it's the only one whose panel
                          // is in the DOM. Pointing at the other two would send
                          // the screen reader to ids that don't exist, which is
                          // worse than saying nothing.
                          aria-controls={
                            index === selected
                              ? `${idPrefix}-panel-${index}`
                              : undefined
                          }
                          className="flex-1 justify-center"
                        />
                      ))}
                    </TabsList>
                  </SurfaceProvider>
                  </>
                  )}

                  {/* The body. Without `initial={false}` the first opening
                      would animate the height from zero, which looks like a card
                      unfolding instead of one appearing whole. `min-h-0` is what
                      makes the body pay for the popup's ceiling: the animated
                      height is the measure it asks for, and flexbox trims it
                      when it doesn't fit.

                      This layer only animates and clips; the scrolling is the
                      ScrollArea's inside it, so a body that outgrows the ceiling
                      gets the system's scrollbar and not the browser's, and on a
                      touch device it hands back to native overflow on its own.
                      Clipping goes on both axes here: `overflow-x-hidden` alone
                      would turn the y axis into `auto` and leave two scrollers,
                      one inside the other. */}
                  <motion.div
                    className="relative min-h-0 overflow-hidden"
                    initial={false}
                    animate={{ height: contentHeight ?? "auto" }}
                    transition={travel}
                  >
                    {/* A shorter fade than the default 48px: on a body that
                        rarely passes 200px, a quarter of it dissolved is the
                        edge treatment eating the content. Marked important
                        because `.scroll-fade` is a plain rule outside Tailwind's
                        layers, and an unlayered rule beats a layered utility of
                        the same specificity whatever the order. */}
                    <ScrollArea
                      className="h-full"
                      viewportClassName="scroll-fade [--scroll-fade-size:24px]!"
                    >
                      <AnimatePresence
                        initial={false}
                        mode="popLayout"
                        custom={direction}
                      >
                        <motion.div
                          key={selected}
                          custom={direction}
                          variants={panelVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                        >
                          {/* The panel is built by hand instead of with
                              `TabPanel`: that one hides whichever isn't selected,
                              and here both have to stay mounted and visible for as
                              long as the crossover lasts. The ids are the ones we
                              gave the tabs above, so each tab's `aria-controls`
                              keeps pointing at its panel. The padding is the
                              `CardContent`'s that wraps it: the body rests on the
                              same plane as the title.

                              With no rail there are no tabs, so the panel drops
                              the roles too: a `tabpanel` labelled by an id that
                              was never rendered sends the screen reader nowhere.
                              What names it then is the popup's own title. */}
                          <div
                            ref={measureRef}
                            id={hasRail ? `${idPrefix}-panel-${selected}` : undefined}
                            role={hasRail ? "tabpanel" : undefined}
                            aria-labelledby={
                              hasRail ? `${idPrefix}-tab-${selected}` : undefined
                            }
                            tabIndex={-1}
                            className="outline-none"
                          >
                            {current?.content}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </ScrollArea>
                  </motion.div>
                </CardContent>

                {footer && <CardFooter>{footer}</CardFooter>}
              </Tabs>
            </Card>
          </Popover.Popup>
        </motion.div>
      </Popover.Positioner>
    </Popover.Portal>
  );

  const root = (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      actionsRef={actionsRef}
      // See decision 5 in the header: the page stays alive behind it.
      modal={false}
    >
      <Popover.Trigger
        render={children}
        nativeButton={isNativeButton}
        openOnHover={openOn === "hover"}
        delay={delay}
        closeDelay={closeDelay}
      />
      {popup}
    </Popover.Root>
  );

  // `size` pins the whole composite —the trigger's and the portalled popup's,
  // because React context crosses portals— to a step of the ladder.
  return size ? <SizeProvider size={size}>{root}</SizeProvider> : root;
}

PeekCard.displayName = "PeekCard";

export { PeekCard };
export type { PeekCardProps, PeekCardTab };
