import type { Currency, LocationType } from "./common";

/**
 * Whether the service is bookable on demand (operator publishes working hours and
 * the booking page generates slots — 1:1 calls, drop-in classes) or only at
 * specific pre-created sessions (workshops, courses, fixed-date events).
 *
 * This is a booking *mechanic*, not a category — do not branch UI on it the way
 * you would on a "yoga vs consulting" service type. See CLAUDE.md.
 */
export type ServiceBookingMode = "open" | "scheduled";

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  currency: Currency;
  capacity: number;
  locationType: LocationType;
  location: string;
  bookingMode: ServiceBookingMode;
  cancellationRule: string;
  active: boolean;
  createdAtISO: string;
  /** Internal-only prep/operator notes. Not shown to clients on the booking page. */
  notes?: string;
};

export type ServiceInput = Omit<Service, "id" | "createdAtISO">;
