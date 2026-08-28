"use client";

/**
 * WorkspaceProvider — the WorkspacePanel's tabs, raised to app level so any
 * component can open one without threading callbacks through props all the way
 * to the panel.
 *
 * Three pieces:
 *   WorkspaceProvider  holds the tabs and which one is active
 *   useWorkspace()     what any part of the app consumes to open them
 *   WorkspaceOutlet    where the panel is drawn, usually in a single place
 *
 * WorkspacePanel knows none of this: it still takes `tabs` through props and
 * works just as well on its own, with no provider.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  WorkspacePanel,
  type WorkspacePanelProps,
  type WorkspaceTab,
} from "@/components/workspace-panel";

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeId: string | undefined;
}

interface WorkspaceContextValue extends WorkspaceState {
  /** Opens a tab and focuses it. If one with that id is already open it isn't
   *  duplicated: it just gets focused, which is what you expect when you ask
   *  again for something that's open. With `focus: false` it opens in the
   *  background. */
  openTab: (tab: WorkspaceTab, options?: { focus?: boolean }) => void;
  /** Closes a tab. If it was the active one, its neighbour takes over — the one
   *  to the right, or the one to the left if it was the last. */
  closeTab: (id: string) => void;
  /** Focuses an already-open tab. Ids that don't exist are ignored. */
  activateTab: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  }
  return ctx;
}

interface WorkspaceProviderProps {
  children: ReactNode;
  /** Tabs it starts with. */
  defaultTabs?: WorkspaceTab[];
  /** Which one is active on mount. The first one by default. */
  defaultActiveId?: string;
}

function WorkspaceProvider({
  children,
  defaultTabs = [],
  defaultActiveId,
}: WorkspaceProviderProps) {
  // One state object and not two: closing the active tab has to drop it from
  // the list and move the selection in the same step, and picking the
  // neighbour needs the list from BEFORE it was dropped. With two separate
  // states that means reading one from inside the other's updater, which
  // StrictMode runs twice.
  const [state, setState] = useState<WorkspaceState>(() => ({
    tabs: defaultTabs,
    activeId: defaultActiveId ?? defaultTabs[0]?.id,
  }));

  const openTab = useCallback(
    (tab: WorkspaceTab, { focus = true }: { focus?: boolean } = {}) => {
      setState((s) => {
        const abierta = s.tabs.some((t) => t.id === tab.id);
        return {
          // Already open: the existing one wins. Replacing it with the new
          // descriptor would remount its content and lose whatever was inside
          // (scroll position, a half-filled form).
          tabs: abierta ? s.tabs : [...s.tabs, tab],
          activeId: focus ? tab.id : s.activeId ?? tab.id,
        };
      });
    },
    []
  );

  const closeTab = useCallback((id: string) => {
    setState((s) => {
      const i = s.tabs.findIndex((t) => t.id === id);
      if (i === -1) return s;
      return {
        tabs: s.tabs.filter((t) => t.id !== id),
        activeId:
          s.activeId === id
            ? (s.tabs[i + 1] ?? s.tabs[i - 1])?.id
            : s.activeId,
      };
    });
  }, []);

  const activateTab = useCallback((id: string) => {
    setState((s) =>
      s.tabs.some((t) => t.id === id) ? { ...s, activeId: id } : s
    );
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ ...state, openTab, closeTab, activateTab }),
    [state, openTab, closeTab, activateTab]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Where the panel is drawn. Usually one of these, next to the sidebar. */
type WorkspaceOutletProps = Omit<
  WorkspacePanelProps,
  "tabs" | "value" | "defaultValue" | "onValueChange" | "onTabClose"
>;

function WorkspaceOutlet(props: WorkspaceOutletProps) {
  const { tabs, activeId, activateTab, closeTab } = useWorkspace();

  return (
    <WorkspacePanel
      tabs={tabs}
      // "" and not undefined: the panel reads `value === undefined` as
      // "uncontrolled" and would fall back to its internal state when no tab is
      // active. An empty id matches nothing and keeps it controlled.
      value={activeId ?? ""}
      onValueChange={activateTab}
      onTabClose={closeTab}
      {...props}
    />
  );
}

// `useWorkspace` lives next to its provider on purpose: splitting it out just
// to please fast refresh would break the module in two for nothing.
// oxlint-disable-next-line react/only-export-components
export { WorkspaceProvider, WorkspaceOutlet, useWorkspace };
export type { WorkspaceContextValue, WorkspaceProviderProps, WorkspaceOutletProps };
