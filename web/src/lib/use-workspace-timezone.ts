"use client";

import * as React from "react";
import { getWorkspaceTimezone } from "@/services/settings.service";

/** The workspace timezone for showing session times (UTC until it loads). */
export function useWorkspaceTimezone(): string {
  const [timezone, setTimezone] = React.useState("UTC");
  React.useEffect(() => {
    let live = true;
    getWorkspaceTimezone()
      .then((value) => {
        if (live) setTimezone(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return timezone;
}
