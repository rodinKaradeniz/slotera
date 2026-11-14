import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";
import { verifiedMetadata, updateVerifiedMetadata, queryClient } from "@/api/query-cache";

import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { clearSession } from "@/lib/session";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Address, WorkspaceLocation } from "@/types/address";
import type { SettingsData, WorkingDay } from "@/types/settings";
import type { Currency } from "@/types/common";
import { NotFoundError, NotImplementedError } from "./_errors";
import { apiCurrency } from "./_currency";
import { getPublicBookingWorkspace } from "./public-booking.service";

type AddressDto = components["schemas"]["Address"];
type BusinessResponseDto = components["schemas"]["BusinessSettingsResponse"];
type BusinessPatchDto = components["schemas"]["BusinessSettingsPatch"];
type LocationResponseDto = components["schemas"]["WorkspaceLocationResponse"];
type LocationCreateDto = components["schemas"]["WorkspaceLocationCreate"];
type LocationPatchDto = components["schemas"]["WorkspaceLocationPatch"];
type LocationListDto = components["schemas"]["WorkspaceLocationListResponse"];
type AvailabilityResponseDto = components["schemas"]["AvailabilityResponse"];
type AvailabilityUpdateDto = components["schemas"]["AvailabilityUpdate"];
type PaymentResponseDto = components["schemas"]["PaymentSettingsResponse"];
type PaymentPatchDto = components["schemas"]["PaymentSettingsPatch"];

export type PaymentSettings = {
  version?: number;
  manualPaymentEnabled: boolean;
  manualPaymentInstructions: string;
  bookingTermsEnabled: boolean;
  bookingTermsContent: string;
  taxTreatment: "none" | "fixed";
  taxRateBps: number;
  taxLabel: string;
  taxJurisdiction: string;
  sellerTaxNumber: string;
};

export type AvailabilityWindow = {
  dayOfWeek: number;
  startLocal: string;
  endLocal: string;
};

export type AvailabilitySettings = {
  version?: number;
  timezone: string;
  weeklyHours: AvailabilityWindow[];
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minimumNoticeMin: number;
  maximumAdvanceDays: number;
  /** Clients can cancel/reschedule from their booking link until this many hours before. */
  customerChangeNoticeHours: number;
  blackouts: {
    id?: string;
    startsAt: string;
    endsAt: string;
    reason?: string;
  }[];
};

export type BusinessSettings = SettingsData["business"];

let mock: SettingsData;
if (dataSource === "mock") {
  mock = mockData<SettingsData>("settings");

mock.business.locations = mock.business.locations.map((item) => ({...item, version: item.version ?? 1}));
}

function mapAddress(address: AddressDto): Address {
  return {
    street: address.street,
    street2: address.street2 ?? undefined,
    city: address.city,
    region: address.region ?? undefined,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes ?? undefined,
  };
}

function toAddressDto(address: Address): AddressDto {
  return {
    street: address.street,
    street2: address.street2 || null,
    city: address.city,
    region: address.region || null,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes || null,
  };
}

function mapLocation(location: LocationResponseDto): WorkspaceLocation {
  return {
    version: location.version,
    id: location.id,
    label: location.label,
    address: mapAddress(location.address),
  };
}

function mapBusiness(
  business: BusinessResponseDto,
  locations: WorkspaceLocation[],
): BusinessSettings {
  return {
    version: business.version,
    name: business.name,
    displayName: business.displayName,
    bio: business.bio,
    email: business.email,
    phone: business.phone,
    address: business.address,
    bookingPageUrl: business.slug,
    bookingPageEnabled: business.bookingPageEnabled,
    notifyOperator: {
      newBooking: business.notifyOperatorNew,
      cancelled: business.notifyOperatorCancelled,
      rescheduled: business.notifyOperatorRescheduled,
    },
    locations,
    onboardingCompletedAt: business.onboardingCompletedAt,
  };
}

