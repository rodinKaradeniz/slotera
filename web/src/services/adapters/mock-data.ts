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
  "client-notes": clientNotesJson,
  notifications: notificationsJson,
  services: servicesJson,
};
export function mockData<T>(name: string): T {
  if (!(name in fixtures)) throw new Error("Unknown demo fixture");
  return structuredClone(fixtures[name]) as T;
}
