import bookingsJson from "@/data/mock/bookings.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Booking, BookingInput } from "@/types/booking";
import { NotFoundError, NotImplementedError } from "./_errors";

let mock: Booking[] = JSON.parse(JSON.stringify(bookingsJson)) as Booking[];

export async function listBookings(): Promise<Booking[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listBookings");
  await sleep(60);
  return [...mock];
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getBooking");
  await sleep(40);
  return mock.find((b) => b.id === id) ?? null;
}

export async function listBookingsByClient(clientId: string): Promise<Booking[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listBookingsByClient");
  await sleep(40);
  return mock.filter((b) => b.clientId === clientId);
}

export async function listBookingsBySession(sessionId: string): Promise<Booking[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listBookingsBySession");
  await sleep(40);
  return mock.filter((b) => b.sessionId === sessionId);
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  if (dataSource !== "mock") throw new NotImplementedError("createBooking");
  await sleep(120);
  const created: Booking = {
    ...input,
    id: makeId("bkg"),
    createdAtISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateBooking(
  id: string,
  patch: Partial<BookingInput>,
): Promise<Booking> {
  if (dataSource !== "mock") throw new NotImplementedError("updateBooking");
  await sleep(100);
  const idx = mock.findIndex((b) => b.id === id);
  if (idx === -1) throw new NotFoundError("booking", id);
  const next: Booking = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function cancelBooking(id: string): Promise<Booking> {
  return updateBooking(id, { status: "cancelled", paymentStatus: "refunded" });
}
