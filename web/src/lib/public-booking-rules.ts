/**
 * The public booking rules from `server/src/slotera_api/public_booking/repository.py` and
 * `booking_financials.py`, mirrored for the demo so `/booking` behaves like `/book/{slug}`.
 * Change these together with the server; `public-booking-rules.test.ts` pins the shared cases.
 */
import { zonedWallToISO } from "@/lib/calendar";
import type { AvailabilitySettings } from "@/services/settings.service";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

export type Slot = { startAt: string; endAt: string; spotsLeft?: number | null };

export type TaxSettings = {
  taxTreatment: "none" | "fixed";
  taxRateBps: number;
  taxLabel: string;
  taxJurisdiction: string;
};

/** `_publicly_bookable`: open 1:1 services, or scheduled services of any capacity. */
export function isPubliclyBookable(service: Service): boolean {
  return service.active && (
    (service.bookingMode === "open" && service.capacity === 1) || service.bookingMode === "scheduled"
  );
}

/** `quote_for`: the service price is gross; a fixed rate is extracted from it, never added. */
export function quoteFor(priceCents: number, tax: TaxSettings): NonNullable<Service["publicQuote"]> {
  const fixed = tax.taxTreatment === "fixed" && tax.taxRateBps > 0;
  const net = fixed ? Math.round((priceCents * 10000) / (10000 + tax.taxRateBps)) : priceCents;
  return {
    treatment: tax.taxTreatment,
    rateBps: tax.taxRateBps,
    label: fixed ? tax.taxLabel : undefined,
    jurisdiction: tax.taxJurisdiction || undefined,
    grossAmountCents: priceCents,
    netAmountCents: net,
    taxAmountCents: priceCents - net,
  };
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

function* days(startsOn: string, endsOn: string): Generator<string> {
  const cursor = new Date(`${startsOn}T00:00:00Z`);
  const last = new Date(`${endsOn}T00:00:00Z`);
  while (cursor <= last) {
    yield cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/** `_available_slots` for open services; `_scheduled_slots` for scheduled ones. */
export function availableSlots(
  service: Service,
  policy: AvailabilitySettings,
  sessions: SessionItem[],
  startsOn: string,
  endsOn: string,
  now: Date,
): Slot[] {
  const rangeStart = Date.parse(zonedWallToISO(startsOn, "00:00", policy.timezone));
  const rangeEnd = Date.parse(zonedWallToISO(endsOn, "00:00", policy.timezone)) + DAY;
  const earliest = now.getTime() + policy.minimumNoticeMin * MINUTE;
  const latest = now.getTime() + policy.maximumAdvanceDays * DAY;

  if (service.bookingMode === "scheduled") {
    return sessions
      .filter((item) => item.serviceId === service.id && item.status === "scheduled")
      .map((item) => ({ item, start: Date.parse(item.startISO) }))
      .filter(({ start }) => start >= Math.max(rangeStart, earliest) && start < Math.min(rangeEnd, latest))
      .filter(({ item }) => item.bookedCount < item.capacity)
      .sort((a, b) => a.start - b.start)
      .map(({ item }) => ({ startAt: item.startISO, endAt: item.endISO, spotsLeft: item.capacity - item.bookedCount }));
  }

  const duration = service.durationMin * MINUTE;
  const interval = policy.slotIntervalMin * MINUTE;
  const before = policy.bufferBeforeMin * MINUTE;
  const after = policy.bufferAfterMin * MINUTE;
  const busy = sessions
    .filter((item) => item.status !== "cancelled")
    .map((item) => [Date.parse(item.startISO), Date.parse(item.endISO)] as const);
  const blackouts = policy.blackouts.map((item) => [Date.parse(item.startsAt), Date.parse(item.endsAt)] as const);

  const slots: Slot[] = [];
  for (const day of days(startsOn, endsOn)) {
    const isoWeekday = new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
    for (const window of policy.weeklyHours.filter((item) => item.dayOfWeek === isoWeekday)) {
      const windowEnd = Date.parse(zonedWallToISO(day, window.endLocal, policy.timezone));
      for (
        let start = Date.parse(zonedWallToISO(day, window.startLocal, policy.timezone));
        start + duration <= windowEnd;
        start += interval
      ) {
        const end = start + duration;
        const blocked = [...blackouts, ...busy].some(([from, to]) => overlaps(start - before, end + after, from, to));
        if (start >= earliest && start <= latest && !blocked) {
          slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
        }
      }
    }
  }
  return slots;
}

/** The only payment methods the server accepts: free for £0 services, otherwise manual when enabled. */
export function paymentMethodFor(priceCents: number, manualPaymentEnabled: boolean): "free" | "manual" | null {
  if (priceCents === 0) return "free";
  return manualPaymentEnabled ? "manual" : null;
}

/** The status fields the server sets on a new public booking. */
export function bookingOutcome(
  service: Pick<Service, "confirmationPolicy">,
  paymentMethod: "free" | "manual",
  startAt: string,
  now: Date,
) {
  const approval = service.confirmationPolicy === "operator_approval" ? "pending" : "not_required";
  const paymentStatus = paymentMethod === "free" ? "free" : "pending";
  const pendingReasons: ("approval" | "payment")[] = [
    ...(approval === "pending" ? (["approval"] as const) : []),
    ...(paymentStatus === "pending" ? (["payment"] as const) : []),
  ];
  return {
    status: pendingReasons.length ? ("pending" as const) : ("confirmed" as const),
    paymentStatus: paymentStatus as "free" | "pending",
    approvalStatus: approval as "pending" | "not_required",
    pendingReasons,
    // Manual payment is due within 48 hours, or by the session start if that is sooner.
    paymentDueAt: paymentMethod === "manual"
      ? new Date(Math.min(now.getTime() + 2 * DAY, Date.parse(startAt))).toISOString()
      : null,
  };
}
