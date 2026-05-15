import type {
  BookingStatus,
  ClientTag,
  LocationType,
  PaymentStatus,
  ServiceKind,
  Tone,
} from "@/types/common";

type Meta<L extends string = string> = { tone: Tone; label: L; icon?: string };

export const BOOKING_STATUS: Record<BookingStatus, Meta> = {
  pending:   { tone: "warning", label: "Pending",   icon: "clock" },
  confirmed: { tone: "accent",  label: "Confirmed", icon: "check" },
  completed: { tone: "neutral", label: "Completed", icon: "check" },
  cancelled: { tone: "danger",  label: "Cancelled", icon: "x" },
  noshow:    { tone: "danger",  label: "No-show",   icon: "x" },
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

export const SERVICE_STYLE: Record<
  ServiceKind,
  { label: string; bg: string; fg: string }
> = {
  discovery: { label: "Discovery", bg: "#E7EDE3", fg: "#2A3F2A" },
  deepdive:  { label: "Deep Dive", bg: "#ECE8E0", fg: "#3B3B33" },
  sprint:    { label: "Sprint",    bg: "#F4E9D6", fg: "#B47B2B" },
  yoga:      { label: "Yoga",      bg: "#E1E7EE", fg: "#3F5670" },
  workshop:  { label: "Workshop",  bg: "#F2DDD8", fg: "#A33B2A" },
};

export const LOC_TYPE_META: Record<
  LocationType,
  { label: string; icon: string }
> = {
  online:   { label: "Online",   icon: "video" },
  physical: { label: "In person", icon: "map-pin" },
  hybrid:   { label: "Hybrid",   icon: "globe" },
};
