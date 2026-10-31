"use client";

import * as React from "react";

type Settled<T> = { load: () => Promise<T>; attempt: number; data?: T; error?: string };

export type Loaded<T> = {
  /** The last successful result; kept while a reload is running. */
  data: T | null;
  /** The message of the failed load, until the next attempt settles. */
  error: string | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Loads data when `load` changes (memoise it with `useCallback`) and again on `reload()`,
 * with loading and error state, so a failed request shows a message instead of loading forever.
 */
export function useLoad<T>(load: () => Promise<T>): Loaded<T> {
  const [attempt, setAttempt] = React.useState(0);
  const [settled, setSettled] = React.useState<Settled<T> | null>(null);
  const [lastData, setLastData] = React.useState<T | null>(null);

  React.useEffect(() => {
    let live = true;
    load().then(
      (data) => {
        if (!live) return;
        setLastData(data);
        setSettled({ load, attempt, data });
      },
      (error: unknown) => {
        if (!live) return;
        setSettled({
          load,
          attempt,
          error: error instanceof Error ? error.message : "Couldn't load this page.",
        });
      },
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);

  const current = settled?.load === load && settled.attempt === attempt;
  return {
    data: lastData,
    error: current ? (settled.error ?? null) : null,
    loading: !current,
    reload: React.useCallback(() => setAttempt((n) => n + 1), []),
  };
}
