import { publishClientLifecycle } from "@/lib/client-lifecycle";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { Lang } from "@/lib/i18n";

export type ClientIdentity = components["schemas"]["ClientIdentity"];
export type ClientBookingPage = components["schemas"]["ClientBookings"];
const options = { authKind: "client" as const, cache: false };
export function requestClientSignIn(
  slug: string,
  email: string,
  language: Lang,
) {
  return apiRequest(
    `/public/workspaces/${encodeURIComponent(slug)}/client-sign-in`,
    {
      ...options,
      method: "POST",
      body: { email, language },
    },
  );
}
export async function consumeClientSignIn(token: string) {
  const identity = await apiRequest<ClientIdentity, { token: string }>(
    "/client/auth/consume",
    {
      ...options,
      method: "POST",
      body: { token },
    },
  );
  publishClientLifecycle();
  return identity;
}
export function getClientSession(signal?: AbortSignal) {
  return apiRequest<ClientIdentity>("/client/auth/session", {
    ...options,
    signal,
  });
}
export async function logoutClient() {
  await apiRequest<void>("/client/auth/logout", {
    ...options,
    method: "POST",
    csrf: true,
  });
  publishClientLifecycle();
}
export function updateClientPreferences(
  body: components["schemas"]["ClientPreference"],
) {
  return apiRequest<ClientIdentity, typeof body>("/client/preferences", {
    ...options,
    method: "PATCH",
    csrf: true,
    body,
  });
}
export function listClientBookings(offset = 0, signal?: AbortSignal) {
  return apiRequest<ClientBookingPage>(
    `/client/bookings?limit=25&offset=${offset}`,
    { ...options, signal },
  );
}
export function clientManagementAccess(bookingId: string) {
  return apiRequest<components["schemas"]["ManagementAccess"]>(
    `/client/bookings/${encodeURIComponent(bookingId)}/management-access`,
    { ...options, method: "POST", csrf: true },
  );
}
