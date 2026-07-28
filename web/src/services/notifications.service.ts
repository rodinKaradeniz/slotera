import notificationsJson from "@/data/mock/notifications.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { Notification } from "@/types/notification";
import { NotImplementedError } from "./_errors";

let mock: Notification[] = JSON.parse(
  JSON.stringify(notificationsJson),
) as Notification[];

export async function listNotifications(): Promise<Notification[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listNotifications");
  await sleep(40);
  return [...mock];
}

export async function markAllRead(): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("markAllRead");
  await sleep(40);
  mock = mock.map((n) => ({ ...n, unread: false }));
}

export async function countUnread(): Promise<number> {
  await sleep(10);
  return mock.filter((n) => n.unread).length;
}
