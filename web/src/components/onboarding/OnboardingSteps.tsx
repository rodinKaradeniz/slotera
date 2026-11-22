"use client";

/** The onboarding wizard's step header, indicator, panes and footer. */

import { useI18n } from "@/components/i18n/I18nProvider";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  ManualPaymentForm,
  type ManualPaymentValue,
} from "@/components/shared/forms/ManualPaymentForm";
import { cn } from "@/lib/cn";

type StepKey = "intro" | "service" | "availability" | "payments" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "intro", label: "Welcome" },
  { key: "service", label: "Service" },
  { key: "availability", label: "Availability" },
  { key: "payments", label: "Payments" },
  { key: "done", label: "Done" },
];

export function StepHeader({
  step,
  operatorName,
}: {
  step: number;
  operatorName: string;
}) {
  const { t: uiText } = useI18n();
  const meta = STEP_COPY[step];
  return (
    <div className="flex flex-col gap-1">
      <div className="eyebrow">{uiText("ui.welcome")}{" "}{operatorName}</div>
      <h1 className="text-h2 text-ink">{meta.title}</h1>
      <p className="text-body text-ink-3 mt-1">{meta.subtitle}</p>
    </div>
  );
}

const STEP_COPY: { title: string; subtitle: string }[] = [
  {
    title: "Let's get you onboarded",
    subtitle:
      "Three quick steps and you'll have a workspace ready to take bookings.",
  },
  {
    title: "Create your first service",
    subtitle:
      "What do clients book from you? You can add more later. This is just the starting point.",
  },
  {
    title: "Set your availability",
    subtitle:
      "Tell Slotera which days and hours you're open. Group sessions and special dates can be scheduled separately.",
  },
  {
    title: "Set up payments",
    subtitle:
      "Stripe takes cards. Manual payment shows clients custom instructions (bank transfer, Interac).",
  },
  {
    title: "You're all set",
    subtitle: "Your workspace is ready. Share your booking page when you'd like.",
  },
];

export function StepIndicator({ step }: { step: number }) {
  // The intro and done panels live outside the 3-step "work" progress.
  if (step === 0 || step === 4) return null;
  const workSteps = STEPS.slice(1, 4); // service, availability, payments
  const activeIdx = step - 1; // 0..2
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {workSteps.map((s, i) => {
          const completed = i < activeIdx;
          const active = i === activeIdx;
          return (
            <React.Fragment key={s.key}>
              <span
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono transition-colors",
                  completed
                    ? "bg-accent text-white"
                    : active
                      ? "bg-ink text-paper"
                      : "bg-paper-2 text-ink-3 border border-line",
                )}
              >
                {completed ? <Icon name="check" size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              {i < workSteps.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1",
                    completed ? "bg-accent" : "bg-line",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-micro">
        {workSteps.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── individual panes ────────────────────────────────────────────────────── */

export function IntroPane({ operatorName }: { operatorName: string }) {
  const { t: uiText } = useI18n();
  const items: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "layers",
      title: uiText("ui.create.your.first.service"),
      body: "Set its duration, price, capacity, and where it happens.",
    },
    {
      icon: "calendar",
      title: uiText("ui.set.your.availability"),
      body: "Pick which days and hours clients can book.",
    },
    {
      icon: "card",
      title: uiText("ui.set.up.payments"),
      body: "Manual bank-transfer instructions, or skip it if your services are free.",
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-2 max-w-xl">
        Hi {operatorName}.{" "}{uiText("ui.here.s.what.we.ll.do.together.you.can.skip.at.any.time.and.come.back.later.from.the.dashbo")}</p>
      <ol className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li
            key={it.title}
            className="flex items-start gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3"
          >
            <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Icon name={it.icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink">
                <span className="text-ink-3 mr-1.5">{i + 1}.</span>
                {it.title}
              </div>
              <p className="text-small mt-0.5">{it.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PaymentsPane({
  value,
  onChange,
  disabled,
}: {
  value: ManualPaymentValue;
  onChange: (next: ManualPaymentValue) => void;
  disabled?: boolean;
}) {
  const { t: uiText } = useI18n();
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
            <Icon name="wallet" size={16} />
          </span>
          <span className="text-[15px] font-medium text-ink">{uiText("ui.manual.payment")}</span>
        </div>
        <p className="text-small mb-4">
          {uiText("ui.show.clients.custom.instructions.bank.transfer.interac.etc.at.checkout.bookings.stay.pendi")}</p>
        <ManualPaymentForm value={value} onChange={onChange} disabled={disabled} />
      </div>
      <div className="flex items-start gap-2 rounded-md border border-line-soft bg-paper-2 px-3 py-2 text-small text-ink-2">
        <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
        <span>
          {uiText("ui.card.payments.are.coming.soon.you.ll.be.able.to.connect.them.from.settings.client.payments")}</span>
      </div>
    </div>
  );
}

export function DonePane({ bookingSlug }: { bookingSlug: string }) {
  const { t: uiText } = useI18n();
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <span className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
        <Icon name="check" size={24} strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-2 max-w-md">
        <h2
          className="font-serif text-ink"
          style={{ fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          {uiText("ui.your.workspace.is.ready")}</h2>
        <p className="text-body text-ink-3">
          {uiText("ui.you.can.share.your.booking.page.now.or.come.back.to.refine.your.services.hours.and.payment")}</p>
      </div>
      <Link href={`/book/${bookingSlug}`} target="_blank" rel="noreferrer">
        <Button variant="secondary" size="md" icon="eye">
          {uiText("ui.preview.your.booking.page")}</Button>
      </Link>
    </div>
  );
}

/* ── footer actions ─────────────────────────────────────────────────────── */

export function StepFooter({
  step,
  busy,
  onBack,
  onNextFromIntro,
  onSaveService,
  onSaveAvailability,
  onSavePayments,
  onFinish,
}: {
  step: number;
  busy: boolean;
  onBack: () => void;
  onNextFromIntro: () => void;
  onSaveService: () => void;
  onSaveAvailability: () => void;
  onSavePayments: () => void;
  onFinish: () => void;
}) {
  const { t: uiText } = useI18n();
  const showBack = step > 0 && step < 4;
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-line-soft">
      {showBack ? (
        <Button variant="ghost" icon="arrow-left" onClick={onBack} disabled={busy}>
          {uiText("ui.back")}</Button>
      ) : (
        <span />
      )}
      {step === 0 && (
        <Button variant="primary" iconRight="arrow-right" onClick={onNextFromIntro}>
          {uiText("ui.get.started")}</Button>
      )}
      {step === 1 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSaveService}
        >
          {uiText("ui.add.and.continue")}</Button>
      )}
      {step === 2 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSaveAvailability}
        >
          {uiText("ui.save.availability.continue")}</Button>
      )}
      {step === 3 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSavePayments}
        >
          {uiText("ui.save.continue")}</Button>
      )}
      {step === 4 && (
        <Button variant="primary" iconRight="arrow-right" onClick={onFinish}>
          {uiText("ui.go.to.dashboard")}</Button>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

export function resumeStep(
  serviceDone: boolean,
  availabilityDone: boolean,
  paymentsDone: boolean,
): number {
  if (!serviceDone && !availabilityDone && !paymentsDone) return 0;
  if (!serviceDone) return 1;
  if (!availabilityDone) return 2;
  if (!paymentsDone) return 3;
  return 4;
}
