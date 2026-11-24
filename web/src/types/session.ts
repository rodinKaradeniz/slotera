import type { Address } from "./address";
import type { LocationType } from "./common";

export type SessionStatus = "scheduled" | "live" | "done" | "cancelled";
export type Recurring = "one-off" | "weekly" | "custom";

export type SessionItem = {
  version?: number;
  seriesVersion?: number;
  seriesId?: string;
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

/** A custom repeat rule: every `intervalWeeks` weeks on these ISO weekdays (1 = Monday). */
export type CustomRecurrence = { intervalWeeks: number; weekdays: number[] };

export type SessionInput = Omit<SessionItem, "id"> & { custom?: CustomRecurrence };
