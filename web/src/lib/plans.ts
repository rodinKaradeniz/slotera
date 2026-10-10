// Slotera's platform plans, mirroring server/src/slotera_api/plans.py. The public
// pricing page reads these constants (it also renders in the mock demo, which has no
// API); the operator's Billing tab reads the same numbers from the API.

export type PlanId = "essentials" | "professional";
export type BillingInterval = "monthly" | "yearly";

export type PlanPrice = {
  id: PlanId;
  monthlyPence: number;
  /** Ten months' price: "2 months free". */
  yearlyPence: number;
  cardFeeBps: number;
};

export const PLAN_PRICES: PlanPrice[] = [
  { id: "essentials", monthlyPence: 1900, yearlyPence: 19000, cardFeeBps: 200 },
  { id: "professional", monthlyPence: 3900, yearlyPence: 39000, cardFeeBps: 100 },
];

export const PLAN_LABEL: Record<PlanId, string> = {
  essentials: "Essentials",
  professional: "Professional",
};

export const TRIAL_DAYS = 30;

/** Whole months saved by paying yearly instead of monthly. */
export function monthsFreeYearly(price: PlanPrice): number {
  return Math.round((price.monthlyPence * 12 - price.yearlyPence) / price.monthlyPence);
}

export type BillingState =
  | { kind: "paid"; through: string }
  | { kind: "trial"; endsISO: string; daysLeft: number }
  | { kind: "lapsed"; endedISO: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a workspace stands. Paid wins while `paidThrough` (a YYYY-MM-DD date) is today
 * or later; otherwise the trial runs until `trialEndsAtISO`; after both, it has lapsed.
 * Nothing is locked on lapse: Slotera staff follow up by hand.
 */
export function billingState(
  trialEndsAtISO: string,
  paidThrough: string | null,
  now: Date = new Date(),
): BillingState {
  const today = now.toISOString().slice(0, 10);
  if (paidThrough && paidThrough >= today) return { kind: "paid", through: paidThrough };
  const ends = new Date(trialEndsAtISO);
  if (ends.getTime() > now.getTime()) {
    return {
      kind: "trial",
      endsISO: trialEndsAtISO,
      daysLeft: Math.ceil((ends.getTime() - now.getTime()) / DAY_MS),
    };
  }
  return { kind: "lapsed", endedISO: paidThrough ?? trialEndsAtISO };
}
