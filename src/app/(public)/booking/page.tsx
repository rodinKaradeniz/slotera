"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookingTopBar } from "@/components/layout/BookingTopBar";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { StepIndicator, STEPS, type StepKey } from "@/components/layout/StepIndicator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepService } from "@/components/booking/StepService";
import { StepDateTime } from "@/components/booking/StepDateTime";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepBilling } from "@/components/booking/StepBilling";
import { StepReview } from "@/components/booking/StepReview";
import { StepPayment } from "@/components/booking/StepPayment";
import { BookingsPausedCard } from "@/components/booking/BookingsPausedCard";
import { EMPTY_DRAFT, type BookingDraft } from "@/components/booking/types";
import { getSettings } from "@/services/settings.service";
import type { SettingsData } from "@/types/settings";

const DRAFT_KEY = "slotera.booking.draft";

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<StepKey>("service");
  const [draft, setDraft] = React.useState<BookingDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BookingDraft>;
        setDraft({
          ...EMPTY_DRAFT,
          ...parsed,
          customer: { ...EMPTY_DRAFT.customer, ...(parsed.customer ?? {}) },
          billing: { ...EMPTY_DRAFT.billing, ...(parsed.billing ?? {}) },
          payment: { ...EMPTY_DRAFT.payment, ...(parsed.payment ?? {}) },
        });
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  const idx = STEPS.findIndex((s) => s.key === step);

  const canAdvance = (() => {
    switch (step) {
      case "service":
        return !!draft.service;
      case "time":
        return !!draft.date && !!draft.time;
      case "details":
        return (
          draft.customer.firstName.trim() &&
          draft.customer.lastName.trim() &&
          draft.customer.email.trim() &&
          draft.customer.consent
        );
      case "billing":
        return (
          draft.billing.street.trim() &&
          draft.billing.zip.trim() &&
          draft.billing.city.trim()
        );
      case "review":
        return true;
      case "pay":
        return (
          (draft.payment.method !== "card") ||
          (draft.payment.cardNumber.replace(/\s/g, "").length >= 12 &&
            draft.payment.cardName.trim().length > 1)
        );
      default:
        return false;
    }
  })();

  const back = () => {
    if (idx === 0) return;
    setStep(STEPS[idx - 1].key);
    setError(null);
  };

  const next = () => {
    if (!canAdvance) return;
    if (step === "pay") {
      submit();
      return;
    }
    setStep(STEPS[idx + 1].key);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    const raw = draft.payment.cardNumber.replace(/\s/g, "");
    const failing = raw.endsWith("0002");
    setSubmitting(false);
    if (failing) {
      router.push("/booking/failure");
      return;
    }
    const ref = `SLT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    try {
      window.sessionStorage.setItem(
        "slotera.booking.last",
        JSON.stringify({ ref, draft }),
      );
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    router.push("/booking/confirmation");
  };

  // While settings are loading, render a quiet placeholder rather than the
  // stepper — otherwise the operator could see the full form for a frame
  // before the paused card replaces it.
  if (settings === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <BookingTopBar />
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-10 pb-10">
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <Skeleton h={28} />
            <Skeleton h={20} />
            <Skeleton h={20} w="60%" />
          </div>
        </main>
        <BookingFooter />
      </div>
    );
  }

  if (!settings.business.bookingPageEnabled) {
    return (
      <div className="min-h-screen flex flex-col">
        <BookingTopBar consultantName={settings.business.displayName} />
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-16 pb-10">
          <BookingsPausedCard displayName={settings.business.displayName} />
        </main>
        <BookingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BookingTopBar consultantName={settings.business.displayName} />
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-10 pb-10">
        <div className="mb-10 px-2 sm:px-6">
          <StepIndicator current={step} />
        </div>

        <div className="fade-in flex flex-col min-h-[clamp(420px,60vh,640px)] [&>*]:flex-1">
          {step === "service" && (
            <StepService
              selected={draft.service}
              onSelect={(s) => setDraft({ ...draft, service: s })}
            />
          )}
          {step === "time" && draft.service && (
            <StepDateTime
              service={draft.service}
              date={draft.date}
              time={draft.time}
              onChange={(p) => setDraft({ ...draft, ...p })}
            />
          )}
          {step === "details" && (
            <Card padded>
              <StepDetails
                customer={draft.customer}
                onChange={(customer) => setDraft({ ...draft, customer })}
              />
            </Card>
          )}
          {step === "billing" && (
            <Card padded>
              <StepBilling
                billing={draft.billing}
                onChange={(billing) => setDraft({ ...draft, billing })}
              />
            </Card>
          )}
          {step === "review" && (
            <StepReview
              draft={draft}
              onEdit={(s) => setStep(s)}
            />
          )}
          {step === "pay" && (
            <StepPayment
              draft={draft}
              payment={draft.payment}
              onChange={(payment) => setDraft({ ...draft, payment })}
            />
          )}
        </div>

        {error && (
          <div className="mt-6 text-small text-danger">{error}</div>
        )}

        <div className="flex items-center justify-between mt-10 gap-3">
          <Button
            variant="ghost"
            size="md"
            icon="arrow-left"
            onClick={back}
            disabled={idx === 0}
          >
            Back
          </Button>
          <Button
            variant="primary"
            size="md"
            iconRight={step === "pay" ? undefined : "arrow-right"}
            onClick={next}
            disabled={!canAdvance}
            loading={submitting}
          >
            {step === "pay"
              ? draft.payment.method === "manual"
                ? "Reserve and pay"
                : draft.service?.priceCents
                  ? "Pay and confirm"
                  : "Confirm booking"
              : "Continue"}
          </Button>
        </div>
      </main>
      <BookingFooter />
    </div>
  );
}
