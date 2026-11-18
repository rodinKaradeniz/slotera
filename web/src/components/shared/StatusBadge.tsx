"use client";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";
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
  const { lang: labelLang } = useI18n();
  // A status that changes while on screen (approved, marked paid) swells once.
  const [prev, setPrev] = React.useState(props.status);
  const [changed, setChanged] = React.useState(false);
  if (props.status !== prev) {
    setPrev(props.status);
    setChanged(true);
  }
  const meta =
    props.kind === "booking"
      ? BOOKING_STATUS[props.status]
      : props.kind === "payment"
        ? PAY_STATUS[props.status]
        : CLIENT_TAGS[props.status];
  return (
    <Pill key={props.status} tone={meta.tone} icon={meta.icon} className={changed ? "swell" : undefined}>
      {translateInterfaceLabel(labelLang, meta.label)}
    </Pill>
  );
}
