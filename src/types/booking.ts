import type { BookingStatus, Currency, PaymentStatus } from "./common";

/** Per-attendee outcome recorded by the operator after a session runs. */
export type BookingAttendance = "present" | "late" | "absent";

export type Booking = {
  id: string;
  sessionId: string;
  clientId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  currency: Currency;
  notes?: string;
  /** Only set once the session has run and the operator marks attendance. */
  attendance?: BookingAttendance;
  createdAtISO: string;
};

export type BookingInput = Omit<Booking, "id" | "createdAtISO">;

export type BookingTimelineEvent = {
  whenISO: string;
  who: string;
  what: string;
  icon: string;
};
