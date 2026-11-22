import type { SessionItem } from "./session";
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
  context?: {clientName: string; clientEmail: string; serviceName: string; session: SessionItem;
    /** Set when a package session covers the booking. */
    packageName?: string; packageSize?: number};
  id: string;
  sessionId: string;
  clientId: string;
  reference?: string;
  emailContact?: string;
  language?: "en" | "tr" | "de";
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** "package": a session of a package the client bought covers it (amount 0). */
  paymentMethod?: "free" | "manual" | "package";
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
  /** Money given back outside Slotera; a full refund makes the payment "refunded". */
  refundedCents?: number;
  refundedAtISO?: string;
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
  packagePurchaseId?: string;
  /** Zero-based position of the package session this booking holds. */
  packagePosition?: number;
  createdAtISO: string;
};

export type BookingInput = Omit<Booking, "id" | "createdAtISO">;

export type BookingTimelineEvent = {
  whenISO: string;
  who: string;
  what: string;
  icon: string;
};

export type BookingEmailKind = "booking_received" | "booking_confirmed" | "booking_cancelled" | "booking_rescheduled" | "booking_reminder" | "booking_details";
export type BookingEmailStatus = "queued" | "sending" | "retrying" | "failed" | "sent" | "superseded";
export type BookingEmail = {
  id: string; kind: BookingEmailKind; recipientEmail: string; status: BookingEmailStatus;
  createdAt: string; sentAt: string | null; availableAt: string; attemptCount: number; simulated: boolean;
};
export type BookingEmailPage = { items: BookingEmail[]; total: number; limit: number; offset: number };


export type BookingSummaryItem = {
  attendance?: BookingAttendance | null;
  id: string; clientId: string; sessionId: string; serviceId: string; reference: string;
  clientName: string; clientCompany: string | null; serviceName: string; startAt: string;
  status: BookingStatus; paymentStatus: PaymentStatus; amountCents: number;
  currency: Currency; coveredByPackage?: boolean; createdAt: string;
};
export type BookingSummaryPage = {
  items: BookingSummaryItem[]; total: number; limit: number; offset: number;
  statusCounts: Record<string, number>;
  statusPreviews: Record<string, BookingSummaryItem[]>;
  pendingPaymentCount: number;
};
