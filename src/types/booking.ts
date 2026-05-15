import type { BookingStatus, Currency, PaymentStatus } from "./common";

export type Booking = {
  id: string;
  sessionId: string;
  clientId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  currency: Currency;
  notes?: string;
  createdAtISO: string;
};

export type BookingInput = Omit<Booking, "id" | "createdAtISO">;

export type BookingTimelineEvent = {
  whenISO: string;
  who: string;
  what: string;
  icon: string;
};
