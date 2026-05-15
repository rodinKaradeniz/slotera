"use client";

import * as React from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { Pill } from "@/components/ui/Pill";
import { BOOKING_STATUS } from "@/lib/status-maps";
import type { BookingStatus } from "@/types/common";
import type { BookingRowData } from "./BookingRow";
import { BookingRow } from "./BookingRow";

type Props = {
  status: BookingStatus;
  rows: BookingRowData[];
  defaultOpen?: boolean;
  onRowClick: (row: BookingRowData) => void;
};

const PAGE = 6;

export function StatusAccordion({ status, rows, defaultOpen, onRowClick }: Props) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [shown, setShown] = React.useState(PAGE);
  const meta = BOOKING_STATUS[status];
  const preview = rows.slice(0, 2);
  return (
    <AccordionItem
      open={open}
      onToggle={() => setOpen((v) => !v)}
      header={
        <div className="flex items-center gap-3">
          <Pill tone={meta.tone} icon={meta.icon}>
            {meta.label}
          </Pill>
          <span className="text-[14px] text-ink-2 font-medium">
            {rows.length}
          </span>
          {!open && preview.length > 0 && (
            <span className="text-small truncate hidden sm:inline">
              {preview.map((p) => p.clientName).join(" · ")}
            </span>
          )}
        </div>
      }
    >
      <div>
        {rows.length === 0 ? (
          <div className="px-5 py-6 text-small text-center">No bookings in this status.</div>
        ) : (
          rows.slice(0, shown).map((r) => (
            <BookingRow key={r.id} row={r} onClick={() => onRowClick(r)} />
          ))
        )}
        {rows.length > shown && (
          <div className="px-5 py-3 border-t border-line-soft text-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="text-[13px] text-ink-2 hover:text-ink underline"
            >
              Show more ({rows.length - shown} hidden)
            </button>
          </div>
        )}
      </div>
    </AccordionItem>
  );
}
