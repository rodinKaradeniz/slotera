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

type Props = { row: BookingRowData; onClick: () => void };

export function BookingRow({ row, onClick }: Props) {
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
          <div className="text-micro truncate">{row.clientCompany}</div>
        )}
        {/* Phones: one line of context under the name instead of three columns. */}
        <div className="md:hidden text-micro truncate tabular-nums">
          {row.serviceName}, {row.when}
        </div>
      </div>
      <div className="hidden md:block text-[14px] text-ink-2 truncate">{row.serviceName}</div>
      <div className="hidden md:block text-small whitespace-nowrap tabular-nums">{row.when}</div>
      <div className="hidden md:flex justify-end">
        <StatusBadge kind="payment" status={row.booking.paymentStatus} />
      </div>
      <div className="text-[14px] font-medium text-ink whitespace-nowrap text-right tabular-nums">
        {row.booking.amountCents === 0
          ? uiText("ui.free")
          : formatMoney(row.booking.amountCents, row.booking.currency)}
      </div>
    </button>
  );
}
