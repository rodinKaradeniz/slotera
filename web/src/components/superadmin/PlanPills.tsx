import { Pill } from "@/components/ui/Pill";
import { PLAN_LABEL, billingState } from "@/lib/plans";
import { fmtDate } from "@/lib/time";
import type { PlatformWorkspace } from "@/types/platform";

/** The tier plus where the workspace stands: on trial, paid to a date, or lapsed. */
export function PlanPills({ workspace }: { workspace: PlatformWorkspace }) {
  const state = billingState(workspace.trialEndsAtISO, workspace.paidThrough);
  return (
    <>
      <Pill tone={workspace.plan === "professional" ? "accent" : "neutral"}>
        {PLAN_LABEL[workspace.plan]}
      </Pill>
      {state.kind === "trial" && <Pill tone="neutral">Trial · {state.daysLeft}d left</Pill>}
      {state.kind === "paid" && (
        <Pill tone="success">Paid to {fmtDate(new Date(`${state.through}T12:00:00`), "short")}</Pill>
      )}
      {state.kind === "lapsed" && <Pill tone="warning">Unpaid</Pill>}
    </>
  );
}
