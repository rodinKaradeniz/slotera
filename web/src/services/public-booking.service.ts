import { readLang, translate } from "@/lib/i18n";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { BookingDraft } from "@/components/booking/types";
import type { FormTemplate } from "@/types/form";
import type { Currency } from "@/types/common";
import type { Service } from "@/types/service";
import { readSession } from "@/lib/session";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { availableSlots, bookingOutcome, isPubliclyBookable, paymentMethodFor, quoteFor } from "@/lib/public-booking-rules";
import { NotFoundError } from "./_errors";
import { listServices } from "./services.service";
import { listSessions } from "./sessions.service";
import { listClients } from "./clients.service";
import { saveDemoBooking } from "@/lib/demo-bookings";
import type { Client } from "@/types/client";
import type { SessionItem } from "@/types/session";
import { getAvailabilitySettings, getPaymentSettings } from "./settings.service";
import { listFormsForService, saveFormResponse } from "./forms.service";

type WorkspaceDto = components["schemas"]["PublicWorkspaceResponse"];
type ServiceListDto = components["schemas"]["PublicServiceListResponse"];
type FormListDto = components["schemas"]["PublicFormListResponse"];
type AvailabilityDto = components["schemas"]["PublicAvailabilityResponse"];
type BookingCreateDto = components["schemas"]["PublicBookingCreate"];
type BookingResponseDto = components["schemas"]["PublicBookingResponse"];
export type PublicBookingResult = BookingResponseDto;
export type ManagedBooking = components["schemas"]["ManagedBookingResponse"];
type ManagedRescheduleDto = components["schemas"]["ManagedBookingReschedule"];

// The public booking flow is shared by many components and services, so the
// workspace being booked is held here rather than threaded through every call.
// `/book/[slug]` sets it before its children render; operator pages fall back
// to the signed-in workspace (e.g. when showing their own public profile).
let activePublicSlug: string | null = null;

export function setPublicWorkspaceSlug(slug: string | null): void {
  activePublicSlug = slug;
}

export function currentPublicWorkspaceSlug(): string | null {
  return activePublicSlug ?? readSession()?.operator.workspaceSlug ?? null;
}

function resolveSlug(): string {
  const slug = currentPublicWorkspaceSlug();
  if (!slug) throw new NotFoundError("Booking page", "(no workspace selected)");
  return slug;
}

function workspacePath(slug: string): string {
  return `/public/workspaces/${encodeURIComponent(slug)}`;
}

export async function getPublicBookingWorkspace(
  slug = resolveSlug(),
): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>(workspacePath(slug));
}

export async function listPublicBookingServices(
  slug?: string,
): Promise<Service[]> {
  if (dataSource === "mock") {
    // The demo applies the server's catalogue rules: every active, publicly bookable
    // service in creation order, priced with the same gross-inclusive quote.
    const tax = await getPaymentSettings();
    return (await listServices())
      .filter(isPubliclyBookable)
      .map((service) => ({ ...service, publicQuote: quoteFor(service.priceCents, tax) }));
  }
  const response = await apiRequest<ServiceListDto>(`${workspacePath(slug ?? resolveSlug())}/services`);
  return response.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    durationMin: item.durationMin,
    priceCents: item.quote.grossAmountCents,
    currency: item.quote.currency as Currency,
    capacity: item.capacity,
    locationType: item.locationType,
    location: item.location,
    bookingMode: item.bookingMode,
    confirmationPolicy: item.confirmationPolicy,
    cancellationRule: item.cancellationRule,
    active: true,
    createdAtISO: "",
    publicQuote: {
      treatment: item.quote.treatment,
      rateBps: item.quote.rateBps,
      label: item.quote.label ?? undefined,
      jurisdiction: item.quote.jurisdiction ?? undefined,
      grossAmountCents: item.quote.grossAmountCents,
      netAmountCents: item.quote.netAmountCents,
      taxAmountCents: item.quote.taxAmountCents,
    },
  }));
}

export async function listPublicServiceForms(
  serviceId: string,
  slug = resolveSlug(),
): Promise<FormTemplate[]> {
  const response = await apiRequest<FormListDto>(
    `${workspacePath(slug)}/services/${encodeURIComponent(serviceId)}/forms`,
  );
  return response.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    status: "active",
    fields: item.fields.map((field) => ({
      ...field,
      placeholder: field.placeholder ?? undefined,
      helpText: field.helpText ?? undefined,
      options: field.options ?? undefined,
    })),
    attachedServiceIds: [serviceId],
    requiredBeforePayment: item.requiredBeforePayment,
    createdAtISO: "",
  }));
}

export type PublicAvailability = {
  timezone: string;
  /** `spotsLeft` is set for scheduled (group) sessions only. */
  items: { startAt: string; endAt: string; spotsLeft?: number | null }[];
};

