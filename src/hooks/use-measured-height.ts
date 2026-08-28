"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Measures the mounted node's height. Returns a stable ref and the height in
 *  px.
 *
 *  For animating the height of a container whose content is replaced with a
 *  crossover: the incoming one publishes its measurement before the outgoing
 *  one has finished leaving, so the container travels to the final measure and
 *  not in two tugs.
 *
 *  Two details that look superfluous and aren't:
 *
 *  - **The ref is the same callback on every render.** A new one per render
 *    makes React unmount and remount it, and each round trip invalidates the
 *    measurement.
 *
 *  - **It doesn't release the observer when called with `null`.** During the
 *    crossover both contents are mounted, so the outgoing node calls the ref
 *    with `null` *after* the incoming one has already signed up: releasing
 *    there would wipe the measurement of the one that's staying.
 *
 *  `offsetHeight` and not `getBoundingClientRect`: under a scaled ancestor —a
 *  popup coming in with a scale spring— the rect returns the visual height and
 *  the container would animate towards a number that stops being true the
 *  moment the scale reaches 1. */
export function useMeasuredHeight<T extends HTMLElement = HTMLDivElement>() {
  const [height, setHeight] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (!node) return;
    observer.current?.disconnect();
    const next = new ResizeObserver(() => setHeight(node.offsetHeight));
    next.observe(node);
    observer.current = next;
    setHeight(node.offsetHeight);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, height] as const;
}
