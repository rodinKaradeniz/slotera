import type { Tone } from "./common";

export type Notification = {
  id: string;
  icon: string;
  tone: Tone;
  title: string;
  detail: string;
  age: string;
  unread: boolean;
};
