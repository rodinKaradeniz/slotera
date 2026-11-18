"use client";

import * as React from "react";
import { exitMs, motion, prefersReducedMotion } from "@/lib/motion";

export type RowState<T> = { item: T; leaving: boolean };

/**
 * Keeps a row that just left `items` on screen, in its old place and marked `leaving`, long
 * enough for it to fade aside while the rows below close up (render each row inside a
 * `.row-shell` with `data-state={leaving ? "closed" : "open"}`). Under Reduce Motion rows
 * simply go.
 */
export function useLeavingRows<T>(items: readonly T[], keyOf: (item: T) => string): RowState<T>[] {
  const signature = items.map(keyOf).join("\u0000");
  const [previous, setPrevious] = React.useState({ signature, items });
  const [leaving, setLeaving] = React.useState<{ item: T; index: number }[]>([]);

  if (previous.signature !== signature) {
    const present = new Set(items.map(keyOf));
    const gone = previous.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !present.has(keyOf(item)));
    setPrevious({ signature, items });
    if (gone.length && !prefersReducedMotion()) {
      setLeaving((current) => [...current.filter(({ item }) => !present.has(keyOf(item))), ...gone]);
    }
  }

  React.useEffect(() => {
    if (!leaving.length) return;
    const timer = window.setTimeout(() => setLeaving([]), exitMs(motion.rows.duration));
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const rows: RowState<T>[] = items.map((item) => ({ item, leaving: false }));
  for (const { item, index } of [...leaving].sort((a, b) => a.index - b.index)) {
    if (!rows.some((row) => keyOf(row.item) === keyOf(item))) {
      rows.splice(Math.min(index, rows.length), 0, { item, leaving: true });
    }
  }
  return rows;
}
