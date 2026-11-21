/** Build-selected fixture adapter: the API bundle replaces this entire module. */
import conversationMessagesJson from "@/data/mock/conversation-messages.json";
import authJson from "@/data/mock/auth.json";
import dashboardJson from "@/data/mock/dashboard.json";
import clientsJson from "@/data/mock/clients.json";
import formsJson from "@/data/mock/forms.json";
import responsesJson from "@/data/mock/form-responses.json";
import sessionsJson from "@/data/mock/sessions.json";
import actionItemsJson from "@/data/mock/session-action-items.json";
import bookingsJson from "@/data/mock/bookings.json";
import personasJson from "@/data/mock/demo-personas.json";
import settingsJson from "@/data/mock/settings.json";
import packagesJson from "@/data/mock/packages.json";
import packagePurchasesJson from "@/data/mock/package-purchases.json";
import clientNotesJson from "@/data/mock/client-notes.json";
import notificationsJson from "@/data/mock/notifications.json";
import servicesJson from "@/data/mock/services.json";
const fixtures: Record<string, unknown> = {
  "conversation-messages": conversationMessagesJson,
  auth: authJson,
  dashboard: dashboardJson,
  clients: clientsJson,
  forms: formsJson,
  "form-responses": responsesJson,
  sessions: sessionsJson,
  "session-action-items": actionItemsJson,
  bookings: bookingsJson,
  "demo-personas": personasJson,
  settings: settingsJson,
  packages: packagesJson,
  "package-purchases": packagePurchasesJson,
  "client-notes": clientNotesJson,
  notifications: notificationsJson,
  services: servicesJson,
};
// The fixtures are written as if today were 17 May 2026. Every date in them moves by the
// same whole number of days so that day lands on the real today, and the demo's calendar,
// bookings, dashboard and booking page always show a believable present.
const FIXTURE_TODAY = Date.UTC(2026, 4, 17);
const DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function demoDayOffset(now = new Date()): number {
  return Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - FIXTURE_TODAY) / DAY);
}

export function shiftDemoDates<T>(value: T, days: number): T {
  if (typeof value === "string") {
    if (DATE_ONLY.test(value)) {
      return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10) as T;
    }
    if (DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))) {
      return new Date(Date.parse(value) + days * DAY).toISOString() as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => shiftDemoDates(item, days)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftDemoDates(item, days)])) as T;
  }
  return value;
}

export function mockData<T>(name: string): T {
  if (!(name in fixtures)) throw new Error("Unknown demo fixture");
  return shiftDemoDates(structuredClone(fixtures[name]), demoDayOffset()) as T;
}
