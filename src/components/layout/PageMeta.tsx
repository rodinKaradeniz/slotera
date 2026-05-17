"use client";

import * as React from "react";
import type { Crumb } from "./AdminTopbar";

type PageMeta = {
  crumbs: Crumb[];
};

type Ctx = {
  meta: PageMeta;
  setMeta: (next: PageMeta) => void;
};

const PageMetaContext = React.createContext<Ctx | null>(null);

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = React.useState<PageMeta>({ crumbs: [] });
  const value = React.useMemo(() => ({ meta, setMeta }), [meta]);
  return (
    <PageMetaContext.Provider value={value}>
      {children}
    </PageMetaContext.Provider>
  );
}

export function usePageMeta(): PageMeta {
  const ctx = React.useContext(PageMetaContext);
  return ctx?.meta ?? { crumbs: [] };
}

/**
 * Pages call this to publish their breadcrumbs to the persistent AdminShell.
 * Pass a stable array (or memoize) to avoid update loops.
 */
export function useSetCrumbs(crumbs: Crumb[]): void {
  const ctx = React.useContext(PageMetaContext);
  const serialized = JSON.stringify(crumbs);
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setMeta({ crumbs });
    // crumbs intentionally compared via serialized form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
