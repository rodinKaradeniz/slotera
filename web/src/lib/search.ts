"use client";

import * as React from "react";
import type { IconName } from "@/components/ui/Icon";
import { dataSource } from "@/lib/env";
import { getWorkspaceSearchMatches } from "@/services/search.service";
import type { WorkspaceSearchMatch } from "@/types/search";

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
    subtitle: "All client bookings",
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
  const matches = await getWorkspaceSearchMatches();
  return [...matches.map(matchToResult), ...navigationResults()];
}

function matchToResult(match: WorkspaceSearchMatch): SearchResult {
  const presentation = {
    booking: { group: "Bookings" as const, href: `/admin/bookings/${match.id}`, icon: "clipboard" },
    client: { group: "Clients" as const, href: `/admin/clients/${match.id}`, icon: "user" },
    service: { group: "Services" as const, href: "/admin/services", icon: "layers" },
    session: { group: "Sessions" as const, href: "/admin/calendar", icon: "calendar" },
  }[match.kind];
  const subtitle = [
    match.occurredAtISO ? formatWhen(match.occurredAtISO) : undefined,
    match.subtitle,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: `${match.kind}-${match.id}`,
    group: presentation.group,
    title: match.title,
    subtitle: subtitle || undefined,
    href: presentation.href,
    icon: presentation.icon,
    keywords: match.keywords,
  };
}

function navigationResults(): SearchResult[] {
  if (dataSource !== "api") return NAV_RESULTS;
  return NAV_RESULTS.filter((item) =>
    [
      "nav-dashboard",
      "nav-calendar",
      "nav-bookings",
      "nav-clients",
      "nav-services",
      "nav-settings",
      "nav-settings-calendar",
    ].includes(item.id),
  );
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
  const [apiResults, setApiResults] = React.useState<SearchResult[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (dataSource === "api") return;
    let cancelled = false;
    getSearchIndex().then((idx) => {
      if (!cancelled) setIndex(idx);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (dataSource !== "api") return;
    if (!query.trim()) {
      setApiResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setApiResults(null);
    setError(null);
    getWorkspaceSearchMatches(query, limitPerGroup)
      .then((matches) => {
        if (!cancelled) {
          setApiResults([...matches.map(matchToResult), ...navigationResults()]);
        }
      })
      .catch((searchError: unknown) => {
        if (!cancelled) {
          setApiResults([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Could not search this workspace.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, limitPerGroup]);

  return React.useMemo(() => {
    if (dataSource === "api") {
      if (!query.trim()) {
        return { loading: false, error: null, groups: [] as ReturnType<typeof groupAndRank> };
      }
      return {
        loading: apiResults === null,
        error,
        groups: apiResults ? groupAndRank(apiResults, query, limitPerGroup) : [],
      };
    }
    if (!index || !query.trim()) {
      return {
        loading: !index,
        error: null,
        groups: [] as ReturnType<typeof groupAndRank>,
      };
    }
    return {
      loading: false,
      error: null,
      groups: groupAndRank(index, query, limitPerGroup),
    };
  }, [apiResults, error, index, query, limitPerGroup]);
}
