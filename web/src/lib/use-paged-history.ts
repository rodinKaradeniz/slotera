"use client";
import * as React from "react";
import { DATA_CHANGED } from "@/api/query-cache";
type Page<T> = { items: T[]; total: number; limit: number; offset: number };
/** Bounded, ephemeral chat history; abort obsolete scopes and merge stable row identities. */
export function usePagedHistory<T extends { id: string }>(
  scope: string,
  load: (offset: number, signal: AbortSignal) => Promise<Page<T>>,
  prepend = false,
) {
  const [revision, setRevision] = React.useState(0);
  const [state, setState] = React.useState<{
    scope: string;
    revision: number;
    items: T[];
    total: number;
    next: number;
    error: Error | null;
  }>({ scope: "", revision: -1, items: [], total: 0, next: 0, error: null });
  const [paging, setPaging] = React.useState(false);
  const flight = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    flight.current = controller;
    void load(0, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted)
          setState({
            scope,
            revision,
            items: page.items,
            total: page.total,
            next: page.items.length,
            error: null,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((old) => ({
            ...(old.scope === scope ? old : { items: [], total: 0, next: 0 }),
            scope,
            revision,
            error: error instanceof Error ? error : new Error("Request failed"),
          }));
      })
      .finally(() => {
        if (flight.current === controller) {
          flight.current = null;
          setPaging(false);
        }
      });
    return () => {
      controller.abort();
      flight.current?.abort();
      flight.current = null;
    };
  }, [scope, load, revision]);
  const current = state.scope === scope;
  async function more() {
    if (flight.current || !current || state.error || state.next >= state.total)
      return;
    const controller = new AbortController();
    flight.current = controller;
    setPaging(true);
    try {
      const page = await load(state.next, controller.signal);
      if (controller.signal.aborted) return;
      setState((old) => ({
        ...old,
        items: Array.from(
          new Map(
            (prepend
              ? [...page.items, ...old.items]
              : [...old.items, ...page.items]
            ).map((item) => [item.id, item]),
          ).values(),
        ),
        total: page.total,
        next: state.next + page.items.length,
        error: null,
      }));
    } catch (error) {
      if (!controller.signal.aborted)
        setState((old) => ({
          ...old,
          error: error instanceof Error ? error : new Error("Request failed"),
        }));
    } finally {
      if (flight.current === controller) {
        flight.current = null;
        setPaging(false);
      }
    }
  }
  return {
    items: current ? state.items : [],
    loading: !current || state.revision !== revision,
    paging,
    error: current ? state.error : null,
    hasMore: current && state.next < state.total,
    more,
    reload: () => setRevision((n) => n + 1),
  };
}
