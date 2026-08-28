"use client";

/**
 * WindowControls — the bar of icons that drives the window's and the sidebar's
 * state, with a shared TravelTooltip.
 *
 * The three buttons operate on real state, not simulated:
 *   sidebar          the registry's useSidebar()
 *   full screen      Fullscreen API
 *   floating window  Document Picture-in-Picture
 *
 * Every label reflects the current state ("Hide" ⇄ "Show"), so pressing one
 * with the tooltip open remeasures the pill and fits it to the new text without
 * closing. It's the same mechanism as the travel between buttons, but fired by
 * a change of state instead of by the pointer.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PictureInPicture2,
  SquarePen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { useSidebar } from "@/components/ui/sidebar";
import { TravelTooltip, TravelTooltipItem } from "@/components/travel-tooltip";
import { cn } from "@/lib/utils";
import type { SizeVariant } from "@/lib/size-context";

/* ───────────────────────── Full screen ───────────────────────── */

function useFullscreen(target?: () => Element | null) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // The user can leave with Escape without touching the button, so the state is
  // derived from the browser's event and not from what we did.
  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const el = target?.() ?? document.documentElement;
        await el.requestFullscreen();
      }
    } catch {
      // It rejects when there's no user gesture or a policy blocks it. The
      // listener above leaves the state as it really is.
    }
  }, [target]);

  return {
    isFullscreen,
    toggle,
    supported:
      typeof document !== "undefined" && document.fullscreenEnabled === true,
  };
}

/* ───────────────────────── Floating window ───────────────────────── */

interface DocumentPiP {
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<Window>;
  window: Window | null;
}

function getPiP(): DocumentPiP | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPiP })
    .documentPictureInPicture ?? null;
}

/** Clones the main document's styles into the floating window. Without this it
 *  comes out with no CSS: it's a separate document and inherits nothing. In dev
 *  Vite injects <style>, in a build they end up as <link>, so both cases have to
 *  be covered. */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("");
      const style = target.document.createElement("style");
      style.textContent = rules;
      target.document.head.appendChild(style);
    } catch {
      // A cross-origin sheet: its rules can't be read, so it gets linked.
      if (!sheet.href) continue;
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.document.head.appendChild(link);
    }
  }
  // The theme lives in a class on <html>, which the new window doesn't
  // inherit.
  target.document.documentElement.className =
    document.documentElement.className;
}

function useFloatingWindow(content: ReactNode) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // The API existing doesn't guarantee it works: inside an embedded panel (not
  // a top-level window) requestWindow rejects with InvalidStateError. The only
  // way to know is to try, so the first failure marks the button as unavailable
  // instead of leaving it dead and silent.
  const [unavailable, setUnavailable] = useState(false);
  const supported = getPiP() !== null && content != null && !unavailable;

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  const open = useCallback(async () => {
    const pip = getPiP();
    if (!pip) return;
    if (pip.window) {
      pip.window.close();
      setPipWindow(null);
      return;
    }
    try {
      const w = await pip.requestWindow({ width: 320, height: 180 });
      copyStyles(w);
      w.document.body.style.margin = "0";
      // Closing from the window's own × has to clear the state too.
      w.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(w);
    } catch {
      // No user gesture, blocked by policy, or a context that can't open
      // windows. Either way the button stops offering something that isn't
      // going to happen.
      setUnavailable(true);
    }
  }, []);

  // If the component unmounts with the window open, it closes with it.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  const portal = pipWindow
    ? createPortal(content, pipWindow.document.body)
    : null;

  return { isOpen: pipWindow !== null, open, close, supported, portal };
}

/* ───────────────────────── Buttons ───────────────────────── */

/** Each control is a loose button with a surface of its own, not three icons
 *  inside a shared pill. `tertiary` supplies the 1px ring that bounds it, and
 *  rounded-full makes it circular — which is the convention for window
 *  controls. It's the one place where the component deliberately steps away
 *  from the shape system: shape.button would give 8px in "rounded" mode, and
 *  here the circle is part of the control's identity. */
const CONTROL_CLASS = "rounded-full";

/* ───────────────────────── The sidebar button ───────────────────────── */

/** Kept apart so the hook only runs when the button is asked for: useSidebar()
 *  throws outside a SidebarProvider, and the other controls don't need it. */
function SidebarControl({ _index }: { _index?: number }) {
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
    // TravelTooltip injects _index into this component, not into the item it
    // returns, so it has to be forwarded by hand.
    <TravelTooltipItem
      _index={_index}
      label={visible ? "Hide side panel" : "Show side panel"}
    >
      <Button
        variant="tertiary"
        size="icon"
        className={CONTROL_CLASS}
        aria-label={visible ? "Hide side panel" : "Show side panel"}
        aria-pressed={visible}
        onClick={toggleSidebar}
      >
        <Icon />
      </Button>
    </TravelTooltipItem>
  );
}

/* ───────────────────────── The "More…" button ───────────────────────── */

interface MoreControlProps {
  fullscreen: ReturnType<typeof useFullscreen>;
  floating: ReturnType<typeof useFloatingWindow>;
  hasFloating: boolean;
  extraItems?: (startIndex: number) => ReactNode;
  _index?: number;
}

