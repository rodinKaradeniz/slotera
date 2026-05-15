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
  location: string;
  recurring: Recurring;
  notes?: string;
};

export type SessionInput = Omit<SessionItem, "id">;
