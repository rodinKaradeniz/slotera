import type { Address } from "./address";
import type { LocationType } from "./common";

export type SessionStatus = "scheduled" | "live" | "done" | "cancelled";
export type Recurring = "one-off" | "weekly" | "custom";

export type SessionItem = {
  id: string;
  serviceId: string;
  startISO: string;
  endISO: string;
  capacity: number;
  bookedCount: number;
  status: SessionStatus;
  locationType: LocationType;
  /** Display label or meeting modality, e.g. "Zoom" or "Mitte Studio". */
  location: string;
  /**
   * Structured address for the session. Only meaningful when `locationType`
   * is `"physical"` or `"hybrid"`. Either populated from a saved workspace
   * location or typed inline per session.
   */
  address?: Address;
  recurring: Recurring;
  notes?: string;
};

export type SessionInput = Omit<SessionItem, "id">;
