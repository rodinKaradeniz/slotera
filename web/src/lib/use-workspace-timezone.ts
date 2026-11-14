"use client";

import { DATA_CHANGED, verifiedMetadata } from "@/api/query-cache";
import * as React from "react";
import { getWorkspaceTimezone } from "@/services/settings.service";

/** The workspace timezone for showing session times (UTC until it loads). */
export function useWorkspaceTimezone(): string {
  const [timezone, setTimezone] = React.useState(() => verifiedMetadata().timezone ?? "UTC");
  React.useEffect(() => {
    let live = true;
    const load = () => getWorkspaceTimezone()
      .then((value) => {
        if (live) setTimezone(value);
      })
      .catch(() => undefined);
    void load();
    window.addEventListener(DATA_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(DATA_CHANGED, load);
    };
  }, []);
  return timezone;
}