function mapAvailability(availability: AvailabilityResponseDto): AvailabilitySettings {
  return {
    version: availability.version,
    timezone: availability.timezone,
    weeklyHours: availability.weeklyHours.map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startLocal: window.startLocal,
      endLocal: window.endLocal,
    })),
    slotIntervalMin: availability.slotIntervalMin,
    bufferBeforeMin: availability.bufferBeforeMin,
    bufferAfterMin: availability.bufferAfterMin,
    minimumNoticeMin: availability.minimumNoticeMin,
    maximumAdvanceDays: availability.maximumAdvanceDays,
    customerChangeNoticeHours: availability.customerChangeNoticeHours,
    blackouts: availability.blackouts.map((blackout) => ({
      id: blackout.id,
      startsAt: blackout.startsAt,
      endsAt: blackout.endsAt,
      reason: blackout.reason ?? undefined,
    })),
  };
}

function availabilityPayload(input: AvailabilitySettings): AvailabilityUpdateDto {
  return {
    timezone: input.timezone,
    weeklyHours: input.weeklyHours.map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startLocal: window.startLocal,
      endLocal: window.endLocal,
    })),
    slotIntervalMin: input.slotIntervalMin,
    bufferBeforeMin: input.bufferBeforeMin,
    bufferAfterMin: input.bufferAfterMin,
    minimumNoticeMin: input.minimumNoticeMin,
    maximumAdvanceDays: input.maximumAdvanceDays,
    customerChangeNoticeHours: input.customerChangeNoticeHours,
    blackouts: input.blackouts.map((blackout) => ({
      startsAt: blackout.startsAt,
      endsAt: blackout.endsAt,
      reason: blackout.reason ?? null,
    })),
  };
}

function mockAvailability(): AvailabilitySettings {
  return {
    timezone: "Europe/Berlin",
    weeklyHours: mock.calendar.workingHours
      .map((day, index) => ({
        dayOfWeek: index + 1,
        startLocal: day.start,
        endLocal: day.end,
        enabled: day.enabled,
      }))
      .filter((window) => window.enabled)
      .map(({ enabled: _enabled, ...window }) => window),
    slotIntervalMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minimumNoticeMin: 60,
    maximumAdvanceDays: 90,
    customerChangeNoticeHours: 24,
    blackouts: [],
  };
}

export async function getAvailabilitySettings(): Promise<AvailabilitySettings> {
  if (dataSource === "api") {
    return mapAvailability(await apiRequest<AvailabilityResponseDto>("/availability"));
  }
  await sleep(60);
  return mockAvailability();
}

