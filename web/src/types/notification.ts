import type { Tone } from "./common";

export type Notification = {
  id: string;
  icon: string;
  tone: Tone;
  title: string;
  detail: string;
  age: string;
  unread: boolean;
  /** Where the notification leads (the booking it is about), when there is one. */
  href?: string;
};

export type NotificationPage = {
  items: Notification[];
  unreadCount: number;
  /** Pass to the next request for the older notifications; null when there are none. */
  next: string | null;
};
