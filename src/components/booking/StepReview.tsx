"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { eur } from "@/lib/money";
import { COUNTRIES } from "./types";
import type { BookingDraft } from "./types";

type Props = {
  draft: BookingDraft;
  onEdit: (step: "service" | "time" | "details" | "billing") => void;
};

export function StepReview({ draft, onEdit }: Props) {
  const country = COUNTRIES.find((c) => c.code === draft.billing.country) ?? COUNTRIES[0];
  const subtotal = draft.service?.priceCents ?? 0;
  const tax = Math.round(subtotal * country.vat);
  const total = subtotal + tax;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <div className="flex flex-col gap-3">
        <SummaryRow
          title="Service"
          value={draft.service?.name ?? "—"}
          hint={draft.service ? `${draft.service.durationMin} min` : undefined}
          onEdit={() => onEdit("service")}
        />
        <SummaryRow
          title="When"
          value={
            draft.date && draft.time
              ? `${new Date(draft.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })} · ${draft.time}`
              : "—"
          }
          onEdit={() => onEdit("time")}
        />
        <SummaryRow
          title="Your details"
          value={`${draft.customer.firstName} ${draft.customer.lastName}`.trim() || "—"}
          hint={draft.customer.email || undefined}
          onEdit={() => onEdit("details")}
        />
        <SummaryRow
          title="Billing"
          value={`${draft.billing.street || "—"}`}
          hint={
            draft.billing.city
              ? `${draft.billing.zip} ${draft.billing.city} · ${country.name}`
              : country.name
          }
          onEdit={() => onEdit("billing")}
        />
      </div>

      <Card padded>
        <div className="eyebrow mb-4">Order summary</div>
        <Row label="Subtotal" value={subtotal === 0 ? "Free" : eur(subtotal)} />
        <Row
          label={`${country.vatLabel} (${(country.vat * 100).toFixed(0)}%)`}
          value={tax === 0 ? "—" : eur(tax)}
        />
        <div className="border-t border-line-soft my-4" />
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-ink-2">Total</span>
          <span
            className="font-serif text-ink"
            style={{ fontSize: 24, fontWeight: 400 }}
          >
            {total === 0 ? "Free" : eur(total)}
          </span>
        </div>
        <div className="flex items-start gap-2 mt-4 text-micro">
          <Icon name="shield" size={12} /> You won&apos;t be charged until you confirm in the next step.
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-[14px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function SummaryRow({
  title,
  value,
  hint,
  onEdit,
}: {
  title: string;
  value: string;
  hint?: string;
  onEdit: () => void;
}) {
  return (
    <Card padded={false} className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-micro">{title}</div>
        <div className="text-[15px] text-ink mt-1 truncate">{value}</div>
        {hint && <div className="text-small mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-[13px] text-ink-3 hover:text-ink inline-flex items-center gap-1"
      >
        <Icon name="edit" size={13} /> Edit
      </button>
    </Card>
  );
}
