import notificationsJson from "@/data/mock/notifications.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { formatMoney } from "@/lib/money";
import type { Currency, Tone } from "@/types/common";
import type { Notification } from "@/types/notification";
import { ApiRequestError } from "./_errors";

type NotificationListDto = components["schemas"]["NotificationListResponse"];
type NotificationDto = NotificationListDto["items"][number];

let mock: Notification[] = JSON.parse(
  JSON.stringify(notificationsJson),
) as Notification[];

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
    title: "Client requested reschedule",
  },
};

function relativeAge(occurredAt: string): string {
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationCurrency(value: string): Currency {
  if ((["EUR", "USD", "GBP"] as string[]).includes(value)) return value as Currency;
  throw new ApiRequestError(
    200,
    "unsupported_currency",
    `The API returned unsupported currency ${value}.`,
  );
}

function detailFor(notification: NotificationDto): string {
  switch (notification.kind) {
    case "booking_pending": {
      const gates = [
        notification.payload.approvalStatus === "pending" ? "approval" : null,
        notification.payload.paymentStatus === "pending" ? "payment" : null,
      ].filter(Boolean);
      return `${gates.join(" + ")} pending · ${formatMoney(notification.payload.amountCents, notificationCurrency(notification.payload.currency))} · ${formatDateTime(notification.payload.startsAt)}`;
    }
    case "booking_confirmed":
      return `Confirmed for ${formatDateTime(notification.payload.startsAt)}`;
    case "payment_pending":
      return formatMoney(
        notification.payload.amountCents,
        notificationCurrency(notification.payload.currency),
      );
    case "session_starting":
      return formatDateTime(notification.payload.startsAt);
    case "reschedule_requested":
      return formatDateTime(notification.payload.requestedFor);
  }
}

function mapNotification(notification: NotificationDto): Notification {
  const presentation = PRESENTATION[notification.kind];
  return {
    id: notification.id,
    icon: presentation.icon,
    tone: presentation.tone,
    title: presentation.title,
    detail: detailFor(notification),
    age: relativeAge(notification.occurredAt),
    unread: notification.readAt === null,
  };
}

export async function listNotifications(): Promise<Notification[]> {
  if (dataSource === "api") {
    const response = await apiRequest<NotificationListDto>("/notifications");
    return response.items.map(mapNotification);
  }
  await sleep(40);
  return [...mock];
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
