"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PublicNav } from "@/components/layout/PublicNav";
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
import {
  StepForms,
  areRequiredFormsComplete,
} from "@/components/booking/StepForms";
import { BookingsPausedCard } from "@/components/booking/BookingsPausedCard";
import { EMPTY_DRAFT, type BookingDraft } from "@/components/booking/types";
import { getSettings } from "@/services/settings.service";
import { listFormsForService, saveFormResponse } from "@/services/forms.service";
import { getPersonaSync } from "@/services/demo.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { SettingsData } from "@/types/settings";
import type { FormTemplate } from "@/types/form";
import type { DemoPersona } from "@/types/demo";

const DRAFT_KEY = "slotera.booking.draft";

export default function BookingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = React.useState<StepKey>("service");
  const [draft, setDraft] = React.useState<BookingDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [forms, setForms] = React.useState<FormTemplate[]>([]);
  const [persona, setPersona] = React.useState<DemoPersona | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // `?demo=<slug>` applies a lightweight persona override (provider name +
  // intro copy + which seeded services show). Read client-side to avoid a
  // useSearchParams Suspense boundary, matching the sessionStorage effects.
  React.useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("demo");
    setPersona(getPersonaSync(slug));
  }, []);

  // Active forms attached to the chosen service decide whether the conditional
  // Forms step appears. Refetch whenever the selected service changes.
  const serviceId = draft.service?.id ?? null;
  React.useEffect(() => {
    if (!serviceId) {
      setForms([]);
      return;
    }
    let cancelled = false;
    listFormsForService(serviceId).then((f) => {
      if (!cancelled) setForms(f);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  // Drop the Forms step when the chosen service has no attached forms.
  const activeSteps = React.useMemo(
    () => STEPS.filter((s) => s.key !== "forms" || forms.length > 0),
    [forms.length],
  );

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BookingDraft>;
        setDraft({
          ...EMPTY_DRAFT,
          ...parsed,
          formResponses: parsed.formResponses ?? {},
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

  const idx = activeSteps.findIndex((s) => s.key === step);

  // If the active step list changes out from under us (e.g. the Forms step
  // disappears), snap back to a valid step rather than rendering nothing.
  React.useEffect(() => {
    if (idx === -1) setStep("details");
  }, [idx]);

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
      case "forms":
        return areRequiredFormsComplete(forms, draft.formResponses);
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
    if (idx <= 0) return;
    setStep(activeSteps[idx - 1].key);
    setError(null);
  };

  const next = () => {
    if (!canAdvance) return;
    if (step === "pay") {
      submit();
      return;
    }
    setStep(activeSteps[idx + 1].key);
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
    // Best-effort mock persistence of form answers against the booking ref.
    try {
      await Promise.all(
        forms.map((form) =>
          saveFormResponse({
            bookingId: ref,
            formTemplateId: form.id,
            answers: draft.formResponses[form.id] ?? [],
          }),
        ),
      );
    } catch {
      // ignore — mock only
    }
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
        <PublicNav />
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
        <PublicNav />
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-16 pb-10">
          <BookingsPausedCard displayName={settings.business.displayName} />
        </main>
        <BookingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-10 pb-10">
        {persona && (
          <p className="text-small text-ink-2 text-center mb-6 max-w-xl mx-auto">
            {persona.intro}
          </p>
        )}
        <div className="mb-10 px-2 sm:px-6">
          <StepIndicator
            current={step}
            steps={activeSteps.map((s) => ({
              key: s.key,
              label: t(`booking.step.${s.key}`),
            }))}
          />
        </div>

        <div className="fade-in flex flex-col min-h-[clamp(420px,60vh,640px)] [&>*]:flex-1">
          {step === "service" && (
            <StepService
              selected={draft.service}
              onSelect={(s) => setDraft({ ...draft, service: s })}
              persona={persona}
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
                providerBookingTerms={settings?.payments.bookingTerms}
              />
            </Card>
          )}
          {step === "forms" && (
            <StepForms
              forms={forms}
              responses={draft.formResponses}
              onChange={(formResponses) => setDraft({ ...draft, formResponses })}
            />
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
            {t("booking.back")}
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
                ? t("booking.reservePay")
                : draft.service?.priceCents
                  ? t("booking.payConfirm")
                  : t("booking.confirm")
              : t("booking.continue")}
          </Button>
        </div>
      </main>
      <BookingFooter />
    </div>
  );
}
