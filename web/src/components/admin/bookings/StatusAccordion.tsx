"use client";

import * as React from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { BOOKING_STATUS } from "@/lib/status-maps";
import type { BookingStatus, Tone } from "@/types/common";
import type { BookingRowData } from "./BookingRow";
import { BookingRow } from "./BookingRow";

type Props = {
  status: BookingStatus;
  rows: BookingRowData[];
  defaultOpen?: boolean;
  onRowClick: (row: BookingRowData) => void;
};

const PAGE = 6;
const PREVIEW = 2;

const TONE_DOT: Record<Tone, string> = {
  warning: "var(--warning)",
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--ink-4)",
  ink: "var(--ink)",
};

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

export function StatusAccordion({ status, rows, defaultOpen, onRowClick }: Props) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [shown, setShown] = React.useState(PAGE);
  const meta = BOOKING_STATUS[status];
  const dotColor = TONE_DOT[meta.tone];
  const preview = rows.slice(0, PREVIEW);
  const overflow = Math.max(0, rows.length - PREVIEW);

  return (
    <AccordionItem
      open={open}
      onToggle={() => setOpen((v) => !v)}
      header={
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: dotColor }}
          />
          <span className="text-[15px] font-semibold text-ink">{meta.label}</span>
          <span
            className="font-serif text-ink"
            style={{ fontSize: 20, fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {rows.length}
          </span>
          {!open && preview.length > 0 && (
            <span className="text-small text-ink-3 truncate hidden sm:inline">
              {preview.map((p) => `${firstName(p.clientName)} ${p.time}`).join(" · ")}
              {overflow > 0 && ` · +${overflow} more`}
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
