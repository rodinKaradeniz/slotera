import type { BookingStatus, PaymentStatus, ServiceKind, Tone } from "./common";

export type KpiTrend = "up" | "down" | "flat";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: KpiTrend;
  spark: number[];
};

export type DashboardScheduleItem = {
  id: string;
  bookingId?: string;
  time: string;
  end: string;
  client: string;
  company?: string;
  service: string;
  kind: ServiceKind;
  duration: string;
  status: "next" | "done" | "past" | "upcoming";
  notes?: string;
};

export type WeekDay = {
  day: string;
  date: number;
  today?: boolean;
  bookings: Array<{
    label: string;
    kind: ServiceKind;
    done?: boolean;
    next?: boolean;
  }>;
};

export type TrendPoint = { d: number; revenue: number; bookings: number };

export type PendingAction = {
  id: string;
  tone: Tone;
  icon: string;
  label: string;
  detail: string;
  age: string;
};

export type RecentBooking = {
  id: string;
  client: string;
  company?: string;
  service: string;
  when: string;
  status: BookingStatus;
  amount: string;
  pay: PaymentStatus;
};

export type DashboardData = {
  todayISO: string;
  todaySchedule: DashboardScheduleItem[];
  weekStrip: WeekDay[];
  kpis: Kpi[];
  trend30d: TrendPoint[];
  pendingActions: PendingAction[];
  recentBookings: RecentBooking[];
};
