"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Pill } from "@/components/ui/Pill";
import { PLAN_LABEL, billingState } from "@/lib/plans";
import { fmtDate } from "@/lib/time";
import type { PlatformWorkspace } from "@/types/platform";

/** The tier plus where the workspace stands: on trial, paid to a date, or lapsed. */
export function PlanPills({ workspace }: { workspace: PlatformWorkspace }) {
  const { t: uiText } = useI18n();
  const state = billingState(workspace.trialEndsAtISO, workspace.paidThrough);
  return (
    <>
      <Pill tone={workspace.plan === "professional" ? "accent" : "neutral"}>
        {PLAN_LABEL[workspace.plan]}
      </Pill>
      {state.kind === "trial" && <Pill tone="neutral">{uiText("ui.trial")}{state.daysLeft}{uiText("ui.d.left")}</Pill>}
      {state.kind === "paid" && (
        <Pill tone="success">{uiText("ui.paid.to")}{fmtDate(new Date(`${state.through}T12:00:00`), "short")}</Pill>
      )}
      {state.kind === "lapsed" && <Pill tone="warning">{uiText("ui.unpaid")}</Pill>}
    </>
  );
}
