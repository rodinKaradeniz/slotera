import type { ClientTag } from "./common";

export type Client = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  timezone?: string;
  address?: string;
  vatId?: string;
  tag: ClientTag;
  joinedISO: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpentCents: number;
  notes?: string;
};

export type ClientInput = Omit<Client, "id" | "joinedISO">;
