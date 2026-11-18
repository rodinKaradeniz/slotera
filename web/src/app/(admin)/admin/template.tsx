import * as React from "react";
import { ScreenEnter } from "@/components/layout/ScreenEnter";

/** Remounts on every navigation, so each screen gets its arrival (see ScreenEnter). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <ScreenEnter>{children}</ScreenEnter>;
}
