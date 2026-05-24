"use client";

import * as React from "react";
import type { IconName } from "@/components/ui/Icon";
import { listBookings } from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import { listServices } from "@/services/services.service";
import { listSessions } from "@/services/sessions.service";

export type SearchGroup =
  | "Bookings"
  | "Clients"
  | "Services"
  | "Sessions"
  | "Navigation";

export type SearchResult = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  href: string;
  icon: IconName;
  keywords: string;
};

const NAV_RESULTS: SearchResult[] = [
  {
    id: "nav-dashboard",
    group: "Navigation",
    title: "Dashboard",
    subtitle: "Overview, KPIs, next sessions",
    href: "/admin/dashboard",
    icon: "grid",
    keywords: "dashboard home overview kpi",
  },
  {
    id: "nav-calendar",
    group: "Navigation",
    title: "Calendar",
    subtitle: "Week and month view of sessions",
    href: "/admin/calendar",
    icon: "calendar",
    keywords: "calendar schedule week month day",
  },
  {
    id: "nav-bookings",
    group: "Navigation",
    title: "Bookings",
    subtitle: "All client reservations",
    href: "/admin/bookings",
    icon: "clipboard",
    keywords: "bookings reservations clients",
  },
  {
    id: "nav-clients",
    group: "Navigation",
    title: "Clients",
    subtitle: "Customer directory",
    href: "/admin/clients",
    icon: "users",
    keywords: "clients customers contacts",
  },
  {
    id: "nav-services",
    group: "Navigation",
    title: "Services",
    subtitle: "Templates you offer",
    href: "/admin/services",
    icon: "layers",
    keywords: "services offerings products templates",
  },
  {
    id: "nav-settings",
    group: "Navigation",
    title: "Settings",
    subtitle: "Workspace, payments, calendar, emails",
    href: "/admin/settings",
    icon: "cog",
    keywords: "settings preferences workspace",
  },
  {
    id: "nav-settings-payments",
    group: "Navigation",
    title: "Settings · Payments",
    subtitle: "Processors, tax, manual instructions",
    href: "/admin/settings?tab=payments",
    icon: "card",
    keywords: "settings payments stripe manual tax vat",
  },
  {
    id: "nav-settings-calendar",
    group: "Navigation",
    title: "Settings · Calendar",
    subtitle: "Availability and connections",
    href: "/admin/settings?tab=calendar",
    icon: "calendar",
    keywords: "settings calendar availability working hours google",
  },
  {
    id: "nav-settings-emails",
    group: "Navigation",
    title: "Settings · Emails",
    subtitle: "Notification preferences",
    href: "/admin/settings?tab=emails",
    icon: "mail",
    keywords: "settings emails notifications",
  },
  {
    id: "nav-booking-page",
    group: "Navigation",
    title: "Public booking page",
    subtitle: "Open the client-facing flow",
    href: "/booking",
    icon: "eye",
    keywords: "public booking page share link preview",
  },
];

let cache: SearchResult[] | null = null;
let inflight: Promise<SearchResult[]> | null = null;

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function buildIndex(): Promise<SearchResult[]> {
  const [bookings, clients, services, sessions] = await Promise.all([
    listBookings(),
    listClients(),
    listServices(),
    listSessions(),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const clientResults: SearchResult[] = clients.map((c) => ({
    id: `client-${c.id}`,
    group: "Clients",
    title: c.name,
    subtitle: [c.email, c.company].filter(Boolean).join(" · "),
    href: `/admin/clients/${c.id}`,
    icon: "user",
    keywords: [c.name, c.email, c.company, c.phone, c.tag]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));

  const serviceResults: SearchResult[] = services.map((s) => ({
    id: `service-${s.id}`,
    group: "Services",
    title: s.name,
    subtitle: `${s.durationMin} min${s.capacity > 1 ? ` · group of ${s.capacity}` : ""}`,
    href: `/admin/services`,
    icon: "layers",
    keywords: [s.name, s.description, s.locationType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));

  const sessionResults: SearchResult[] = sessions.map((s) => {
    const svc = serviceById.get(s.serviceId);
    const when = formatWhen(s.startISO);
    return {
      id: `session-${s.id}`,
      group: "Sessions",
      title: svc?.name ?? "Session",
      subtitle: `${when} · ${s.bookedCount}/${s.capacity} booked · ${s.status}`,
      href: `/admin/calendar`,
      icon: "calendar",
      keywords: [svc?.name, when, s.status, s.location, s.locationType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const bookingResults: SearchResult[] = bookings.map((b) => {
    const client = clientById.get(b.clientId);
    const session = sessionById.get(b.sessionId);
    const svc = session ? serviceById.get(session.serviceId) : null;
    const when = session ? formatWhen(session.startISO) : null;
    const title = client ? client.name : "Booking";
    const subtitleParts = [
      svc?.name,
      when,
      b.status,
      b.paymentStatus,
    ].filter(Boolean);
    return {
      id: `booking-${b.id}`,
      group: "Bookings",
      title,
      subtitle: subtitleParts.join(" · "),
      href: `/admin/bookings/${b.id}`,
      icon: "clipboard",
      keywords: [
        client?.name,
        client?.email,
        svc?.name,
        b.status,
        b.paymentStatus,
        when,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  return [
    ...bookingResults,
    ...clientResults,
    ...serviceResults,
    ...sessionResults,
    ...NAV_RESULTS,
  ];
}

export async function getSearchIndex(): Promise<SearchResult[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = buildIndex().then((idx) => {
      cache = idx;
      inflight = null;
      return idx;
    });
  }
  return inflight;
}

export function invalidateSearchIndex(): void {
  cache = null;
}

export function scoreResult(result: SearchResult, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const title = result.title.toLowerCase();
  const subtitle = (result.subtitle ?? "").toLowerCase();
  const keywords = result.keywords;

  if (title === q) return 1000;
  if (title.startsWith(q)) return 500;
  if (title.includes(q)) return 250;
  if (subtitle.includes(q)) return 120;
  if (keywords.includes(q)) return 80;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allMatch = tokens.every(
      (t) => title.includes(t) || keywords.includes(t),
    );
    if (allMatch) return 60;
  }
  return 0;
}

const GROUP_ORDER: SearchGroup[] = [
  "Bookings",
  "Clients",
  "Services",
  "Sessions",
  "Navigation",
];

export function groupAndRank(
  results: SearchResult[],
  query: string,
  limitPerGroup = 5,
): { group: SearchGroup; items: SearchResult[] }[] {
  const scored = results
    .map((r) => ({ r, s: scoreResult(r, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const byGroup = new Map<SearchGroup, SearchResult[]>();
  for (const { r } of scored) {
    const list = byGroup.get(r.group) ?? [];
    if (list.length < limitPerGroup) list.push(r);
    byGroup.set(r.group, list);
  }

  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    items: byGroup.get(g)!,
  }));
}

export function useSearch(query: string, limitPerGroup = 5) {
  const [index, setIndex] = React.useState<SearchResult[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getSearchIndex().then((idx) => {
      if (!cancelled) setIndex(idx);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return React.useMemo(() => {
    if (!index || !query.trim()) {
      return { loading: !index, groups: [] as ReturnType<typeof groupAndRank> };
    }
    return { loading: false, groups: groupAndRank(index, query, limitPerGroup) };
  }, [index, query, limitPerGroup]);
}
