"use client";

import { DATA_CHANGED, verifiedMetadata } from "@/api/query-cache";
import * as React from "react";
import { getWorkspaceCurrency } from "@/services/settings.service";
import type { Currency } from "@/types/common";

/** The workspace's client-payment currency (GBP until it loads), for money shown in lists. */
export function useWorkspaceCurrency(): Currency {
  const [currency, setCurrency] = React.useState<Currency>(() => verifiedMetadata().currency ?? "GBP");
  React.useEffect(() => {
    let live = true;
    const load = () => getWorkspaceCurrency()
      .then((value) => {
        if (live) setCurrency(value);
      })
      .catch(() => undefined);
    void load();
    window.addEventListener(DATA_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(DATA_CHANGED, load);
    };
  }, []);
  return currency;
}
