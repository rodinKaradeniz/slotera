/**
 * Owner of the demo's localStorage records: bookings (`slotera.demoBookings`) and package
 * requests (`slotera.demoPackagePurchases`) a visitor makes on the demo booking page, so they
 * show up in the demo admin (bookings, calendar, clients, dashboard, a client's packages).
 * The admin opens the booking page in a new tab, so in-memory mock state can't carry them;
 * localStorage is shared between tabs and fires `storage` in the other one. Nothing leaves
 * the browser. Storage failures fall back to "no demo records".
 */
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { PackagePurchase } from "@/types/package-purchase";
import type { SessionItem } from "@/types/session";
import { DATA_CHANGED } from "@/api/query-cache";

const MAX = 20;

export type DemoBookingRecord = {
  booking: Booking;
  /** Set when the visitor is new; an existing client is matched by email instead. */
  client: Client | null;
  /** Set for open-mode services, where the booking creates its own session. */
  session: SessionItem | null;
};

export type DemoPurchaseRecord = {
  purchase: Pick<PackagePurchase, "id" | "clientId" | "packageId" | "createdAtISO">;
  /** Set when the visitor is new, as for a booking. */
  client: Client | null;
};

function demoStore<T>(key: string, valid: (item: T) => boolean) {
  const listeners = new Set<(records: T[]) => void>();
  const read = (): T[] => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as T[]).filter(valid) : [];
    } catch {
      return [];
    }
  };
  const notify = () => {
    const records = read();
    listeners.forEach((merge) => merge(records));
    window.dispatchEvent(new Event(DATA_CHANGED));
  };
  return {
    read,
    /** Stores call this once at load; it runs now and again whenever any tab adds a record. */
    sync(merge: (records: T[]) => void): void {
      if (typeof window === "undefined") return;
      merge(read());
      listeners.add(merge);
      if (listeners.size === 1) {
        window.addEventListener("storage", (event) => {
          if (event.key === key) notify();
        });
      }
    },
    save(record: T): void {
      try {
        window.localStorage.setItem(key, JSON.stringify([record, ...read()].slice(0, MAX)));
      } catch {
        return;
      }
      notify();
    },
  };
}

const bookings = demoStore<DemoBookingRecord>("slotera.demoBookings", (item) => !!item?.booking?.id);
export const readDemoBookings = bookings.read;
export const syncDemoBookings = bookings.sync;
export const saveDemoBooking = bookings.save;

const purchases = demoStore<DemoPurchaseRecord>("slotera.demoPackagePurchases", (item) => !!item?.purchase?.id);
export const syncDemoPurchases = purchases.sync;
export const saveDemoPurchase = purchases.save;
