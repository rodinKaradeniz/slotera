import type {
  BookingStatus,
  ClientTag,
  LocationType,
  PaymentStatus,
  Tone,
} from "@/types/common";
import type { SubscriptionStatus } from "@/types/billing";
import type { PlatformInquiryType } from "@/types/platform";

type Meta<L extends string = string> = { tone: Tone; label: L; icon?: string };

export const BOOKING_STATUS: Record<BookingStatus, Meta> = {
  pending:   { tone: "warning", label: "Pending",   icon: "clock" },
  confirmed: { tone: "accent",  label: "Confirmed", icon: "check" },
  completed: { tone: "neutral", label: "Completed", icon: "check" },
  cancelled: { tone: "danger",  label: "Cancelled", icon: "x" },
  noshow:    { tone: "warning", label: "No-show",   icon: "alert" },
};

export const PAY_STATUS: Record<PaymentStatus, Meta> = {
  paid:     { tone: "accent",  label: "Paid",     icon: "check" },
  pending:  { tone: "warning", label: "Pending",  icon: "clock" },
  refunded: { tone: "neutral", label: "Refunded", icon: "refresh" },
  free:     { tone: "neutral", label: "Free",     icon: "sparkle" },
  overdue:  { tone: "danger",  label: "Overdue",  icon: "info" },
};

export const CLIENT_TAGS: Record<ClientTag, Meta> = {
  new:     { tone: "accent",  label: "New" },
  active:  { tone: "success", label: "Active" },
  dormant: { tone: "neutral", label: "Dormant" },
};

export const LOC_TYPE_META: Record<
  LocationType,
  { label: string; icon: string }
> = {
  online:   { label: "Online",   icon: "video" },
  physical: { label: "In person", icon: "map-pin" },
  hybrid:   { label: "Hybrid",   icon: "globe" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, Meta> = {
  trialing:         { tone: "info",    label: "Trialing",         icon: "sparkle" },
  active:           { tone: "accent",  label: "Active",           icon: "check" },
  past_due:         { tone: "danger",  label: "Past due",         icon: "alert" },
  cancel_scheduled: { tone: "warning", label: "Cancel scheduled", icon: "clock" },
  cancelled:        { tone: "neutral", label: "Cancelled",        icon: "x" },
};

export const INQUIRY_TYPE: Record<PlatformInquiryType, { label: string; tone: Tone }> = {
  business:    { label: "Business inquiry",   tone: "accent" },
  development: { label: "Development issue",  tone: "danger" },
  feature:     { label: "Feature request",    tone: "info" },
  general:     { label: "General request",    tone: "neutral" },
};

export const PLAN_LABEL: Record<"solo" | "team" | "custom", string> = {
  solo:   "Solo",
  team:   "Team",
  custom: "Custom",
};
