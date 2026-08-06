import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { BookingDraft } from "@/components/booking/types";
import type { FormTemplate } from "@/types/form";
import type { Currency } from "@/types/common";
import type { Service } from "@/types/service";

type WorkspaceDto = components["schemas"]["PublicWorkspaceResponse"];
type ServiceListDto = components["schemas"]["PublicServiceListResponse"];
type FormListDto = components["schemas"]["PublicFormListResponse"];
type AvailabilityDto = components["schemas"]["PublicAvailabilityResponse"];
type BookingCreateDto = components["schemas"]["PublicBookingCreate"];
type BookingResponseDto = components["schemas"]["PublicBookingResponse"];
export type PublicBookingResult = BookingResponseDto;

export const LOCAL_PUBLIC_WORKSPACE_SLUG = "lena";

function workspacePath(slug: string): string {
  return `/public/workspaces/${encodeURIComponent(slug)}`;
}

export async function getPublicBookingWorkspace(
  slug = LOCAL_PUBLIC_WORKSPACE_SLUG,
): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>(workspacePath(slug));
}

export async function listPublicBookingServices(
  slug = LOCAL_PUBLIC_WORKSPACE_SLUG,
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
    bookingMode: "open",
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
  slug = LOCAL_PUBLIC_WORKSPACE_SLUG,
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
  items: { startAt: string; endAt: string }[];
};

export async function listPublicAvailability(
  serviceId: string,
  startsOn: string,
  endsOn: string,
  slug = LOCAL_PUBLIC_WORKSPACE_SLUG,
): Promise<PublicAvailability> {
  const query = new URLSearchParams({ from: startsOn, to: endsOn });
  return apiRequest<AvailabilityDto>(
    `${workspacePath(slug)}/services/${encodeURIComponent(serviceId)}/availability?${query}`,
  );
}

export async function createPublicBooking(
  draft: BookingDraft,
  slug = LOCAL_PUBLIC_WORKSPACE_SLUG,
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