function MoreControl({
  fullscreen,
  floating,
  hasFloating,
  extraItems,
  _index,
}: MoreControlProps) {
  const [open, setOpen] = useState(false);

  // The menu unfolds exactly where the pill would go, so while it's open the
  // item is silenced instead of drawing both on top of each other.
  let i = 0;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <TravelTooltipItem _index={_index} label="More…" suppressed={open}>
        <DropdownTrigger
          render={
            <Button
              variant="tertiary"
              size="icon"
              className={CONTROL_CLASS}
              aria-label="More options"
            />
          }
        >
          <MoreHorizontal />
        </DropdownTrigger>
      </TravelTooltipItem>

      <DropdownContent side="bottom" align="start">
        <MenuItem
          index={i++}
          label={
            fullscreen.isFullscreen
              ? "Exit full screen"
              : "Full screen"
          }
          disabled={!fullscreen.supported}
          onSelect={fullscreen.toggle}
        />
        {hasFloating && (
          <MenuItem
            index={i++}
            label={
              floating.isOpen
                ? "Close floating window"
                : "Use floating window"
            }
            disabled={!floating.supported}
            onSelect={floating.isOpen ? floating.close : floating.open}
          />
        )}
        {extraItems && (
          <>
            <DropdownSeparator />
            {extraItems(i)}
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

/* ───────────────────────── WindowControls ───────────────────────── */

interface WindowControlsProps {
  /** Includes the button that opens and closes the sidebar. Requires being
   *  inside a SidebarProvider — the hook throws if there isn't one.
   *  @default true */
  sidebar?: boolean;
  /** Which element goes full screen. The whole document by default. */
  fullscreenTarget?: () => Element | null;
  /** The floating window's content. Without this the button isn't rendered: an
   *  empty window is no use to anyone. */
  floatingContent?: ReactNode;
  /** The first button's action. Without this, that button isn't rendered. */
  onCompose?: () => void;
  /** The first button's label. @default "New note" */
  composeLabel?: string;
  /** Extra items for the "More…" menu. It takes the index to carry on from,
   *  because MenuItem needs them contiguous for its proximity highlight. */
  moreItems?: (startIndex: number) => ReactNode;
  /** Includes the "More…" menu, which is where full screen and the floating
   *  window live. Switch it off when the bar is made only of the app's own
   *  controls: a menu with two browser items has no reason to keep them
   *  company. @default true */
  more?: boolean;
  /** The app's own controls, inside the same travelling tooltip. They go before
   *  the menu and the sidebar button — the app's things first, the window's
   *  after. They're written as `TravelTooltipItem`, so the highlight crosses
   *  from one to the next without closing, which is the reason the bar is a
   *  single one and not three loose buttons with three tooltips. */
  children?: ReactNode;
  /** Pins the bar to a step of the size ladder. */
  size?: SizeVariant;
  className?: string;
}

function WindowControls({
  sidebar = true,
  fullscreenTarget,
  floatingContent,
  onCompose,
  composeLabel = "New note",
  moreItems,
  more = true,
  children,
  size,
  className,
}: WindowControlsProps) {
  const fullscreen = useFullscreen(fullscreenTarget);
  const floating = useFloatingWindow(floatingContent);

  return (
    <>
      <div className={cn("inline-flex", className)}>
        {/* side="bottom" fixed: these controls live in a window's top bar,
            where there's no room above. */}
        <TravelTooltip side="bottom" size={size}>
          {onCompose ? (
            <TravelTooltipItem label={composeLabel}>
              <Button
                variant="tertiary"
                size="icon"
                className={CONTROL_CLASS}
                aria-label={composeLabel}
                onClick={onCompose}
              >
                <SquarePen />
              </Button>
            </TravelTooltipItem>
          ) : null}

          {floatingContent != null ? (
            <TravelTooltipItem
              label={
                !floating.supported
                  ? "This browser doesn't open floating windows"
                  : floating.isOpen
                    ? "Close floating window"
                    : "Use floating window"
              }
            >
              <Button
                variant="tertiary"
                size="icon"
                className={cn(CONTROL_CLASS, !floating.supported && "opacity-50")}
                aria-label={
                  floating.isOpen
                    ? "Close floating window"
                    : "Use floating window"
                }
                aria-pressed={floating.isOpen}
                aria-disabled={!floating.supported}
                onClick={
                  !floating.supported
                    ? undefined
                    : floating.isOpen
                      ? floating.close
                      : floating.open
                }
              >
                <PictureInPicture2 />
              </Button>
            </TravelTooltipItem>
          ) : null}

          {children}

          {more ? (
            <MoreControl
              fullscreen={fullscreen}
              floating={floating}
              hasFloating={floatingContent != null}
              extraItems={moreItems}
            />
          ) : null}

          {sidebar ? <SidebarControl /> : null}
        </TravelTooltip>
      </div>

      {floating.portal}
    </>
  );
}

WindowControls.displayName = "WindowControls";

export { WindowControls };
export type { WindowControlsProps };
