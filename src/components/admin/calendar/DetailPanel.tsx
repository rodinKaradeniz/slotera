"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { CardHead } from "@/components/shared/CardHead";
import { DetailLine } from "@/components/shared/DetailLine";
import { fmtDate } from "@/lib/time";
import { SERVICE_STYLE, LOC_TYPE_META } from "@/lib/status-maps";
import type { CalEvent } from "./EventBlock";

type Props = {
  event: CalEvent;
  onEdit: () => void;
  onClose: () => void;
};

export function DetailPanel({ event, onEdit, onClose }: Props) {
  const s = event.session;
  const service = event.service;
  const style = service ? SERVICE_STYLE[service.kind] : null;
  const loc = LOC_TYPE_META[s.locationType];
  const start = new Date(s.startISO);

  return (
    <Card padded={false}>
      <CardHead
        title="Session details"
        right={
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink text-[13px]"
          >
            Close
          </button>
        }
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div
            className="font-serif text-ink"
            style={{ fontSize: 22, fontWeight: 400 }}
          >
            {service?.name ?? "Session"}
          </div>
          {style && (
            <span
              className="px-2 py-0.5 rounded-md text-[12px]"
              style={{ background: style.bg, color: style.fg }}
            >
              {style.label}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Pill tone={s.status === "scheduled" ? "accent" : "neutral"}>
            {s.status}
          </Pill>
          {s.capacity === 1 ? (
            <Pill tone="neutral">1:1</Pill>
          ) : (
            <Pill tone="neutral">
              {s.bookedCount} / {s.capacity} booked
            </Pill>
          )}
        </div>
        <DetailLine
          icon="calendar"
          label="When"
          value={`${fmtDate(start)} · ${s.startISO.slice(11, 16)} – ${s.endISO.slice(11, 16)}`}
        />
        <DetailLine icon={loc.icon} label="Location" value={`${loc.label} · ${s.location}`} />
        <DetailLine
          icon="repeat"
          label="Recurrence"
          value={s.recurring === "one-off" ? "One-off" : s.recurring}
        />
        {s.notes && (
          <DetailLine icon="file" label="Notes" value={s.notes} />
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          <Button variant="primary" size="sm" icon="edit" onClick={onEdit}>
            Edit session
          </Button>
          <Button variant="secondary" size="sm" icon="copy">
            Copy link
          </Button>
        </div>
      </div>
    </Card>
  );
}
