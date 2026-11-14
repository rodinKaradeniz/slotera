"use client";

import { DATA_CHANGED } from "@/api/query-cache";
import * as React from "react";

type Settled<T> = { load: (signal?: AbortSignal) => Promise<T>; attempt: number; data?: T; error?: Error };

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
export function useLoad<T>(load: (signal?: AbortSignal) => Promise<T>): Loaded<T> {
  const [attempt, setAttempt] = React.useState(0);
  const [settled, setSettled] = React.useState<Settled<T> | null>(null);
  const [lastData, setLastData] = React.useState<T | null>(null);

  React.useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);

  React.useEffect(() => {
    let live = true;
    const controller = new AbortController();
    load(controller.signal).then(
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
          error: error instanceof Error ? error : new Error("Couldn't load this page."),
        });
      },
    );
    return () => {
      live = false;
      controller.abort();
    };
  }, [load, attempt]);

  const current = settled?.load === load && settled.attempt === attempt;
  return {
    data: lastData,
    error: current ? (settled.error?.message ?? null) : null,
    loading: !current,
    reload: React.useCallback(() => setAttempt((n) => n + 1), []),
  };
}
