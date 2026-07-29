import bookingsJson from "@/data/mock/bookings.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Booking, BookingAttendance, BookingInput } from "@/types/booking";
import { ApiRequestError, NotFoundError, NotImplementedError } from "./_errors";

type BookingDto = components["schemas"]["BookingResponse"];
type BookingListDto = components["schemas"]["BookingListResponse"];

let mock: Booking[] = JSON.parse(JSON.stringify(bookingsJson)) as Booking[];

function mapBooking(booking: BookingDto): Booking {
  return {
    id: booking.id,
    sessionId: booking.sessionId,
    clientId: booking.clientId,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    amountCents: booking.amountCents,
    currency: booking.currency as Booking["currency"],
    notes: booking.notes ?? undefined,
    createdAtISO: booking.createdAt,
  };
}

export async function listBookings(): Promise<Booking[]> {
  if (dataSource === "api") {
    const response = await apiRequest<BookingListDto>("/bookings?limit=200");
    return response.items.map(mapBooking);
  }
  await sleep(60);
  return [...mock];
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (dataSource === "api") {
    try {
      return mapBooking(await apiRequest<BookingDto>(`/bookings/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }
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

/**
 * Record per-attendee attendance for a single booking. Pass `null` to clear
 * (the field is optional on `Booking`, so a clear is meaningful — used by
 * "undo" actions).
 */
export async function setBookingAttendance(
  id: string,
  attendance: BookingAttendance | null,
): Promise<Booking> {
  if (dataSource !== "mock")
    throw new NotImplementedError("setBookingAttendance");
  await sleep(80);
  const idx = mock.findIndex((b) => b.id === id);
  if (idx === -1) throw new NotFoundError("booking", id);
  const next: Booking = { ...mock[idx] };
  if (attendance === null) delete next.attendance;
  else next.attendance = attendance;
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}
