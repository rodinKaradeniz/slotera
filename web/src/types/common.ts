/** Client-payment currencies a workspace may use (mirrors the backend's allowed list). */
export const CURRENCIES = ["GBP", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type LocationType = "online" | "physical" | "hybrid";

export type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "ink";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "noshow";

export type PaymentStatus =
  | "paid"
  | "pending"
  | "refunded"
  | "free"
  | "overdue";

export type ClientTag = "new" | "active" | "dormant";
