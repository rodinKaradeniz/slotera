import { readLang, translate } from "./i18n";
import { billingState } from "./plans";
import type { PendingAction } from "@/types/dashboard";

export function billingAction(
  trialEndsAtISO: string,
  paidThrough: string | null,
  now: Date = new Date(),
): PendingAction | null {
  const state = billingState(trialEndsAtISO, paidThrough, now);
  if (state.kind === "paid" || (state.kind === "trial" && state.daysLeft > 7))
    return null;
  return {
    id: "billing",
    tone: "warning",
    icon: "card",
    label:
      state.kind === "trial"
        ? translate(readLang(), "dashboard.trialEnds", {
            count: state.daysLeft,
          })
        : translate(readLang(), "dashboard.trialEnded"),
    detail: translate(readLang(), "dashboard.billingHint"),
    age: translate(readLang(), "dashboard.now"),
  };
}
