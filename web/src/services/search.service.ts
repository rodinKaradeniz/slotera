import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { WorkspaceSearchMatch } from "@/types/search";
import { listBookings } from "./bookings.service";
import { listClients } from "./clients.service";
import { listServices } from "./services.service";
import { listSessions } from "./sessions.service";

type SearchResponseDto = components["schemas"]["SearchResponse"];

function apiMatch(match: SearchResponseDto["items"][number]): WorkspaceSearchMatch {
  return {
    kind: match.kind,
    id: match.id,
    title: match.title,
    subtitle: match.subtitle ?? undefined,
    occurredAtISO: match.occurredAt ?? undefined,
    keywords: [match.title, match.subtitle].filter(Boolean).join(" ").toLowerCase(),
  };
}

async function mockMatches(): Promise<WorkspaceSearchMatch[]> {
  const [bookings, clients, services, sessions] = await Promise.all([
    listBookings(),
    listClients(),
    listServices(),
    listSessions(),
  ]);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return [
    ...bookings.map((booking) => {
      const client = clientById.get(booking.clientId);
      const session = sessionById.get(booking.sessionId);
      const service = session ? serviceById.get(session.serviceId) : undefined;
      return {
        kind: "booking" as const,
        id: booking.id,
        title: client?.name ?? "Booking",
        subtitle: [service?.name, booking.status, booking.paymentStatus]
          .filter(Boolean)
          .join(" · "),
        occurredAtISO: session?.startISO,
        keywords: [
          client?.name,
          client?.email,
          service?.name,
          booking.status,
          booking.paymentStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    }),
    ...clients.map((client) => ({
      kind: "client" as const,
      id: client.id,
      title: client.name,
      subtitle: [client.email, client.company].filter(Boolean).join(" · "),
      keywords: [client.name, client.email, client.company, client.phone, client.tag]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    })),
    ...services.map((service) => ({
      kind: "service" as const,
      id: service.id,
      title: service.name,
      subtitle: `${service.durationMin} min${service.capacity > 1 ? ` · group of ${service.capacity}` : ""}`,
      keywords: [service.name, service.description, service.locationType, service.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    })),
    ...sessions.map((session) => {
      const service = serviceById.get(session.serviceId);
      return {
        kind: "session" as const,
        id: session.id,
        title: service?.name ?? "Session",
        subtitle: `${session.bookedCount}/${session.capacity} booked · ${session.status}`,
        occurredAtISO: session.startISO,
        keywords: [
          service?.name,
          session.status,
          session.location,
          session.locationType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    }),
  ];
}

export async function getWorkspaceSearchMatches(
  query?: string,
  limitPerKind = 6,
): Promise<WorkspaceSearchMatch[]> {
  if (dataSource === "api") {
    if (!query?.trim()) return [];
    const params = new URLSearchParams({
      query: query.trim(),
      limitPerKind: String(limitPerKind),
    });
    const response = await apiRequest<SearchResponseDto>(`/search?${params}`);
    return response.items.map(apiMatch);
  }
  await sleep(60);
  return mockMatches();
}
