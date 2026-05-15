"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { eur } from "@/lib/money";
import type { Booking } from "@/types/booking";

export type BookingRowData = {
  id: string;
  booking: Booking;
  clientName: string;
  clientCompany?: string;
  serviceName: string;
  when: string;
};

type Props = { row: BookingRowData; onClick: () => void };

export function BookingRow({ row, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full grid grid-cols-[auto_2fr_2fr_1fr_auto_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm text-left"
    >
      <Avatar name={row.clientName} size={32} />
      <div className="min-w-0">
        <div className="text-[14px] text-ink truncate">{row.clientName}</div>
        {row.clientCompany && (
          <div className="text-micro truncate">{row.clientCompany}</div>
        )}
      </div>
      <div className="text-[14px] text-ink-2 truncate">{row.serviceName}</div>
      <div className="text-small whitespace-nowrap">{row.when}</div>
      <StatusBadge kind="payment" status={row.booking.paymentStatus} />
      <div className="text-[14px] font-medium text-ink whitespace-nowrap">
        {row.booking.amountCents === 0
          ? "Free"
          : eur(row.booking.amountCents)}
      </div>
    </button>
  );
}
