import { mockData } from "@/services/adapters/mock-data";
import { readLang, translate, localeForLang } from "@/lib/i18n";

import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { formatMoney } from "@/lib/money";
import type { Tone } from "@/types/common";
import type { Notification, NotificationPage } from "@/types/notification";
import { apiCurrency } from "./_currency";

type NotificationListDto = components["schemas"]["NotificationListResponse"];
type NotificationDto = NotificationListDto["items"][number];

let mock: Notification[] = dataSource === "mock" ? mockData("notifications") : [] as Notification[];

const PRESENTATION: Record<
  NotificationDto["kind"],
  { icon: string; tone: Tone; title: string }
> = {
  booking_pending: {
    icon: "clock",
    tone: "warning",
    title: "Booking needs attention",
  },
  booking_confirmed: {
    icon: "check",
    tone: "accent",
    title: "New booking confirmed",
  },
  payment_pending: {
    icon: "card",
    tone: "warning",
    title: "Payment pending",
  },
  session_starting: {
    icon: "clock",
    tone: "info",
    title: "Session starts soon",
  },
  reschedule_requested: {
    icon: "refresh",
    tone: "info",
    title: "Client rescheduled",
  },
  booking_cancelled: {
    icon: "x",
    tone: "warning",
    title: "Client cancelled",
  },
  package_requested: {
    icon: "layers",
    tone: "accent",
    title: "Package requested",
  },
};

function relativeAge(occurredAt: string): string {
  const lang = readLang();
  if (lang !== "en") {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(occurredAt).getTime()) / 60000));
    return new Intl.RelativeTimeFormat(localeForLang(lang), { numeric: "auto", style: "narrow" }).format(
      -Math.floor(elapsed < 60 ? elapsed : elapsed < 1440 ? elapsed / 60 : elapsed / 1440),
      elapsed < 60 ? "minute" : elapsed < 1440 ? "hour" : "day");
  }
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(occurredAt).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(localeForLang(readLang()), {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function detailFor(notification: NotificationDto): string {
  const lang = readLang();
  switch (notification.kind) {
    case "booking_pending": {
      const gates = [
        notification.payload.approvalStatus === "pending" ? translate(lang, "notification.approval") : null,
        notification.payload.paymentStatus === "pending" ? translate(lang, "notification.payment") : null,
      ].filter(Boolean);
      return translate(lang, "notification.pending", { gates: gates.join(" + "), amount: formatMoney(notification.payload.amountCents, apiCurrency(notification.payload.currency)), time: formatDateTime(notification.payload.startsAt) });
    }
    case "booking_confirmed":
      return translate(lang, "notification.confirmed", { time: formatDateTime(notification.payload.startsAt) });
    case "payment_pending":
      return formatMoney(
        notification.payload.amountCents,
        apiCurrency(notification.payload.currency),
      );
    case "session_starting":
      return formatDateTime(notification.payload.startsAt);
    case "reschedule_requested":
      return translate(lang, "notification.now", { time: formatDateTime(notification.payload.requestedFor) });
    case "booking_cancelled":
      return translate(lang, "notification.was", { time: formatDateTime(notification.payload.startsAt) });
    case "package_requested":
      return translate(lang, "notification.package", {
        name: notification.payload.packageName,
        amount: formatMoney(notification.payload.priceCents, apiCurrency(notification.payload.currency)),
      });
  }
}

function mapNotification(notification: NotificationDto): Notification {
  const presentation = PRESENTATION[notification.kind];
  return {
    id: notification.id,
    icon: presentation.icon,
    tone: presentation.tone,
    title: translate(readLang(), `notification.${notification.kind}`),
    detail: detailFor(notification),
    age: relativeAge(notification.occurredAt),
    unread: notification.readAt === null,
    href:
      notification.kind === "package_requested"
        ? `/admin/clients/${notification.payload.clientId}`
        : notification.resourceType === "booking" && notification.resourceId
          ? `/admin/bookings/${notification.resourceId}`
          : undefined,
  };
}

/** How many recent notifications the bell's dropdown shows; the rest live on their page. */
export const NOTIFICATION_PREVIEW_COUNT = 7;

/**
 * One page of notifications, newest first. `cursor` is the `next` of the previous page;
 * the API pages by the last item's time and id, so new arrivals never shift later pages.
 */
export async function listNotificationPage(
  cursor: string | null = null,
  limit = 20,
): Promise<NotificationPage> {
  if (dataSource === "api") {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      const [before, beforeId] = cursor.split("|");
      params.set("before", before);
      params.set("beforeId", beforeId);
    }
    const page = await apiRequest<NotificationListDto>(`/notifications?${params}`);
    const last = page.items.at(-1);
    return {
      items: page.items.map(mapNotification),
      unreadCount: page.unreadCount,
      next: page.hasMore && last ? `${last.occurredAt}|${last.id}` : null,
    };
  }
  await sleep(120);
  const start = cursor ? mock.findIndex((item) => item.id === cursor) + 1 : 0;
  const items = mock.slice(start, start + limit);
  const last = items.at(-1);
  return {
    items: [...items],
    unreadCount: mock.filter((item) => item.unread).length,
    next: last && start + limit < mock.length ? last.id : null,
  };
}

export async function markAllRead(): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>("/notifications/mark-all-read", {
      method: "POST",
      csrf: true,
    });
    return;
  }
  await sleep(40);
  mock = mock.map((notification) => ({ ...notification, unread: false }));
}

export async function countUnread(): Promise<number> {
  if (dataSource === "api") {
    const response = await apiRequest<NotificationListDto>("/notifications?limit=1");
    return response.unreadCount;
  }
  await sleep(10);
  return mock.filter((notification) => notification.unread).length;
}

export async function getNotificationSummary(): Promise<{items: Notification[]; unreadCount: number; hasMore: boolean}> {
  const page = await listNotificationPage(null, NOTIFICATION_PREVIEW_COUNT);
  return { items: page.items, unreadCount: page.unreadCount, hasMore: page.next !== null };
}