export async function updateAvailabilitySettings(
  input: AvailabilitySettings,
): Promise<AvailabilitySettings> {
  if (dataSource === "api") {
    clearWorkspaceCache();
    return mapAvailability(
      await apiRequest<AvailabilityResponseDto, AvailabilityUpdateDto>(
        "/availability",
        { method: "PUT", body: availabilityPayload(input), csrf: true, expectedVersion: input.version },
      ),
    );
  }
  await sleep(120);
  const windowsByDay = new Map(input.weeklyHours.map((window) => [window.dayOfWeek, window]));
  mock = {
    ...mock,
    calendar: {
      ...mock.calendar,
      workingHours: mock.calendar.workingHours.map((day, index) => {
        const window = windowsByDay.get(index + 1);
        return window
          ? { ...day, enabled: true, start: window.startLocal, end: window.endLocal }
          : { ...day, enabled: false };
      }),
    },
  };
  return mockAvailability();
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Expands API weekly windows into the per-day rows `WorkingHoursForm` edits. */
export function availabilityToWorkingDays(availability: AvailabilitySettings): WorkingDay[] {
  const days: WorkingDay[] = [];
  WEEKDAY_LABELS.forEach((day, index) => {
    const dayOfWeek = index + 1;
    const windows = availability.weeklyHours.filter((window) => window.dayOfWeek === dayOfWeek);
    if (windows.length === 0) {
      days.push({ day, dayOfWeek, enabled: false, start: "09:00", end: "17:00" });
      return;
    }
    days.push(
      ...windows.map((window) => ({
        day,
        dayOfWeek,
        enabled: true,
        start: window.startLocal,
        end: window.endLocal,
      })),
    );
  });
  return days;
}

/** Inverse of `availabilityToWorkingDays`: enabled rows become API weekly windows. */
export function workingDaysToWeeklyHours(days: WorkingDay[]): AvailabilityWindow[] {
  return days
    .filter((day) => day.enabled)
    .map((day) => ({
      dayOfWeek: day.dayOfWeek ?? WEEKDAY_LABELS.indexOf(day.day) + 1,
      startLocal: day.start,
      endLocal: day.end,
    }));
}

export async function getSettings(): Promise<SettingsData> {
  if (dataSource === "api") {
    const workspace = await getPublicBookingWorkspace();
    return {
      branding: workspace.branding ?? {accent: "#3d5a3d", fontFamily: "serif"},
      business: {name: workspace.displayName, displayName: workspace.displayName,
        bio: workspace.bio, email: workspace.email, phone: "", address: workspace.address,
        bookingPageUrl: workspace.slug, bookingPageEnabled: true,
        showPlatformBranding: workspace.showPlatformBranding, locations: []},
      payments: {processors: [], taxRate: 0, vatNumber: "",
        manualPaymentEnabled: workspace.manualPaymentEnabled,
        manualPaymentInstructions: workspace.manualPaymentInstructions,
        defaultPaymentMethods: ["manual"],
        bookingTerms: {enabled: workspace.bookingTermsEnabled, content: workspace.bookingTermsContent}},
      calendar: {connections: [], workingHours: [], defaultMeetingProvider: "in-person"},
      emails: {notifyAdmin: {newBooking: false, cancellation: false, reschedule: false},
        notifyClients: {confirmation: true, reminder: true, followUp: false}, fromAddress: ""},
      account: {email: "", twoFactorEnabled: false, workspaceName: ""},
    };
  }
  await sleep(60);
  return mock;
}

export async function updateSettings(
  patch: Partial<SettingsData>,
): Promise<SettingsData> {
  if (dataSource !== "mock") throw new NotImplementedError("updateSettings");
  await sleep(120);
  mock = { ...mock, ...patch } as SettingsData;
  return mock;
}

function mapPaymentSettings(item: PaymentResponseDto): PaymentSettings {
  return {
    version: item.version,
    manualPaymentEnabled: item.manualPaymentEnabled,
    manualPaymentInstructions: item.manualPaymentInstructions,
    bookingTermsEnabled: item.bookingTermsEnabled,
    bookingTermsContent: item.bookingTermsContent,
    taxTreatment: item.taxTreatment,
    taxRateBps: item.taxRateBps,
    taxLabel: item.taxLabel,
    taxJurisdiction: item.taxJurisdiction ?? "",
    sellerTaxNumber: item.sellerTaxNumber ?? "",
  };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  if (dataSource === "mock") {
    return {
      manualPaymentEnabled: mock.payments.manualPaymentEnabled,
      manualPaymentInstructions: mock.payments.manualPaymentInstructions,
      bookingTermsEnabled: mock.payments.bookingTerms.enabled,
      bookingTermsContent: mock.payments.bookingTerms.content,
      taxTreatment: mock.payments.taxRate > 0 ? "fixed" : "none",
      taxRateBps: Math.round(mock.payments.taxRate * 100),
      taxLabel: "Tax",
      taxJurisdiction: "",
      sellerTaxNumber: mock.payments.vatNumber,
    };
  }
  return mapPaymentSettings(
    await apiRequest<PaymentResponseDto>("/settings/payments"),
  );
}

export async function updatePaymentSettings(
  input: PaymentSettings,
): Promise<PaymentSettings> {
  if (dataSource === "mock") throw new NotImplementedError("updatePaymentSettings");
  const payload: PaymentPatchDto = {
    manualPaymentEnabled: input.manualPaymentEnabled,
    manualPaymentInstructions: input.manualPaymentInstructions,
    bookingTermsEnabled: input.bookingTermsEnabled,
    bookingTermsContent: input.bookingTermsContent,
    taxTreatment: input.taxTreatment,
    taxRateBps: input.taxTreatment === "none" ? 0 : input.taxRateBps,
    taxLabel: input.taxLabel,
    taxJurisdiction: input.taxJurisdiction || null,
    sellerTaxNumber: input.sellerTaxNumber || null,
  };
  return mapPaymentSettings(
    await apiRequest<PaymentResponseDto, PaymentPatchDto>("/settings/payments", {
      method: "PATCH",
      expectedVersion: input.version,
      body: payload,
      csrf: true,
    }),
  );
}

/** Marks onboarding finished (Done or Skip). One-way: there is no way to reopen it. */
export async function completeOnboarding(): Promise<void> {
  if (dataSource === "mock") return;
  const current = await getBusinessSettings();
  await apiRequest<BusinessResponseDto, BusinessPatchDto>("/settings/business", {
    expectedVersion: current.version,
    method: "PATCH",
    body: { onboardingCompleted: true },
    csrf: true,
  });
}

/** Memoises a load for the session; a failed load is retried, `clear` drops it. */
/** Shared query ownership replaces the previous indefinitely memoized promises. */
export function clearWorkspaceCache(): void {
  updateVerifiedMetadata({currency: undefined, timezone: undefined});
  queryClient().removeQueries({predicate: (query) => typeof query.queryKey[2] === "string" &&
    /^\/(settings|availability)(?:[/?]|$)/.test(query.queryKey[2])});
}

/** The workspace's client-payment currency; services and bookings inherit it. */
export async function getWorkspaceCurrency(): Promise<Currency> {
  if (dataSource === "mock") return "GBP";
  if (verifiedMetadata().currency) return verifiedMetadata().currency!;
  return apiCurrency((await apiRequest<BusinessResponseDto>("/settings/business")).currency);
}

/** The workspace's timezone; the demo shows session times as written (UTC). */
export async function getWorkspaceTimezone(): Promise<string> {
  if (dataSource === "mock") return "UTC";
  if (verifiedMetadata().timezone) return verifiedMetadata().timezone!;
  return (await apiRequest<AvailabilityResponseDto>("/availability")).timezone;
}

export async function getBusinessSettings(includeLocations = true): Promise<BusinessSettings> {
  if (dataSource === "mock") {
    await sleep(60);
    return mock.business;
  }
  const [business, locations] = await Promise.all([
    apiRequest<BusinessResponseDto>("/settings/business"),
    includeLocations ? listWorkspaceLocations() : Promise.resolve([]),
  ]);
  return mapBusiness(business, locations);
}

export async function updateBusinessSettings(
  patch: Partial<BusinessSettings>,
): Promise<BusinessSettings> {
  if (dataSource === "mock") {
    await sleep(120);
    mock = { ...mock, business: { ...mock.business, ...patch } };
    return mock.business;
  }
  clearWorkspaceCache();
  const payload: BusinessPatchDto = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.displayName !== undefined) payload.displayName = patch.displayName;
  if (patch.bio !== undefined) payload.bio = patch.bio;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.bookingPageEnabled !== undefined) {
    payload.bookingPageEnabled = patch.bookingPageEnabled;
  }
  if (patch.notifyOperator !== undefined) {
    payload.notifyOperatorNew = patch.notifyOperator.newBooking;
    payload.notifyOperatorCancelled = patch.notifyOperator.cancelled;
    payload.notifyOperatorRescheduled = patch.notifyOperator.rescheduled;
  }
  const [business, locations] = await Promise.all([
    apiRequest<BusinessResponseDto, BusinessPatchDto>("/settings/business", {
      method: "PATCH",
      expectedVersion: patch.version,
      body: payload,
      csrf: true,
    }),
    listWorkspaceLocations(),
  ]);
  return mapBusiness(business, locations);
}

