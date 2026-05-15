import * as React from "react";
import { Pill } from "@/components/ui/Pill";
import {
  BOOKING_STATUS,
  CLIENT_TAGS,
  PAY_STATUS,
} from "@/lib/status-maps";
import type {
  BookingStatus,
  ClientTag,
  PaymentStatus,
} from "@/types/common";

type Props =
  | { kind: "booking"; status: BookingStatus }
  | { kind: "payment"; status: PaymentStatus }
  | { kind: "client"; status: ClientTag };

export function StatusBadge(props: Props) {
  const meta =
    props.kind === "booking"
      ? BOOKING_STATUS[props.status]
      : props.kind === "payment"
        ? PAY_STATUS[props.status]
        : CLIENT_TAGS[props.status];
  return (
    <Pill tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Pill>
  );
}
