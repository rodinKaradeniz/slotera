"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatMoney } from "@/lib/money";
import type { Booking } from "@/types/booking";

export type BookingRowData = {
  id: string;
  booking: Booking;
  clientName: string;
  clientCompany?: string;
  serviceName: string;
  when: string;
  time: string;
};

/** `groupStatus`: the status group the row sits in, so a badge that repeats it is dropped. */
type Props = { row: BookingRowData; onClick: () => void; groupStatus?: string };

export function BookingRow({ row, onClick, groupStatus }: Props) {
  const { t: uiText } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full grid grid-cols-[32px_minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_7.5rem_5.5rem] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm transition-colors duration-(--d-press) ease-out text-left"
    >
      <Avatar name={row.clientName} size={32} />
      <div className="min-w-0">
        <div className="text-[14px] text-ink truncate">{row.clientName}</div>
        {row.clientCompany && (
          <div className="hidden md:block text-micro truncate">{row.clientCompany}</div>
        )}
        {/* Phones: the service, then the date and time on a line of their own so they never cut off. */}
        <div className="md:hidden text-micro truncate">{row.serviceName}</div>
        <div className="md:hidden text-micro whitespace-nowrap tabular-nums">{row.when}</div>
      </div>
      <div className="hidden md:block text-[14px] text-ink-2 truncate">{row.serviceName}</div>
      <div className="hidden md:block text-small whitespace-nowrap tabular-nums">{row.when}</div>
      <div className="hidden md:flex justify-end">
        {row.booking.paymentStatus !== groupStatus && (
          <StatusBadge kind="payment" status={row.booking.paymentStatus} />
        )}
      </div>
      <div className="text-[14px] font-medium text-ink whitespace-nowrap text-right tabular-nums">
        {row.booking.paymentMethod === "package"
          ? uiText("booking.package.marker")
          : row.booking.amountCents === 0
            ? uiText("ui.free")
            : formatMoney(row.booking.amountCents, row.booking.currency)}
      </div>
    </button>
  );
}