export async function listWorkspaceLocations(): Promise<WorkspaceLocation[]> {
  if (dataSource === "mock") {
    await sleep(40);
    return [...mock.business.locations];
  }
  const response = await apiRequest<LocationListDto>("/settings/locations");
  return response.items.map(mapLocation);
}

export async function createWorkspaceLocation(
  input: Omit<WorkspaceLocation, "id">,
): Promise<WorkspaceLocation> {
  if (dataSource === "mock") {
    await sleep(100);
    const created = { ...input, id: makeId("loc") };
    mock = {
      ...mock,
      business: {
        ...mock.business,
        locations: [...mock.business.locations, created],
      },
    };
    return created;
  }
  const payload: LocationCreateDto = {
    label: input.label,
    address: toAddressDto(input.address),
  };
  const response = await apiRequest<LocationResponseDto, LocationCreateDto>(
    "/settings/locations",
    { method: "POST", body: payload, csrf: true },
  );
  return mapLocation(response);
}

export async function updateWorkspaceLocation(
  id: string,
  patch: Omit<WorkspaceLocation, "id">,
  expectedVersion?: number,
): Promise<WorkspaceLocation> {
  if (dataSource === "mock") {
    await sleep(100);
    const index = mock.business.locations.findIndex((item) => item.id === id);
    if (index === -1) throw new NotFoundError("location", id);
    const updated = { id, ...patch, version: nextEditVersion(mock.business.locations[index], expectedVersion) };
    const locations = [...mock.business.locations];
    locations[index] = updated;
    mock = { ...mock, business: { ...mock.business, locations } };
    return updated;
  }
  const payload: LocationPatchDto = {
    label: patch.label,
    address: toAddressDto(patch.address),
  };
  const response = await apiRequest<LocationResponseDto, LocationPatchDto>(
    `/settings/locations/${encodeURIComponent(id)}`,
    { method: "PATCH", expectedVersion, body: payload, csrf: true },
  );
  return mapLocation(response);
}

