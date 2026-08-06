import type { BookingStatus, Currency, PaymentStatus } from "./common";

/** Per-attendee outcome recorded by the operator after a session runs. */
export type BookingAttendance = "present" | "late" | "absent";
export type BookingApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "declined";
export type BookingPendingReason = "approval" | "payment";

export type Booking = {
  id: string;
  sessionId: string;
  clientId: string;
  reference?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: "free" | "manual";
  confirmationPolicy?: "automatic" | "operator_approval";
  approvalStatus?: BookingApprovalStatus;
  pendingReasons?: BookingPendingReason[];
  amountCents: number;
  netAmountCents?: number;
  taxAmountCents?: number;
  taxTreatment?: "none" | "fixed";
  taxRateBps?: number;
  taxLabel?: string;
  taxJurisdiction?: string;
  sellerTaxNumber?: string;
  currency: Currency;
  paymentDueAtISO?: string;
  paymentReceivedAtISO?: string;
  approvedAtISO?: string;
  declinedAtISO?: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
  };
  providerTermsSnapshot?: string;
  platformTermsVersion?: string;
  termsAcceptedAtISO?: string;
  manualPaymentInstructionsSnapshot?: string;
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
