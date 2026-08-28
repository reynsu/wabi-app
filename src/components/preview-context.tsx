"use client";

/**
 * PreviewProvider — what the rail is showing, raised to app level and kept per
 * scope.
 *
 * Same problem and same solution as `workspace-context`: the rail is drawn on
 * one side of the shell and whatever asks for a preview lives anywhere else —a
 * row in a list, a name in a table, a tile on the board—. Without this you'd
 * have to thread callbacks through props all the way there.
 *
 * Three pieces:
 *   PreviewProvider  holds the open preview of each scope
 *   usePreview()     what any part of the app consumes to open one
 *   the rail         reads it and shows it instead of the board
 *
 * **A preview belongs to whoever opened it.** The rail is one place in the
 * shell, but what it shows answers a question that was asked inside a tab —
 * this row, this record, this thing. Held as one preview for the whole app,
 * opening a profile in one tab and moving to another leaves that profile
 * standing over a screen that never asked for it. So the provider keeps one
 * preview *per scope*, and `scope` says which one is on: `usePreview()` reads
 * and writes the one that's on, and changing scope changes what the rail shows
 * without anybody having closed anything.
 *
 * `scope` is optional, and that's the point: without it everything lands in the
 * same bucket and the provider behaves exactly as it did before — one app, one
 * preview. Scopes are opt-in.
 *
 * Nothing is ever swept: only the scope that's on is ever read, so what belongs
 * to the others simply isn't shown. A scope that comes back —a tab reopened
 * under the same id— finds its preview where it left it, which is the same rule
 * the workspace already plays by: **the id is the identity**, and asking again
 * for something that's open focuses it instead of making a second one.
 *
 * `LateralPreview` knows none of this: it takes its content through props and
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

/** The bucket of a provider with no `scope`. An empty id names nobody, so
 *  passing `scope=""` is the same as passing nothing — which is what the app
 *  does while no tab is active. */
const SOLO = "";

interface PreviewContextValue {
  /** What the rail is showing **in the scope that's on**, or `null` if it's
   *  showing the board. */
  preview: ReactNode | null;
  /** Puts a preview in the rail, in the scope that's on. It replaces whatever
   *  was there: the rail shows one thing at a time, which is what sets it apart
   *  from the board. */
  show: (preview: ReactNode) => void;
  /** Gives the rail back to the board, in the scope that's on. */
  close: () => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

function usePreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  if (!ctx) {
    throw new Error("usePreview must be used inside a PreviewProvider");
  }
  return ctx;
}

interface PreviewProviderProps {
  children: ReactNode;
  /** Whose preview is on — a tab's id, usually. Without it there's a single
   *  preview for the whole app, which is what this provider used to be. */
  scope?: string;
}

function PreviewProvider({ children, scope }: PreviewProviderProps) {
  const [previews, setPreviews] = useState<Record<string, ReactNode>>({});
  const key = scope ?? SOLO;

  const show = useCallback(
    (next: ReactNode) => setPreviews((p) => ({ ...p, [key]: next })),
    [key],
  );

  const close = useCallback(
    () =>
      setPreviews((p) => {
        if (!(key in p)) return p;
        const { [key]: _fuera, ...resto } = p;
        return resto;
      }),
    [key],
  );

  const value = useMemo<PreviewContextValue>(
    () => ({ preview: previews[key] ?? null, show, close }),
    [previews, key, show, close],
  );

  return (
    <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
  );
}

// `usePreview` lives next to its provider on purpose: splitting it out just to
// please fast refresh would break the module in two for nothing. Same decision
// as in `workspace-context`.
// oxlint-disable-next-line react/only-export-components
export { PreviewProvider, usePreview };
export type { PreviewContextValue, PreviewProviderProps };
