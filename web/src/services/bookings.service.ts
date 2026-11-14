import bookingsJson from "@/data/mock/bookings.json";
import { apiListAll, apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import { createClient, getClient, searchClients } from "./clients.service";
import { getSession, updateSession } from "./sessions.service";
import { getService } from "./services.service";
import type { ClientIdentity } from "@/lib/client-validation";
import type { Lang } from "@/lib/i18n";
import type { BookingEmailPage, BookingEmail, Booking, BookingAttendance, BookingInput } from "@/types/booking";
import { ApiRequestError, NotFoundError, NotImplementedError } from "./_errors";

type BookingDto = components["schemas"]["BookingResponse"];
type BookingListDto = components["schemas"]["BookingListResponse"];
type OperatorBookingCreateDto = components["schemas"]["OperatorBookingCreate"];
type BookingMoveDto = components["schemas"]["BookingMoveCommand"];

let mock: Booking[] = JSON.parse(JSON.stringify(bookingsJson)) as Booking[];

function mapBooking(booking: BookingDto): Booking {
  return {
    id: booking.id,
    sessionId: booking.sessionId,
    clientId: booking.clientId,
    reference: booking.reference,
    emailContact: booking.emailContact,
    language: booking.language,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    confirmationPolicy: booking.confirmationPolicy,
    approvalStatus: booking.approvalStatus,
    pendingReasons: booking.pendingReasons,
    attendance: booking.attendance ?? undefined,
    amountCents: booking.amountCents,
    netAmountCents: booking.netAmountCents,
    taxAmountCents: booking.taxAmountCents,
    taxTreatment: booking.taxTreatment,
    taxRateBps: booking.taxRateBps,
    taxLabel: booking.taxLabel ?? undefined,
    taxJurisdiction: booking.taxJurisdiction ?? undefined,
    sellerTaxNumber: booking.sellerTaxNumber ?? undefined,
    currency: booking.currency as Booking["currency"],
    paymentDueAtISO: booking.paymentDueAt ?? undefined,
    paymentReceivedAtISO: booking.paymentReceivedAt ?? undefined,
    approvedAtISO: booking.approvedAt ?? undefined,
    declinedAtISO: booking.declinedAt ?? undefined,
    customer: {
      firstName: booking.customer.firstName,
      lastName: booking.customer.lastName,
      email: booking.customer.email,
      phone: booking.customer.phone ?? undefined,
      company: booking.customer.company ?? undefined,
    },
    providerTermsSnapshot: booking.providerTermsSnapshot,
    platformTermsVersion: booking.platformTermsVersion,
    termsAcceptedAtISO: booking.termsAcceptedAt ?? undefined,
    manualPaymentInstructionsSnapshot:
      booking.manualPaymentInstructionsSnapshot,
    notes: booking.notes ?? undefined,
    createdAtISO: booking.createdAt,
  };
}

export async function listBookings(): Promise<Booking[]> {
  if (dataSource === "api") {
    return (await apiListAll<BookingListDto["items"][number]>("/bookings")).map(mapBooking);
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
  if (dataSource === "api") {
    const items = await apiListAll<BookingListDto["items"][number]>(
      `/bookings?clientId=${encodeURIComponent(clientId)}`,
    );
    return items.map(mapBooking);
  }
  await sleep(40);
  return mock.filter((b) => b.clientId === clientId);
}

export async function listBookingsBySession(sessionId: string): Promise<Booking[]> {
  if (dataSource === "api") {
    const items = await apiListAll<BookingListDto["items"][number]>(
      `/bookings?sessionId=${encodeURIComponent(sessionId)}`,
    );
    return items.map(mapBooking);
  }
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
  const occurrence = await getSession(created.sessionId);
  if (occurrence && ["pending", "confirmed"].includes(created.status)) {
    await updateSession(occurrence.id, { bookedCount: occurrence.bookedCount + 1 });
  }
  return created;
}

export type OperatorBookingInput = {
  sessionId: string; notes?: string; auditReason: string; sendEmail: boolean; language: Lang;
} & ({ clientId: string; newClient?: never } | { clientId?: never; newClient: ClientIdentity });
const mockCommands = new Map<string, { fingerprint: string; result: Promise<Booking> }>();
const mockEmails = new Map<string, BookingEmail[]>();
let mockCommandTail: Promise<void> = Promise.resolve();
function mockCommand(key: string, input: unknown, execute: () => Promise<Booking>): Promise<Booking> {
  const fingerprint = JSON.stringify(input);
  const previous = mockCommands.get(key);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return Promise.reject(new ApiRequestError(409, "idempotency_conflict", "This request changed. Reopen the dialog to submit a different request."));
    return previous.result;
  }
  const result = mockCommandTail.then(execute).catch((error) => { mockCommands.delete(key); throw error; });
  mockCommandTail = result.then(() => undefined, () => undefined);
  mockCommands.set(key, { fingerprint, result });
  return result;
}
function mockEmail(booking: Booking, kind: BookingEmail["kind"]): void {
  mockEmails.set(booking.id, [{ id: makeId("email"), kind, recipientEmail: booking.emailContact ?? "",
    status: "sent", createdAt: new Date().toISOString(), sentAt: new Date().toISOString(),
    availableAt: new Date().toISOString(), attemptCount: 1, simulated: true }, ...(mockEmails.get(booking.id) ?? [])]);
}
export async function createOperatorBooking(input: OperatorBookingInput, idempotencyKey: string): Promise<Booking> {
  if (dataSource === "api") return mapBooking(await apiRequest<BookingDto, OperatorBookingCreateDto>("/bookings", {
    method: "POST", body: { ...input, notes: input.notes?.trim() || null, auditReason: input.auditReason.trim() }, csrf: true, idempotencyKey,
  }));
  return mockCommand(idempotencyKey, input, async () => {
    const session = await getSession(input.sessionId);
    const service = session && await getService(session.serviceId);
    if (!session || !service || session.status !== "scheduled") throw new NotFoundError("session", input.sessionId);
    if (session.bookedCount >= session.capacity || mock.filter((b) => b.sessionId === session.id && ["pending", "confirmed"].includes(b.status)).length >= session.capacity)
      throw new ApiRequestError(409, "booking_capacity_exceeded", "This session is full.");
    if (input.newClient && (await searchClients(input.newClient.email)).some((c) => c.email.toLowerCase() === input.newClient!.email.trim().toLowerCase()))
      throw new ApiRequestError(409, "client_email_conflict", "This email already belongs to a client. Select that existing client.");
    const client = input.newClient ? await createClient({ ...input.newClient, email: input.newClient.email.trim().toLowerCase() }) : await getClient(input.clientId!);
    if (!client) throw new NotFoundError("client", input.clientId!);
    const free = service.priceCents === 0;
    const booking = await createBooking({ clientId: client.id, sessionId: session.id, status: free ? "confirmed" : "pending",
      paymentStatus: free ? "free" : "pending", paymentMethod: free ? "free" : "manual", approvalStatus: "approved",
      amountCents: service.priceCents, currency: service.currency, notes: input.notes, emailContact: client.email,
      language: input.language, customer: { firstName: client.name, lastName: "", email: client.email, phone: client.phone, company: client.company } });
    if (input.sendEmail) mockEmail(booking, free ? "booking_confirmed" : "booking_received");
    return booking;
  });
}
export async function listBookingEmails(id: string, offset = 0): Promise<BookingEmailPage> {
  if (dataSource === "api") {
    const page = await apiRequest<components["schemas"]["BookingEmailListResponse"]>(`/bookings/${encodeURIComponent(id)}/emails?limit=20&offset=${offset}`);
    return { ...page, items: page.items.map((item) => ({ ...item, kind: item.kind as BookingEmail["kind"] })) };
  }
  await sleep(60);
  const items = mockEmails.get(id) ?? [];
  return { items: items.slice(offset, offset + 20), total: items.length, limit: 20, offset };
}
export async function sendBookingDetails(id: string, recipientEmail: string, idempotencyKey: string): Promise<Booking> {
  if (dataSource === "api") return mapBooking(await apiRequest<BookingDto, components["schemas"]["BookingEmailSend"]>(`/bookings/${encodeURIComponent(id)}/send-details`, {
    method: "POST", body: { recipientEmail }, csrf: true, idempotencyKey,
  }));
  return mockCommand(idempotencyKey, { id, recipientEmail }, async () => {
    const booking = await updateBooking(id, { emailContact: recipientEmail.trim().toLowerCase() });
    mockEmail(booking, "booking_details");
    return booking;
  });
}

/**
 * API mode: move a pending or confirmed booking to another upcoming session of the same
 * service. The client receives the new time for either booking origin. Reuse one
 * `idempotencyKey` per dialog so a retried submit cannot move it twice.
 */
export async function moveBooking(
  id: string,
  input: { sessionId: string; auditReason: string },
  idempotencyKey: string,
): Promise<Booking> {
  if (dataSource !== "api") throw new NotImplementedError("moveBooking");
  return mapBooking(
    await apiRequest<BookingDto, BookingMoveDto>(`/bookings/${encodeURIComponent(id)}/move`, {
      method: "POST",
      body: { sessionId: input.sessionId, auditReason: input.auditReason.trim() },
      csrf: true,
      idempotencyKey,
    }),
  );
}

export async function updateBooking(
  id: string,
  patch: Partial<BookingInput>,
): Promise<Booking> {
  if (dataSource !== "mock") throw new NotImplementedError("updateBooking");
  await sleep(100);
  const idx = mock.findIndex((b) => b.id === id);
  if (idx === -1) throw new NotFoundError("booking", id);
  const previous = mock[idx];
  const next: Booking = { ...previous, ...patch };
  const held = (booking: Booking) => ["pending", "confirmed"].includes(booking.status);
  if (previous.sessionId !== next.sessionId || held(previous) !== held(next)) {
    for (const [sessionId, delta] of [[previous.sessionId, held(previous) ? -1 : 0], [next.sessionId, held(next) ? 1 : 0]] as const) {
      const occurrence = await getSession(sessionId);
      if (occurrence && delta) await updateSession(sessionId, { bookedCount: Math.max(0, occurrence.bookedCount + delta) });
    }
  }
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function cancelBooking(id: string): Promise<Booking> {
  if (dataSource === "api") return commandBooking(id, "cancel");
  return updateBooking(id, { status: "cancelled" });
}

async function commandBooking(
  id: string,
  command: "approve" | "decline" | "mark-payment-received" | "cancel" | "complete" | "noshow",
): Promise<Booking> {
  return mapBooking(
    await apiRequest<BookingDto>(
      `/bookings/${encodeURIComponent(id)}/${command}`,
      {
        method: "POST",
        csrf: true,
        idempotencyKey: crypto.randomUUID(),
      },
    ),
  );
}

export async function approveBooking(id: string): Promise<Booking> {
  if (dataSource !== "api") return updateBooking(id, { status: "confirmed" });
  return commandBooking(id, "approve");
}

export async function declineBooking(id: string): Promise<Booking> {
  if (dataSource !== "api") return cancelBooking(id);
  return commandBooking(id, "decline");
}

export async function markBookingPaymentReceived(id: string): Promise<Booking> {
  if (dataSource !== "api") {
    return updateBooking(id, { paymentStatus: "paid", status: "confirmed" });
  }
  return commandBooking(id, "mark-payment-received");
}

/** A confirmed 1:1 booking's outcome after the session: it happened, or the client didn't come. */
export async function completeBooking(id: string): Promise<Booking> {
  if (dataSource !== "api") return updateBooking(id, { status: "completed" });
  return commandBooking(id, "complete");
}

export async function markBookingNoShow(id: string): Promise<Booking> {
  if (dataSource !== "api") return updateBooking(id, { status: "noshow" });
  return commandBooking(id, "noshow");
}

/**
 * Record a post-session group attendance outcome. The backend completes the
 * booking atomically and rejects non-group or non-confirmed bookings.
 */
export async function setBookingAttendance(
  id: string,
  attendance: BookingAttendance,
): Promise<Booking> {
  if (dataSource === "api") {
    return mapBooking(
      await apiRequest<BookingDto, { attendance: BookingAttendance }>(
        `/bookings/${encodeURIComponent(id)}/attendance`,
        {
          method: "POST",
          body: { attendance },
          csrf: true,
          idempotencyKey: crypto.randomUUID(),
        },
      ),
    );
  }
  await sleep(80);
  const idx = mock.findIndex((b) => b.id === id);
  if (idx === -1) throw new NotFoundError("booking", id);
  const next: Booking = { ...mock[idx] };
  next.attendance = attendance;
  next.status = "completed";
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}
