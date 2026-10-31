"use client";

import * as React from "react";
import { getWorkspaceCurrency } from "@/services/settings.service";
import type { Currency } from "@/types/common";

/** The workspace's client-payment currency (GBP until it loads), for money shown in lists. */
export function useWorkspaceCurrency(): Currency {
  const [currency, setCurrency] = React.useState<Currency>("GBP");
  React.useEffect(() => {
    let live = true;
    getWorkspaceCurrency()
      .then((value) => {
        if (live) setCurrency(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return currency;
}
