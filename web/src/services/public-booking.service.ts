import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { BookingDraft } from "@/components/booking/types";
import type { FormTemplate } from "@/types/form";
import type { Currency } from "@/types/common";
import type { Service } from "@/types/service";
import { readSession } from "@/lib/session";
import { NotFoundError } from "./_errors";

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
  slug = resolveSlug(),
): Promise<Service[]> {
  const response = await apiRequest<ServiceListDto>(`${workspacePath(slug)}/services`);
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
  slug = resolveSlug(),
): Promise<PublicAvailability> {
  const query = new URLSearchParams({ from: startsOn, to: endsOn });
  return apiRequest<AvailabilityDto>(
    `${workspacePath(slug)}/services/${encodeURIComponent(serviceId)}/availability?${query}`,
  );
}

export async function createPublicBooking(
  draft: BookingDraft,
  slug = resolveSlug(),
): Promise<PublicBookingResult> {
  if (!draft.service || !draft.startAt) {
    throw new Error("Choose an available booking time.");
  }
  const body: BookingCreateDto = {
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
    billingAddress: {
      street: draft.billing.street,
      street2: draft.billing.address2 || null,
      city: draft.billing.city,
      region: draft.billing.state || null,
      postalCode: draft.billing.zip,
      country: draft.billing.country,
    },
    paymentMethod: draft.service.priceCents === 0 ? "free" : "manual",
    formResponses: Object.entries(draft.formResponses).map(
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
    { method: "POST", body, idempotencyKey },
  );
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