export async function listPublicAvailability(
  serviceId: string,
  startsOn: string,
  endsOn: string,
  slug?: string,
): Promise<PublicAvailability> {
  if (dataSource === "mock") {
    const service = (await listPublicBookingServices()).find((item) => item.id === serviceId);
    const policy = await getAvailabilitySettings();
    if (!service) throw new NotFoundError("Service", serviceId);
    return {
      timezone: policy.timezone,
      items: availableSlots(service, policy, await listSessions(), startsOn, endsOn, new Date()),
    };
  }
  const query = new URLSearchParams({ from: startsOn, to: endsOn });
  return apiRequest<AvailabilityDto>(
    `${workspacePath(slug ?? resolveSlug())}/services/${encodeURIComponent(serviceId)}/availability?${query}`,
  );
}

export async function createPublicBooking(
  draft: BookingDraft,
  slug?: string,
): Promise<PublicBookingResult> {
  if (!draft.service || !draft.startAt) {
    throw new Error(translate(readLang(), "errors.slot"));
  }
  if (dataSource === "mock") return createDemoBooking(draft, draft.service, draft.startAt);
  slug ??= resolveSlug();
  const requiredForms = new Set((await listPublicServiceForms(draft.service.id, slug))
    .filter((form) => form.requiredBeforePayment).map((form) => form.id));
  const body: BookingCreateDto = {
    language: readLang(),
    serviceId: draft.service.id,
    startAt: draft.startAt,
    customer: {
      firstName: draft.customer.firstName,
      lastName: draft.customer.lastName,
      email: draft.customer.email,
      phone: draft.customer.phone || null,
      company: draft.customer.company || null,
      notes: draft.customer.notes || null,
    },
    // Free and package bookings skip the billing step; only a payment needs an address.
    billingAddress: draft.service.priceCents === 0 || draft.packagePurchaseId ? null : {
      street: draft.billing.street,
      street2: draft.billing.address2 || null,
      city: draft.billing.city,
      region: draft.billing.state || null,
      postalCode: draft.billing.zip,
      country: draft.billing.country,
    },
    paymentMethod: draft.packagePurchaseId ? "package" : draft.service.priceCents === 0 ? "free" : "manual",
    packagePurchaseId: draft.packagePurchaseId || null,
    formResponses: Object.entries(draft.formResponses).filter(([id]) => requiredForms.has(id)).map(
      ([formTemplateId, answers]) => ({
        formTemplateId,
        answers: answers.map((answer) => ({
          fieldId: answer.fieldId,
          value: answer.value,
        })),
      }),
    ),
    termsAccepted: true,
  };
  const idempotencyKey = crypto.randomUUID();
  return apiRequest<BookingResponseDto, BookingCreateDto>(
    `${workspacePath(slug)}/bookings`,
    // A package booking is the signed-in client's: their session cookie and CSRF token go along.
    draft.packagePurchaseId
      ? { method: "POST", body, idempotencyKey, authKind: "client", csrf: true }
      : { method: "POST", body, idempotencyKey },
  );
}

