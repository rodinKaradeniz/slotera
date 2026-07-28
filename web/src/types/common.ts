export type Currency = "EUR" | "USD" | "GBP";
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
