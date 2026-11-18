/**
 * Owner of the `slotera.demoBookings` localStorage key: bookings a visitor makes on the demo
 * booking page, so they show up in the demo admin (bookings, calendar, clients, dashboard).
 * The admin opens the booking page in a new tab, so in-memory mock state can't carry them;
 * localStorage is shared between tabs and fires `storage` in the other one. Nothing leaves
 * the browser. Storage failures fall back to "no demo bookings".
 */
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { SessionItem } from "@/types/session";
import { DATA_CHANGED } from "@/api/query-cache";

const KEY = "slotera.demoBookings";
const MAX = 20;

export type DemoBookingRecord = {
  booking: Booking;
  /** Set when the visitor is new; an existing client is matched by email instead. */
  client: Client | null;
  /** Set for open-mode services, where the booking creates its own session. */
  session: SessionItem | null;
};

export function readDemoBookings(): DemoBookingRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DemoBookingRecord[]).filter((item) => item?.booking?.id) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(records: DemoBookingRecord[]) => void>();

/** Stores call this once at load; it runs now and again whenever any tab adds a booking. */
export function syncDemoBookings(merge: (records: DemoBookingRecord[]) => void): void {
  if (typeof window === "undefined") return;
  merge(readDemoBookings());
  listeners.add(merge);
  if (listeners.size === 1) {
    window.addEventListener("storage", (event) => {
      if (event.key === KEY) notify();
    });
  }
}

function notify(): void {
  const records = readDemoBookings();
  listeners.forEach((merge) => merge(records));
  window.dispatchEvent(new Event(DATA_CHANGED));
}

export function saveDemoBooking(record: DemoBookingRecord): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([record, ...readDemoBookings()].slice(0, MAX)));
  } catch {
    return;
  }
  notify();
}