/** The demo's booking command: the server's slot, payment and status rules, nothing stored. */
async function createDemoBooking(draft: BookingDraft, chosen: Service, startAt: string): Promise<PublicBookingResult> {
  const now = new Date();
  const service = (await listPublicBookingServices()).find((item) => item.id === chosen.id);
  const payments = await getPaymentSettings();
  const day = startAt.slice(0, 10);
  const slot = service && (await listPublicAvailability(service.id, day, day)).items
    .find((item) => Date.parse(item.startAt) === Date.parse(startAt));
  if (!service || !slot) throw new Error(translate(readLang(), "errors.slot"));
  const paymentMethod = paymentMethodFor(service.priceCents, payments.manualPaymentEnabled);
  if (!paymentMethod) throw new Error(translate(readLang(), "booking.payment.unavailable"));
  await sleep(600);
  const reference = `SLT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const required = (await listFormsForService(service.id)).filter((form) => form.requiredBeforePayment);
  await Promise.all(required.map((form) => saveFormResponse({
    bookingId: reference,
    formTemplateId: form.id,
    answers: draft.formResponses[form.id] ?? [],
  })));
  const outcome = bookingOutcome(service, paymentMethod, slot.startAt, now);
  const quote = service.publicQuote ?? quoteFor(service.priceCents, payments);
  const id = crypto.randomUUID();
  await recordDemoBooking(draft, service, slot, { id, reference, paymentMethod, outcome, quote, now });
  return {
    id,
    reference,
    ...outcome,
    paymentMethod,
    confirmationPolicy: service.confirmationPolicy,
    sessionStartAt: slot.startAt,
    sessionEndAt: slot.endAt,
    sessionLocationType: service.locationType,
    sessionLocation: service.location,
    sessionAddress: service.locationType === "online" || !service.address ? null : {
      ...service.address,
      street2: service.address.street2 ?? null,
      region: service.address.region ?? null,
      notes: null,
    },
    // As on the server: the meeting link only once the booking is confirmed.
    meetingUrl: outcome.status === "confirmed" ? service.meetingUrl ?? null : null,
    quote: {
      currency: service.currency,
      grossAmountCents: quote.grossAmountCents,
      netAmountCents: quote.netAmountCents,
      taxAmountCents: quote.taxAmountCents,
      rateBps: quote.rateBps,
      label: quote.label ?? null,
      jurisdiction: quote.jurisdiction ?? null,
      treatment: quote.treatment,
    },
  };
}

/** Keeps the demo booking so the demo admin (in its own tab) lists it too; see `lib/demo-bookings`. */
async function recordDemoBooking(
  draft: BookingDraft,
  service: Service,
  slot: { startAt: string; endAt: string },
  made: {
    id: string;
    reference: string;
    paymentMethod: "free" | "manual";
    outcome: ReturnType<typeof bookingOutcome>;
    quote: { grossAmountCents: number; netAmountCents: number; taxAmountCents: number; rateBps?: number | null; label?: string | null; treatment: "none" | "fixed" };
    now: Date;
  },
): Promise<void> {
  const nowISO = made.now.toISOString();
  const { customer } = draft;
  const name = `${customer.firstName} ${customer.lastName}`.trim();
  const existingClient = (await listClients()).find((item) => item.email.toLowerCase() === customer.email.trim().toLowerCase());
  const client: Client | null = existingClient ? null : {
    version: 1,
    id: `cli-demo-${made.id}`,
    name,
    email: customer.email.trim(),
    phone: customer.phone || undefined,
    company: customer.company || undefined,
    tag: "new",
    joinedISO: nowISO,
    totalBookings: 1,
    completedBookings: 0,
    cancelledBookings: 0,
    totalSpentCents: 0,
  };
  const existingSession = service.bookingMode === "scheduled"
    ? (await listSessions()).find((item) => item.serviceId === service.id && Date.parse(item.startISO) === Date.parse(slot.startAt))
    : undefined;
  const session: SessionItem | null = existingSession ? null : {
    version: 1,
    id: `ses-demo-${made.id}`,
    serviceId: service.id,
    startISO: slot.startAt,
    endISO: slot.endAt,
    capacity: 1,
    bookedCount: 1,
    status: "scheduled",
    locationType: service.locationType,
    location: service.location,
    address: service.locationType === "online" ? undefined : service.address,
    recurring: "one-off",
  };
  saveDemoBooking({
    client,
    session,
    booking: {
      id: made.id,
      reference: made.reference,
      sessionId: existingSession?.id ?? session!.id,
      clientId: existingClient?.id ?? client!.id,
      emailContact: customer.email.trim(),
      language: readLang(),
      status: made.outcome.status,
      paymentStatus: made.outcome.paymentStatus,
      paymentMethod: made.paymentMethod,
      confirmationPolicy: service.confirmationPolicy,
      approvalStatus: made.outcome.approvalStatus,
      pendingReasons: made.outcome.pendingReasons,
      amountCents: made.quote.grossAmountCents,
      netAmountCents: made.quote.netAmountCents,
      taxAmountCents: made.quote.taxAmountCents,
      taxTreatment: made.quote.treatment,
      taxRateBps: made.quote.rateBps ?? undefined,
      taxLabel: made.quote.label ?? undefined,
      currency: service.currency,
      paymentDueAtISO: made.outcome.paymentDueAt ?? undefined,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email.trim(),
        phone: customer.phone || undefined,
        company: customer.company || undefined,
      },
      termsAcceptedAtISO: nowISO,
      notes: customer.notes || undefined,
      createdAtISO: nowISO,
    },
  });
}

// ── Customer booking link (API mode) ────────────────────────────────────────
// The token comes from the emailed link's URL fragment and is only ever sent as a
// header, never in a URL.

function linkHeaders(token: string): Record<string, string> {
  return { "X-Booking-Token": token };
}

export async function getManagedBooking(token: string): Promise<ManagedBooking> {
  return apiRequest<ManagedBooking>("/public/bookings/manage", { headers: linkHeaders(token) });
}

export async function cancelManagedBooking(token: string): Promise<ManagedBooking> {
  return apiRequest<ManagedBooking>("/public/bookings/manage/cancel", {
    method: "POST",
    headers: linkHeaders(token),
  });
}

export async function rescheduleManagedBooking(
  token: string,
  startAt: string,
): Promise<ManagedBooking> {
  return apiRequest<ManagedBooking, ManagedRescheduleDto>("/public/bookings/manage/reschedule", {
    method: "POST",
    body: { startAt },
    headers: linkHeaders(token),
  });
}