export async function deleteWorkspaceLocation(id: string, expectedVersion?: number): Promise<void> {
  if (dataSource === "mock") {
    await sleep(80);
    const before = mock.business.locations.length;
    const locations = mock.business.locations.filter((item) => item.id !== id);
    if (locations.length === before) throw new NotFoundError("location", id);
    mock = { ...mock, business: { ...mock.business, locations } };
    return;
  }
  await apiRequest<void>(`/settings/locations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    expectedVersion,
    csrf: true,
  });
}

// ── Calendar feed (Settings → Calendar, real app only) ───────────────────────────

export type CalendarFeedStatus = components["schemas"]["CalendarFeedStatus"];

export async function getCalendarFeed(): Promise<CalendarFeedStatus> {
  if (dataSource !== "api") throw new NotImplementedError("getCalendarFeed");
  return apiRequest<CalendarFeedStatus>("/settings/calendar-feed");
}

/** Creates a new subscribe link (revoking any earlier one). The URL is shown once. */
export async function createCalendarFeed(): Promise<string> {
  if (dataSource !== "api") throw new NotImplementedError("createCalendarFeed");
  const response = await apiRequest<components["schemas"]["CalendarFeedLink"]>(
    "/settings/calendar-feed",
    { method: "POST", csrf: true },
  );
  return response.url;
}

export async function revokeCalendarFeed(): Promise<void> {
  if (dataSource !== "api") throw new NotImplementedError("revokeCalendarFeed");
  await apiRequest<unknown>("/settings/calendar-feed", { method: "DELETE", csrf: true });
}

export type WorkspaceExport = components["schemas"]["WorkspaceExportResponse"];

/** Everything the workspace holds, one JSON document (Settings → Account). */
export async function exportWorkspace(): Promise<WorkspaceExport> {
  if (dataSource !== "api") throw new NotImplementedError("exportWorkspace");
  return apiRequest<WorkspaceExport>("/settings/workspace-export");
}

/**
 * Closes the workspace: the booking page goes offline, everyone is signed out, and the
 * data is deleted after the returned number of days. `confirmSlug` must match.
 */
export async function closeWorkspace(confirmSlug: string): Promise<number> {
  if (dataSource !== "api") throw new NotImplementedError("closeWorkspace");
  const response = await apiRequest<components["schemas"]["WorkspaceClosed"], components["schemas"]["WorkspaceClose"]>(
    "/settings/close-workspace",
    { method: "POST", csrf: true, body: { confirmSlug } },
  );
  // The server revoked every session of the workspace, including this one.
  clearSession();
  return response.deletedAfterDays;
}

export async function getWorkspaceLocation(id: string): Promise<WorkspaceLocation | null> {
  if (dataSource === "mock") return mock.business.locations.find((item) => item.id === id) ?? null;
  try {return mapLocation(await apiRequest<LocationResponseDto>(`/settings/locations/${encodeURIComponent(id)}`));}
  catch (error) {if (error instanceof Error && "status" in error && error.status === 404) return null; throw error;}
}
