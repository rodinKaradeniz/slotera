"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { gbp } from "@/lib/money";
import { COUNTRIES } from "./types";
import type { BookingDraft } from "./types";

type Props = {
  draft: BookingDraft;
  variant: "review" | "pay";
  manualInstructions?: string | null;
  reference?: string | null;
  className?: string;
};

const METHOD_LABEL: Record<BookingDraft["payment"]["method"], string> = {
  card: "Card",
  manual: "Manual payment",
};

const METHOD_ICON: Record<BookingDraft["payment"]["method"], IconName> = {
  card: "card",
  manual: "wallet",
};

export function ReceiptCard({
  draft,
  variant,
  manualInstructions,
  reference,
  className,
}: Props) {
  const country =
    COUNTRIES.find((c) => c.code === draft.billing.country) ?? COUNTRIES[0];
  const subtotal = draft.service?.priceCents ?? 0;
  const tax = Math.round(subtotal * country.vat);
  const total = subtotal + tax;
  const isFree = total === 0;

  const dateLabel =
    draft.date && draft.time
      ? `${new Date(draft.date).toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })} · ${draft.time}`
      : "—";

  const clientName =
    `${draft.customer.firstName} ${draft.customer.lastName}`.trim() || null;

  const addressLines = [
    draft.billing.street,
    draft.billing.address2,
    [draft.billing.zip, draft.billing.city].filter(Boolean).join(" "),
    [draft.billing.state, country.name].filter(Boolean).join(", "),
  ].filter((line) => line && line.trim().length > 0);

  const ref =
    reference ??
    `PREVIEW-${draft.service?.id?.slice(0, 4)?.toUpperCase() ?? "XXXX"}`;
  const today = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "relative bg-surface border border-line rounded-lg shadow-2 flex flex-col h-full overflow-hidden",
        className,
      )}
    >
      <ReceiptNotch position="top" />
      <ReceiptNotch position="bottom" />

      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">
            {variant === "pay" ? "Payment receipt" : "Order summary"}
          </div>
          <div
            className="font-serif text-ink mt-1"
            style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.1 }}
          >
            {variant === "pay" ? "Almost done" : "Review your booking"}
          </div>
        </div>
        <div className="text-right text-micro">
          <div>{today}</div>
          <div className="font-mono text-ink-3 mt-0.5">{ref}</div>
        </div>
      </div>

      <PerforationLine />

      <div className="px-6 py-5 flex flex-col gap-5">
        <ReceiptSection title="Service">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] text-ink truncate">
              {draft.service?.name ?? "—"}
            </span>
            {draft.service && (
              <span className="text-micro flex-shrink-0">
                {draft.service.durationMin} min
              </span>
            )}
          </div>
          <div className="text-small text-ink-3 mt-0.5">{dateLabel}</div>
        </ReceiptSection>

        {(clientName || draft.customer.email) && (
          <ReceiptSection title="Client">
            {clientName && (
              <div className="text-[15px] text-ink">{clientName}</div>
            )}
            {draft.customer.email && (
              <div className="text-small text-ink-3 mt-0.5">
                {draft.customer.email}
              </div>
            )}
            {draft.customer.phone && (
              <div className="text-small text-ink-3">
                {draft.customer.phone}
              </div>
            )}
          </ReceiptSection>
        )}

        {addressLines.length > 0 && (
          <ReceiptSection title="Billing address">
            <div className="text-small text-ink leading-snug">
              {addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </ReceiptSection>
        )}
      </div>

      <DashedDivider />

      <div className="px-6 py-5 flex flex-col gap-1.5">
        <Row
          label="Subtotal"
          value={subtotal === 0 ? "Free" : gbp(subtotal)}
        />
        <Row
          label={`${country.vatLabel} (${Math.round(country.vat * 100)}%)`}
          value={tax === 0 ? "—" : gbp(tax)}
        />
      </div>

      <DashedDivider />

      <div className="px-6 py-5 flex items-baseline justify-between">
        <span className="text-small text-ink-2 uppercase tracking-wider">
          Total
        </span>
        <span
          className="font-serif text-ink"
          style={{ fontSize: 28, fontWeight: 400, lineHeight: 1 }}
        >
          {isFree ? "Free" : gbp(total)}
        </span>
      </div>

      <DashedDivider />

      <div className="px-6 py-5 flex flex-col gap-3">
        <ReceiptSection title="Payment method">
          <div className="flex items-center gap-2 text-[14px] text-ink">
            <Icon name={METHOD_ICON[draft.payment.method]} size={14} />
            {METHOD_LABEL[draft.payment.method]}
          </div>
        </ReceiptSection>

        {draft.payment.method === "manual" && manualInstructions && (
          <div className="rounded-md bg-paper-2 border border-line-soft px-3 py-3">
            <div className="eyebrow mb-1.5">Manual payment instructions</div>
            <p className="text-small whitespace-pre-line text-ink">
              {manualInstructions}
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto px-6 pt-3 pb-6 text-micro flex items-start gap-2">
        <Icon name="shield" size={12} className="mt-0.5 flex-shrink-0" />
        <span>
          {variant === "pay"
            ? draft.payment.method === "manual"
              ? "Manual payments require operator confirmation before your booking is final."
              : "Encrypted · PCI-DSS via Stripe (mocked)"
            : "You won't be charged until you confirm in the next step."}
        </span>
      </div>
    </div>
  );
}

function ReceiptSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow mb-1">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[14px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function DashedDivider() {
  return (
    <div
      className="h-px mx-6"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, var(--line-soft) 0 6px, transparent 6px 12px)",
      }}
    />
  );
}

function PerforationLine() {
  return (
    <div className="relative h-px">
      <div
        className="absolute inset-x-0 h-px"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--line) 0 4px, transparent 4px 8px)",
        }}
      />
    </div>
  );
}

function ReceiptNotch({ position }: { position: "top" | "bottom" }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute w-3 h-3 rounded-full bg-paper border border-line",
          position === "top" ? "-top-1.5" : "-bottom-1.5",
          "-left-1.5",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute w-3 h-3 rounded-full bg-paper border border-line",
          position === "top" ? "-top-1.5" : "-bottom-1.5",
          "-right-1.5",
        )}
      />
    </>
  );
}
